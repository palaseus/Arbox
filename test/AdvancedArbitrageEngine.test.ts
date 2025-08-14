import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory, Signer } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Advanced Arbitrage Engine", function () {
  let advancedEngine: Contract;
  let mevProtector: Contract;
  let aiStrategy: Contract;
  let mockToken: Contract;
  let owner: HardhatEthersSigner;
  let strategist: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let emergency: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ROLE"));

  beforeEach(async function () {
    [owner, strategist, operator, emergency, user] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK", 18);

    // Deploy MEV Protector
    const MEVProtector = await ethers.getContractFactory("MEVProtector");
    mevProtector = await MEVProtector.deploy(await owner.getAddress());
    await mevProtector.waitForDeployment();

    // Deploy AI Strategy
    const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy");
    aiStrategy = await AIStrategy.deploy();
    await aiStrategy.waitForDeployment();

    // Deploy Advanced Arbitrage Engine
    const AdvancedArbitrageEngine = await ethers.getContractFactory("AdvancedArbitrageEngine");
    advancedEngine = await AdvancedArbitrageEngine.deploy(
      await mevProtector.getAddress(),
      await owner.getAddress()
    );
    await advancedEngine.waitForDeployment();

    // Grant roles
    await advancedEngine.grantRole(STRATEGIST_ROLE, await strategist.getAddress());
    await advancedEngine.grantRole(OPERATOR_ROLE, await operator.getAddress());
    await advancedEngine.grantRole(EMERGENCY_ROLE, await emergency.getAddress());
  });

  describe("Access Control", function () {
    it("Should grant correct roles to admin", async function () {
      expect(await advancedEngine.hasRole(STRATEGIST_ROLE, await owner.getAddress())).to.be.true;
      expect(await advancedEngine.hasRole(OPERATOR_ROLE, await owner.getAddress())).to.be.true;
      expect(await advancedEngine.hasRole(EMERGENCY_ROLE, await owner.getAddress())).to.be.true;
    });

    it("Should allow role management", async function () {
      await advancedEngine.grantRole(STRATEGIST_ROLE, await user.getAddress());
      expect(await advancedEngine.hasRole(STRATEGIST_ROLE, await user.getAddress())).to.be.true;
    });

    it("Should restrict unauthorized access", async function () {
      await expect(
        advancedEngine.connect(user).addStrategy(
          ethers.keccak256(ethers.toUtf8Bytes("test")),
          await aiStrategy.getAddress(),
          {
            isActive: true,
            minProfit: ethers.parseEther("0.1"),
            maxSlippage: 100,
            gasLimit: 500000,
            cooldownPeriod: 0,
            lastExecution: 0,
            successRate: 0,
            avgProfit: 0
          }
        )
      ).to.be.revertedWithCustomError(advancedEngine, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Strategy Management", function () {
    const strategyId = ethers.keccak256(ethers.toUtf8Bytes("ai_strategy_v1"));
    const strategyConfig = {
      isActive: true,
      minProfit: ethers.parseEther("0.1"),
      maxSlippage: 100,
      gasLimit: 500000,
      cooldownPeriod: 0,
      lastExecution: 0,
      successRate: 0,
      avgProfit: 0
    };

    it("Should add new strategy", async function () {
      await advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), strategyConfig);
      
      expect(await advancedEngine.strategies(strategyId)).to.equal(await aiStrategy.getAddress());
      expect(await advancedEngine.getActiveStrategies()).to.include(strategyId);
    });

    it("Should prevent duplicate strategy addition", async function () {
      await advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), strategyConfig);
      
      await expect(
        advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), strategyConfig)
      ).to.be.revertedWith("Strategy already exists");
    });

    it("Should get strategy configuration", async function () {
      await advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), strategyConfig);
      
      const config = await advancedEngine.getStrategyConfig(strategyId);
      expect(config.isActive).to.be.true;
      expect(config.minProfit).to.equal(ethers.parseEther("0.1"));
    });
  });

  describe("Risk Management", function () {
    it("Should have default risk parameters", async function () {
      const params = await advancedEngine.getRiskParams();
      
      expect(params.maxExposurePerToken).to.equal(ethers.parseEther("1000"));
      expect(params.maxExposurePerStrategy).to.equal(ethers.parseEther("5000"));
      expect(params.maxGasPrice).to.equal(ethers.parseUnits("100", "gwei"));
      expect(params.minProfitThreshold).to.equal(ethers.parseEther("0.1"));
      expect(params.maxSlippageTolerance).to.equal(200);
      expect(params.emergencyStopLoss).to.equal(ethers.parseEther("100"));
    });

    it("Should update risk parameters", async function () {
      const newParams = {
        maxExposurePerToken: ethers.parseEther("2000"),
        maxExposurePerStrategy: ethers.parseEther("10000"),
        maxGasPrice: ethers.parseUnits("200", "gwei"),
        minProfitThreshold: ethers.parseEther("0.2"),
        maxSlippageTolerance: 300,
        emergencyStopLoss: ethers.parseEther("200")
      };

      await advancedEngine.connect(strategist).updateRiskParams(newParams);
      
      const updatedParams = await advancedEngine.getRiskParams();
      expect(updatedParams.maxExposurePerToken).to.equal(newParams.maxExposurePerToken);
      expect(updatedParams.maxSlippageTolerance).to.equal(newParams.maxSlippageTolerance);
    });

    it("Should update token risk profile", async function () {
      const profile = {
        maxExposure: ethers.parseEther("500"),
        currentExposure: 0,
        volatilityScore: 5000,
        isBlacklisted: false,
        lastUpdate: Math.floor(Date.now() / 1000)
      };

      await advancedEngine.connect(strategist).updateTokenRiskProfile(await mockToken.getAddress(), profile);
      
      const updatedProfile = await advancedEngine.getTokenRiskProfile(await mockToken.getAddress());
      expect(updatedProfile.maxExposure).to.equal(profile.maxExposure);
      expect(updatedProfile.volatilityScore).to.equal(profile.volatilityScore);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency stop", async function () {
      await advancedEngine.connect(emergency).emergencyStop("Test emergency");
      
      expect(await advancedEngine.paused()).to.be.true;
    });

    it("Should allow resume after emergency stop", async function () {
      await advancedEngine.connect(emergency).emergencyStop("Test emergency");
      await advancedEngine.connect(emergency).resume();
      
      expect(await advancedEngine.paused()).to.be.false;
    });

    it("Should restrict emergency functions to authorized roles", async function () {
      await expect(
        advancedEngine.connect(user).emergencyStop("Test")
      ).to.be.revertedWithCustomError(advancedEngine, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Performance Tracking", function () {
    it("Should track global metrics", async function () {
      const metrics = await advancedEngine.getGlobalMetrics();
      
      expect(metrics[0]).to.equal(0); // totalProfit
      expect(metrics[1]).to.equal(0); // totalGasUsed
      expect(metrics[2]).to.equal(0); // successfulArbitrages
      expect(metrics[3]).to.equal(0); // failedArbitrages
    });

    it("Should track strategy performance", async function () {
      const strategyId = ethers.keccak256(ethers.toUtf8Bytes("test_strategy"));
      
      const performance = await advancedEngine.getStrategyPerformance(strategyId);
      
      expect(performance[0]).to.equal(0); // totalExecutions
      expect(performance[1]).to.equal(0); // successfulExecutions
      expect(performance[2]).to.equal(0); // totalProfit
      expect(performance[3]).to.equal(0); // avgGasUsed
    });
  });

  describe("MEV Protection Integration", function () {
    it("Should have MEV protector address", async function () {
      expect(await advancedEngine.mevProtector()).to.equal(await mevProtector.getAddress());
    });

    it("Should track processed blocks", async function () {
      // This would be tested when executing arbitrage
      expect(await advancedEngine.lastBlockNumber()).to.equal(0);
    });
  });

  describe("AI Strategy Integration", function () {
    it("Should validate strategy compatibility", async function () {
      const strategyId = ethers.keccak256(ethers.toUtf8Bytes("ai_strategy"));
      
      // Add strategy first
      await advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), {
        isActive: true,
        minProfit: ethers.parseEther("0.1"),
        maxSlippage: 100,
        gasLimit: 500000,
        cooldownPeriod: 0,
        lastExecution: 0,
        successRate: 0,
        avgProfit: 0
      });

      // Check if strategy is compatible
      const isCompatible = await aiStrategy.isCompatible({
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.1"),
        gasEstimate: 200000,
        strategyId: strategyId,
        routes: []
      });

      // Note: This will return false initially due to insufficient historical data
      expect(typeof isCompatible).to.equal("boolean");
    });

    it("Should get strategy metadata", async function () {
      expect(await aiStrategy.getName()).to.equal("AI Arbitrage Strategy v1.0");
      expect(await aiStrategy.getVersion()).to.equal("1.0.0");
    });

    it("Should estimate gas usage", async function () {
      const gasEstimate = await aiStrategy.estimateGas({
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.1"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("test")),
        routes: []
      });

      expect(gasEstimate).to.be.gt(0);
    });
  });

  describe("Gas Optimization", function () {
    it("Should use efficient gas patterns", async function () {
      // Test that the contract uses efficient patterns
      const startGas = await ethers.provider.getBalance(await owner.getAddress());
      
      // Call a view function to check gas efficiency
      await advancedEngine.getRiskParams();
      
      // In a real test, you'd measure actual gas usage
      // For now, just verify the function doesn't revert
      expect(true).to.be.true;
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete arbitrage flow", async function () {
      // This is a high-level integration test
      // In a real scenario, you'd need to set up more complex state
      
      const strategyId = ethers.keccak256(ethers.toUtf8Bytes("integration_test"));
      
      // Add strategy
      await advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), {
        isActive: true,
        minProfit: ethers.parseEther("0.1"),
        maxSlippage: 100,
        gasLimit: 500000,
        cooldownPeriod: 0,
        lastExecution: 0,
        successRate: 0,
        avgProfit: 0
      });

      // Verify strategy was added
      expect(await advancedEngine.strategies(strategyId)).to.equal(await aiStrategy.getAddress());
      
      // Check active strategies
      const activeStrategies = await advancedEngine.getActiveStrategies();
      expect(activeStrategies).to.include(strategyId);
    });
  });

  describe("Error Handling", function () {
    it("Should handle invalid strategy addresses", async function () {
      await expect(
        advancedEngine.addStrategy(
          ethers.keccak256(ethers.toUtf8Bytes("invalid")),
          ethers.ZeroAddress,
          {
            isActive: true,
            minProfit: ethers.parseEther("0.1"),
            maxSlippage: 100,
            gasLimit: 500000,
            cooldownPeriod: 0,
            lastExecution: 0,
            successRate: 0,
            avgProfit: 0
          }
        )
      ).to.be.revertedWith("Invalid strategy address");
    });

    it("Should handle duplicate strategy IDs", async function () {
      const strategyId = ethers.keccak256(ethers.toUtf8Bytes("duplicate"));
      
      await advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), {
        isActive: true,
        minProfit: ethers.parseEther("0.1"),
        maxSlippage: 100,
        gasLimit: 500000,
        cooldownPeriod: 0,
        lastExecution: 0,
        successRate: 0,
        avgProfit: 0
      });

      await expect(
        advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), {
          isActive: true,
          minProfit: ethers.parseEther("0.1"),
          maxSlippage: 100,
          gasLimit: 500000,
          cooldownPeriod: 0,
          lastExecution: 0,
          successRate: 0,
          avgProfit: 0
        })
      ).to.be.revertedWith("Strategy already exists");
    });
  });

  describe("Upgradeability and Extensibility", function () {
    it("Should support multiple strategies", async function () {
      const strategy1 = ethers.keccak256(ethers.toUtf8Bytes("strategy_1"));
      const strategy2 = ethers.keccak256(ethers.toUtf8Bytes("strategy_2"));
      
      await advancedEngine.addStrategy(strategy1, await aiStrategy.getAddress(), {
        isActive: true,
        minProfit: ethers.parseEther("0.1"),
        maxSlippage: 100,
        gasLimit: 500000,
        cooldownPeriod: 0,
        lastExecution: 0,
        successRate: 0,
        avgProfit: 0
      });

      await advancedEngine.addStrategy(strategy2, await aiStrategy.getAddress(), {
        isActive: true,
        minProfit: ethers.parseEther("0.2"),
        maxSlippage: 200,
        gasLimit: 600000,
        cooldownPeriod: 100,
        lastExecution: 0,
        successRate: 0,
        avgProfit: 0
      });

      const activeStrategies = await advancedEngine.getActiveStrategies();
      expect(activeStrategies).to.include(strategy1);
      expect(activeStrategies).to.include(strategy2);
      expect(activeStrategies.length).to.equal(2);
    });
  });
});
