import { expect } from "chai";
import { ethers } from "hardhat";

describe("Constructor Test", function () {
  it("should deploy FlashLoanArbitrage with correct parameters", async function () {
    const [owner] = await ethers.getSigners();

    const MockAaveLendingPool = await ethers.getContractFactory("MockAaveLendingPool");
    const MockAaveAddressesProvider = await ethers.getContractFactory("MockAaveAddressesProvider");
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");

    const aavePool = await MockAaveLendingPool.deploy();
    const aaveAddressesProvider = await MockAaveAddressesProvider.deploy(await aavePool.getAddress());

    const flashLoanArbitrage = await FlashLoanArbitrage.deploy(
      await aaveAddressesProvider.getAddress(),
      await owner.getAddress(),
      ethers.parseEther("0.01"),
      1000, // minProfitPercentage
      500,  // maxSlippage
      100000000000 // maxGasPrice (100 gwei)
    );

    expect(await flashLoanArbitrage.getAddress()).to.be.a("string");
  });
});
