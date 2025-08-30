#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import chalk from "chalk";
import axios from "axios";

dotenvConfig();

interface VerificationConfig {
  network: string;
  chainId: number;
  explorerUrl: string;
  apiKey: string;
  apiUrl: string;
}

interface VerificationResult {
  contract: string;
  address: string;
  network: string;
  success: boolean;
  verificationUrl?: string;
  error?: string;
}

class ContractVerifier {
  private configs: { [key: string]: VerificationConfig } = {};
  private results: VerificationResult[] = [];

  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs() {
    this.configs = {
      mainnet: {
        network: "Ethereum Mainnet",
        chainId: 1,
        explorerUrl: "https://etherscan.io",
        apiKey: process.env.ETHERSCAN_API_KEY || "",
        apiUrl: "https://api.etherscan.io/api"
      },
      sepolia: {
        network: "Sepolia Testnet",
        chainId: 11155111,
        explorerUrl: "https://sepolia.etherscan.io",
        apiKey: process.env.ETHERSCAN_API_KEY || "",
        apiUrl: "https://api-sepolia.etherscan.io/api"
      },
      polygon: {
        network: "Polygon Mainnet",
        chainId: 137,
        explorerUrl: "https://polygonscan.com",
        apiKey: process.env.POLYGONSCAN_API_KEY || "",
        apiUrl: "https://api.polygonscan.com/api"
      },
      mumbai: {
        network: "Polygon Mumbai",
        chainId: 80001,
        explorerUrl: "https://mumbai.polygonscan.com",
        apiKey: process.env.POLYGONSCAN_API_KEY || "",
        apiUrl: "https://api-testnet.polygonscan.com/api"
      },
      arbitrum: {
        network: "Arbitrum One",
        chainId: 42161,
        explorerUrl: "https://arbiscan.io",
        apiKey: process.env.ARBISCAN_API_KEY || "",
        apiUrl: "https://api.arbiscan.io/api"
      },
      arbitrumSepolia: {
        network: "Arbitrum Sepolia",
        chainId: 421614,
        explorerUrl: "https://sepolia.arbiscan.io",
        apiKey: process.env.ARBISCAN_API_KEY || "",
        apiUrl: "https://api-sepolia.arbiscan.io/api"
      },
      optimism: {
        network: "Optimism",
        chainId: 10,
        explorerUrl: "https://optimistic.etherscan.io",
        apiKey: process.env.OPTIMISTIC_ETHERSCAN_API_KEY || "",
        apiUrl: "https://api-optimistic.etherscan.io/api"
      },
      base: {
        network: "Base",
        chainId: 8453,
        explorerUrl: "https://basescan.org",
        apiKey: process.env.BASESCAN_API_KEY || "",
        apiUrl: "https://api.basescan.org/api"
      },
      baseSepolia: {
        network: "Base Sepolia",
        chainId: 84532,
        explorerUrl: "https://sepolia.basescan.org",
        apiKey: process.env.BASESCAN_API_KEY || "",
        apiUrl: "https://api-sepolia.basescan.org/api"
      },
      avalanche: {
        network: "Avalanche C-Chain",
        chainId: 43114,
        explorerUrl: "https://snowtrace.io",
        apiKey: process.env.SNOWTRACE_API_KEY || "",
        apiUrl: "https://api.snowtrace.io/api"
      }
    };
  }

