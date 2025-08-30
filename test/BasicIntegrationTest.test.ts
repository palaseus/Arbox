import { expect } from "chai";
import { ethers } from "hardhat";

describe("Basic Integration Test", function () {
  let owner: any;
  let tokenA: any;
  let tokenB: any;
  let uniswapRouter: any;
  let sushiswapRouter: any;
  let aavePool: any;
  let aaveAddressesProvider: any;
  let advancedArbitrageEngine: any;
  let flashLoanArbitrage: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

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
    aaveAddressesProvider = await MockAaveAddressesProvider.deploy(await aavePool.getAddress());

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

  describe("Contract Deployment", function () {
    it("should deploy all contracts successfully", async function () {
      expect(await tokenA.getAddress()).to.be.a("string");
      expect(await tokenB.getAddress()).to.be.a("string");
      expect(await uniswapRouter.getAddress()).to.be.a("string");
      expect(await sushiswapRouter.getAddress()).to.be.a("string");
      expect(await aavePool.getAddress()).to.be.a("string");
      expect(await aaveAddressesProvider.getAddress()).to.be.a("string");
      expect(await advancedArbitrageEngine.getAddress()).to.be.a("string");
      expect(await flashLoanArbitrage.getAddress()).to.be.a("string");
    });

    it("should set up roles correctly", async function () {
      const OPERATOR_ROLE = await advancedArbitrageEngine.OPERATOR_ROLE();
      const STRATEGIST_ROLE = await advancedArbitrageEngine.STRATEGIST_ROLE();
      const EMERGENCY_ROLE = await advancedArbitrageEngine.EMERGENCY_ROLE();

      expect(await advancedArbitrageEngine.hasRole(OPERATOR_ROLE, await owner.getAddress())).to.be.true;
      expect(await advancedArbitrageEngine.hasRole(STRATEGIST_ROLE, await owner.getAddress())).to.be.true;
      expect(await advancedArbitrageEngine.hasRole(EMERGENCY_ROLE, await owner.getAddress())).to.be.true;
    });

    it("should set up flash loan arbitrage correctly", async function () {
      expect(await flashLoanArbitrage.whitelistedTokens(await tokenA.getAddress())).to.be.true;
      expect(await flashLoanArbitrage.whitelistedTokens(await tokenB.getAddress())).to.be.true;
    });
  });

  describe("Token Operations", function () {
    it("should mint tokens correctly", async function () {
      const balance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      expect(balance).to.equal(ethers.parseEther("1000"));
    });

    it("should transfer tokens correctly", async function () {
      // First mint tokens to owner
      await tokenA.mint(await owner.getAddress(), ethers.parseEther("100"));
      await tokenA.transfer(await advancedArbitrageEngine.getAddress(), ethers.parseEther("50"));
      const balance = await tokenA.balanceOf(await advancedArbitrageEngine.getAddress());
      expect(balance).to.equal(ethers.parseEther("1050")); // 1000 + 50
    });
  });

  describe("Access Control", function () {
    it("should prevent unauthorized access to critical functions", async function () {
      const [_, unauthorized] = await ethers.getSigners();
      
      // Try to call a function that requires EMERGENCY_ROLE
      await expect(
        advancedArbitrageEngine.connect(unauthorized).emergencyStop("test")
      ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");
    });

    it("should allow authorized access to critical functions", async function () {
      // Owner should be able to emergency stop
      await expect(advancedArbitrageEngine.emergencyStop("test emergency")).to.not.be.reverted;
      
      // Owner should be able to resume
      await expect(advancedArbitrageEngine.resume()).to.not.be.reverted;
    });
  });
});
