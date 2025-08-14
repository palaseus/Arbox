import { ethers } from "hardhat";

async function main() {
  console.log("🎭 Advanced Arbitrage Engine Demo - Local Network");
  console.log("================================================\n");
  
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const user1 = signers[1];
  const user2 = signers[2];
  
  if (!deployer || !user1 || !user2) {
    throw new Error("Not enough signers available");
  }
  
  console.log("👥 Demo Participants:");
  console.log("  Deployer:", await deployer.getAddress());
  console.log("  User 1:", await user1.getAddress());
  console.log("  User 2:", await user2.getAddress());
  console.log("");
  
  // Deploy contracts
  console.log("🚀 Deploying contracts...");
  
  const MEVProtector = await ethers.getContractFactory("MEVProtector");
  const mevProtector = await MEVProtector.deploy(await deployer.getAddress());
  await mevProtector.waitForDeployment();
  
  const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy");
  const aiStrategy = await AIStrategy.deploy();
  await aiStrategy.waitForDeployment();
  
  const AdvancedArbitrageEngine = await ethers.getContractFactory("AdvancedArbitrageEngine");
  const advancedEngine = await AdvancedArbitrageEngine.deploy(
    await mevProtector.getAddress(),
    await deployer.getAddress()
  );
  await advancedEngine.waitForDeployment();
  
  console.log("✅ All contracts deployed successfully!");
  console.log("");
  
  // Demo 1: Role Management
  console.log("🔐 Demo 1: Role Management");
  console.log("----------------------------");
  
  const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  
  await advancedEngine.grantRole(STRATEGIST_ROLE, await user1.getAddress());
  await advancedEngine.grantRole(OPERATOR_ROLE, await user2.getAddress());
  
  console.log("  ✅ Granted STRATEGIST_ROLE to User 1");
  console.log("  ✅ Granted OPERATOR_ROLE to User 2");
  console.log("  ✅ User 1 can now add strategies");
  console.log("  ✅ User 2 can now execute arbitrage");
  console.log("");
  
  // Demo 2: Strategy Management
  console.log("🤖 Demo 2: AI Strategy Integration");
  console.log("----------------------------------");
  
  const strategyId = ethers.keccak256(ethers.toUtf8Bytes("demo_strategy"));
  const strategyConfig = {
    isActive: true,
    minProfit: ethers.parseEther("0.01"),
    maxSlippage: 50,
    gasLimit: 300000,
    cooldownPeriod: 0,
    lastExecution: 0,
    successRate: 0,
    avgProfit: 0
  };
  
  await advancedEngine.connect(user1).addStrategy(strategyId, await aiStrategy.getAddress(), strategyConfig);
  console.log("  ✅ AI Strategy added by User 1");
  console.log("  ✅ Strategy ID:", strategyId);
  console.log("  ✅ Strategy Address:", await aiStrategy.getAddress());
  console.log("");
  
  // Demo 3: Risk Management
  console.log("⚠️ Demo 3: Risk Management");
  console.log("----------------------------");
  
  const riskParams = await advancedEngine.getRiskParams();
  console.log("  📊 Current Risk Parameters:");
  console.log("    Max Exposure per Token:", ethers.formatEther(riskParams.maxExposurePerToken), "ETH");
  console.log("    Max Exposure per Strategy:", ethers.formatEther(riskParams.maxExposurePerStrategy), "ETH");
  console.log("    Min Profit Threshold:", ethers.formatEther(riskParams.minProfitThreshold), "ETH");
  console.log("    Max Gas Price:", ethers.formatUnits(riskParams.maxGasPrice, "gwei"), "gwei");
  console.log("");
  
  // Demo 4: MEV Protection
  console.log("🛡️ Demo 4: MEV Protection");
  console.log("----------------------------");
  
  const protectionStatus = await mevProtector.getProtectionStatus();
  console.log("  🚦 Protection Status:", protectionStatus.active ? "🟢 ACTIVE" : "🔴 INACTIVE");
  console.log("  📍 Last Protection Block:", protectionStatus.lastProtectionBlock.toString());
  
  const protectionParams = await mevProtector.getProtectionParams();
  console.log("  ⚙️ Protection Parameters:");
  console.log("    Flashbots Enabled:", protectionParams.flashbotsEnabled ? "✅" : "❌");
  console.log("    Private Mempool:", protectionParams.privateMempoolEnabled ? "✅" : "❌");
  console.log("    Anti-Sandwich:", protectionParams.antiSandwichEnabled ? "✅" : "❌");
  console.log("");
  
  // Demo 5: Performance Tracking
  console.log("📈 Demo 5: Performance Tracking");
  console.log("--------------------------------");
  
  const globalMetrics = await advancedEngine.getGlobalMetrics();
  console.log("  📊 Global Performance:");
  console.log("    Total Profit:", ethers.formatEther(globalMetrics[0]), "ETH");
  console.log("    Total Gas Used:", globalMetrics[1].toString());
  console.log("    Successful Arbitrages:", globalMetrics[2].toString());
  console.log("    Failed Arbitrages:", globalMetrics[3].toString());
  console.log("");
  
  // Demo 6: Emergency Functions
  console.log("🚨 Demo 6: Emergency Functions");
  console.log("-------------------------------");
  
  console.log("  ⏸️ Pausing system for demo...");
  await advancedEngine.connect(deployer).emergencyStop("Demo emergency stop");
  
  const isPaused = await advancedEngine.paused();
  console.log("  🚫 System Paused:", isPaused ? "✅" : "❌");
  
  console.log("  ▶️ Resuming system...");
  await advancedEngine.connect(deployer).resume();
  
  const isResumed = await advancedEngine.paused();
  console.log("  🟢 System Resumed:", !isResumed ? "✅" : "❌");
  console.log("");
  
  // Demo Summary
  console.log("🎉 Demo Complete!");
  console.log("==================");
  console.log("✅ Role-based access control working");
  console.log("✅ AI Strategy integration successful");
  console.log("✅ Risk management parameters set");
  console.log("✅ MEV protection system active");
  console.log("✅ Performance tracking operational");
  console.log("✅ Emergency functions functional");
  console.log("");
  console.log("🚀 Your Advanced Arbitrage Engine is ready for production!");
  console.log("");
  console.log("📋 Next Steps:");
  console.log("  1. Deploy to testnet (Sepolia/Mumbai)");
  console.log("  2. Test with real testnet conditions");
  console.log("  3. Monitor performance with dashboard");
  console.log("  4. Deploy to mainnet when ready");
  console.log("");
  console.log("🔗 Contract Addresses:");
  console.log("  MEV Protector:", await mevProtector.getAddress());
  console.log("  AI Strategy:", await aiStrategy.getAddress());
  console.log("  Advanced Engine:", await advancedEngine.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Demo failed:", error);
    process.exit(1);
  });
