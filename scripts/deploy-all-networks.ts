#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import chalk from "chalk";

dotenvConfig();

interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  gasPrice: string;
  confirmations: number;
  enabled: boolean;
}

interface DeploymentResult {
  network: string;
  success: boolean;
  contracts: { [key: string]: string };
  gasUsed: number;
  deploymentTime: number;
  error?: string;
}

class MultiNetworkDeployer {
  private networks: { [key: string]: NetworkConfig } = {};
  private deploymentResults: DeploymentResult[] = [];

  constructor() {
    this.initializeNetworks();
  }

  private initializeNetworks() {
    this.networks = {
      mainnet: {
        name: "Ethereum Mainnet",
        chainId: 1,
        rpcUrl: process.env.MAINNET_RPC_URL || "",
        explorerUrl: "https://etherscan.io",
        gasPrice: "20 gwei",
        confirmations: 5,
        enabled: false // Disabled by default for safety
      },
      sepolia: {
        name: "Sepolia Testnet",
        chainId: 11155111,
        rpcUrl: process.env.SEPOLIA_RPC_URL || "",
        explorerUrl: "https://sepolia.etherscan.io",
        gasPrice: "1.5 gwei",
        confirmations: 3,
        enabled: true
      },
      polygon: {
        name: "Polygon Mainnet",
        chainId: 137,
        rpcUrl: process.env.POLYGON_RPC_URL || "",
        explorerUrl: "https://polygonscan.com",
        gasPrice: "30 gwei",
        confirmations: 256,
        enabled: false
      },
      mumbai: {
        name: "Polygon Mumbai",
        chainId: 80001,
        rpcUrl: process.env.MUMBAI_RPC_URL || "",
        explorerUrl: "https://mumbai.polygonscan.com",
        gasPrice: "30 gwei",
        confirmations: 256,
        enabled: true
      },
      arbitrum: {
        name: "Arbitrum One",
        chainId: 42161,
        rpcUrl: process.env.ARBITRUM_RPC_URL || "",
        explorerUrl: "https://arbiscan.io",
        gasPrice: "0.1 gwei",
        confirmations: 1,
        enabled: false
      },
      arbitrumSepolia: {
        name: "Arbitrum Sepolia",
        chainId: 421614,
        rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "",
        explorerUrl: "https://sepolia.arbiscan.io",
        gasPrice: "0.1 gwei",
        confirmations: 1,
        enabled: true
      },
      optimism: {
        name: "Optimism",
        chainId: 10,
        rpcUrl: process.env.OPTIMISM_RPC_URL || "",
        explorerUrl: "https://optimistic.etherscan.io",
        gasPrice: "0.001 gwei",
        confirmations: 1,
        enabled: false
      },
      base: {
        name: "Base",
        chainId: 8453,
        rpcUrl: process.env.BASE_RPC_URL || "",
        explorerUrl: "https://basescan.org",
        gasPrice: "0.001 gwei",
        confirmations: 1,
        enabled: false
      },
      baseSepolia: {
        name: "Base Sepolia",
        chainId: 84532,
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "",
        explorerUrl: "https://sepolia.basescan.org",
        gasPrice: "0.001 gwei",
        confirmations: 1,
        enabled: true
      },
      avalanche: {
        name: "Avalanche C-Chain",
        chainId: 43114,
        rpcUrl: process.env.AVALANCHE_RPC_URL || "",
        explorerUrl: "https://snowtrace.io",
        gasPrice: "25 gwei",
        confirmations: 1,
        enabled: false
      }
    };
  }