  async verifyContract(
    networkKey: string,
    contractName: string,
    contractAddress: string,
    constructorArgs: any[] = []
  ): Promise<VerificationResult> {
    const config = this.configs[networkKey];
    if (!config) {
      throw new Error(`Network ${networkKey} not supported for verification`);
    }

    if (!config.apiKey) {
      return {
        contract: contractName,
        address: contractAddress,
        network: config.network,
        success: false,
        error: "API key not configured"
      };
    }

    console.log(chalk.blue(`🔍 Verifying ${contractName} on ${config.network}...`));

    try {
      // Get contract bytecode and constructor arguments
      const contractFactory = await ethers.getContractFactory(contractName);
      const bytecode = contractFactory.bytecode;
      
      // Prepare verification data
      const verificationData = {
        apikey: config.apiKey,
        module: "contract",
        action: "verifysourcecode",
        contractaddress: contractAddress,
        sourceCode: await this.getSourceCode(contractName),
        codeformat: "solidity-standard-json-input",
        constructorArguements: this.encodeConstructorArgs(constructorArgs),
        optimizationUsed: "1",
        runs: "200",
        evmversion: "paris",
        licenseType: "3" // MIT License
      };

      // Submit verification request
      const response = await axios.post(config.apiUrl, verificationData);
      
      if (response.data.status === "1") {
        const guid = response.data.result;
        
        // Wait for verification to complete
        const verificationUrl = await this.waitForVerification(config, guid);
        
        const result: VerificationResult = {
          contract: contractName,
          address: contractAddress,
          network: config.network,
          success: true,
          verificationUrl
        };

        this.results.push(result);
        console.log(chalk.green(`✅ Successfully verified ${contractName}`));
        console.log(chalk.gray(`   URL: ${verificationUrl}`));
        
        return result;
      } else {
        throw new Error(response.data.result || "Verification failed");
      }

    } catch (error) {
      const result: VerificationResult = {
        contract: contractName,
        address: contractAddress,
        network: config.network,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };

      this.results.push(result);
      console.log(chalk.red(`❌ Failed to verify ${contractName}: ${result.error}`));
      
      return result;
    }
  }

  private async getSourceCode(contractName: string): Promise<string> {
    // In a real implementation, this would read the actual source code
    // For now, we'll return a placeholder
    return `{"language":"Solidity","sources":{"${contractName}.sol":{"content":"// Placeholder source code"}}}`;
  }

  private encodeConstructorArgs(args: any[]): string {
    if (args.length === 0) return "";
    
    const abiCoder = new ethers.AbiCoder();
    return abiCoder.encode(
      ["address", "uint256", "string"], // Example parameter types
      args
    ).slice(2); // Remove '0x' prefix
  }

