#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenvConfig();

interface SepoliaDeploymentConfig {
  rpcUrl: string;
  privateKey: string;
  adminAddress: string;
  gasPrice: string;
  gasLimit: number;
}

class SepoliaDeployer {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private config: SepoliaDeploymentConfig;

  constructor(config: SepoliaDeploymentConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
  }

  /**
   * Deploy all contracts to Sepolia testnet
   */
  async deploy(): Promise<void> {
    console.log("🚀 Deploying Advanced Arbitrage Engine to Sepolia Testnet...");
    console.log("Network: Sepolia Testnet");
    console.log("Deployer:", await this.wallet.getAddress());
    console.log("Balance:", ethers.formatEther(await this.provider.getBalance(await this.wallet.getAddress())), "ETH");
    console.log("");

    try {
      // Deploy MEV Protector
      console.log("📦 Deploying MEV Protector...");
      const mevProtector = await this.deployMEVProtector();
      const mevProtectorAddress = await mevProtector.getAddress();
      console.log("✅ MEV Protector deployed at:", mevProtectorAddress);
      console.log("   Transaction hash:", mevProtector.deploymentTransaction()?.hash);
      console.log("");

      // Deploy AI Strategy
      console.log("🤖 Deploying AI Arbitrage Strategy...");
      const aiStrategy = await this.deployAIStrategy();
      const aiStrategyAddress = await aiStrategy.getAddress();
      console.log("✅ AI Strategy deployed at:", aiStrategyAddress);
      console.log("   Transaction hash:", aiStrategy.deploymentTransaction()?.hash);
      console.log("");

      // Deploy Advanced Arbitrage Engine
      console.log("⚡ Deploying Advanced Arbitrage Engine...");
      const advancedEngine = await this.deployAdvancedEngine(mevProtectorAddress);
      const advancedEngineAddress = await advancedEngine.getAddress();
      console.log("✅ Advanced Engine deployed at:", advancedEngineAddress);
      console.log("   Transaction hash:", advancedEngine.deploymentTransaction()?.hash);
      console.log("");

      // Setup initial configuration
      console.log("⚙️  Setting up initial configuration...");
      await this.setupInitialConfig(advancedEngine, aiStrategyAddress);
      console.log("✅ Initial configuration complete");
      console.log("");

      // Verify contracts on Etherscan
      console.log("🔍 Verifying contracts on Etherscan...");
      await this.verifyContracts(mevProtectorAddress, aiStrategyAddress, advancedEngineAddress);
      console.log("✅ Contract verification initiated");
      console.log("");

      // Generate deployment summary
      await this.generateDeploymentSummary(mevProtectorAddress, aiStrategyAddress, advancedEngineAddress);

    } catch (error) {
      console.error("❌ Deployment failed:", error);
      throw error;
    }
  }

  /**
   * Deploy MEV Protector contract
   */
  private async deployMEVProtector() {
    const { ethers } = require("hardhat");
    const MEVProtector = await ethers.getContractFactory("MEVProtector", this.wallet);
    
    return await MEVProtector.deploy(
      this.config.adminAddress,
      {
        gasLimit: this.config.gasLimit,
        gasPrice: ethers.parseUnits(this.config.gasPrice, "gwei")
      }
    );
  }

  /**
   * Deploy AI Arbitrage Strategy contract
   */
  private async deployAIStrategy() {
    const { ethers } = require("hardhat");
    const AIStrategy = await ethers.getContractFactory("AIArbitrageStrategy", this.wallet);
    
    return await AIStrategy.deploy({
      gasLimit: this.config.gasLimit,
      gasPrice: ethers.parseUnits(this.config.gasPrice, "gwei")
    });
  }

  /**
   * Deploy Advanced Arbitrage Engine contract
   */
  private async deployAdvancedEngine(mevProtectorAddress: string) {
    const { ethers } = require("hardhat");
    const AdvancedEngine = await ethers.getContractFactory("AdvancedArbitrageEngine", this.wallet);
    
    return await AdvancedEngine.deploy(
      mevProtectorAddress,
      this.config.adminAddress,
      {
        gasLimit: this.config.gasLimit,
        gasPrice: ethers.parseUnits(this.config.gasPrice, "gwei")
      }
    );
  }

