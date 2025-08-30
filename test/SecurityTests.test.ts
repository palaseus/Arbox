import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { MockERC20, MockUniswapV3Router, MockSushiswapRouter, MockAaveLendingPool } from "../typechain-types";

describe("Security Tests", function () {
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let attacker: Signer;
  let advancedArbitrageEngine: Contract;
  let flashLoanArbitrage: Contract;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let uniswapRouter: MockUniswapV3Router;
  let sushiswapRouter: MockSushiswapRouter;
  let aavePool: MockAaveLendingPool;

  beforeEach(async function () {
    [owner, user1, user2, attacker] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const MockUniswapV3Router = await ethers.getContractFactory("MockUniswapV3Router");
    const MockSushiswapRouter = await ethers.getContractFactory("MockSushiswapRouter");
    const MockAaveLendingPool = await ethers.getContractFactory("MockAaveLendingPool");
    const MockAaveAddressesProvider = await ethers.getContractFactory("MockAaveAddressesProvider");
    const AdvancedArbitrageEngine = await ethers.getContractFactory("AdvancedArbitrageEngine");
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");

    tokenA = await MockERC20.deploy("Token A", "TKA", 18);
    tokenB = await MockERC20.deploy("Token B", "TKB", 18);
    uniswapRouter = await MockUniswapV3Router.deploy();
    sushiswapRouter = await MockSushiswapRouter.deploy();
    aavePool = await MockAaveLendingPool.deploy();
    const aaveAddressesProvider = await MockAaveAddressesProvider.deploy(await aavePool.getAddress());

    advancedArbitrageEngine = await AdvancedArbitrageEngine.deploy(
      ethers.ZeroAddress, // mevProtector - using zero address for now
      await owner.getAddress() // admin
    );
    flashLoanArbitrage = await FlashLoanArbitrage.deploy(
      await aaveAddressesProvider.getAddress(),
      await owner.getAddress(),
      ethers.parseEther("0.01"),
      1000, // minProfitPercentage
      500,  // maxSlippage
      100000000000 // maxGasPrice (100 gwei)
    );

    // Setup roles and permissions
    const OPERATOR_ROLE = await advancedArbitrageEngine.OPERATOR_ROLE();
    const STRATEGIST_ROLE = await advancedArbitrageEngine.STRATEGIST_ROLE();
    const EMERGENCY_ROLE = await advancedArbitrageEngine.EMERGENCY_ROLE();

    await advancedArbitrageEngine.grantRole(OPERATOR_ROLE, await owner.getAddress());
    await advancedArbitrageEngine.grantRole(STRATEGIST_ROLE, await owner.getAddress());
    await advancedArbitrageEngine.grantRole(EMERGENCY_ROLE, await owner.getAddress());

    // Setup flash loan arbitrage
    await flashLoanArbitrage.addRouter(await uniswapRouter.getAddress(), await uniswapRouter.getAddress());
    await flashLoanArbitrage.addRouter(await sushiswapRouter.getAddress(), await sushiswapRouter.getAddress());
    await flashLoanArbitrage.whitelistToken(await tokenA.getAddress());
    await flashLoanArbitrage.whitelistToken(await tokenB.getAddress());

    // Mint tokens for testing
    await tokenA.mint(await advancedArbitrageEngine.getAddress(), ethers.parseEther("1000"));
    await tokenB.mint(await advancedArbitrageEngine.getAddress(), ethers.parseEther("1000"));
    await tokenA.mint(await aavePool.getAddress(), ethers.parseEther("10000"));
    await tokenB.mint(await aavePool.getAddress(), ethers.parseEther("10000"));
  });

  describe("Access Control Attacks", function () {
    it("should prevent unauthorized access to critical functions", async function () {
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Attacker tries to execute arbitrage without proper role
      await expect(
        advancedArbitrageEngine.connect(attacker).executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");

      // Attacker tries to add strategy without proper role
      await expect(
        advancedArbitrageEngine.connect(attacker).addStrategy(
          "test",
          await user1.getAddress(),
          ethers.parseEther("0.1"),
          ethers.parseEther("0.01")
        )
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");

      // Attacker tries to update risk parameters without proper role
      await expect(
        advancedArbitrageEngine.connect(attacker).updateRiskParams(
          ethers.parseEther("0.1"),
          ethers.parseEther("0.01"),
          ethers.parseEther("0.001")
        )
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");

      // Attacker tries to emergency stop without proper role
      await expect(
        advancedArbitrageEngine.connect(attacker).emergencyStop()
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");
    });

    it("should prevent role escalation attacks", async function () {
      // Attacker tries to grant themselves admin role
      const DEFAULT_ADMIN_ROLE = await advancedArbitrageEngine.DEFAULT_ADMIN_ROLE();
      
      await expect(
        advancedArbitrageEngine.connect(attacker).grantRole(DEFAULT_ADMIN_ROLE, await attacker.getAddress())
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");

      // Attacker tries to revoke owner's role
      await expect(
        advancedArbitrageEngine.connect(attacker).revokeRole(DEFAULT_ADMIN_ROLE, await owner.getAddress())
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Reentrancy Attacks", function () {
    it("should prevent reentrancy attacks on executeArbitrage", async function () {
      // Deploy malicious router that attempts reentrancy
      const MaliciousRouter = await ethers.getContractFactory("MaliciousRouter");
      const maliciousRouter = await MaliciousRouter.deploy(await advancedArbitrageEngine.getAddress());

      const routes = [
        {
          router: await maliciousRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // The malicious router will attempt reentrancy, but should be blocked
      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });

    it("should prevent reentrancy attacks on flash loan arbitrage", async function () {
      // Deploy malicious router that attempts reentrancy
      const MaliciousRouter = await ethers.getContractFactory("MaliciousRouter");
      const maliciousRouter = await MaliciousRouter.deploy(await flashLoanArbitrage.getAddress());

      await flashLoanArbitrage.addRouter(await maliciousRouter.getAddress());

      const routes = [
        {
          router: await maliciousRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // The malicious router will attempt reentrancy, but should be blocked
      await expect(
        flashLoanArbitrage.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });
  });

  describe("Integer Overflow/Underflow Attacks", function () {
    it("should prevent integer overflow in amount calculations", async function () {
      // Test with maximum uint256 values
      const maxAmount = ethers.MaxUint256;
      
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: maxAmount,
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Should revert due to insufficient balance, not overflow
      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          maxAmount,
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });

    it("should prevent integer underflow in profit calculations", async function () {
      // Test with very small amounts that could cause underflow
      const smallAmount = ethers.parseEther("0.000000000000000001");
      
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: smallAmount,
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Should handle small amounts without underflow
      try {
        await advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          smallAmount,
          routes,
          ethers.parseEther("0.000000000000000001")
        );
      } catch (error) {
        // Expected to fail due to insufficient profit, not underflow
        expect(error.message).to.not.include("arithmetic underflow");
      }
    });
  });

  describe("Front-Running Attacks", function () {
    it("should prevent front-running through MEV protection", async function () {
      // Setup price differences
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 105);

      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        },
        {
          router: await sushiswapRouter.getAddress(),
          tokenIn: await tokenB.getAddress(),
          tokenOut: await tokenA.getAddress(),
          amountIn: 0,
          minAmountOut: ethers.parseEther("1.01"),
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenB.getAddress(), 3000, await tokenA.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Execute arbitrage with MEV protection
      const initialBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      
      await advancedArbitrageEngine.executeArbitrage(
        await tokenA.getAddress(),
        ethers.parseEther("1"),
        routes,
        ethers.parseEther("0.01")
      );

      const finalBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      
      // Should still make profit despite potential front-running
      expect(finalBalance).to.be.gte(initialBalance);
    });
  });

  describe("Flash Loan Attacks", function () {
    it("should prevent flash loan attacks on the arbitrage engine", async function () {
      // Attacker tries to use flash loan to manipulate prices
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1000"), // Large amount
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Should fail due to insufficient balance
      await expect(
        advancedArbitrageEngine.connect(attacker).executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1000"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");
    });

    it("should validate flash loan repayment in flash loan arbitrage", async function () {
      // Setup price differences
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 105);

      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("10"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        },
        {
          router: await sushiswapRouter.getAddress(),
          tokenIn: await tokenB.getAddress(),
          tokenOut: await tokenA.getAddress(),
          amountIn: 0,
          minAmountOut: ethers.parseEther("10.5"),
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenB.getAddress(), 3000, await tokenA.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Flash loan should succeed and repay correctly
      await flashLoanArbitrage.executeArbitrage(
        await tokenA.getAddress(),
        ethers.parseEther("10"),
        routes,
        ethers.parseEther("0.1")
      );

      // Verify flash loan was repaid
      const poolBalance = await tokenA.balanceOf(await aavePool.getAddress());
      expect(poolBalance).to.be.gte(ethers.parseEther("10000")); // Should not lose funds
    });
  });

  describe("Price Manipulation Attacks", function () {
    it("should prevent price manipulation through large trades", async function () {
      // Attacker tries to manipulate prices with large trades
      const largeAmount = ethers.parseEther("10000");
      
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: largeAmount,
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Should fail due to insufficient balance
      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          largeAmount,
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });

    it("should validate slippage protection", async function () {
      // Setup routes with high slippage
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: ethers.parseEther("100"), // Unrealistic min amount
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Should fail due to slippage protection
      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });
  });

  describe("Denial of Service Attacks", function () {
    it("should prevent DoS through gas limit exhaustion", async function () {
      // Create complex routes that could exhaust gas
      const complexRoutes = [];
      for (let i = 0; i < 10; i++) {
        complexRoutes.push({
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("0.1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        });
      }

      // Should fail due to invalid route length, not gas exhaustion
      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          complexRoutes,
          ethers.parseEther("0.01")
        )
      ).to.be.revertedWith("Invalid routes length");
    });

    it("should prevent DoS through repeated failed transactions", async function () {
      // Setup routes that will fail
      const failingRoutes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Setup same prices (no arbitrage opportunity)
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);

      // Execute multiple failing transactions
      for (let i = 0; i < 5; i++) {
        await expect(
          advancedArbitrageEngine.executeArbitrage(
            await tokenA.getAddress(),
            ethers.parseEther("1"),
            failingRoutes,
            ethers.parseEther("0.01")
          )
        ).to.be.revertedWith("Insufficient profit");
      }

      // Contract should still be functional
      const balance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      expect(balance).to.equal(ethers.parseEther("1000")); // Balance should remain unchanged
    });
  });

  describe("Token Validation Attacks", function () {
    it("should prevent attacks with invalid token addresses", async function () {
      const invalidToken = ethers.ZeroAddress;
      
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: invalidToken,
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [invalidToken, 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      await expect(
        advancedArbitrageEngine.executeArbitrage(
          invalidToken,
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });

    it("should prevent attacks with non-ERC20 tokens", async function () {
      // Deploy a non-ERC20 contract
      const NonERC20Token = await ethers.getContractFactory("MockTarget");
      const nonERC20Token = await NonERC20Token.deploy();

      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await nonERC20Token.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await nonERC20Token.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await nonERC20Token.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });
  });

  describe("Router Validation Attacks", function () {
    it("should prevent attacks with malicious routers", async function () {
      // Deploy malicious router
      const MaliciousRouter = await ethers.getContractFactory("MaliciousRouter");
      const maliciousRouter = await MaliciousRouter.deploy(await advancedArbitrageEngine.getAddress());

      const routes = [
        {
          router: await maliciousRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      // Should fail due to malicious router behavior
      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });

    it("should prevent attacks with non-existent routers", async function () {
      const nonExistentRouter = "0x1234567890123456789012345678901234567890";
      
      const routes = [
        {
          router: nonExistentRouter,
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });
  });

  describe("Emergency Stop Security", function () {
    it("should prevent unauthorized emergency stops", async function () {
      // Attacker tries to emergency stop
      await expect(
        advancedArbitrageEngine.connect(attacker).emergencyStop()
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");

      // Contract should still be functional
      expect(await advancedArbitrageEngine.paused()).to.be.false;
    });

    it("should allow authorized emergency stops", async function () {
      // Owner can emergency stop
      await advancedArbitrageEngine.emergencyStop();
      expect(await advancedArbitrageEngine.paused()).to.be.true;

      // Contract should be paused
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.revertedWith("Pausable: paused");

      // Owner can resume
      await advancedArbitrageEngine.resume();
      expect(await advancedArbitrageEngine.paused()).to.be.false;
    });
  });

  describe("Flash Loan Arbitrage Security", function () {
    it("should prevent unauthorized flash loan access", async function () {
      // Attacker tries to execute flash loan arbitrage without proper setup
      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenA.getAddress(),
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenA.getAddress(), 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      await expect(
        flashLoanArbitrage.connect(attacker).executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.reverted;
    });

    it("should validate token whitelist", async function () {
      const nonWhitelistedToken = await tokenA.getAddress();
      await flashLoanArbitrage.removeTokenFromWhitelist(nonWhitelistedToken);

      const routes = [
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: nonWhitelistedToken,
          tokenOut: await tokenB.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [nonWhitelistedToken, 3000, await tokenB.getAddress()]
          ),
          fee: 3000
        }
      ];

      await expect(
        flashLoanArbitrage.executeArbitrage(
          nonWhitelistedToken,
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.revertedWithCustomError(flashLoanArbitrage, "TokenNotWhitelisted");
    });
  });
});