  private async waitForVerification(config: VerificationConfig, guid: string): Promise<string> {
    const maxAttempts = 30;
    const delayMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));

      try {
        const response = await axios.get(config.apiUrl, {
          params: {
            apikey: config.apiKey,
            module: "contract",
            action: "checkverifystatus",
            guid: guid
          }
        });

        if (response.data.status === "1") {
          if (response.data.result === "OK") {
            return `${config.explorerUrl}/address/${response.data.address}#code`;
          } else if (response.data.result.includes("Already Verified")) {
            return `${config.explorerUrl}/address/${response.data.address}#code`;
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⏳ Verification in progress... (attempt ${attempt + 1}/${maxAttempts})`));
      }
    }

    throw new Error("Verification timeout");
  }

  async verifyMultipleContracts(
    networkKey: string,
    contracts: { name: string; address: string; args?: any[] }[]
  ): Promise<VerificationResult[]> {
    console.log(chalk.bold.blue(`🌐 BATCH VERIFICATION - ${this.configs[networkKey]?.network}`));
    console.log(chalk.blue("=".repeat(50)));
    console.log("");

    const results: VerificationResult[] = [];

    for (const contract of contracts) {
      try {
        const result = await this.verifyContract(
          networkKey,
          contract.name,
          contract.address,
          contract.args || []
        );
        results.push(result);

        // Add delay between verifications
        if (contract !== contracts[contracts.length - 1]) {
          console.log(chalk.gray("  ⏳ Waiting 5 seconds before next verification..."));
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to verify ${contract.name}: ${error}`));
      }
    }

    this.displayVerificationSummary(results);
    return results;
  }

  private displayVerificationSummary(results: VerificationResult[]) {
    console.log(chalk.bold.blue("\n📊 VERIFICATION SUMMARY"));
    console.log(chalk.blue("=".repeat(50)));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(chalk.green(`✅ Successful Verifications: ${successful.length}`));
    console.log(chalk.red(`❌ Failed Verifications: ${failed.length}`));
    console.log("");

    if (successful.length > 0) {
      console.log(chalk.bold.cyan("Successful Verifications:"));
      successful.forEach(result => {
        console.log(chalk.green(`  • ${result.contract} (${result.network})`));
        console.log(chalk.gray(`    Address: ${result.address}`));
        if (result.verificationUrl) {
          console.log(chalk.gray(`    URL: ${result.verificationUrl}`));
        }
        console.log("");
      });
    }

    if (failed.length > 0) {
      console.log(chalk.bold.red("Failed Verifications:"));
      failed.forEach(result => {
        console.log(chalk.red(`  • ${result.contract} (${result.network}): ${result.error}`));
      });
      console.log("");
    }
  }

  async verifyAllNetworks(contracts: { name: string; address: string; args?: any[] }[]): Promise<VerificationResult[]> {
    console.log(chalk.bold.blue("🌐 MULTI-NETWORK CONTRACT VERIFICATION"));
    console.log(chalk.blue("=".repeat(60)));
    console.log("");

    const allResults: VerificationResult[] = [];
    const enabledNetworks = Object.keys(this.configs).filter(key => this.configs[key].apiKey);

    console.log(chalk.cyan(`📋 Verifying contracts on ${enabledNetworks.length} networks:`));
    enabledNetworks.forEach(network => {
      console.log(chalk.white(`  • ${this.configs[network].network}`));
    });
    console.log("");

    for (const networkKey of enabledNetworks) {
      try {
        const results = await this.verifyMultipleContracts(networkKey, contracts);
        allResults.push(...results);
      } catch (error) {
        console.log(chalk.red(`❌ Failed to verify on ${networkKey}: ${error}`));
      }
    }

    this.displayOverallSummary(allResults);
    return allResults;
  }

  private displayOverallSummary(results: VerificationResult[]) {
    console.log(chalk.bold.blue("\n🎯 OVERALL VERIFICATION SUMMARY"));
    console.log(chalk.blue("=".repeat(50)));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(chalk.green(`✅ Total Successful: ${successful.length}`));
    console.log(chalk.red(`❌ Total Failed: ${failed.length}`));
    console.log(chalk.white(`📊 Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%`));
    console.log("");

    // Group by network
    const networkStats: { [key: string]: { success: number; failed: number } } = {};
    results.forEach(result => {
      if (!networkStats[result.network]) {
        networkStats[result.network] = { success: 0, failed: 0 };
      }
      if (result.success) {
        networkStats[result.network].success++;
      } else {
        networkStats[result.network].failed++;
      }
    });

    console.log(chalk.bold.cyan("Network Statistics:"));
    Object.entries(networkStats).forEach(([network, stats]) => {
      const total = stats.success + stats.failed;
      const rate = ((stats.success / total) * 100).toFixed(1);
      console.log(chalk.white(`  • ${network}: ${stats.success}/${total} (${rate}%)`));
    });
  }

  // Public methods for external use
  getConfigs(): { [key: string]: VerificationConfig } {
    return this.configs;
  }

  getResults(): VerificationResult[] {
    return this.results;
  }

  addApiKey(networkKey: string, apiKey: string): void {
    if (this.configs[networkKey]) {
      this.configs[networkKey].apiKey = apiKey;
    }
  }
}

// Main execution
async function main() {
  const verifier = new ContractVerifier();
  
  try {
    console.log(chalk.bold.blue("🔍 ADVANCED DEFI ARBITRAGE ENGINE - CONTRACT VERIFICATION"));
    console.log(chalk.blue("=".repeat(70)));
    console.log("");

    // Example contracts to verify (replace with actual deployed addresses)
    const contracts = [
      { name: "AdvancedArbitrageEngine", address: "0x...", args: [] },
      { name: "PriceOracle", address: "0x...", args: [] },
      { name: "AdvancedMEVProtector", address: "0x...", args: [] },
      { name: "CrossChainBridge", address: "0x...", args: [] },
      { name: "BalancerV2Integration", address: "0x...", args: ["0x..."] },
      { name: "CurveFinanceIntegration", address: "0x...", args: ["0x..."] },
      { name: "AIArbitrageStrategy", address: "0x...", args: [] }
    ];

    // Verify on all networks
    await verifier.verifyAllNetworks(contracts);

    console.log(chalk.bold.green("\n🎉 Contract verification completed!"));
    
  } catch (error) {
    console.error(chalk.red("❌ Verification failed:"), error);
    process.exit(1);
  }
}

// Export for use in other modules
export { ContractVerifier };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
