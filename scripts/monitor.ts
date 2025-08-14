#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import chalk from "chalk";
import { table } from "table";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { task } from "hardhat/config";

dotenvConfig();

interface MonitoringConfig {
  rpcUrl: string;
  contractAddress: string;
  mevProtectorAddress: string;
  updateInterval: number;
  alertThreshold: number;
  maxGasPrice: string;
}

interface ArbitrageMetrics {
  totalProfit: string;
  totalGasUsed: string;
  successfulArbitrages: number;
  failedArbitrages: number;
  successRate: number;
  avgProfit: string;
  avgGasUsed: string;
}

interface StrategyPerformance {
  strategyId: string;
  totalExecutions: number;
  successfulExecutions: number;
  totalProfit: string;
  avgGasUsed: string;
  successRate: number;
  lastExecution: number;
}

interface MEVProtectionStatus {
  active: boolean;
  lastProtectionBlock: number;
  totalBundles: number;
  activeBundles: number;
  protectionEfficiency: number;
}

class ArbitrageMonitor {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private mevProtector: ethers.Contract;
  private config: MonitoringConfig;
  private isRunning: boolean = false;
  private metrics: ArbitrageMetrics | null = null;
  private strategies: StrategyPerformance[] = [];
  private mevStatus: MEVProtectionStatus | null = null;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(
      config.contractAddress,
      [
        "function getGlobalMetrics() external view returns (uint256, uint256, uint256, uint256)",
        "function getActiveStrategies() external view returns (bytes32[])",
        "function getStrategyPerformance(bytes32) external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
        "function getRiskParams() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)"
      ],
      this.provider
    );
    
