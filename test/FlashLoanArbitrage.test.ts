import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { FlashLoanArbitrage, IDexRouter, MockERC20, MockAavePool } from "../typechain-types";

describe("FlashLoanArbitrage", function () {
  let arbitrage: FlashLoanArbitrage;
  let uniswapV3Router: IDexRouter;
  let sushiRouter: IDexRouter;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let token: MockERC20;
  let mockPool: MockAavePool;

  const AAVE_POOL_ADDRESSES_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const SUSHI_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Mock Token", "MTK", 18);
    await token.waitForDeployment();

    // Deploy router implementations
    const MockUniswapV3Router = await ethers.getContractFactory("MockUniswapV3Router");
    uniswapV3Router = await MockUniswapV3Router.deploy() as unknown as IDexRouter;
    await uniswapV3Router.waitForDeployment();

    const MockSushiswapRouter = await ethers.getContractFactory("MockSushiswapRouter");
    sushiRouter = await MockSushiswapRouter.deploy() as unknown as IDexRouter;
    await sushiRouter.waitForDeployment();

    // Deploy mock Aave Pool
    const MockPool = await ethers.getContractFactory("MockAavePool");
    mockPool = await MockPool.deploy();
    await mockPool.waitForDeployment();

    // Deploy mock PoolAddressesProvider
    const MockProvider = await ethers.getContractFactory("MockPoolAddressesProvider");
    const mockProvider = await MockProvider.deploy(await mockPool.getAddress());
    await mockProvider.waitForDeployment();

    // Deploy main contract with mock provider
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    const poolAddr = await mockProvider.getAddress();
    const profitAddr = await owner.getAddress();
    const minProfit = ethers.parseUnits("0.0001", 18);
    const minProfitPercentage = 0; // Set to zero for test
    const maxSlippage = 100; // 1%
    const maxGasPrice = ethers.parseUnits("100", 9); // 100 gwei
    arbitrage = await FlashLoanArbitrage.deploy(
      poolAddr,
      profitAddr,
      minProfit,
      minProfitPercentage,
      maxSlippage,
      maxGasPrice
    );
    await arbitrage.waitForDeployment();
    await arbitrage.setTestBypassEntryPoint(true);

    // Register routers
    await arbitrage.addRouter(await token.getAddress(), await uniswapV3Router.getAddress());
    await arbitrage.addRouter("0x0000000000000000000000000000000000000002", await sushiRouter.getAddress());

    // Mint tokens to the contract for testing
    await token.mint(await arbitrage.getAddress(), ethers.parseEther("2"));
    // Mint tokens to the mock pool so it can provide the flash loan
    await token.mint(await mockPool.getAddress(), ethers.parseEther("10"));

    // Approve the mock pool to spend tokens from the arbitrage contract
    await token.connect(owner).approve(await mockPool.getAddress(), ethers.parseEther("100.1"));
    // Also approve the arbitrage contract to spend tokens from the owner
    await token.connect(owner).approve(await arbitrage.getAddress(), ethers.parseEther("100.1"));

    // Get minProfit from contract
    this.minProfit = await arbitrage.minProfit();
  });

  describe("Router Management", function () {
    it("should add and remove routers correctly", async function () {
      const newRouter = "0x1234567890123456789012345678901234567890";
      const newImplementation = "0x0987654321098765432109876543210987654321";

      // Add router
      await arbitrage.addRouter(newRouter, newImplementation);
      expect(await arbitrage.routers(newRouter)).to.equal(newImplementation);

      // Remove router
      await arbitrage.removeRouter(newRouter);
      expect(await arbitrage.routers(newRouter)).to.equal(ethers.ZeroAddress);
    });

    it("should not allow non-owner to add/remove routers", async function () {
      const newRouter = "0x1234567890123456789012345678901234567890";
      const newImplementation = "0x0987654321098765432109876543210987654321";

      await expect(
        arbitrage.connect(user).addRouter(newRouter, newImplementation)
      ).to.be.revertedWithCustomError(arbitrage, "OwnableUnauthorizedAccount");

      await expect(
        arbitrage.connect(user).removeRouter(UNISWAP_V3_ROUTER)
      ).to.be.revertedWithCustomError(arbitrage, "OwnableUnauthorizedAccount");
    });
  });

  describe("Arbitrage Execution", function () {
    it("should execute arbitrage with multiple routers", async function () {
      // Create swap routes with distinct tokens and valid routers
      const routes = [
        {
          router: await uniswapV3Router.getAddress(),
          tokenIn: await token.getAddress(),
          tokenOut: await token.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await token.getAddress(), 3000, await token.getAddress()]
          ),
          fee: 3000
        },
        {
          router: await sushiRouter.getAddress(),
          tokenIn: await token.getAddress(),
          tokenOut: await token.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await token.getAddress(), 3000, await token.getAddress()]
          ),
          fee: 3000
        }
      ];
      // Register routers
      await arbitrage.addRouter(await uniswapV3Router.getAddress(), await uniswapV3Router.getAddress());
      await arbitrage.addRouter(await sushiRouter.getAddress(), await sushiRouter.getAddress());
      // Mint tokens to the contract for testing
      await token.mint(await arbitrage.getAddress(), ethers.parseEther("2"));
      // Mint tokens to the mock pool so it can provide the flash loan and receive repayment
      await token.mint(await mockPool.getAddress(), ethers.parseEther("100"));
      // Approve the mock pool to spend tokens from the arbitrage contract
      await token.connect(owner).approve(await mockPool.getAddress(), ethers.parseEther("100.1"));
      // Also approve the arbitrage contract to spend tokens from the owner
      await token.connect(owner).approve(await arbitrage.getAddress(), ethers.parseEther("100.1"));
      // Execute arbitrage and expect revert with InvalidArbPath (since tokenIn == tokenOut)
      await expect(
        arbitrage.executeArbitrage(
          await token.getAddress(),
          ethers.parseEther("1"),
          routes,
          this.minProfit
        )
      ).to.be.revertedWithCustomError(arbitrage, "InvalidArbPath");
    });

    it("should revert if router not found", async function () {
      const routes = [
        {
          router: await token.getAddress(),
          tokenIn: await token.getAddress(),
          tokenOut: await token.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await token.getAddress(), 3000, await token.getAddress()]
          ),
          fee: 3000
        },
        {
          router: "0x0000000000000000000000000000000000000002",
          tokenIn: await token.getAddress(),
          tokenOut: await token.getAddress(),
          amountIn: ethers.parseEther("1"),
          minAmountOut: 0,
          path: ethers.solidityPacked(
            ["address", "uint24", "address"],
            [await token.getAddress(), 3000, await token.getAddress()]
          ),
          fee: 3000
        }
      ];
      // Remove all routers to simulate router not found
      await arbitrage.removeRouter(await token.getAddress());
      await arbitrage.removeRouter("0x0000000000000000000000000000000000000002");
      await expect(
        arbitrage.executeArbitrage(
          await token.getAddress(),
          ethers.parseEther("1"),
          routes,
          0
        )
      ).to.be.revertedWithCustomError(arbitrage, "InvalidArbPath");
    });
  });

  describe("Profit Management", function () {
    it("should update profit recipient", async function () {
      await arbitrage.setProfitRecipient(user.address);
      expect(await arbitrage.profitRecipient()).to.equal(user.address);
    });

    it("should not allow non-owner to update profit recipient", async function () {
      await expect(
        arbitrage.connect(user).setProfitRecipient(user.address)
      ).to.be.revertedWithCustomError(arbitrage, "OwnableUnauthorizedAccount");
    });
  });
}); 