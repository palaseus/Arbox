import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Advanced Arbitrage Engine to Testnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying from:", await deployer.getAddress());
  console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(await deployer.getAddress())), "ETH");
  
  // Deploy MEV Protector
  console.log("\n🛡️ Deploying MEV Protector...");
  const MEVProtector = await ethers.getContractFactory("MEVProtector");
  const mevProtector = await MEVProtector.deploy(await deployer.getAddress());
  await mevProtector.waitForDeployment();
  console.log("✅ MEV Protector deployed to:", await mevProtector.getAddress());
  
  // Deploy AI Strategy
  console.log("\n🤖 Deploying AI Strategy...");
  const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy");
  const aiStrategy = await AIStrategy.deploy();
  await aiStrategy.waitForDeployment();
  console.log("✅ AI Strategy deployed to:", await aiStrategy.getAddress());
  
  // Deploy Advanced Arbitrage Engine
  console.log("\n⚡ Deploying Advanced Arbitrage Engine...");
  const AdvancedArbitrageEngine = await ethers.getContractFactory("AdvancedArbitrageEngine");
  const advancedEngine = await AdvancedArbitrageEngine.deploy(
    await mevProtector.getAddress(),
    await deployer.getAddress()
  );
  await advancedEngine.waitForDeployment();
  console.log("✅ Advanced Engine deployed to:", await advancedEngine.getAddress());
  
  // Setup initial configuration
  console.log("\n🔧 Setting up initial configuration...");
  
  const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ROLE"));
  
  // Grant roles to deployer
  await advancedEngine.grantRole(STRATEGIST_ROLE, await deployer.getAddress());
  await advancedEngine.grantRole(OPERATOR_ROLE, await deployer.getAddress());
  await advancedEngine.grantRole(EMERGENCY_ROLE, await deployer.getAddress());
  console.log("✅ Roles granted to deployer");
  
  // Add AI Strategy
  const strategyId = ethers.keccak256(ethers.toUtf8Bytes("ai_strategy_v1"));
  const strategyConfig = {
    isActive: true,
    minProfit: ethers.parseEther("0.1"),
    maxSlippage: 100,
    gasLimit: 500000,
    cooldownPeriod: 0,
    lastExecution: 0,
    successRate: 0,
    avgProfit: 0
  };
  
  await advancedEngine.addStrategy(strategyId, await aiStrategy.getAddress(), strategyConfig);
  console.log("✅ AI Strategy added to engine");
  
  // Deployment Summary
  console.log("\n🎉 Deployment Complete!");
  console.log("==================================");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", await deployer.getAddress());
  console.log("MEV Protector:", await mevProtector.getAddress());
  console.log("AI Strategy:", await aiStrategy.getAddress());
  console.log("Advanced Engine:", await advancedEngine.getAddress());
  console.log("==================================");
  
  console.log("\n📋 Next Steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Test functionality with small amounts");
  console.log("3. Monitor performance with dashboard");
  console.log("4. Ready for mainnet deployment!");
  
  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: await deployer.getAddress(),
    timestamp: new Date().toISOString(),
    contracts: {
      mevProtector: await mevProtector.getAddress(),
      aiStrategy: await aiStrategy.getAddress(),
      advancedEngine: await advancedEngine.getAddress()
    }
  };
  
  const fs = require("fs");
  fs.writeFileSync(
    `deployment-testnet-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to file");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
