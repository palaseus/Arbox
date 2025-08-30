#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

async function main() {
  console.log("🚀 Deploying to Local Mainnet Fork...");
  console.log("This will give you real ETH to test with!");
  console.log("");

  // Connect to local hardhat node (which should be forking mainnet)
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // Use different accounts to avoid nonce conflicts
  const account1 = new ethers.Wallet("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const account2 = new ethers.Wallet("59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider);
  const account3 = new ethers.Wallet("5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", provider);
  
  const balance = await provider.getBalance(await account1.getAddress());
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
  console.log("");

  if (balance === 0n) {
    console.log("❌ No ETH found. Starting local node with mainnet fork...");
    console.log("Run this command in another terminal:");
    console.log("npx hardhat node --fork https://mainnet.infura.io/v3/47a4155be9f941a5a5a6a6c841f01831");
    return;
  }

  console.log("✅ Sufficient balance found! Deploying contracts...");
  console.log("");

  try {
    const { ethers } = require("hardhat");
    
    // Deploy MEV Protector with account 1
    console.log("📦 Deploying MEV Protector...");
    const MEVProtector = await ethers.getContractFactory("MEVProtector", account1);
    const mevProtector = await MEVProtector.deploy(await account1.getAddress());
    await mevProtector.waitForDeployment();
    const mevProtectorAddress = await mevProtector.getAddress();
    console.log("✅ MEV Protector:", mevProtectorAddress);

    // Deploy AI Strategy with account 2
    console.log("🤖 Deploying AI Strategy...");
    const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy", account2);
    const aiStrategy = await AIStrategy.deploy();
    await aiStrategy.waitForDeployment();
    const aiStrategyAddress = await aiStrategy.getAddress();
    console.log("✅ AI Strategy:", aiStrategyAddress);

    // Deploy Advanced Engine with account 3
    console.log("⚡ Deploying Advanced Engine...");
    const AdvancedEngine = await ethers.getContractFactory("AdvancedArbitrageEngine", account3);
    const advancedEngine = await AdvancedEngine.deploy(mevProtectorAddress, await account3.getAddress());
    await advancedEngine.waitForDeployment();
    const advancedEngineAddress = await advancedEngine.getAddress();
    console.log("✅ Advanced Engine:", advancedEngineAddress);

    console.log("");
    console.log("🎉 Deployment Complete!");
    console.log("🔗 Contract Addresses:");
    console.log(`   MEV Protector: ${mevProtectorAddress}`);
    console.log(`   AI Strategy: ${aiStrategyAddress}`);
    console.log(`   Advanced Engine: ${advancedEngineAddress}`);
    console.log("");
    console.log("📊 You can now test with real mainnet data!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
  }
}

main().catch(console.error);
