import { expect } from "chai";
import { ethers } from "hardhat";

describe("Debug Test", function () {
  it("should deploy all mock contracts", async function () {
    const [owner] = await ethers.getSigners();

    console.log("Deploying MockERC20...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
    console.log("MockERC20 deployed successfully");

    console.log("Deploying MockUniswapV3Router...");
    const MockUniswapV3Router = await ethers.getContractFactory("MockUniswapV3Router");
    const uniswapRouter = await MockUniswapV3Router.deploy();
    console.log("MockUniswapV3Router deployed successfully");

    console.log("Deploying MockSushiswapRouter...");
    const MockSushiswapRouter = await ethers.getContractFactory("MockSushiswapRouter");
    const sushiswapRouter = await MockSushiswapRouter.deploy();
    console.log("MockSushiswapRouter deployed successfully");

    console.log("Deploying MockAaveLendingPool...");
    const MockAaveLendingPool = await ethers.getContractFactory("MockAaveLendingPool");
    const aavePool = await MockAaveLendingPool.deploy();
    console.log("MockAaveLendingPool deployed successfully");

    console.log("Deploying MockAaveAddressesProvider...");
    const MockAaveAddressesProvider = await ethers.getContractFactory("MockAaveAddressesProvider");
    const aaveAddressesProvider = await MockAaveAddressesProvider.deploy(await aavePool.getAddress());
    console.log("MockAaveAddressesProvider deployed successfully");

    console.log("Deploying AdvancedArbitrageEngine...");
    const AdvancedArbitrageEngine = await ethers.getContractFactory("AdvancedArbitrageEngine");
    const advancedArbitrageEngine = await AdvancedArbitrageEngine.deploy(
      ethers.ZeroAddress, // mevProtector - using zero address for now
      await owner.getAddress() // admin
    );
    console.log("AdvancedArbitrageEngine deployed successfully");

    console.log("Deploying FlashLoanArbitrage...");
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    const flashLoanArbitrage = await FlashLoanArbitrage.deploy(
      await aaveAddressesProvider.getAddress(),
      await owner.getAddress(),
      ethers.parseEther("0.01"),
      1000, // minProfitPercentage
      500,  // maxSlippage
      100000000000 // maxGasPrice (100 gwei)
    );
    console.log("FlashLoanArbitrage deployed successfully");

    expect(await tokenA.getAddress()).to.be.a("string");
    expect(await uniswapRouter.getAddress()).to.be.a("string");
    expect(await sushiswapRouter.getAddress()).to.be.a("string");
    expect(await aavePool.getAddress()).to.be.a("string");
    expect(await aaveAddressesProvider.getAddress()).to.be.a("string");
    expect(await advancedArbitrageEngine.getAddress()).to.be.a("string");
    expect(await flashLoanArbitrage.getAddress()).to.be.a("string");
  });
});
