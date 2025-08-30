#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

// Use Hardhat's second account
const ALTERNATIVE_PRIVATE_KEY = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ALTERNATIVE_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

async function main() {
  console.log("🚀 Deploying with Alternative Account...");
  console.log("Account:", ALTERNATIVE_ADDRESS);
  console.log("");

  // Check balance first
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(ALTERNATIVE_PRIVATE_KEY, provider);
  
  const balance = await provider.getBalance(ALTERNATIVE_ADDRESS);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.log("❌ No ETH found. Please get testnet ETH for this address:");
    console.log("   Address:", ALTERNATIVE_ADDRESS);
    console.log("   Faucet: https://sepoliafaucet.com/");
    console.log("   Alternative: https://faucets.chain.link/sepolia");
    return;
  }

  console.log("✅ Sufficient balance found! Proceeding with deployment...");
  console.log("");

  // Deploy contracts
  const MEVProtector = await ethers.getContractFactory("MEVProtector", wallet);
  const mevProtector = await MEVProtector.deploy(ALTERNATIVE_ADDRESS);
  await mevProtector.waitForDeployment();
  const mevProtectorAddress = await mevProtector.getAddress();
  console.log("✅ MEV Protector:", mevProtectorAddress);

  const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy", wallet);
  const aiStrategy = await AIStrategy.deploy();
  await aiStrategy.waitForDeployment();
  const aiStrategyAddress = await aiStrategy.getAddress();
  console.log("✅ AI Strategy:", aiStrategyAddress);

  const AdvancedEngine = await ethers.getContractFactory("AdvancedArbitrageEngine", wallet);
  const advancedEngine = await AdvancedEngine.deploy(mevProtectorAddress, ALTERNATIVE_ADDRESS);
  await advancedEngine.waitForDeployment();
  const advancedEngineAddress = await advancedEngine.getAddress();
  console.log("✅ Advanced Engine:", advancedEngineAddress);

  console.log("");
  console.log("🎉 Deployment Complete!");
  console.log("🔗 View on Etherscan:");
  console.log(`   https://sepolia.etherscan.io/address/${advancedEngineAddress}`);
}

main().catch(console.error);
