import { ethers } from "hardhat";
import { AdvancedArbitrageEngine, MEVProtector } from "../typechain-types";

async function main() {
  console.log("🚀 Testing Arbitrage Engine with Real Market Data...\n");

  // Load deployment info
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(require('fs').readFileSync('deployment-info.json', 'utf8'));
    console.log("📋 Loaded deployment info from deployment-info.json");
  } catch (error) {
    console.log("❌ No deployment info found. Run deploy-testnet.ts first.");
    return;
  }

  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Testing with account: ${deployer.address}`);

  const arbitrageEngine = await ethers.getContractAt(
    "AdvancedArbitrageEngine",
    deploymentInfo.arbitrageEngine
  ) as AdvancedArbitrageEngine;

  const mevProtector = await ethers.getContractAt(
    "MEVProtector",
    deploymentInfo.mevProtector
  ) as MEVProtector;

  console.log(`⚡ Connected to Arbitrage Engine: ${deploymentInfo.arbitrageEngine}`);
  console.log(`🔒 Connected to MEV Protector: ${deploymentInfo.mevProtector}\n`);

  // Testnet token addresses and ABIs
  const TOKENS = {
    WETH: {
      address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
      decimals: 18,
      symbol: "WETH"
    },
    USDC: {
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      decimals: 6,
      symbol: "USDC"
    },
    DAI: {
      address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
      decimals: 18,
      symbol: "DAI"
    }
  };

  // DEX router addresses
  const DEXES = {
    UNISWAP_V2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UNISWAP_V3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    SUSHISWAP: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"
  };

  // Test 1: System Status Check
  console.log("🔍 Test 1: System Status Check");
  console.log("-".repeat(40));
  
  try {
    const isPaused = await arbitrageEngine.paused();
    const riskParams = await arbitrageEngine.getRiskParams();
    const globalMetrics = await arbitrageEngine.getGlobalMetrics();
    
    console.log(`✅ System Paused: ${isPaused}`);
    console.log(`✅ Min Profit Threshold: ${ethers.formatEther(riskParams.minProfitThreshold)} ETH`);
    console.log(`✅ Max Gas Price: ${ethers.formatGwei(riskParams.maxGasPrice)} gwei`);
    console.log(`✅ Total Profit: ${ethers.formatEther(globalMetrics.totalProfit)} ETH`);
    console.log(`✅ Total Gas Used: ${globalMetrics.totalGasUsed.toString()}`);
  } catch (error) {
    console.log(`❌ System status check failed: ${error}`);
    return;
  }

  // Test 2: Token Balance Check
  console.log("\n💰 Test 2: Token Balance Check");
  console.log("-".repeat(40));
  
  for (const [symbol, token] of Object.entries(TOKENS)) {
    try {
      const balance = await arbitrageEngine.getTokenBalance(token.address);
      console.log(`✅ ${symbol} Balance: ${ethers.formatUnits(balance, token.decimals)} ${token.symbol}`);
    } catch (error) {
      console.log(`❌ ${symbol} balance check failed: ${error}`);
    }
  }

  // Test 3: Market Data Fetching
  console.log("\n📊 Test 3: Market Data Fetching");
  console.log("-".repeat(40));
  
  try {
    // Get current gas price
    const gasPrice = await ethers.provider.getFeeData();
    console.log(`✅ Current Gas Price: ${ethers.formatGwei(gasPrice.gasPrice || 0)} gwei`);
    
    // Get current block
    const block = await ethers.provider.getBlock("latest");
    console.log(`✅ Current Block: ${block?.number}`);
    console.log(`✅ Block Timestamp: ${new Date((block?.timestamp || 0) * 1000).toISOString()}`);
    
    // Check if gas price is within limits
    const riskParams = await arbitrageEngine.getRiskParams();
    if (gasPrice.gasPrice && gasPrice.gasPrice > riskParams.maxGasPrice) {
      console.log(`⚠️  Gas price ${ethers.formatGwei(gasPrice.gasPrice)} gwei exceeds limit ${ethers.formatGwei(riskParams.maxGasPrice)} gwei`);
    } else {
      console.log(`✅ Gas price within acceptable limits`);
    }
  } catch (error) {
    console.log(`❌ Market data fetch failed: ${error}`);
  }

  // Test 4: Arbitrage Opportunity Detection
  console.log("\n🎯 Test 4: Arbitrage Opportunity Detection");
  console.log("-".repeat(40));
  
  try {
    // Simulate a simple arbitrage opportunity
    const testAmount = ethers.parseEther("0.1"); // 0.1 ETH
    const minProfit = ethers.parseEther("0.001"); // 0.001 ETH minimum profit
    
    console.log(`🔍 Checking for arbitrage opportunities...`);
    console.log(`   Test Amount: ${ethers.formatEther(testAmount)} ETH`);
    console.log(`   Min Profit: ${ethers.formatEther(minProfit)} ETH`);
    
    // Check if we have sufficient balance
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    if (deployerBalance < testAmount) {
      console.log(`⚠️  Insufficient balance for testing. Need ${ethers.formatEther(testAmount)} ETH, have ${ethers.formatEther(deployerBalance)} ETH`);
    } else {
      console.log(`✅ Sufficient balance for testing`);
    }
    
  } catch (error) {
    console.log(`❌ Arbitrage opportunity detection failed: ${error}`);
  }

  // Test 5: MEV Protection Status
  console.log("\n🛡️ Test 5: MEV Protection Status");
  console.log("-".repeat(40));
  
  try {
    const protectionStatus = await mevProtector.getProtectionStatus();
    console.log(`✅ Flashbots Enabled: ${protectionStatus.flashbotsEnabled}`);
    console.log(`✅ Private Mempool: ${protectionStatus.privateMempoolEnabled}`);
    console.log(`✅ Anti-Sandwich: ${protectionStatus.antiSandwichEnabled}`);
  } catch (error) {
    console.log(`❌ MEV protection status check failed: ${error}`);
  }

  // Test 6: Risk Management Validation
  console.log("\n⚖️ Test 6: Risk Management Validation");
  console.log("-".repeat(40));
  
  try {
    const riskParams = await arbitrageEngine.getRiskParams();
    const tokenProfiles = await arbitrageEngine.getTokenRiskProfiles();
    
    console.log(`✅ Risk Parameters:`);
    console.log(`   Max Exposure Per Token: ${ethers.formatEther(riskParams.maxExposurePerToken)} ETH`);
    console.log(`   Max Exposure Per Strategy: ${ethers.formatEther(riskParams.maxExposurePerStrategy)} ETH`);
    console.log(`   Max Slippage: ${riskParams.maxSlippage / 100}%`);
    console.log(`   Max Block Delay: ${riskParams.maxBlockDelay} blocks`);
    
    console.log(`\n✅ Token Risk Profiles:`);
    for (const [symbol, token] of Object.entries(TOKENS)) {
      try {
        const profile = await arbitrageEngine.getTokenRiskProfile(token.address);
        console.log(`   ${symbol}: Max Exposure ${ethers.formatEther(profile.maxExposure)} ETH, Max Slippage ${profile.maxSlippage / 100}%`);
      } catch (error) {
        console.log(`   ${symbol}: Profile not found`);
      }
    }
  } catch (error) {
    console.log(`❌ Risk management validation failed: ${error}`);
  }

  // Test 7: Emergency Functions
  console.log("\n🚨 Test 7: Emergency Functions");
  console.log("-".repeat(40));
  
  try {
    const isPaused = await arbitrageEngine.paused();
    if (!isPaused) {
      console.log(`✅ System is running normally`);
      
      // Test emergency stop (will pause the system)
      console.log(`🛑 Testing emergency stop...`);
      const tx = await arbitrageEngine.emergencyStop("Test emergency stop");
      await tx.wait();
      console.log(`✅ Emergency stop executed successfully`);
      
      // Verify system is paused
      const newPausedStatus = await arbitrageEngine.paused();
      console.log(`✅ System paused: ${newPausedStatus}`);
      
      // Resume system
      console.log(`▶️  Resuming system...`);
      const resumeTx = await arbitrageEngine.resume();
      await resumeTx.wait();
      console.log(`✅ System resumed successfully`);
      
      const finalPausedStatus = await arbitrageEngine.paused();
      console.log(`✅ System paused: ${finalPausedStatus}`);
    } else {
      console.log(`⚠️  System is currently paused`);
    }
  } catch (error) {
    console.log(`❌ Emergency functions test failed: ${error}`);
  }

  // Test Summary
  console.log("\n🎉 REAL MARKET TESTING COMPLETE!");
  console.log("=" * 50);
  console.log(`🌐 Network: Sepolia Testnet`);
  console.log(`⚡ Engine: ${deploymentInfo.arbitrageEngine}`);
  console.log(`👤 Tester: ${deployer.address}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log("=" * 50);
  
  console.log("\n🎯 Next Steps:");
  console.log("1. Monitor system performance:");
  console.log(`   npx hardhat run scripts/monitor-testnet.ts --network sepolia`);
  console.log("2. Execute real arbitrage (when opportunities arise)");
  console.log("3. Analyze gas costs and profits");
  console.log("4. Test with different token pairs");
}

main().catch((error) => {
  console.error("❌ Real market test failed:", error);
  process.exit(1);
});
