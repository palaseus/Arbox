#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import chalk from "chalk";
import { AdvancedArbitrageEngine } from "../typechain-types/contracts/AdvancedArbitrageEngine";
import { PriceOracle } from "../typechain-types/contracts/oracles/PriceOracle";
import { AdvancedMEVProtector } from "../typechain-types/contracts/protection/AdvancedMEVProtector";
import { CrossChainBridge } from "../typechain-types/contracts/bridges/CrossChainBridge";

dotenvConfig();

interface DashboardMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  totalProfit: string;
  averageProfit: string;
  successRate: number;
  totalGasUsed: number;
  averageGasUsed: number;
  activeStrategies: number;
  lastExecution: string;
  systemStatus: string;
}

interface NetworkMetrics {
  chainId: number;
  name: string;
  totalTransfers: number;
  totalVolume: string;
  totalFees: string;
  activeRelayers: number;
}

interface DEXMetrics {
  name: string;
  totalSwaps: number;
  totalVolume: string;
  totalFees: string;
  activePools: number;
}

class MonitoringDashboard {
  private arbitrageEngine: AdvancedArbitrageEngine;
  private priceOracle: PriceOracle;
  private mevProtector: AdvancedMEVProtector;
  private crossChainBridge: CrossChainBridge;
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.arbitrageEngine = {} as AdvancedArbitrageEngine;
    this.priceOracle = {} as PriceOracle;
    this.mevProtector = {} as AdvancedMEVProtector;
    this.crossChainBridge = {} as CrossChainBridge;
  }

  async initialize() {
    console.log(chalk.blue("🔧 Initializing Monitoring Dashboard..."));
    
    try {
      // Initialize contract instances (you would need to deploy these first)
      // For now, we'll simulate the dashboard
      console.log(chalk.green("✅ Dashboard initialized successfully"));
    } catch (error) {
      console.error(chalk.red("❌ Failed to initialize dashboard:"), error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log(chalk.yellow("⚠️  Dashboard is already running"));
      return;
    }

    this.isRunning = true;
    console.log(chalk.green("🚀 Starting Real-Time Monitoring Dashboard..."));
    console.log(chalk.cyan("Press Ctrl+C to stop the dashboard"));
    console.log("");

    // Initial display
    await this.displayDashboard();

    // Start periodic updates
    this.updateInterval = setInterval(async () => {
      await this.displayDashboard();
    }, 5000); // Update every 5 seconds
  }

  async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log(chalk.yellow("🛑 Dashboard stopped"));
  }

  private async displayDashboard() {
    // Clear console
    console.clear();
    
    // Get current timestamp
    const now = new Date();
    
    // Display header
    console.log(chalk.bold.blue("=".repeat(80)));
    console.log(chalk.bold.blue("🤖 ADVANCED DEFI ARBITRAGE ENGINE - REAL-TIME MONITORING DASHBOARD"));
    console.log(chalk.bold.blue("=".repeat(80)));
    console.log(chalk.gray(`Last Updated: ${now.toLocaleString()}`));
    console.log("");

    // Get metrics
    const metrics = await this.getMetrics();
    const networkMetrics = await this.getNetworkMetrics();
    const dexMetrics = await this.getDEXMetrics();

    // Display main metrics
    this.displayMainMetrics(metrics);
    
    // Display network metrics
    this.displayNetworkMetrics(networkMetrics);
    
    // Display DEX metrics
    this.displayDEXMetrics(dexMetrics);
    
    // Display system status
    this.displaySystemStatus(metrics);
    
    // Display recent activity
    await this.displayRecentActivity();
    
    // Display footer
    console.log(chalk.bold.blue("=".repeat(80)));
    console.log(chalk.gray("Press Ctrl+C to stop monitoring"));
  }

  private async getMetrics(): Promise<DashboardMetrics> {
    // Simulate metrics (in real implementation, these would come from contracts)
    return {
      totalExecutions: 47,
      successfulExecutions: 42,
      totalProfit: "3.2",
      averageProfit: "0.068",
      successRate: 89.4,
      totalGasUsed: 2450000,
      averageGasUsed: 52128,
      activeStrategies: 3,
      lastExecution: "2 minutes ago",
      systemStatus: "ACTIVE"
    };
  }

  private async getNetworkMetrics(): Promise<NetworkMetrics[]> {
    return [
      {
        chainId: 1,
        name: "Ethereum",
        totalTransfers: 12,
        totalVolume: "45.2",
        totalFees: "0.226",
        activeRelayers: 2
      },
      {
        chainId: 137,
        name: "Polygon",
        totalTransfers: 8,
        totalVolume: "23.1",
        totalFees: "0.116",
        activeRelayers: 1
      },
      {
        chainId: 42161,
        name: "Arbitrum",
        totalTransfers: 5,
        totalVolume: "18.7",
        totalFees: "0.094",
        activeRelayers: 1
      }
    ];
  }

  private async getDEXMetrics(): Promise<DEXMetrics[]> {
    return [
      {
        name: "Uniswap V3",
        totalSwaps: 25,
        totalVolume: "156.8",
        totalFees: "0.471",
        activePools: 12
      },
      {
        name: "Balancer V2",
        totalSwaps: 15,
        totalVolume: "89.3",
        totalFees: "0.268",
        activePools: 8
      },
      {
        name: "Curve Finance",
        totalSwaps: 18,
        totalVolume: "234.1",
        totalFees: "0.585",
        activePools: 15
      }
    ];
  }

  private displayMainMetrics(metrics: DashboardMetrics) {
    console.log(chalk.bold.cyan("📊 PERFORMANCE METRICS"));
    console.log(chalk.cyan("-".repeat(50)));
    
    const profitColor = parseFloat(metrics.totalProfit) > 0 ? chalk.green : chalk.red;
    const successColor = metrics.successRate > 80 ? chalk.green : chalk.yellow;
    
    console.log(`Total Executions:     ${chalk.white(metrics.totalExecutions.toString())}`);
    console.log(`Successful Executions: ${chalk.white(metrics.successfulExecutions.toString())}`);
    console.log(`Success Rate:         ${successColor(`${metrics.successRate}%`)}`);
    console.log(`Total Profit:         ${profitColor(`${metrics.totalProfit} ETH`)}`);
    console.log(`Average Profit:       ${profitColor(`${metrics.averageProfit} ETH`)}`);
    console.log(`Total Gas Used:       ${chalk.white(metrics.totalGasUsed.toLocaleString())}`);
    console.log(`Average Gas Used:     ${chalk.white(metrics.averageGasUsed.toLocaleString())}`);
    console.log(`Active Strategies:    ${chalk.white(metrics.activeStrategies.toString())}`);
    console.log(`Last Execution:       ${chalk.gray(metrics.lastExecution)}`);
    console.log("");
  }

  private displayNetworkMetrics(networks: NetworkMetrics[]) {
    console.log(chalk.bold.cyan("🌉 CROSS-CHAIN METRICS"));
    console.log(chalk.cyan("-".repeat(50)));
    
    console.log(chalk.white("Network".padEnd(12) + "Transfers".padEnd(12) + "Volume".padEnd(12) + "Fees".padEnd(12) + "Relayers"));
    console.log(chalk.gray("-".repeat(60)));
    
    networks.forEach(network => {
      console.log(
        chalk.white(network.name.padEnd(12)) +
        chalk.cyan(network.totalTransfers.toString().padEnd(12)) +
        chalk.green(`${network.totalVolume} ETH`.padEnd(12)) +
        chalk.yellow(`${network.totalFees} ETH`.padEnd(12)) +
        chalk.blue(network.activeRelayers.toString())
      );
    });
    console.log("");
  }

  private displayDEXMetrics(dexes: DEXMetrics[]) {
    console.log(chalk.bold.cyan("🏊 DEX INTEGRATION METRICS"));
    console.log(chalk.cyan("-".repeat(50)));
    
    console.log(chalk.white("DEX".padEnd(15) + "Swaps".padEnd(10) + "Volume".padEnd(12) + "Fees".padEnd(12) + "Active Pools"));
    console.log(chalk.gray("-".repeat(65)));
    
    dexes.forEach(dex => {
      console.log(
        chalk.white(dex.name.padEnd(15)) +
        chalk.cyan(dex.totalSwaps.toString().padEnd(10)) +
        chalk.green(`${dex.totalVolume} ETH`.padEnd(12)) +
        chalk.yellow(`${dex.totalFees} ETH`.padEnd(12)) +
        chalk.blue(dex.activePools.toString())
      );
    });
    console.log("");
  }

  private displaySystemStatus(metrics: DashboardMetrics) {
    console.log(chalk.bold.cyan("🔧 SYSTEM STATUS"));
    console.log(chalk.cyan("-".repeat(50)));
    
    const statusColor = metrics.systemStatus === "ACTIVE" ? chalk.green : chalk.red;
    
    console.log(`System Status:        ${statusColor(metrics.systemStatus)}`);
    console.log(`AI Engine:            ${chalk.green("ACTIVE")}`);
    console.log(`MEV Protection:       ${chalk.green("ACTIVE")}`);
    console.log(`Price Oracle:         ${chalk.green("ACTIVE")}`);
    console.log(`Cross-Chain Bridge:   ${chalk.green("ACTIVE")}`);
    console.log(`Multi-DEX Integration: ${chalk.green("ACTIVE")}`);
    console.log("");
  }

  private async displayRecentActivity() {
    console.log(chalk.bold.cyan("📈 RECENT ACTIVITY"));
    console.log(chalk.cyan("-".repeat(50)));
    
    // Simulate recent activity
    const activities = [
      { time: "2 min ago", action: "Arbitrage executed", profit: "+0.045 ETH", dex: "Uniswap V3 → Balancer V2" },
      { time: "5 min ago", action: "Cross-chain transfer", profit: "+0.023 ETH", dex: "Ethereum → Polygon" },
      { time: "8 min ago", action: "MEV protection", profit: "+0.012 ETH", dex: "Flashbots bundle" },
      { time: "12 min ago", action: "Price update", profit: "N/A", dex: "Oracle refresh" },
      { time: "15 min ago", action: "Arbitrage executed", profit: "+0.067 ETH", dex: "Curve → Uniswap V3" }
    ];
    
    activities.forEach(activity => {
      const profitColor = activity.profit.startsWith("+") ? chalk.green : chalk.gray;
      console.log(
        chalk.gray(activity.time.padEnd(10)) +
        chalk.white(activity.action.padEnd(20)) +
        profitColor(activity.profit.padEnd(12)) +
        chalk.cyan(activity.dex)
      );
    });
    console.log("");
  }

  // Public method to get current metrics (for external use)
  async getCurrentMetrics(): Promise<DashboardMetrics> {
    return await this.getMetrics();
  }

  // Public method to get network metrics (for external use)
  async getCurrentNetworkMetrics(): Promise<NetworkMetrics[]> {
    return await this.getNetworkMetrics();
  }

  // Public method to get DEX metrics (for external use)
  async getCurrentDEXMetrics(): Promise<DEXMetrics[]> {
    return await this.getDEXMetrics();
  }
}

// Main execution
async function main() {
  const dashboard = new MonitoringDashboard();
  
  try {
    await dashboard.initialize();
    await dashboard.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\n");
      await dashboard.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red("❌ Dashboard failed to start:"), error);
    process.exit(1);
  }
}

// Export for use in other modules
export { MonitoringDashboard };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
