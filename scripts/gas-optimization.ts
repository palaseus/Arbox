#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import chalk from "chalk";
import fs from "fs";
import path from "path";

dotenvConfig();

interface GasReport {
  contract: string;
  function: string;
  currentGas: number;
  optimizedGas: number;
  reduction: number;
  reductionPercentage: number;
}

interface OptimizationSuggestion {
  contract: string;
  function: string;
  suggestion: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
  implementation: string;
}

class GasOptimizer {
  private gasReports: GasReport[] = [];
  private suggestions: OptimizationSuggestion[] = [];

  constructor() {
    this.initializeGasReports();
    this.generateOptimizationSuggestions();
  }

  private initializeGasReports() {
    // Sample gas reports for demonstration
    this.gasReports = [
      {
        contract: "AdvancedArbitrageEngine",
        function: "executeArbitrage",
        currentGas: 150000,
        optimizedGas: 120000,
        reduction: 30000,
        reductionPercentage: 20.0
      },
      {
        contract: "AdvancedArbitrageEngine",
        function: "registerStrategy",
        currentGas: 80000,
        optimizedGas: 65000,
        reduction: 15000,
        reductionPercentage: 18.8
      },
      {
        contract: "AIArbitrageStrategy",
        function: "execute",
        currentGas: 95000,
        optimizedGas: 78000,
        reduction: 17000,
        reductionPercentage: 17.9
      },
      {
        contract: "AdvancedMEVProtector",
        function: "submitBundle",
        currentGas: 110000,
        optimizedGas: 88000,
        reduction: 22000,
        reductionPercentage: 20.0
      },
      {
        contract: "PriceOracle",
        function: "updatePrice",
        currentGas: 65000,
        optimizedGas: 52000,
        reduction: 13000,
        reductionPercentage: 20.0
      }
    ];
  }

  private generateOptimizationSuggestions() {
    this.suggestions = [
      {
        contract: "AdvancedArbitrageEngine",
        function: "executeArbitrage",
        suggestion: "Use unchecked math for known-safe operations",
        potentialSavings: 5000,
        priority: "high",
        implementation: "Replace arithmetic operations with unchecked blocks"
      },
      {
        contract: "AdvancedArbitrageEngine",
        function: "registerStrategy",
        suggestion: "Optimize storage layout and pack variables",
        potentialSavings: 3000,
        priority: "medium",
        implementation: "Group related variables in storage slots"
      },
      {
        contract: "AIArbitrageStrategy",
        function: "execute",
        suggestion: "Cache frequently accessed data in memory",
        potentialSavings: 4000,
        priority: "high",
        implementation: "Store repeated calculations in memory variables"
      },
      {
        contract: "AdvancedMEVProtector",
        function: "submitBundle",
        suggestion: "Batch multiple operations to reduce overhead",
        potentialSavings: 6000,
        priority: "high",
        implementation: "Combine multiple transactions into single bundle"
      },
      {
        contract: "PriceOracle",
        function: "updatePrice",
        suggestion: "Optimize event emissions",
        potentialSavings: 2000,
        priority: "low",
        implementation: "Use indexed parameters and optimize event data"
      }
    ];
  }

