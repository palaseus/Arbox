import { ethers } from "hardhat";
import { Contract } from "ethers";

async function main() {
  // Mainnet addresses
  const AAVE_POOL_ADDRESSES_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";
  const SUSHI_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  // Token addresses
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  
  // Get contract instances
  const arbitrage = await ethers.getContractAt(
    "FlashLoanArbitrage",
    process.env.ARBITRAGE_CONTRACT_ADDRESS || ""
  );
  
  const uniswapRouter = await ethers.getContractAt(
    "ISwapRouter",
    UNISWAP_V3_ROUTER
  );
  
  const sushiRouter = await ethers.getContractAt(
    "IUniswapV2Router02",
    SUSHI_ROUTER
  );
  
  // Get token instances
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const weth = await ethers.getContractAt("IERC20", WETH);
  
  // Build arbitrage transaction
  const flashLoanAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC
  const minAmountOut = flashLoanAmount - (flashLoanAmount * 100n) / 10000n; // Apply 1% slippage
  const uniswapPath = ethers.utils.solidityPack(
    ["address", "uint24", "address"],
    [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      3000, // 0.3% fee tier
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // WETH
    ]
  );
  const sushiPath = [
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  // USDC
  ];

  // Encode transaction data
  const data = arbitrage.interface.encodeFunctionData("executeArbitrage", [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    flashLoanAmount,
    [
      {
        router: UNISWAP_V3_ROUTER,
        tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        amountIn: flashLoanAmount,
        minAmountOut: minAmountOut,
        path: uniswapPath,
        fee: 3000
      },
      {
        router: SUSHI_ROUTER,
        tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        tokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        amountIn: 0, // Will be set by contract
        minAmountOut: flashLoanAmount + (flashLoanAmount * 50n) / 10000n, // 0.5% profit
        path: ethers.utils.solidityPack(
          ["address", "uint24", "address"],
          ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 3000, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]
        ),
        fee: 3000
      }
    ],
    ethers.parseUnits("0.0001", 18) // minProfit
  ]);
  
  try {
    // Simulate arbitrage
    console.log("Simulating arbitrage...");
    console.log("Flash loan amount:", ethers.utils.formatUnits(flashLoanAmount, 6), "USDC");
    
    // Get initial balances
    const initialUsdcBalance = await usdc.balanceOf(process.env.PROFIT_RECIPIENT || "");
    console.log("Initial USDC balance:", ethers.utils.formatUnits(initialUsdcBalance, 6));
    
    // Execute arbitrage
    const tx = await arbitrage.executeArbitrage(
      USDC,
      flashLoanAmount,
      routeObjs,
      0 // No minimum profit for simulation
    );
    
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    
    // Get final balances
    const finalUsdcBalance = await usdc.balanceOf(process.env.PROFIT_RECIPIENT || "");
    console.log("Final USDC balance:", ethers.utils.formatUnits(finalUsdcBalance, 6));
    
    const profit = finalUsdcBalance.sub(initialUsdcBalance);
    console.log("Profit:", ethers.utils.formatUnits(profit, 6), "USDC");
    
  } catch (error) {
    console.error("Simulation failed:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 