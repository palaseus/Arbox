import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import axios from "axios";

// Tenderly API configuration
const TENDERLY_API = "https://api.tenderly.co/api/v1";
const TENDERLY_USER = process.env.TENDERLY_USER_ID;
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT_ID;
const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY;

async function simulateTransaction(
  from: string,
  to: string,
  data: string,
  value: string = "0",
  networkId: string = "1"
) {
  const response = await axios.post(
    `${TENDERLY_API}/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`,
    {
      network_id: networkId,
      from,
      to,
      input: data,
      value,
      save: true,
    },
    {
      headers: {
        "X-Access-Key": TENDERLY_ACCESS_KEY,
      },
    }
  );

  return response.data;
}

async function main() {
  // Get contract instance
  const arbitrage = await ethers.getContractAt(
    "FlashLoanArbitrage",
    process.env.ARBITRAGE_CONTRACT_ADDRESS || ""
  );

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

  // Encode transaction data
  const data = arbitrage.interface.encodeFunctionData("executeArbitrage", [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    flashLoanAmount,
    [
      {
        router: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
        tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        amountIn: flashLoanAmount,
        minAmountOut: minAmountOut,
        path: uniswapPath,
        fee: 3000
      },
      {
        router: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router
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

  // Simulate transaction
  console.log("Simulating arbitrage transaction...");
  const simulation = await simulateTransaction(
    process.env.PROFIT_RECIPIENT || "", // from address
    arbitrage.address, // to address
    data
  );

  // Process simulation results
  if (simulation.transaction.status) {
    console.log("Simulation successful!");
    console.log("Gas used:", simulation.transaction.gas_used);
    console.log("Gas price:", ethers.utils.formatUnits(simulation.transaction.gas_price, "gwei"), "gwei");
    console.log("Total cost:", ethers.utils.formatEther(simulation.transaction.gas_used.mul(simulation.transaction.gas_price)), "ETH");
    
    // Check for profit
    const profitRecipient = process.env.PROFIT_RECIPIENT || "";
    const initialBalance = BigNumber.from(simulation.transaction.initial_state.balances[profitRecipient]);
    const finalBalance = BigNumber.from(simulation.transaction.final_state.balances[profitRecipient]);
    const profit = finalBalance.sub(initialBalance);
    
    console.log("Profit:", ethers.utils.formatUnits(profit, 6), "USDC");
  } else {
    console.log("Simulation failed!");
    console.log("Error:", simulation.transaction.error_message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 