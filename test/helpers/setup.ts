import { ethers } from "hardhat";
import { Contract } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

export async function deployMockTokens() {
  try {
    // Deploy mock ERC20 tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    const tokenADeploy = await MockToken.deploy("Token A", "TKNA", 18);
    const tokenBDeploy = await MockToken.deploy("Token B", "TKNB", 18);
    const tokenCDeploy = await MockToken.deploy("Token C", "TKNC", 18);

    // Wait for deployments to be mined
    const tokenA = await tokenADeploy.waitForDeployment();
    const tokenB = await tokenBDeploy.waitForDeployment();
    const tokenC = await tokenCDeploy.waitForDeployment();

    // Deploy mock DEX routers
    const MockUniswapV3Router = await ethers.getContractFactory("MockUniswapV3Router");
    const MockSushiswapRouter = await ethers.getContractFactory("MockSushiswapRouter");
    const uniswapV3RouterDeploy = await MockUniswapV3Router.deploy();
    const sushiswapRouterDeploy = await MockSushiswapRouter.deploy();

    // Wait for deployments to be mined
    const uniswapV3Router = await uniswapV3RouterDeploy.waitForDeployment();
    const sushiswapRouter = await sushiswapRouterDeploy.waitForDeployment();

    // Deploy mock Aave lending pool
    const MockAaveLendingPool = await ethers.getContractFactory("MockAaveLendingPool");
    const aaveLendingPoolDeploy = await MockAaveLendingPool.deploy();
    const aaveLendingPool = await aaveLendingPoolDeploy.waitForDeployment();

    // Deploy mock Aave addresses provider
    const MockAaveAddressesProvider = await ethers.getContractFactory("MockAaveAddressesProvider");
    const aaveAddressesProviderDeploy = await MockAaveAddressesProvider.deploy(await aaveLendingPool.getAddress());
    const aaveAddressesProvider = await aaveAddressesProviderDeploy.waitForDeployment();

    console.log("Deployed mock contracts:");
    console.log("Token A:", await tokenA.getAddress());
    console.log("Token B:", await tokenB.getAddress());
    console.log("Token C:", await tokenC.getAddress());
    console.log("UniswapV3Router:", await uniswapV3Router.getAddress());
    console.log("SushiswapRouter:", await sushiswapRouter.getAddress());
    console.log("AaveLendingPool:", await aaveLendingPool.getAddress());
    console.log("AaveAddressesProvider:", await aaveAddressesProvider.getAddress());

    return {
      tokens: [tokenA, tokenB, tokenC],
      dexes: {
        uniswap: uniswapV3Router,
        sushiswap: sushiswapRouter
      },
      lendingPool: aaveLendingPool,
      addressesProvider: aaveAddressesProvider
    };
  } catch (error) {
    console.error("Error deploying mock contracts:", error);
    throw error;
  }
}

export async function setupLiquidity(
  uniswapRouter: Contract,
  sushiswapRouter: Contract,
  tokenA: Contract,
  tokenB: Contract,
  ratio: number
) {
  const [owner] = await ethers.getSigners();

  // Mint tokens to owner
  const amount = BigInt("1000000000000000000000000"); // 1M tokens
  await tokenA.mint(owner.address, amount);
  await tokenB.mint(owner.address, amount);

  // Approve routers
  await tokenA.approve(await uniswapRouter.getAddress(), amount);
  await tokenB.approve(await uniswapRouter.getAddress(), amount);
  await tokenA.approve(await sushiswapRouter.getAddress(), amount);
  await tokenB.approve(await sushiswapRouter.getAddress(), amount);

  // Add liquidity to Uniswap
  const uniswapAmountA = amount;
  const uniswapAmountB = BigInt(Math.floor(Number(amount) * ratio));
  await uniswapRouter.addLiquidity(
    await tokenA.getAddress(),
    await tokenB.getAddress(),
    uniswapAmountA,
    uniswapAmountB
  );

  // Add liquidity to Sushiswap with different ratio
  const sushiswapAmountA = amount;
  const sushiswapAmountB = BigInt(Math.floor(Number(amount) / ratio));
  await sushiswapRouter.addLiquidity(
    await tokenA.getAddress(),
    await tokenB.getAddress(),
    sushiswapAmountA,
    sushiswapAmountB
  );
} 