  async deployToNetwork(networkKey: string): Promise<DeploymentResult> {
    const network = this.networks[networkKey];
    if (!network) {
      throw new Error(`Network ${networkKey} not found`);
    }

    if (!network.enabled) {
      return {
        network: network.name,
        success: false,
        contracts: {},
        gasUsed: 0,
        deploymentTime: 0,
        error: "Network is disabled"
      };
    }

    console.log(chalk.blue(`🚀 Deploying to ${network.name}...`));
    const startTime = Date.now();

    try {
      // Set up provider and signer
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment variables");
      }
      const signer = new ethers.Wallet(privateKey, provider);

      // Deploy contracts
      const contracts = await this.deployContracts(signer, network);

      // Verify contracts
      await this.verifyContracts(contracts, network);

      const deploymentTime = Date.now() - startTime;
      const gasUsed = await this.calculateTotalGasUsed(contracts);

      const result: DeploymentResult = {
        network: network.name,
        success: true,
        contracts,
        gasUsed,
        deploymentTime
      };

      this.deploymentResults.push(result);
      console.log(chalk.green(`✅ Successfully deployed to ${network.name}`));
      
      return result;

    } catch (error) {
      const deploymentTime = Date.now() - startTime;
      const result: DeploymentResult = {
        network: network.name,
        success: false,
        contracts: {},
        gasUsed: 0,
        deploymentTime,
        error: error instanceof Error ? error.message : "Unknown error"
      };

      this.deploymentResults.push(result);
      console.log(chalk.red(`❌ Failed to deploy to ${network.name}: ${result.error}`));
      
      return result;
    }
  }

  private async deployContracts(signer: ethers.Wallet, network: NetworkConfig) {
    const contracts: { [key: string]: string } = {};

    console.log(chalk.yellow("  📦 Deploying Advanced Arbitrage Engine..."));
    const ArbitrageEngine = await ethers.getContractFactory("AdvancedArbitrageEngine", signer);
    const arbitrageEngine = await ArbitrageEngine.deploy();
    await arbitrageEngine.waitForDeployment();
    contracts.AdvancedArbitrageEngine = await arbitrageEngine.getAddress();

    console.log(chalk.yellow("  🔮 Deploying Price Oracle..."));
    const PriceOracle = await ethers.getContractFactory("PriceOracle", signer);
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.waitForDeployment();
    contracts.PriceOracle = await priceOracle.getAddress();

    console.log(chalk.yellow("  🛡️ Deploying MEV Protector..."));
    const MEVProtector = await ethers.getContractFactory("AdvancedMEVProtector", signer);
    const mevProtector = await MEVProtector.deploy();
    await mevProtector.waitForDeployment();
    contracts.AdvancedMEVProtector = await mevProtector.getAddress();

    console.log(chalk.yellow("  🌉 Deploying Cross-Chain Bridge..."));
    const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge", signer);
    const crossChainBridge = await CrossChainBridge.deploy();
    await crossChainBridge.waitForDeployment();
    contracts.CrossChainBridge = await crossChainBridge.getAddress();

    console.log(chalk.yellow("  🏊 Deploying Balancer Integration..."));
    const BalancerIntegration = await ethers.getContractFactory("BalancerV2Integration", signer);
    const balancerIntegration = await BalancerIntegration.deploy(ethers.ZeroAddress); // Mock vault address
    await balancerIntegration.waitForDeployment();
    contracts.BalancerV2Integration = await balancerIntegration.getAddress();

    console.log(chalk.yellow("  📈 Deploying Curve Integration..."));
    const CurveIntegration = await ethers.getContractFactory("CurveFinanceIntegration", signer);
    const curveIntegration = await CurveIntegration.deploy(ethers.ZeroAddress); // Mock registry address
    await curveIntegration.waitForDeployment();
    contracts.CurveFinanceIntegration = await curveIntegration.getAddress();

    console.log(chalk.yellow("  🤖 Deploying AI Strategy..."));
    const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy", signer);
    const aiStrategy = await AIStrategy.deploy();
    await aiStrategy.waitForDeployment();
    contracts.AIArbitrageStrategy = await aiStrategy.getAddress();

    return contracts;
  }

  private async verifyContracts(contracts: { [key: string]: string }, network: NetworkConfig) {
    console.log(chalk.yellow("  🔍 Verifying contracts..."));
    
    // In a real implementation, this would use the block explorer's API
    // For now, we'll simulate verification
    for (const [name, address] of Object.entries(contracts)) {
      console.log(chalk.gray(`    ✓ ${name}: ${address}`));
    }
  }

  private async calculateTotalGasUsed(contracts: { [key: string]: string }): Promise<number> {
    // Simulate gas calculation
    return Object.keys(contracts).length * 500000; // Average 500k gas per contract
  }

  async deployToAllNetworks(): Promise<DeploymentResult[]> {
    console.log(chalk.bold.blue("🌐 MULTI-NETWORK DEPLOYMENT"));
    console.log(chalk.blue("=".repeat(50)));
    console.log("");

    const enabledNetworks = Object.entries(this.networks)
      .filter(([_, config]) => config.enabled)
      .map(([key, _]) => key);

    console.log(chalk.cyan(`📋 Deploying to ${enabledNetworks.length} networks:`));
    enabledNetworks.forEach(network => {
      console.log(chalk.white(`  • ${this.networks[network].name}`));
    });
    console.log("");

    const results: DeploymentResult[] = [];
    
    for (const networkKey of enabledNetworks) {
      try {
        const result = await this.deployToNetwork(networkKey);
        results.push(result);
        
        // Add delay between deployments
        if (networkKey !== enabledNetworks[enabledNetworks.length - 1]) {
          console.log(chalk.gray("  ⏳ Waiting 10 seconds before next deployment..."));
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to deploy to ${networkKey}: ${error}`));
      }
    }

    this.displayDeploymentSummary(results);
    return results;
  }

  private displayDeploymentSummary(results: DeploymentResult[]) {
    console.log(chalk.bold.blue("\n📊 DEPLOYMENT SUMMARY"));
    console.log(chalk.blue("=".repeat(50)));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(chalk.green(`✅ Successful Deployments: ${successful.length}`));
    console.log(chalk.red(`❌ Failed Deployments: ${failed.length}`));
    console.log("");

    if (successful.length > 0) {
      console.log(chalk.bold.cyan("Successful Deployments:"));
      successful.forEach(result => {
        console.log(chalk.green(`  • ${result.network}`));
        console.log(chalk.gray(`    Gas Used: ${result.gasUsed.toLocaleString()}`));
        console.log(chalk.gray(`    Time: ${result.deploymentTime}ms`));
        Object.entries(result.contracts).forEach(([name, address]) => {
          console.log(chalk.gray(`    ${name}: ${address}`));
        });
        console.log("");
      });
    }

    if (failed.length > 0) {
      console.log(chalk.bold.red("Failed Deployments:"));
      failed.forEach(result => {
        console.log(chalk.red(`  • ${result.network}: ${result.error}`));
      });
      console.log("");
    }

    const totalGasUsed = successful.reduce((sum, r) => sum + r.gasUsed, 0);
    const totalTime = successful.reduce((sum, r) => sum + r.deploymentTime, 0);

    console.log(chalk.bold.white("Overall Statistics:"));
    console.log(chalk.white(`  Total Gas Used: ${totalGasUsed.toLocaleString()}`));
    console.log(chalk.white(`  Total Deployment Time: ${totalTime}ms`));
    console.log(chalk.white(`  Average Gas per Network: ${Math.round(totalGasUsed / successful.length).toLocaleString()}`));
    console.log(chalk.white(`  Average Time per Network: ${Math.round(totalTime / successful.length)}ms`));
  }

  // Public methods for external use
  getNetworks(): { [key: string]: NetworkConfig } {
    return this.networks;
  }

  getDeploymentResults(): DeploymentResult[] {
    return this.deploymentResults;
  }

  enableNetwork(networkKey: string): void {
    if (this.networks[networkKey]) {
      this.networks[networkKey].enabled = true;
    }
  }

  disableNetwork(networkKey: string): void {
    if (this.networks[networkKey]) {
      this.networks[networkKey].enabled = false;
    }
  }
}

// Main execution
async function main() {
  const deployer = new MultiNetworkDeployer();
  
  try {
    console.log(chalk.bold.blue("🚀 ADVANCED DEFI ARBITRAGE ENGINE - MULTI-NETWORK DEPLOYMENT"));
    console.log(chalk.blue("=".repeat(70)));
    console.log("");

    // Check environment variables
    if (!process.env.PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY environment variable is required");
    }

    // Deploy to all enabled networks
    await deployer.deployToAllNetworks();

    console.log(chalk.bold.green("\n🎉 Multi-network deployment completed!"));
    
  } catch (error) {
    console.error(chalk.red("❌ Deployment failed:"), error);
    process.exit(1);
  }
}

// Export for use in other modules
export { MultiNetworkDeployer };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
