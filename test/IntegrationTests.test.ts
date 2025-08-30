import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { MockERC20, MockUniswapV3Router, MockSushiswapRouter, MockAaveLendingPool } from "../typechain-types";

describe("Integration Tests", function () {
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let advancedArbitrageEngine: Contract;
  let flashLoanArbitrage: Contract;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let tokenC: MockERC20;
  let uniswapRouter: MockUniswapV3Router;
  let sushiswapRouter: MockSushiswapRouter;
  let aavePool: MockAaveLendingPool;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

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
    tokenC = await MockERC20.deploy("Token C", "TKC", 18);
    uniswapRouter = await MockUniswapV3Router.deploy();
    sushiswapRouter = await MockSushiswapRouter.deploy();
    aavePool = await MockAaveLendingPool.deploy();
    const aaveAddressesProvider = await MockAaveAddressesProvider.deploy(await aavePool.getAddress());

    advancedArbitrageEngine = await AdvancedArbitrageEngine.deploy(
      ethers.ZeroAddress, // mevProtector - using zero address for now
      await owner.getAddress() // admin
    );
    flashLoanArbitrage = await FlashLoanArbitrage.deploy(
      await aaveAddressesProvider.getAddress(), // pool addresses provider
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
    await flashLoanArbitrage.whitelistToken(await tokenC.getAddress());
    await flashLoanArbitrage.setTestBypassEntryPoint(true);
    await flashLoanArbitrage.setTestMode(true);

    // Mint tokens for testing
    await tokenA.mint(await advancedArbitrageEngine.getAddress(), ethers.parseEther("1000"));
    await tokenB.mint(await advancedArbitrageEngine.getAddress(), ethers.parseEther("1000"));
    await tokenC.mint(await advancedArbitrageEngine.getAddress(), ethers.parseEther("1000"));
    await tokenA.mint(await aavePool.getAddress(), ethers.parseEther("10000"));
    await tokenB.mint(await aavePool.getAddress(), ethers.parseEther("10000"));
    await tokenC.mint(await aavePool.getAddress(), ethers.parseEther("10000"));
    await tokenA.mint(await flashLoanArbitrage.getAddress(), ethers.parseEther("1000"));
    await tokenB.mint(await flashLoanArbitrage.getAddress(), ethers.parseEther("1000"));
    await tokenC.mint(await flashLoanArbitrage.getAddress(), ethers.parseEther("1000"));
  });

  describe("End-to-End Arbitrage Flows", function () {
    it("should execute complete arbitrage flow with multiple DEXs", async function () {
      // Setup price differences between DEXs
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100); // 1:100
      await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 102); // 1:102

      // Execute arbitrage
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

      const initialBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      
      await advancedArbitrageEngine.executeArbitrage(
        await tokenA.getAddress(),
        ethers.parseEther("1"),
        routes,
        ethers.parseEther("0.01")
      );

      const finalBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should handle flash loan arbitrage with profit", async function () {
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

      const initialBalance = await tokenA.balanceOf(await owner.getAddress());
      
      await flashLoanArbitrage.executeArbitrage(
        await tokenA.getAddress(),
        ethers.parseEther("10"),
        routes,
        ethers.parseEther("1.0")
      );

      const finalBalance = await tokenA.balanceOf(await owner.getAddress());
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should handle multi-token arbitrage flows", async function () {
      // Setup triangular arbitrage: A -> B -> C -> A
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await sushiswapRouter.setPriceRatio(await tokenB.getAddress(), await tokenC.getAddress(), 50);
      await uniswapRouter.setPriceRatio(await tokenC.getAddress(), await tokenA.getAddress(), 20);

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
          tokenOut: await tokenC.getAddress(),
          amountIn: 0,
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenB.getAddress(), 3000, await tokenC.getAddress()]
          ),
          fee: 3000
        },
        {
          router: await uniswapRouter.getAddress(),
          tokenIn: await tokenC.getAddress(),
          tokenOut: await tokenA.getAddress(),
          amountIn: 0,
          minAmountOut: ethers.parseEther("1.01"),
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenC.getAddress(), 3000, await tokenA.getAddress()]
          ),
          fee: 3000
        }
      ];

      const initialBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      
      await advancedArbitrageEngine.executeArbitrage(
        await tokenA.getAddress(),
        ethers.parseEther("1"),
        routes,
        ethers.parseEther("0.01")
      );

      const finalBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Cross-DEX Integration", function () {
    it("should handle arbitrage between Uniswap and Sushiswap", async function () {
      // Setup different prices on different DEXs
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 110);

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
          minAmountOut: ethers.parseEther("1.05"),
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenB.getAddress(), 3000, await tokenA.getAddress()]
          ),
          fee: 3000
        }
      ];

      const initialBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      
      await advancedArbitrageEngine.executeArbitrage(
        await tokenA.getAddress(),
        ethers.parseEther("1"),
        routes,
        ethers.parseEther("0.05")
      );

      const finalBalance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should handle failed arbitrage gracefully", async function () {
      // Setup same prices (no arbitrage opportunity)
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);

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

      await expect(
        advancedArbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          ethers.parseEther("1"),
          routes,
          ethers.parseEther("0.01")
        )
      ).to.be.revertedWith("Insufficient profit");
    });
  });

  describe("Gas Optimization Integration", function () {
    it("should optimize gas usage for large arbitrage operations", async function () {
      const largeAmount = ethers.parseEther("100");
      
      // Setup price differences
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 105);

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
        },
        {
          router: await sushiswapRouter.getAddress(),
          tokenIn: await tokenB.getAddress(),
          tokenOut: await tokenA.getAddress(),
          amountIn: 0,
          minAmountOut: largeAmount + ethers.parseEther("1"),
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await tokenB.getAddress(), 3000, await tokenA.getAddress()]
          ),
          fee: 3000
        }
      ];

      const tx = await advancedArbitrageEngine.executeArbitrage(
        await tokenA.getAddress(),
        largeAmount,
        routes,
        ethers.parseEther("0.5")
      );

      const receipt = await tx.wait();
      expect(receipt.gasUsed).to.be.lt(500000); // Should use less than 500k gas
    });
  });

  describe("Error Handling Integration", function () {
    it("should handle router failures gracefully", async function () {
      // Make router fail
      await uniswapRouter.setShouldFail(true);

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
      ).to.be.reverted;
    });

    it("should handle insufficient liquidity", async function () {
      // Set very low liquidity
      await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100);
      await uniswapRouter.setLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("0.1"), ethers.parseEther("0.1")); // Very low liquidity

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
      ).to.be.reverted;
    });
  });

  describe("Performance Integration", function () {
    it("should handle high-frequency arbitrage operations", async function () {
      const operations = [];
      
      for (let i = 0; i < 5; i++) {
        // Setup different price ratios for each operation
        await uniswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 100 + i);
        await sushiswapRouter.setPriceRatio(await tokenA.getAddress(), await tokenB.getAddress(), 105 + i);

        const routes = [
          {
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
          },
          {
            router: await sushiswapRouter.getAddress(),
            tokenIn: await tokenB.getAddress(),
            tokenOut: await tokenA.getAddress(),
            amountIn: 0,
            minAmountOut: ethers.parseEther("0.105"),
            path: ethers.solidityPacked(
              ["address", "uint24", "address"],
              [await tokenB.getAddress(), 3000, await tokenA.getAddress()]
            ),
            fee: 3000
          }
        ];

        operations.push(
          advancedArbitrageEngine.executeArbitrage(
            await tokenA.getAddress(),
            ethers.parseEther("0.1"),
            routes,
            ethers.parseEther("0.005")
          )
        );
      }

      // Execute all operations
      const results = await Promise.all(operations);
      expect(results.length).to.equal(5);
      
      // Verify all transactions were successful (if they reach here, they succeeded)
      for (const result of results) {
        expect(result).to.not.be.undefined;
      }
    });
  });
});
