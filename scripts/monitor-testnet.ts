import { ethers } from "hardhat";
import { AdvancedArbitrageEngine, MEVProtector } from "../typechain-types";

async function main() {
  console.log("📊 Monitoring Arbitrage Engine on Testnet...\n");

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
  const arbitrageEngine = await ethers.getContractAt(
    "AdvancedArbitrageEngine",
    deploymentInfo.arbitrageEngine
  ) as AdvancedArbitrageEngine;

  const mevProtector = await ethers.getContractAt(
    "MEVProtector",
    deploymentInfo.mevProtector
  ) as MEVProtector;

  console.log(`🌐 Network: Sepolia Testnet`);
  console.log(`⚡ Engine: ${deploymentInfo.arbitrageEngine}`);
  console.log(`👤 Monitor: ${deployer.address}\n`);

  // Monitoring loop
  let iteration = 1;
  const maxIterations = 10; // Monitor for 10 iterations

  while (iteration <= maxIterations) {
    console.log(`\n🔄 Monitoring Iteration ${iteration}/${maxIterations}`);
    console.log("=" * 50);
    console.log(`⏰ ${new Date().toISOString()}`);

    try {
      // 1. System Status
      const isPaused = await arbitrageEngine.paused();
      console.log(`📊 System Status: ${isPaused ? 'PAUSED' : 'RUNNING'}`);

      // 2. Network Conditions
      const gasPrice = await ethers.provider.getFeeData();
      const block = await ethers.provider.getBlock("latest");
      console.log(`⛽ Gas Price: ${ethers.formatGwei(gasPrice.gasPrice || 0)} gwei`);
      console.log(`🔢 Block: ${block?.number}`);

      // 3. Risk Parameters
      const riskParams = await arbitrageEngine.getRiskParams();
      if (gasPrice.gasPrice && gasPrice.gasPrice > riskParams.maxGasPrice) {
        console.log(`⚠️  GAS PRICE TOO HIGH! Current: ${ethers.formatGwei(gasPrice.gasPrice)} gwei, Max: ${ethers.formatGwei(riskParams.maxGasPrice)} gwei`);
      }

      // 4. Global Metrics
      const globalMetrics = await arbitrageEngine.getGlobalMetrics();
      console.log(`💰 Total Profit: ${ethers.formatEther(globalMetrics.totalProfit)} ETH`);
      console.log(`⛽ Total Gas Used: ${globalMetrics.totalGasUsed.toString()}`);
      console.log(`📈 Successful Arbitrages: ${globalMetrics.successfulArbitrages.toString()}`);
      console.log(`❌ Failed Arbitrages: ${globalMetrics.failedArbitrages.toString()}`);

      // 5. Token Balances
      const TOKENS = {
        WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        DAI: "0x68194a729C2450ad26072b3D33ADaCbcef39D574"
      };

      console.log(`\n🪙 Token Balances:`);
      for (const [symbol, address] of Object.entries(TOKENS)) {
        try {
          const balance = await arbitrageEngine.getTokenBalance(address);
          const profile = await arbitrageEngine.getTokenRiskProfile(address);
          const exposurePercent = (Number(balance) / Number(profile.maxExposure)) * 100;
          
          console.log(`  ${symbol}: ${ethers.formatEther(balance)} ETH (${exposurePercent.toFixed(2)}% of max)`);
          
          if (exposurePercent > 80) {
            console.log(`    ⚠️  HIGH EXPOSURE WARNING!`);
          }
        } catch (error) {
          console.log(`  ${symbol}: Error checking balance`);
        }
      }

      // 6. MEV Protection Status
      try {
        const protectionStatus = await mevProtector.getProtectionStatus();
        console.log(`\n🛡️ MEV Protection:`);
        console.log(`  Flashbots: ${protectionStatus.flashbotsEnabled ? '✅' : '❌'}`);
        console.log(`  Private Mempool: ${protectionStatus.privateMempoolEnabled ? '✅' : '❌'}`);
        console.log(`  Anti-Sandwich: ${protectionStatus.antiSandwichEnabled ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`\n🛡️ MEV Protection: Error checking status`);
      }

      // 7. Arbitrage Opportunity Check
      console.log(`\n🎯 Arbitrage Opportunity Check:`);
      try {
        // Check if there are any profitable opportunities
        const testAmount = ethers.parseEther("0.1");
        const minProfit = riskParams.minProfitThreshold;
        
        // This is a simplified check - in reality you'd compare prices across DEXes
        console.log(`  Test Amount: ${ethers.formatEther(testAmount)} ETH`);
        console.log(`  Min Profit Required: ${ethers.formatEther(minProfit)} ETH`);
        console.log(`  Current Gas Cost: ~${ethers.formatEther((gasPrice.gasPrice || 0) * BigInt(300000))} ETH`);
        
        // Simple profitability check
        if (minProfit > (gasPrice.gasPrice || 0) * BigInt(300000)) {
          console.log(`  ✅ Potential for profitable arbitrage`);
        } else {
          console.log(`  ⚠️  Gas costs may exceed profit threshold`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking opportunities: ${error}`);
      }

      // 8. Performance Metrics
      if (globalMetrics.successfulArbitrages > 0) {
        const avgProfit = globalMetrics.totalProfit / globalMetrics.successfulArbitrages;
        const successRate = (Number(globalMetrics.successfulArbitrages) / 
                           (Number(globalMetrics.successfulArbitrages) + Number(globalMetrics.failedArbitrages))) * 100;
        
        console.log(`\n📈 Performance Metrics:`);
        console.log(`  Average Profit: ${ethers.formatEther(avgProfit)} ETH`);
        console.log(`  Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`  Gas Efficiency: ${ethers.formatEther(globalMetrics.totalProfit)} ETH profit / ${globalMetrics.totalGasUsed} gas`);
      }

    } catch (error) {
      console.log(`❌ Monitoring error: ${error}`);
    }

    // Wait before next iteration (30 seconds)
    if (iteration < maxIterations) {
      console.log(`\n⏳ Waiting 30 seconds before next check...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    iteration++;
  }

  console.log(`\n🎉 Monitoring Complete!`);
  console.log(`📊 Checked system ${maxIterations} times`);
  console.log(`⏰ Duration: ${maxIterations * 30} seconds`);
  
  console.log(`\n🎯 Next Steps:`);
  console.log(`1. Analyze the monitoring data above`);
  console.log(`2. Adjust risk parameters if needed`);
  console.log(`3. Execute arbitrage when profitable opportunities arise`);
  console.log(`4. Run monitoring again to track changes`);
}

main().catch((error) => {
  console.error("❌ Monitoring failed:", error);
  process.exit(1);
});