    this.mevProtector = new ethers.Contract(
      config.mevProtectorAddress,
      [
        "function getProtectionStatus() external view returns (bool, uint256)",
        "function getTotalBundles() external view returns (uint256)",
        "function getActiveBundles() external view returns (uint256)",
        "function getProtectionEfficiency() external view returns (uint256)"
      ],
      this.provider
    );
  }

  /**
   * Start the monitoring process
   */
  async start(): Promise<void> {
    console.log(chalk.blue("🚀 Starting Arbitrage Monitor..."));
    console.log(chalk.gray(`Monitoring contract: ${this.config.contractAddress}`));
    console.log(chalk.gray(`Update interval: ${this.config.updateInterval}ms`));
    console.log(chalk.gray("Press Ctrl+C to stop monitoring\n"));

    this.isRunning = true;
    
    // Initial data fetch
    await this.updateMetrics();
    
    // Start monitoring loop
    while (this.isRunning) {
      try {
        await this.updateMetrics();
        this.displayDashboard();
        
        // Wait for next update
        await new Promise(resolve => setTimeout(resolve, this.config.updateInterval));
      } catch (error) {
        console.error(chalk.red("❌ Error updating metrics:"), error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds on error
      }
    }
  }

  /**
   * Stop the monitoring process
   */
  stop(): void {
    console.log(chalk.yellow("\n🛑 Stopping monitor..."));
    this.isRunning = false;
  }

  /**
   * Update all monitoring metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      // Update global metrics
      this.metrics = await this.fetchGlobalMetrics();
      
      // Update strategy performance
      this.strategies = await this.fetchStrategyPerformance();
      
      // Update MEV protection status
      this.mevStatus = await this.fetchMEVProtectionStatus();
      
    } catch (error) {
      console.error(chalk.red("Failed to update metrics:"), error);
    }
  }

  /**
   * Fetch global arbitrage metrics
   */
  private async fetchGlobalMetrics(): Promise<ArbitrageMetrics> {
    try {
      const [totalProfit, totalGasUsed, successfulArbitrages, failedArbitrages] = 
        await this.contract.getGlobalMetrics();
      
      const successRate = successfulArbitrages + failedArbitrages > 0 
        ? (Number(successfulArbitrages) / (Number(successfulArbitrages) + Number(failedArbitrages))) * 100 
        : 0;
      
      const avgProfit = successfulArbitrages > 0 
        ? ethers.formatEther(totalProfit / BigInt(successfulArbitrages))
        : "0";
      
      const avgGasUsed = successfulArbitrages > 0 
        ? ethers.formatUnits(totalGasUsed / BigInt(successfulArbitrages), "wei")
        : "0";

      return {
        totalProfit: ethers.formatEther(totalProfit),
        totalGasUsed: ethers.formatUnits(totalGasUsed, "wei"),
        successfulArbitrages: Number(successfulArbitrages),
        failedArbitrages: Number(failedArbitrages),
        successRate,
        avgProfit,
        avgGasUsed
      };
    } catch (error) {
      console.error(chalk.red("Failed to fetch global metrics:"), error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Fetch strategy performance data
   */
  private async fetchStrategyPerformance(): Promise<StrategyPerformance[]> {
    try {
      const activeStrategies = await this.contract.getActiveStrategies();
      const strategies: StrategyPerformance[] = [];

      for (const strategyId of activeStrategies) {
        try {
          const [totalExecutions, successfulExecutions, totalProfit, avgGasUsed, lastExecution, successRate] = 
            await this.contract.getStrategyPerformance(strategyId);
          
          strategies.push({
            strategyId: strategyId.slice(0, 10) + "...",
            totalExecutions: Number(totalExecutions),
            successfulExecutions: Number(successfulExecutions),
            totalProfit: ethers.formatEther(totalProfit),
            avgGasUsed: ethers.formatUnits(avgGasUsed, "wei"),
            successRate: Number(successRate) / 100, // Convert from basis points
            lastExecution: Number(lastExecution)
          });
        } catch (error) {
          console.warn(chalk.yellow(`Failed to fetch strategy ${strategyId}:`), error);
        }
      }

      return strategies;
    } catch (error) {
      console.error(chalk.red("Failed to fetch strategy performance:"), error);
      return [];
    }
  }

  /**
   * Fetch MEV protection status
   */
  private async fetchMEVProtectionStatus(): Promise<MEVProtectionStatus> {
    try {
      const [active, lastProtectionBlock] = await this.mevProtector.getProtectionStatus();
      const totalBundles = await this.mevProtector.getTotalBundles();
      const activeBundles = await this.mevProtector.getActiveBundles();
      const protectionEfficiency = await this.mevProtector.getProtectionEfficiency();

      return {
        active,
        lastProtectionBlock: Number(lastProtectionBlock),
        totalBundles: Number(totalBundles),
        activeBundles: Number(activeBundles),
        protectionEfficiency: Number(protectionEfficiency) / 100 // Convert from basis points
      };
    } catch (error) {
      console.error(chalk.red("Failed to fetch MEV protection status:"), error);
      return this.getDefaultMEVStatus();
    }
  }

  /**
   * Display the monitoring dashboard
   */
  private displayDashboard(): void {
    console.clear();
    console.log(chalk.blue.bold("🔍 ARBITRAGE MONITORING DASHBOARD"));
    console.log(chalk.gray("=".repeat(60)));
    console.log(chalk.gray(`Last updated: ${new Date().toLocaleString()}\n`));

    // Display global metrics
    if (this.metrics) {
      this.displayGlobalMetrics(this.metrics);
    }

    // Display strategy performance
    if (this.strategies.length > 0) {
      this.displayStrategyPerformance(this.strategies);
    }

    // Display MEV protection status
    if (this.mevStatus) {
      this.displayMEVProtectionStatus(this.mevStatus);
    }

    // Display alerts
    this.displayAlerts();
  }

  /**
   * Display global arbitrage metrics
   */
  private displayGlobalMetrics(metrics: ArbitrageMetrics): void {
    console.log(chalk.cyan.bold("📊 GLOBAL METRICS"));
    console.log(chalk.gray("-".repeat(40)));

    const data = [
      ["Total Profit", `${metrics.totalProfit} ETH`],
      ["Total Gas Used", `${metrics.totalGasUsed} wei`],
      ["Successful Arbitrages", metrics.successfulArbitrages.toString()],
      ["Failed Arbitrages", metrics.failedArbitrages.toString()],
      ["Success Rate", `${metrics.successRate.toFixed(2)}%`],
      ["Average Profit", `${metrics.avgProfit} ETH`],
      ["Average Gas Used", `${metrics.avgGasUsed} wei`]
    ];

    console.log(table(data));
    console.log();
  }

  /**
   * Display strategy performance table
   */
  private displayStrategyPerformance(strategies: StrategyPerformance[]): void {
    console.log(chalk.cyan.bold("🎯 STRATEGY PERFORMANCE"));
    console.log(chalk.gray("-".repeat(40)));

    const data = [
      ["Strategy ID", "Executions", "Success Rate", "Total Profit", "Avg Gas", "Last Exec"]
    ];

    for (const strategy of strategies) {
      const lastExec = strategy.lastExecution > 0 
        ? new Date(strategy.lastExecution * 1000).toLocaleString()
        : "Never";
      
      data.push([
        strategy.strategyId,
        strategy.totalExecutions.toString(),
        `${(strategy.successRate * 100).toFixed(1)}%`,
        `${strategy.totalProfit} ETH`,
        `${strategy.avgGasUsed} wei`,
        lastExec
      ]);
    }

    console.log(table(data));
    console.log();
  }

  /**
   * Display MEV protection status
   */
  private displayMEVProtectionStatus(status: MEVProtectionStatus): void {
    console.log(chalk.cyan.bold("🛡️ MEV PROTECTION STATUS"));
    console.log(chalk.gray("-".repeat(40)));

    const data = [
      ["Status", status.active ? chalk.green("🟢 Active") : chalk.red("🔴 Inactive")],
      ["Last Protection Block", status.lastProtectionBlock.toString()],
      ["Total Bundles", status.totalBundles.toString()],
      ["Active Bundles", status.activeBundles.toString()],
      ["Protection Efficiency", `${(status.protectionEfficiency * 100).toFixed(1)}%`]
    ];

    console.log(table(data));
    console.log();
  }

  /**
   * Display important alerts
   */
  private displayAlerts(): void {
    const alerts: string[] = [];

    if (this.metrics) {
      if (this.metrics.successRate < 80) {
        alerts.push(chalk.yellow("⚠️  Low success rate detected"));
      }
      
      if (this.metrics.failedArbitrages > this.metrics.successfulArbitrages) {
        alerts.push(chalk.red("🚨 More failed than successful arbitrages"));
      }
    }

    if (this.mevStatus && !this.mevStatus.active) {
      alerts.push(chalk.red("🚨 MEV protection is inactive"));
    }

    if (alerts.length > 0) {
      console.log(chalk.red.bold("🚨 ALERTS"));
      console.log(chalk.gray("-".repeat(40)));
      alerts.forEach(alert => console.log(alert));
      console.log();
    }
  }

  /**
   * Get default metrics when fetching fails
   */
  private getDefaultMetrics(): ArbitrageMetrics {
    return {
      totalProfit: "0",
      totalGasUsed: "0",
      successfulArbitrages: 0,
      failedArbitrages: 0,
      successRate: 0,
      avgProfit: "0",
      avgGasUsed: "0"
    };
  }

  /**
   * Get default MEV status when fetching fails
   */
  private getDefaultMEVStatus(): MEVProtectionStatus {
    return {
      active: false,
      lastProtectionBlock: 0,
      totalBundles: 0,
      activeBundles: 0,
      protectionEfficiency: 0
    };
  }
}

// Hardhat task for running the monitor
task("monitor", "Start the arbitrage monitoring dashboard")
  .addParam("contract", "Address of the arbitrage contract")
  .addParam("mevProtector", "Address of the MEV protector contract")
  .addOptionalParam("rpc", "RPC URL (defaults to hardhat network)")
  .addOptionalParam("interval", "Update interval in milliseconds (default: 5000)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const config: MonitoringConfig = {
      rpcUrl: taskArgs.rpc || "http://localhost:8545",
      contractAddress: taskArgs.contract,
      mevProtectorAddress: taskArgs.mevProtector,
      updateInterval: parseInt(taskArgs.interval) || 5000,
      alertThreshold: 0.1,
      maxGasPrice: "100 gwei"
    };

    const monitor = new ArbitrageMonitor(config);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      monitor.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      monitor.stop();
      process.exit(0);
    });

    try {
      await monitor.start();
    } catch (error) {
      console.error(chalk.red("Failed to start monitor:"), error);
      process.exit(1);
    }
  });

// Standalone execution
if (require.main === module) {
  const config: MonitoringConfig = {
    rpcUrl: process.env.MAINNET_RPC_URL || "http://localhost:8545",
    contractAddress: process.env.ARBITRAGE_CONTRACT_ADDRESS || "",
    mevProtectorAddress: process.env.MEV_PROTECTOR_ADDRESS || "",
    updateInterval: 5000,
    alertThreshold: 0.1,
    maxGasPrice: "100 gwei"
  };

  if (!config.contractAddress || !config.mevProtectorAddress) {
    console.error(chalk.red("Please set ARBITRAGE_CONTRACT_ADDRESS and MEV_PROTECTOR_ADDRESS environment variables"));
    process.exit(1);
  }

  const monitor = new ArbitrageMonitor(config);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    monitor.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    monitor.stop();
    process.exit(0);
  });

  monitor.start().catch(error => {
    console.error(chalk.red("Failed to start monitor:"), error);
    process.exit(1);
  });
}