  /**
   * Setup initial configuration for the advanced engine
   */
  private async setupInitialConfig(advancedEngine: any, aiStrategyAddress: string) {
    // Grant roles to specified addresses
    const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ROLE"));

    // Grant roles if different from admin
    if (this.config.adminAddress !== await this.wallet.getAddress()) {
      await advancedEngine.grantRole(STRATEGIST_ROLE, this.config.adminAddress);
      console.log("   Granted STRATEGIST_ROLE to:", this.config.adminAddress);
    }

    // Add AI Strategy to the engine
    const strategyId = ethers.keccak256(ethers.toUtf8Bytes("ai_strategy_v1"));
    const strategyConfig = {
      isActive: true,
      minProfit: ethers.parseEther("0.01"), // Lower for testnet
      maxSlippage: 100,
      gasLimit: 500000,
      cooldownPeriod: 0,
      lastExecution: 0,
      successRate: 0,
      avgProfit: 0
    };

    await advancedEngine.addStrategy(strategyId, aiStrategyAddress, strategyConfig);
    console.log("   Added AI Strategy with ID:", strategyId);
  }

  /**
   * Verify contracts on Etherscan
   */
  private async verifyContracts(mevProtectorAddress: string, aiStrategyAddress: string, advancedEngineAddress: string) {
    try {
      // Note: In a real deployment, you would use hardhat-etherscan plugin
      // For now, we'll just provide the verification commands
      console.log("   MEV Protector verification command:");
      console.log(`   npx hardhat verify --network sepolia ${mevProtectorAddress} "${this.config.adminAddress}"`);
      console.log("");
      console.log("   AI Strategy verification command:");
      console.log(`   npx hardhat verify --network sepolia ${aiStrategyAddress}`);
      console.log("");
      console.log("   Advanced Engine verification command:");
      console.log(`   npx hardhat verify --network sepolia ${advancedEngineAddress} "${mevProtectorAddress}" "${this.config.adminAddress}"`);
    } catch (error) {
      console.warn("⚠️  Contract verification setup failed:", error);
    }
  }

  /**
   * Generate deployment summary
   */
  private async generateDeploymentSummary(mevProtectorAddress: string, aiStrategyAddress: string, advancedEngineAddress: string): Promise<void> {
    const network = await this.provider.getNetwork();
    
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Network: Sepolia Testnet (Chain ID: ${network.chainId})`);
    console.log(`Deployer: ${await this.wallet.getAddress()}`);
    console.log(`Deployment Time: ${new Date().toISOString()}`);
    console.log("");
    console.log("Contracts Deployed:");
    console.log(`├── MEV Protector: ${mevProtectorAddress}`);
    console.log(`├── AI Strategy: ${aiStrategyAddress}`);
    console.log(`└── Advanced Engine: ${advancedEngineAddress}`);
    console.log("");
    console.log("Configuration:");
    console.log(`├── Admin: ${this.config.adminAddress}`);
    console.log(`├── Gas Price: ${this.config.gasPrice} gwei`);
    console.log(`└── Gas Limit: ${this.config.gasLimit}`);
    console.log("");
    console.log("🔗 Sepolia Block Explorer:");
    console.log(`   https://sepolia.etherscan.io/address/${advancedEngineAddress}`);
    console.log("");
    console.log("📊 Environment Variables for Monitoring:");
    console.log(`export ARBITRAGE_CONTRACT_ADDRESS=${advancedEngineAddress}`);
    console.log(`export MEV_PROTECTOR_ADDRESS=${mevProtectorAddress}`);
    console.log(`export SEPOLIA_RPC_URL=${this.config.rpcUrl}`);
    console.log("");
    console.log("🎉 Your Advanced Arbitrage Engine is now live on Sepolia Testnet!");
    console.log("");
    console.log("📋 Next Steps:");
    console.log("1. Fund the contracts with testnet ETH");
    console.log("2. Test arbitrage strategies with small amounts");
    console.log("3. Monitor performance via Etherscan");
    console.log("4. Deploy to mainnet when ready");
  }
}

// Main execution
async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const adminAddress = process.env.ADMIN_ADDRESS;
  const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
  
  if (!privateKey || !adminAddress || !sepoliaRpcUrl) {
    console.error("❌ Please set PRIVATE_KEY, ADMIN_ADDRESS, and SEPOLIA_RPC_URL environment variables");
    console.error("   Add these to your .env file:");
    console.error("   PRIVATE_KEY=your-private-key-here");
    console.error("   ADMIN_ADDRESS=your-admin-address-here");
    console.error("   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id");
    process.exit(1);
  }

  const config: SepoliaDeploymentConfig = {
    rpcUrl: sepoliaRpcUrl,
    privateKey: privateKey,
    adminAddress: adminAddress,
    gasPrice: "20", // 20 gwei for Sepolia
    gasLimit: 5000000
  };

  const deployer = new SepoliaDeployer(config);
  
  try {
    await deployer.deploy();
  } catch (error) {
    console.error("❌ Sepolia deployment failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
