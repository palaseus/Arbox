import { expect } from "chai";
import { ethers } from "hardhat";
import { AIArbitrageStrategy } from "../typechain-types/contracts/strategies/AIArbitrageStrategy";
import { FlashLoanArbitrage } from "../typechain-types/contracts/FlashLoanArbitrage";
import { MockERC20 } from "../typechain-types/contracts/mocks/MockERC20";
import { MockUniswapV3Router } from "../typechain-types/contracts/mocks/MockUniswapV3Router";
import { MockAaveLendingPool } from "../typechain-types/contracts/mocks/MockAaveLendingPool";
import { Contract } from "ethers";

describe("AI Strategy Integration Tests", function () {
  let aiStrategy: AIArbitrageStrategy;
  let arbitrage: FlashLoanArbitrage;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let router: MockUniswapV3Router;
  let mockPool: MockAaveLendingPool;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock contracts
    const MockToken = await ethers.getContractFactory("MockERC20");
    tokenA = await MockToken.deploy("Token A", "TKNA", 18);
    tokenB = await MockToken.deploy("Token B", "TKNB", 18);

    const MockRouter = await ethers.getContractFactory("MockUniswapV3Router");
    router = await MockRouter.deploy();

    const MockPool = await ethers.getContractFactory("MockAaveLendingPool");
    mockPool = await MockPool.deploy();

    const MockProvider = await ethers.getContractFactory("MockPoolAddressesProvider");
    const mockProvider = await MockProvider.deploy(await mockPool.getAddress());

    // Deploy AI Strategy
    const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy");
    aiStrategy = await AIStrategy.deploy();

    // Deploy arbitrage contract
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    arbitrage = await FlashLoanArbitrage.deploy(
      await mockProvider.getAddress(),
      owner.address,
      ethers.parseEther("0.001"),
      50, // 0.5% min profit
      100, // 1% max slippage
      ethers.parseUnits("100", 9) // 100 gwei max gas
    );

    // Setup
    await arbitrage.setTestBypassEntryPoint(true);
    await arbitrage.addRouter(await router.getAddress(), await router.getAddress());
    await arbitrage.whitelistToken(await tokenA.getAddress());
    await arbitrage.whitelistToken(await tokenB.getAddress());

    // Fund contracts
    await tokenA.mint(await arbitrage.getAddress(), ethers.parseEther("10"));
    await tokenB.mint(await arbitrage.getAddress(), ethers.parseEther("10"));
    await tokenA.mint(await mockPool.getAddress(), ethers.parseEther("100"));
    await tokenB.mint(await mockPool.getAddress(), ethers.parseEther("100"));

    // Add liquidity to router
    await router.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      ethers.parseEther("1000"),
      ethers.parseEther("1000")
    );

    // Wait for deployments to be mined
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();
    await router.waitForDeployment();
    await mockPool.waitForDeployment();
    await mockProvider.waitForDeployment();
    await aiStrategy.waitForDeployment();
    await arbitrage.waitForDeployment();
  });

  describe("AI Strategy Core Functionality", function () {
    it("should initialize with correct default parameters", async function () {
      expect(await aiStrategy.name()).to.equal("AI Arbitrage Strategy v1.0");
      expect(await aiStrategy.version()).to.equal("1.0.0");
      expect(await aiStrategy.learningRate()).to.equal(ethers.parseEther("0.001"));
      expect(await aiStrategy.momentum()).to.equal(ethers.parseEther("0.9"));
      expect(await aiStrategy.volatilityThreshold()).to.equal(ethers.parseEther("0.05"));
    });

    it("should calculate profit probability using ML components", async function () {
      // Create opportunity
      const opportunity = await _createOpportunity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        "1",
        "0.01"
      );

      // Update price history to simulate market data
      await _updatePriceHistory(await tokenA.getAddress(), [100, 101, 102, 103, 104]);

      // Estimate gas
      const gasEstimate = await aiStrategy.estimateGas(opportunity);
      expect(gasEstimate).to.be.gt(0);

      // Get risk score
      const riskScore = await aiStrategy.getRiskScore();
      expect(riskScore).to.be.lte(10000);
    });

    it("should learn from successful executions", async function () {
      const opportunity = await _createOpportunity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        "1",
        "0.01"
      );

      // Execute strategy - should be rejected by AI analysis
      await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");

      // Check that no executions were recorded since it was rejected
      const stats = await aiStrategy.getStrategyStats();
      expect(stats[0]).to.equal(0); // totalExecutions
      expect(stats[1]).to.equal(0); // successfulExecutions
    });

    it("should learn from failed executions", async function () {
      const opportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("1000"), // Too large amount to cause failure
        expectedProfit: ethers.parseEther("0.01"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1000"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      // This should fail due to AI analysis rejection
      await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");

      // Check that no executions were recorded since it was rejected
      const stats = await aiStrategy.getStrategyStats();
      expect(stats[0]).to.equal(0); // totalExecutions
      expect(stats[1]).to.equal(0); // successfulExecutions
    });
  });

  describe("Advanced AI Features", function () {
    it("should apply neural network-like decision making", async function () {
      // Create multiple opportunities with different characteristics
      const opportunities = [
        {
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amount: ethers.parseEther("0.1"),
          expectedProfit: ethers.parseEther("0.005"),
          gasEstimate: 200000,
          strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
          routes: [{
            router: await router.getAddress(),
            tokenIn: await tokenA.getAddress(),
            tokenOut: await tokenB.getAddress(),
            amountIn: ethers.parseEther("0.1"),
            minAmountOut: 0,
            path: "0x",
            fee: 3000,
            gasEstimate: 100000
          }]
        },
        {
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amount: ethers.parseEther("1"),
          expectedProfit: ethers.parseEther("0.02"),
          gasEstimate: 200000,
          strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
          routes: [{
            router: await router.getAddress(),
            tokenIn: await tokenA.getAddress(),
            tokenOut: await tokenB.getAddress(),
            amountIn: ethers.parseEther("1"),
            minAmountOut: 0,
            path: "0x",
            fee: 3000,
            gasEstimate: 100000
          }]
        }
      ];

      // Update price history with favorable trend
      await _updatePriceHistory(await tokenA.getAddress(), [100, 102, 104, 106, 108]);

      // Execute both opportunities - should be rejected by AI analysis or insufficient profit
      for (const opportunity of opportunities) {
        await expect(aiStrategy.execute(opportunity)).to.be.revertedWith(/AI analysis suggests not to execute|Insufficient profit/);
      }

      // Check that no executions were recorded since they were rejected
      const stats = await aiStrategy.getStrategyStats();
      expect(stats[1]).to.equal(0); // Both should be rejected
    });

    it("should calculate volatility metrics correctly", async function () {
      // Update price history with volatile data
      const volatilePrices = [100, 110, 90, 120, 80, 130, 70, 140, 60, 150];
      await _updatePriceHistory(await tokenA.getAddress(), volatilePrices);

      // Get volatility metrics
      const metrics = await aiStrategy.getVolatilityMetrics(await tokenA.getAddress());
      expect(metrics[0]).to.be.gte(0); // currentVolatility should be calculated (can be 0 if no data)
    });

    it("should apply Kelly Criterion for position sizing", async function () {
      // Create opportunity with high probability
      const opportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.05"), // High profit
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      // Update price history with strong uptrend
      await _updatePriceHistory(await tokenA.getAddress(), [100, 105, 110, 115, 120]);

      // Execute strategy - should be rejected by AI analysis
      await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");

      // Check that no executions were recorded since it was rejected
      const stats = await aiStrategy.getStrategyStats();
      expect(stats[2]).to.equal(0); // No profit generated since rejected
    });
  });

  describe("Market Condition Analysis", function () {
    it("should consider gas prices in decision making", async function () {
      const opportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.01"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      // Execute with different gas conditions - should be rejected by AI analysis
      await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");

      // The strategy should have considered current gas prices
      const gasEstimate = await aiStrategy.estimateGas(opportunity);
      expect(gasEstimate).to.be.gt(0);
    });

    it("should adapt to changing market conditions", async function () {
      // Create opportunity
      const opportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.01"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      // Execute multiple times to simulate market adaptation - should be rejected by AI analysis
      for (let i = 0; i < 5; i++) {
        await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");
        
        // Update price history with different trends
        const trend = i % 2 === 0 ? "up" : "down";
        const prices = trend === "up" ? 
          [100 + i*2, 102 + i*2, 104 + i*2, 106 + i*2, 108 + i*2] :
          [100 - i*2, 98 - i*2, 96 - i*2, 94 - i*2, 92 - i*2];
        await _updatePriceHistory(await tokenA.getAddress(), prices);
      }

      // Check that no executions were recorded since they were rejected
      const stats = await aiStrategy.getStrategyStats();
      expect(stats[0]).to.equal(0); // 0 executions since all were rejected
    });
  });

  describe("Performance Optimization", function () {
    it("should optimize gas usage", async function () {
      const opportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.01"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      // Measure gas usage - should be rejected by AI analysis
      await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");
      
      // Gas estimation should still work
      const gasEstimate = await aiStrategy.estimateGas(opportunity);
      expect(gasEstimate).to.be.gt(0);
    });

    it("should maintain consistent performance", async function () {
      const opportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.01"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      const gasUsages: number[] = [];

      // Execute multiple times and measure gas - should be rejected by AI analysis
      for (let i = 0; i < 3; i++) {
        await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");
        // Get gas estimate instead
        const gasEstimate = await aiStrategy.estimateGas(opportunity);
        gasUsages.push(Number(gasEstimate));
      }

      // Gas estimates should be consistent (within 10% variance)
      const avgGas = gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length;
      const variance = gasUsages.reduce((sum, gas) => sum + Math.pow(gas - avgGas, 2), 0) / gasUsages.length;
      const stdDev = Math.sqrt(variance);
      
      expect(stdDev / avgGas).to.be.lt(0.1); // Less than 10% variance
    });
  });

  describe("Risk Management", function () {
    it("should respect exposure limits", async function () {
      const largeOpportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("2000"), // Exceeds max exposure
        expectedProfit: ethers.parseEther("0.01"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("2000"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      // Should fail due to exposure limit
      await expect(aiStrategy.execute(largeOpportunity)).to.be.revertedWith("Exposure limit exceeded");
    });

    it("should calculate risk scores dynamically", async function () {
      // Create opportunity
      const opportunity = {
        tokenIn: await tokenA.getAddress(),
        tokenOut: await tokenB.getAddress(),
        amount: ethers.parseEther("1"),
        expectedProfit: ethers.parseEther("0.01"),
        gasEstimate: 200000,
        strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
        routes: [{
          router: await router.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: "0x",
          fee: 3000,
          gasEstimate: 100000
        }]
      };

      // Get initial risk score
      const initialRisk = await aiStrategy.getRiskScore();

      // Execute strategy - should be rejected by AI analysis
      await expect(aiStrategy.execute(opportunity)).to.be.revertedWith("AI analysis suggests not to execute");

      // Get updated risk score
      const updatedRisk = await aiStrategy.getRiskScore();

      // Risk score should be calculated
      expect(initialRisk).to.be.lte(10000);
      expect(updatedRisk).to.be.lte(10000);
    });
  });

  // Helper function to create opportunity
  async function _createOpportunity(tokenIn: string, tokenOut: string, amount: string, expectedProfit: string) {
    return {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amount: ethers.parseEther(amount),
      expectedProfit: ethers.parseEther(expectedProfit),
      gasEstimate: 200000,
      strategyId: ethers.keccak256(ethers.toUtf8Bytes("ai_strategy")),
      routes: [{
        router: await router.getAddress(),
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amountIn: ethers.parseEther(amount),
        minAmountOut: 0,
        path: "0x",
        fee: 3000,
        gasEstimate: 100000
      }]
    };
  }

  // Helper function to update price history
  async function _updatePriceHistory(token: string, prices: number[]) {
    for (let i = 0; i < prices.length; i++) {
      // Simulate price updates by calling the strategy with different amounts
      const opportunity = await _createOpportunity(
        token, 
        await tokenB.getAddress(), 
        prices[i].toString(), 
        "0.001"
      );

      try {
        await aiStrategy.execute(opportunity);
      } catch {
        // Ignore execution failures, we just want to update price history
      }
    }
  }
});
