import { HardhatRuntimeEnvironment } from "hardhat/types";
// @ts-ignore
const { ethers } = require("hardhat");
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { GasProfiler } from "../test/utils/gasProfiler";
import { GitUtils } from "./utils/gitUtils";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("contract", { type: "string", demandOption: true, describe: "Contract name" })
    .option("function", { type: "string", demandOption: true, describe: "Function name" })
    .option("times", { type: "number", default: 5, describe: "Number of runs" })
    .option("compare", { type: "boolean", default: false, describe: "Compare with baseline" })
    .option("max-increase", { type: "number", default: 5, describe: "Maximum allowed gas increase percentage" })
    .option("baseline", { type: "string", describe: "Path to baseline JSON file" })
    .option("fail-on-diff", { type: "boolean", default: false, describe: "Fail if gas usage increases" })
    .option("compare-main", { type: "boolean", default: false, describe: "Compare with main branch baseline" })
    .option("summary-only", { type: "boolean", default: false, describe: "Only show summary output" })
    .help().parse();

  const contractName = argv.contract;
  const functionName = argv.function;
  const times = argv.times;
  const shouldCompare = argv.compare;
  const maxIncrease = argv["max-increase"];
  const baselinePath = argv.baseline;
  const failOnDiff = argv["fail-on-diff"];
  const compareMain = argv["compare-main"];
  const summaryOnly = argv["summary-only"];

  // Initialize Hardhat environment
  const hre: HardhatRuntimeEnvironment = require("hardhat");
  const [deployer] = await ethers.getSigners();
  const ContractFactory = await ethers.getContractFactory(contractName, deployer);
  const contract = await ContractFactory.deploy();
  await contract.waitForDeployment();

  if (!summaryOnly) {
    console.log(chalk.green("\n=== Gas Profiling ==="));
    console.log(chalk.yellow(`Contract: ${contractName}`));
    console.log(chalk.yellow(`Function: ${functionName}`));
    console.log(chalk.yellow(`Runs: ${times}`));
  }

  const profile = await GasProfiler.profile(contract, functionName, [], times);
  const outputPath = GasProfiler.saveProfile(profile);

  // Generate summary table
  const summary = {
    contractName,
    functionName,
    avgGasUsed: profile.avgGasUsed,
    maxGasUsed: profile.maxGasUsed,
    minGasUsed: profile.minGasUsed,
    variance: profile.variance,
    timestamp: profile.timestamp,
    network: profile.network,
    blockNumber: profile.blockNumber,
    commit: GitUtils.getCurrentCommit()
  };

  // Save summary
  const summaryPath = outputPath.replace('_gas_profile.json', '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // Generate markdown report
  const markdownPath = outputPath.replace('_gas_profile.json', '_report.md');
  let markdownContent = `# Gas Profile Report

## Summary
| Metric | Value |
|--------|-------|
| Average Gas | ${profile.avgGasUsed} |
| Max Gas | ${profile.maxGasUsed} |
| Min Gas | ${profile.minGasUsed} |
| Variance | ${profile.variance.toFixed(2)} |
| Network | ${profile.network} |
| Block | ${profile.blockNumber} |
| Commit | ${summary.commit} |

`;

  if (!summaryOnly) {
    console.log(chalk.green("\n=== Summary ==="));
    console.log(chalk.yellow("┌─────────────────┬─────────────────┐"));
    console.log(chalk.yellow("│ Metric          │ Value           │"));
    console.log(chalk.yellow("├─────────────────┼─────────────────┤"));
    console.log(chalk.yellow(`│ Average Gas     │ ${profile.avgGasUsed.toString().padEnd(15)} │`));
    console.log(chalk.yellow(`│ Max Gas         │ ${profile.maxGasUsed.toString().padEnd(15)} │`));
    console.log(chalk.yellow(`│ Min Gas         │ ${profile.minGasUsed.toString().padEnd(15)} │`));
    console.log(chalk.yellow(`│ Variance        │ ${profile.variance.toFixed(2).padEnd(15)} │`));
    console.log(chalk.yellow("└─────────────────┴─────────────────┘"));

    console.log(chalk.green(`\nResults saved to:`));
    console.log(chalk.yellow(`Profile: ${outputPath}`));
    console.log(chalk.yellow(`Summary: ${summaryPath}`));
    console.log(chalk.yellow(`Report: ${markdownPath}`));
  }

  if (shouldCompare || baselinePath || compareMain) {
    let baseline: any;
    
    if (baselinePath) {
      baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    } else if (compareMain) {
      if (!summaryOnly) {
        console.log(chalk.yellow("\nFetching baseline from main branch..."));
      }
      baseline = await GitUtils.getMainBaseline(contractName, functionName);
      if (!summaryOnly) {
        console.log(chalk.green("Baseline fetched successfully"));
      }
    } else {
      baseline = await GasProfiler.getLatestProfile(contractName, functionName);
    }

    if (baseline) {
      const comparison = GasProfiler.compareProfiles(baseline, profile);
      
      // Add comparison to markdown report
      markdownContent += `## Comparison with Baseline
| Metric | Change |
|--------|--------|
| Average Gas | ${comparison.diff.avgGasUsed >= 0 ? '+' : ''}${comparison.diff.avgGasUsed} (${comparison.diff.percentageChange >= 0 ? '+' : ''}${comparison.diff.percentageChange.toFixed(2)}%) |
| Max Gas | ${comparison.diff.maxGasUsed >= 0 ? '+' : ''}${comparison.diff.maxGasUsed} (${((comparison.diff.maxGasUsed / baseline.maxGasUsed) * 100).toFixed(2)}%) |
| Min Gas | ${comparison.diff.minGasUsed >= 0 ? '+' : ''}${comparison.diff.minGasUsed} (${((comparison.diff.minGasUsed / baseline.minGasUsed) * 100).toFixed(2)}%) |

Baseline: ${baseline.commit?.substring(0, 7) || 'N/A'}
Current: ${summary.commit.substring(0, 7)}
`;

      if (!summaryOnly) {
        console.log(chalk.green("\n=== Comparison with Baseline ==="));
        console.log(chalk.yellow("┌─────────────────┬─────────────────┐"));
        console.log(chalk.yellow("│ Metric          │ Change          │"));
        console.log(chalk.yellow("├─────────────────┼─────────────────┤"));
        
        const formatChange = (value: number, percentage: number) => {
          const sign = value >= 0 ? '+' : '';
          const color = value <= 0 ? chalk.green : chalk.red;
          return color(`${sign}${value} (${sign}${percentage.toFixed(2)}%)`.padEnd(15));
        };

        console.log(chalk.yellow(`│ Average Gas     │ ${formatChange(comparison.diff.avgGasUsed, comparison.diff.percentageChange)} │`));
        console.log(chalk.yellow(`│ Max Gas         │ ${formatChange(comparison.diff.maxGasUsed, (comparison.diff.maxGasUsed / baseline.maxGasUsed) * 100)} │`));
        console.log(chalk.yellow(`│ Min Gas         │ ${formatChange(comparison.diff.minGasUsed, (comparison.diff.minGasUsed / baseline.minGasUsed) * 100)} │`));
        console.log(chalk.yellow("└─────────────────┴─────────────────┘"));

        if (baseline.commit) {
          console.log(chalk.yellow(`\nBaseline commit: ${baseline.commit}`));
        }
        console.log(chalk.yellow(`Current commit: ${summary.commit}`));
      }

      // Save comparison
      const comparisonPath = outputPath.replace('_gas_profile.json', '_comparison.json');
      fs.writeFileSync(comparisonPath, JSON.stringify({
        ...comparison,
        baselineCommit: baseline.commit,
        currentCommit: summary.commit
      }, null, 2));

      if (!summaryOnly) {
        console.log(chalk.yellow(`\nComparison saved to: ${comparisonPath}`));
      }

      // Save markdown report
      fs.writeFileSync(markdownPath, markdownContent);

      if (failOnDiff && comparison.diff.percentageChange > maxIncrease) {
        console.log(chalk.red(`\nERROR: Gas usage increased by ${comparison.diff.percentageChange.toFixed(2)}%, ` +
          `which exceeds the maximum allowed increase of ${maxIncrease}%`));
        process.exit(1);
      }
    } else {
      if (!summaryOnly) {
        console.log(chalk.yellow("\nNo baseline found for comparison"));
      }
    }
  }
}

main().catch((error) => {
  console.error(chalk.red(error));
  process.exit(1);
}); 