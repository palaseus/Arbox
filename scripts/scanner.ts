import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

// Token addresses
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

// DEX addresses
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const SUSHI_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";

// Minimum profit threshold (in USDC)
const MIN_PROFIT_THRESHOLD = ethers.utils.parseUnits("10", 6); // 10 USDC

// Gas buffer (in ETH)
const GAS_BUFFER = ethers.utils.parseEther("0.01"); // 0.01 ETH

async function getUniswapV3Price(
  router: ethers.Contract,
  tokenIn: string,
  tokenOut: string,
  amount: BigNumber
): Promise<BigNumber> {
  const path = ethers.utils.solidityPack(
    ["address", "uint24", "address"],
    [tokenIn, 3000, tokenOut]
  );

  const quote = await router.quoteExactInput(path, amount);
  return quote;
}

async function getSushiPrice(
  router: ethers.Contract,
  tokenIn: string,
  tokenOut: string,
  amount: BigNumber
): Promise<BigNumber> {
  const path = [tokenIn, tokenOut];
  const amounts = await router.getAmountsOut(amount, path);
  return amounts[1];
}

async function checkArbitrageOpportunity(
  uniswapRouter: ethers.Contract,
  sushiRouter: ethers.Contract,
  flashLoanAmount: BigNumber
): Promise<{
  profitable: boolean;
  profit: BigNumber;
  uniswapPath: string;
  sushiPath: string[];
  minAmountOut: BigNumber;
}> {
  // Get prices
  const uniswapOutput = await getUniswapV3Price(
    uniswapRouter,
    USDC,
    WETH,
    flashLoanAmount
  );

  const sushiOutput = await getSushiPrice(
    sushiRouter,
    WETH,
    USDC,
    uniswapOutput
  );

  // Calculate profit
  const profit = sushiOutput.sub(flashLoanAmount);

  // Build paths
  const uniswapPath = ethers.utils.solidityPack(
    ["address", "uint24", "address"],
    [USDC, 3000, WETH]
  );
  const sushiPath = [WETH, USDC];

  // Calculate minimum output with slippage
  const minAmountOut = flashLoanAmount.sub(flashLoanAmount.mul(100).div(10000)); // 1% slippage

  return {
    profitable: profit.gt(MIN_PROFIT_THRESHOLD),
    profit,
    uniswapPath,
    sushiPath,
    minAmountOut
  };
}

async function main() {
  // Get signers
  const [wallet] = await ethers.getSigners();
  
  // Initialize Flashbots provider
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    ethers.provider,
    wallet,
    "https://relay.flashbots.net"
  );

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

  // Start monitoring
  console.log("Starting arbitrage scanner...");
  
  // Subscribe to new blocks
  ethers.provider.on("block", async (blockNumber) => {
    try {
      // Get current gas price
      const gasPrice = await ethers.provider.getGasPrice();
      const gasCost = gasPrice.mul(500000); // Estimated gas limit

      // Check if gas cost is too high
      if (gasCost.gt(GAS_BUFFER)) {
        console.log(`Gas price too high: ${ethers.utils.formatEther(gasCost)} ETH`);
        return;
      }

      // Check arbitrage opportunity
      const flashLoanAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC
      const opportunity = await checkArbitrageOpportunity(
        uniswapRouter,
        sushiRouter,
        flashLoanAmount
      );

      if (opportunity.profitable) {
        console.log("Profitable opportunity found!");
        console.log("Profit:", ethers.utils.formatUnits(opportunity.profit, 6), "USDC");
        
        // Build transaction
        const routes = [
          {
            router: UNISWAP_V3_ROUTER,
            tokenIn: USDC,
            tokenOut: WETH,
            amountIn: flashLoanAmount,
            minAmountOut: opportunity.minAmountOut,
            path: opportunity.uniswapPath,
            fee: 3000
          },
          {
            router: SUSHI_ROUTER,
            tokenIn: WETH,
            tokenOut: USDC,
            amountIn: 0, // Will be set by contract
            minAmountOut: flashLoanAmount.add(flashLoanAmount.mul(50).div(10000)), // 0.5% profit
            path: ethers.utils.solidityPack(
              ["address", "uint24", "address"],
              [WETH, 3000, USDC]
            ),
            fee: 3000
          }
        ];

        // Execute arbitrage
        const tx = await arbitrage.executeArbitrage(
          USDC,
          flashLoanAmount,
          routes,
          ethers.parseUnits("0.0001", 18) // minProfit
        );

        console.log("Transaction hash:", tx.hash);
        await tx.wait();
      }
    } catch (error) {
      console.error("Error in block processing:", error);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 