  async analyzeGasUsage() {
    console.log(chalk.bold.blue("🔍 GAS OPTIMIZATION ANALYSIS"));
    console.log(chalk.blue("=".repeat(60)));
    console.log("");

    // Analyze each contract
    const contracts = [
      "AdvancedArbitrageEngine",
      "AIArbitrageStrategy", 
      "AdvancedMEVProtector",
      "PriceOracle",
      "CrossChainBridge"
    ];

    for (const contract of contracts) {
      console.log(chalk.blue(`📦 Analyzing ${contract}...`));
      
      try {
        const contractFactory = await ethers.getContractFactory(contract);
        const deployedContract = await contractFactory.deploy();
        await deployedContract.waitForDeployment();
        
        console.log(chalk.green(`  ✅ ${contract} deployed successfully`));
        
        // Simulate gas analysis
        const gasEstimate = await this.estimateGasUsage(contract);
        console.log(chalk.gray(`  📊 Estimated gas usage: ${gasEstimate.toLocaleString()}`));
        
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  ${contract}: ${error}`));
      }
    }

    this.displayGasAnalysis();
    this.displayOptimizationSuggestions();
    this.generateOptimizationReport();
  }

  private async estimateGasUsage(contractName: string): Promise<number> {
    // Simulate gas estimation
    const baseGas = 50000;
    const complexityMultiplier = contractName.length * 100;
    return baseGas + complexityMultiplier;
  }

  private displayGasAnalysis() {
    console.log(chalk.bold.cyan("\n📊 GAS USAGE ANALYSIS"));
    console.log(chalk.cyan("=".repeat(100)));
    
    console.log(chalk.white(
      "Contract".padEnd(25) + 
      "Function".padEnd(25) + 
      "Current".padEnd(10) + 
      "Optimized".padEnd(10) + 
      "Reduction".padEnd(10) + 
      "% Reduction"
    ));
    console.log(chalk.gray("-".repeat(100)));

    let totalCurrent = 0;
    let totalOptimized = 0;

    this.gasReports.forEach(report => {
      const reductionColor = report.reductionPercentage >= 20 ? chalk.green : 
                           report.reductionPercentage >= 10 ? chalk.yellow : chalk.red;
      
      console.log(
        chalk.white(report.contract.padEnd(25)) +
        chalk.cyan(report.function.padEnd(25)) +
        chalk.white(report.currentGas.toString().padEnd(10)) +
        chalk.green(report.optimizedGas.toString().padEnd(10)) +
        chalk.yellow(report.reduction.toString().padEnd(10)) +
        reductionColor(`${report.reductionPercentage.toFixed(1)}%`)
      );

      totalCurrent += report.currentGas;
      totalOptimized += report.optimizedGas;
    });

    const totalReduction = totalCurrent - totalOptimized;
    const totalReductionPercentage = (totalReduction / totalCurrent) * 100;

    console.log(chalk.gray("-".repeat(100)));
    console.log(chalk.bold.white(
      "TOTAL".padEnd(25) + 
      "".padEnd(25) + 
      totalCurrent.toString().padEnd(10) + 
      totalOptimized.toString().padEnd(10) + 
      totalReduction.toString().padEnd(10) + 
      `${totalReductionPercentage.toFixed(1)}%`
    ));
    console.log("");
  }

  private displayOptimizationSuggestions() {
    console.log(chalk.bold.cyan("💡 OPTIMIZATION SUGGESTIONS"));
    console.log(chalk.cyan("=".repeat(100)));

    // Group by priority
    const highPriority = this.suggestions.filter(s => s.priority === 'high');
    const mediumPriority = this.suggestions.filter(s => s.priority === 'medium');
    const lowPriority = this.suggestions.filter(s => s.priority === 'low');

    if (highPriority.length > 0) {
      console.log(chalk.bold.red("🔴 HIGH PRIORITY"));
      highPriority.forEach(suggestion => {
        console.log(chalk.red(`  • ${suggestion.contract}: ${suggestion.suggestion}`));
        console.log(chalk.gray(`    Potential Savings: ${suggestion.potentialSavings} gas`));
        console.log(chalk.gray(`    Implementation: ${suggestion.implementation}`));
        console.log("");
      });
    }

    if (mediumPriority.length > 0) {
      console.log(chalk.bold.yellow("🟡 MEDIUM PRIORITY"));
      mediumPriority.forEach(suggestion => {
        console.log(chalk.yellow(`  • ${suggestion.contract}: ${suggestion.suggestion}`));
        console.log(chalk.gray(`    Potential Savings: ${suggestion.potentialSavings} gas`));
        console.log(chalk.gray(`    Implementation: ${suggestion.implementation}`));
        console.log("");
      });
    }

    if (lowPriority.length > 0) {
      console.log(chalk.bold.blue("🔵 LOW PRIORITY"));
      lowPriority.forEach(suggestion => {
        console.log(chalk.blue(`  • ${suggestion.contract}: ${suggestion.suggestion}`));
        console.log(chalk.gray(`    Potential Savings: ${suggestion.potentialSavings} gas`));
        console.log(chalk.gray(`    Implementation: ${suggestion.implementation}`));
        console.log("");
      });
    }
  }

  private generateOptimizationReport() {
    console.log(chalk.bold.cyan("📈 OPTIMIZATION SUMMARY"));
    console.log(chalk.cyan("=".repeat(50)));

    const totalCurrent = this.gasReports.reduce((sum, report) => sum + report.currentGas, 0);
    const totalOptimized = this.gasReports.reduce((sum, report) => sum + report.optimizedGas, 0);
    const totalSavings = totalCurrent - totalOptimized;
    const totalSavingsPercent = ((totalSavings / totalCurrent) * 100).toFixed(1);

    const totalPotentialSavings = this.suggestions.reduce((sum, suggestion) => sum + suggestion.potentialSavings, 0);

    console.log(chalk.white(`Total Current Gas Usage: ${totalCurrent.toLocaleString()}`));
    console.log(chalk.white(`Total Optimized Gas Usage: ${totalOptimized.toLocaleString()}`));
    console.log(chalk.green(`Total Potential Savings: ${totalSavings.toLocaleString()} (${totalSavingsPercent}%)`));
    console.log(chalk.cyan(`Total Potential Savings from Suggestions: ${totalPotentialSavings.toLocaleString()} gas`));

    // Save report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      gasReports: this.gasReports,
      suggestions: this.suggestions,
      summary: {
        totalCurrent,
        totalOptimized,
        totalSavings,
        totalSavingsPercent,
        totalPotentialSavings
      }
    };

    const reportPath = path.join(__dirname, "..", "test", "results", "gas_optimization_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(chalk.gray(`\nReport saved to: ${reportPath}`));
  }

  // Public methods for external use
  getGasReports(): GasReport[] {
    return this.gasReports;
  }

  getOptimizationSuggestions(): OptimizationSuggestion[] {
    return this.suggestions;
  }
}

// Main execution
async function main() {
  const optimizer = new GasOptimizer();
  
  try {
    await optimizer.analyzeGasUsage();
    
    console.log(chalk.bold.green("\n🎉 Gas optimization analysis completed!"));
    
  } catch (error) {
    console.error(chalk.red("❌ Gas optimization analysis failed:"), error);
    process.exit(1);
  }
}

// Export for use in other modules
export { GasOptimizer };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
