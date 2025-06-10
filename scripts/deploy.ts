import { ethers } from "hardhat";
import { config } from "../test/config/arbitrage.config";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy router implementations
  console.log("Deploying UniswapV3Router...");
  const UniswapV3Router = await ethers.getContractFactory("UniswapV3Router");
  const uniswapRouter = await UniswapV3Router.deploy(config.routers.UNISWAP_V3.address);
  await uniswapRouter.waitForDeployment();
  console.log("UniswapV3Router deployed to:", await uniswapRouter.getAddress());

  console.log("Deploying SushiSwapRouter...");
  const SushiSwapRouter = await ethers.getContractFactory("SushiSwapRouter");
  const sushiswapRouter = await SushiSwapRouter.deploy(config.routers.SUSHISWAP.address);
  await sushiswapRouter.waitForDeployment();
  console.log("SushiSwapRouter deployed to:", await sushiswapRouter.getAddress());

  console.log("Deploying BalancerRouter...");
  const BalancerRouter = await ethers.getContractFactory("BalancerRouter");
  const balancerRouter = await BalancerRouter.deploy(config.routers.BALANCER.address);
  await balancerRouter.waitForDeployment();
  console.log("BalancerRouter deployed to:", await balancerRouter.getAddress());

  // Deploy arbitrage contract
  console.log("Deploying FlashLoanArbitrage...");
  const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
  const minProfit = ethers.parseUnits("0.0001", 18);
  const minProfitPercentage = 50; // 0.5%
  const maxSlippage = 100; // 1%
  const maxGasPrice = ethers.parseUnits("100", 9); // 100 gwei
  const arbitrage = await FlashLoanArbitrage.deploy(
    config.tokens.WETH.address,
    minProfit,
    minProfitPercentage,
    maxSlippage,
    maxGasPrice
  );
  await arbitrage.waitForDeployment();
  console.log("FlashLoanArbitrage deployed to:", await arbitrage.getAddress());

  // Get token contracts
  const weth = await ethers.getContractAt("IERC20", config.tokens.WETH.address);
  const usdc = await ethers.getContractAt("IERC20", config.tokens.USDC.address);

  // Fund contract with WETH
  console.log("Funding contract with WETH...");
  const whale = await ethers.getSigner(config.tokens.WETH.whale);
  await weth.connect(whale).transfer(await arbitrage.getAddress(), config.testParams.defaultAmount);

  // Approve routers
  console.log("Approving routers...");
  await weth.approve(await uniswapRouter.getAddress(), ethers.MaxUint256);
  await weth.approve(await sushiswapRouter.getAddress(), ethers.MaxUint256);
  await weth.approve(await balancerRouter.getAddress(), ethers.MaxUint256);

  // Test arbitrage
  console.log("Testing arbitrage...");
  const path1 = ethers.solidityPacked(
    ["address", "uint24", "address"],
    [weth.target, 3000, usdc.target]
  );

  const path2 = ethers.solidityPacked(
    ["address", "uint24", "address"],
    [usdc.target, 3000, weth.target]
  );

  const routes = [
    {
      router: await uniswapRouter.getAddress(),
      path: path1,
      amountIn: config.testParams.defaultAmount,
      amountOutMin: 0n,
    },
    {
      router: await sushiswapRouter.getAddress(),
      path: path2,
      amountIn: 0n,
      amountOutMin: config.testParams.defaultAmount + config.testParams.minProfit,
    },
  ];

  const initialBalance = await weth.balanceOf(deployer.address);
  
  // Execute arbitrage with proper parameter structure
  await arbitrage.executeArbitrage(
    weth.target,
    config.testParams.defaultAmount,
    routes,
    config.testParams.minProfit
  );
  
  const finalBalance = await weth.balanceOf(deployer.address);
  const profit = finalBalance - initialBalance;
  console.log(`Profit: ${ethers.formatEther(profit)} WETH`);

  console.log("Deployment and test completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 