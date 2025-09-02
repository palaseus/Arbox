import { ethers } from "hardhat";
import { AdvancedArbitrageEngine, MEVProtector } from "../typechain-types";

async function main() {
  console.log("🚀 Deploying Arbitrage Engine to Sepolia Testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying from: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance for deployment. Get testnet ETH from faucets.");
  }

  // Deploy MEV Protector first
  console.log("🔒 Deploying MEV Protector...");
  const mevProtector = await ethers.deployContract("MEVProtector", [deployer.address]);
  await mevProtector.waitForDeployment();
  const mevProtectorAddress = await mevProtector.getAddress();
  console.log(`✅ MEV Protector deployed to: ${mevProtectorAddress}`);

  // Deploy Advanced Arbitrage Engine
  console.log("\n⚡ Deploying Advanced Arbitrage Engine...");
  const advancedArbitrageEngine = await ethers.deployContract("AdvancedArbitrageEngine", [
    mevProtectorAddress,
    deployer.address, // admin
    deployer.address, // operator
    deployer.address  // treasury
  ]);
  await advancedArbitrageEngine.waitForDeployment();
  const engineAddress = await advancedArbitrageEngine.getAddress();
  console.log(`✅ Advanced Arbitrage Engine deployed to: ${engineAddress}`);

  // Grant roles
  console.log("\n🔑 Setting up roles and permissions...");
  
  const OPERATOR_ROLE = await advancedArbitrageEngine.OPERATOR_ROLE();
  const DEFAULT_ADMIN_ROLE = await advancedArbitrageEngine.DEFAULT_ADMIN_ROLE();
  
  await advancedArbitrageEngine.grantRole(OPERATOR_ROLE, deployer.address);
  console.log(`✅ Granted OPERATOR_ROLE to ${deployer.address}`);
  
  await advancedArbitrageEngine.grantRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log(`✅ Granted DEFAULT_ADMIN_ROLE to ${deployer.address}`);

  // Set initial risk parameters
  console.log("\n⚙️  Configuring initial risk parameters...");
  
  const riskParams = {
    maxExposurePerToken: ethers.parseEther("1000"), // 1000 ETH max per token
    maxExposurePerStrategy: ethers.parseEther("5000"), // 5000 ETH max per strategy
    minProfitThreshold: ethers.parseEther("0.001"), // 0.001 ETH minimum profit
    maxGasPrice: ethers.parseUnits("50", "gwei"), // 50 gwei max gas price
    maxSlippage: 500, // 5% max slippage
    maxBlockDelay: 3 // 3 blocks max delay
  };

  await advancedArbitrageEngine.updateRiskParams(riskParams);
  console.log("✅ Risk parameters configured");

  // Set token risk profiles
  console.log("\n🪙 Setting up token risk profiles...");
  
  const TOKENS = {
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    DAI: "0x68194a729C2450ad26072b3D33ADaCbcef39D574"
  };

  for (const [symbol, address] of Object.entries(TOKENS)) {
    try {
      await advancedArbitrageEngine.updateTokenRiskProfile(
        address,
        ethers.parseEther("100"), // 100 ETH max exposure
        1000 // 10% max slippage
      );
      console.log(`✅ ${symbol} risk profile configured`);
    } catch (error) {
      console.log(`⚠️  Failed to configure ${symbol}: ${error}`);
    }
  }

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  
  const isPaused = await advancedArbitrageEngine.paused();
  const hasOperatorRole = await advancedArbitrageEngine.hasRole(OPERATOR_ROLE, deployer.address);
  const hasAdminRole = await advancedArbitrageEngine.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  
  console.log(`📊 System Status:`);
  console.log(`  Paused: ${isPaused}`);
  console.log(`  Has Operator Role: ${hasOperatorRole}`);
  console.log(`  Has Admin Role: ${hasAdminRole}`);

  // Deployment summary
  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("=" * 50);
  console.log(`🌐 Network: Sepolia Testnet`);
  console.log(`🔒 MEV Protector: ${mevProtectorAddress}`);
  console.log(`⚡ Arbitrage Engine: ${engineAddress}`);
  console.log(`👤 Admin/Operator: ${deployer.address}`);
  console.log("=" * 50);
  
  console.log("\n🎯 Next Steps:");
  console.log("1. Verify contracts on Etherscan:");
  console.log(`   https://sepolia.etherscan.io/address/${engineAddress}`);
  console.log("2. Run real market test:");
  console.log(`   npx hardhat run scripts/real-market-test.ts --network sepolia`);
  console.log("3. Monitor system:");
  console.log(`   npx hardhat run scripts/monitor-testnet.ts --network sepolia`);

  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: 11155111,
    mevProtector: mevProtectorAddress,
    arbitrageEngine: engineAddress,
    admin: deployer.address,
    timestamp: new Date().toISOString()
  };

  console.log("\n💾 Deployment info saved to deployment-info.json");
  require('fs').writeFileSync(
    'deployment-info.json', 
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
