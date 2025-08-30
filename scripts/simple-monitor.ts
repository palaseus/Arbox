#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenvConfig();

interface MonitoringConfig {
  rpcUrl: string;
  contractAddress: string;
  mevProtectorAddress: string;
  updateInterval: number;
}

class SimpleArbitrageMonitor {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private mevProtector: ethers.Contract;
  private config: MonitoringConfig;
  private isRunning: boolean = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(
      config.contractAddress,
      [
        "function getGlobalMetrics() external view returns (uint256, uint256, uint256, uint256)",
        "function getActiveStrategies() external view returns (bytes32[])",
        "function getRiskParams() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
        "function paused() external view returns (bool)"
      ],
      this.provider
    );
    
    this.mevProtector = new ethers.Contract(
      config.mevProtectorAddress,
      [
        "function getProtectionStatus() external view returns (bool, uint256)",
        "function getProtectionParams() external view returns (bool, bool, uint256, uint256, uint256, bool, bool)"
      ],
      this.provider
    );
  }

  /**
   * Start the monitoring process
   */
  async start(): Promise<void> {
    console.log("🚀 Starting Simple Arbitrage Monitor...");
    console.log(`📊 Monitoring contract: ${this.config.contractAddress}`);
    console.log(`🛡️ MEV Protector: ${this.config.mevProtectorAddress}`);
    console.log(`⏱️ Update interval: ${this.config.updateInterval}ms`);
    console.log("Press Ctrl+C to stop monitoring\n");

    this.isRunning = true;
    
    // Initial data fetch
    await this.updateMetrics();
    
    // Start monitoring loop
    while (this.isRunning) {
      try {
        await this.updateMetrics();
        await this.sleep(this.config.updateInterval);
      } catch (error) {
        console.error("❌ Error updating metrics:", error);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  /**
   * Stop the monitoring process
   */
  stop(): void {
    this.isRunning = false;
    console.log("\n🛑 Monitoring stopped");
  }

  /**
   * Update and display metrics
   */
  private async updateMetrics(): Promise<void> {
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      // Get contract metrics
      const [totalProfit, totalGasUsed, successfulArbitrages, failedArbitrages] = 
        await this.contract.getGlobalMetrics();
      
      const isPaused = await this.contract.paused();
      
      // Get MEV protection status
      const [protectionActive, lastProtectionBlock] = 
        await this.mevProtector.getProtectionStatus();
      
      const [flashbotsEnabled, privateMempoolEnabled, maxGasPrice, minBribeAmount, protectionWindow, antiSandwichEnabled, frontrunProtectionEnabled] = 
        await this.mevProtector.getProtectionParams();

      // Clear console and display metrics
      console.clear();
      console.log("=".repeat(60));
      console.log(`🎯 ADVANCED ARBITRAGE ENGINE MONITOR - ${timestamp}`);
      console.log("=".repeat(60));
      
      // Contract Status
      console.log("\n📊 CONTRACT STATUS:");
      console.log(`   Status: ${isPaused ? "⏸️ PAUSED" : "🟢 ACTIVE"}`);
      console.log(`   Total Profit: ${ethers.formatEther(totalProfit)} ETH`);
      console.log(`   Total Gas Used: ${totalGasUsed.toString()}`);
      console.log(`   Successful Arbitrages: ${successfulArbitrages.toString()}`);
      console.log(`   Failed Arbitrages: ${failedArbitrages.toString()}`);
      
      const successRate = successfulArbitrages > 0 || failedArbitrages > 0 
        ? (Number(successfulArbitrages) / (Number(successfulArbitrages) + Number(failedArbitrages)) * 100).toFixed(2)
        : "0.00";
      console.log(`   Success Rate: ${successRate}%`);
      
      // MEV Protection Status
      console.log("\n🛡️ MEV PROTECTION:");
      console.log(`   Status: ${protectionActive ? "🟢 ACTIVE" : "🔴 INACTIVE"}`);
      console.log(`   Last Protection Block: ${lastProtectionBlock.toString()}`);
      console.log(`   Flashbots: ${flashbotsEnabled ? "✅" : "❌"}`);
      console.log(`   Private Mempool: ${privateMempoolEnabled ? "✅" : "❌"}`);
      console.log(`   Anti-Sandwich: ${antiSandwichEnabled ? "✅" : "❌"}`);
      console.log(`   Frontrun Protection: ${frontrunProtectionEnabled ? "✅" : "❌"}`);
      console.log(`   Max Gas Price: ${ethers.formatUnits(maxGasPrice, "gwei")} gwei`);
      console.log(`   Min Bribe Amount: ${ethers.formatEther(minBribeAmount)} ETH`);
      console.log(`   Protection Window: ${protectionWindow.toString()} blocks`);

      // Performance Metrics
      if (Number(totalProfit) > 0) {
        const avgProfit = Number(totalProfit) / Number(successfulArbitrages);
        const avgGasUsed = Number(totalGasUsed) / Number(successfulArbitrages);
        console.log("\n📈 PERFORMANCE METRICS:");
        console.log(`   Average Profit per Trade: ${ethers.formatEther(avgProfit.toString())} ETH`);
        console.log(`   Average Gas per Trade: ${avgGasUsed.toFixed(0)}`);
      }

      console.log("\n" + "=".repeat(60));
      console.log("🔄 Next update in 5 seconds...");
      
    } catch (error) {
      console.error("❌ Error fetching metrics:", error);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const contractAddress = process.env.ARBITRAGE_CONTRACT_ADDRESS;
  const mevProtectorAddress = process.env.MEV_PROTECTOR_ADDRESS;
  
  if (!contractAddress || !mevProtectorAddress) {
    console.error("❌ Please set ARBITRAGE_CONTRACT_ADDRESS and MEV_PROTECTOR_ADDRESS environment variables");
    process.exit(1);
  }

  const config: MonitoringConfig = {
    rpcUrl: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
    contractAddress,
    mevProtectorAddress,
    updateInterval: 5000 // 5 seconds
  };

  const monitor = new SimpleArbitrageMonitor(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });

  await monitor.start();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
