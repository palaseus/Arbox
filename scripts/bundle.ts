import { ethers } from "hardhat";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { BigNumber } from "ethers";

async function main() {
  // Get signers
  const [wallet] = await ethers.getSigners();
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    ethers.provider,
    wallet,
    "https://relay.flashbots.net"
  );

  // Get contract instance
  const arbitrage = await ethers.getContractAt(
    "FlashLoanArbitrage",
    process.env.ARBITRAGE_CONTRACT_ADDRESS || ""
  );

  // Build arbitrage transaction
  const flashLoanAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC
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

  // Build transaction
  const tx = await arbitrage.populateTransaction.executeArbitrage(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    flashLoanAmount,
    uniswapPath,
    sushiPath,
    0 // No minimum profit for simulation
  );

  // Get current block
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  
  // Calculate max priority fee
  const maxPriorityFeePerGas = BigNumber.from(3).mul(1e9); // 3 gwei

  // Build signed bundle
  const signedBundle = await flashbotsProvider.signBundle([
    {
      signer: wallet,
      transaction: {
        ...tx,
        maxFeePerGas: block.baseFeePerGas?.add(maxPriorityFeePerGas) || maxPriorityFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: 500000,
      },
    },
  ]);

  // Simulate bundle
  const simulation = await flashbotsProvider.simulate(
    signedBundle,
    blockNumber + 1
  );

  if ("error" in simulation) {
    console.log(`Simulation Error: ${simulation.error.message}`);
    return;
  }

  console.log(
    `Simulation Success: ${ethers.utils.formatEther(
      simulation.totalGasUsed.mul(block.baseFeePerGas || 0)
    )} ETH`
  );

  // Submit bundle
  const bundleSubmission = await flashbotsProvider.sendBundle(
    signedBundle,
    blockNumber + 1
  );

  console.log("Bundle submitted, waiting for response...");
  const resolution = await bundleSubmission.wait();
  console.log(`Bundle ${resolution ? "included" : "not included"} in block`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 