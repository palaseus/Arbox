#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenvConfig();

interface MumbaiDeploymentConfig {
  rpcUrl: string;
  privateKey: string;
  adminAddress: string;
  gasPrice: string;
  gasLimit: number;
}

class MumbaiDeployer {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private config: MumbaiDeploymentConfig;

  constructor(config: MumbaiDeploymentConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
  }

  async deploy(): Promise<void> {
    console.log("🚀 Deploying Advanced Arbitrage Engine to Mumbai Testnet...");
    console.log("Network: Mumbai Testnet (Polygon)");
    console.log("Deployer:", await this.wallet.getAddress());
    console.log("Balance:", ethers.formatEther(await this.provider.getBalance(await this.wallet.getAddress())), "MATIC");
    console.log("");

    try {
      // Deploy MEV Protector
      console.log("📦 Deploying MEV Protector...");
      const MEVProtectorFactory = await ethers.getContractFactory("MEVProtector", this.wallet);
      const mevProtector = await MEVProtectorFactory.deploy(
        this.config.adminAddress,
        {
          gasLimit: this.config.gasLimit,
          gasPrice: ethers.parseUnits(this.config.gasPrice, "gwei")
        }
      );
      await mevProtector.waitForDeployment();
      const mevProtectorAddress = await mevProtector.getAddress();
      console.log("✅ MEV Protector deployed at:", mevProtectorAddress);
      console.log("   Transaction hash:", mevProtector.deploymentTransaction()?.hash);
      console.log("");

      // Deploy AI Strategy
      console.log("🤖 Deploying AI Arbitrage Strategy...");
      const AIStrategyFactory = await ethers.getContractFactory("AIArbitrageStrategy", this.wallet);
      const aiStrategy = await AIStrategyFactory.deploy({
        gasLimit: this.config.gasLimit,
        gasPrice: ethers.parseUnits(this.config.gasPrice, "gwei")
      });
      await aiStrategy.waitForDeployment();
      const aiStrategyAddress = await aiStrategy.getAddress();
      console.log("✅ AI Strategy deployed at:", aiStrategyAddress);
      console.log("   Transaction hash:", aiStrategy.deploymentTransaction()?.hash);
      console.log("");

      // Deploy Advanced Arbitrage Engine
      console.log("⚡ Deploying Advanced Arbitrage Engine...");
      const AdvancedEngineFactory = await ethers.getContractFactory("AdvancedArbitrageEngine", this.wallet);
      const advancedEngine = await AdvancedEngineFactory.deploy(
        mevProtectorAddress,
        this.config.adminAddress,
        {
          gasLimit: this.config.gasLimit,
          gasPrice: ethers.parseUnits(this.config.gasPrice, "gwei")
        }
      );
      await advancedEngine.waitForDeployment();
      const advancedEngineAddress = await advancedEngine.getAddress();
      console.log("✅ Advanced Engine deployed at:", advancedEngineAddress);
      console.log("   Transaction hash:", advancedEngine.deploymentTransaction()?.hash);
      console.log("");

      // Setup initial configuration
      console.log("⚙️  Setting up initial configuration...");
      await this.setupInitialConfig(advancedEngine, aiStrategyAddress);
      console.log("✅ Initial configuration complete");
      console.log("");

      // Generate deployment summary
      await this.generateDeploymentSummary(mevProtectorAddress, aiStrategyAddress, advancedEngineAddress);

    } catch (error) {
      console.error("❌ Deployment failed:", error);
      throw error;
    }
  }

  private async setupInitialConfig(advancedEngine: any, aiStrategyAddress: string) {
    const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ROLE"));

    if (this.config.adminAddress !== await this.wallet.getAddress()) {
      await advancedEngine.grantRole(STRATEGIST_ROLE, this.config.adminAddress);
      console.log("   Granted STRATEGIST_ROLE to:", this.config.adminAddress);
    }

    const strategyId = ethers.keccak256(ethers.toUtf8Bytes("ai_strategy_v1"));
    const strategyConfig = {
      isActive: true,
      minProfit: ethers.parseEther("0.01"),
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

  private async generateDeploymentSummary(mevProtectorAddress: string, aiStrategyAddress: string, advancedEngineAddress: string): Promise<void> {
    const network = await this.provider.getNetwork();

    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Network: Mumbai Testnet (Chain ID: ${network.chainId})`);
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
    console.log("🔗 Mumbai Block Explorer:");
    console.log(`   https://mumbai.polygonscan.com/address/${advancedEngineAddress}`);
    console.log("");
    console.log("📊 Environment Variables for Monitoring:");
    console.log(`export ARBITRAGE_CONTRACT_ADDRESS=${advancedEngineAddress}`);
    console.log(`export MEV_PROTECTOR_ADDRESS=${mevProtectorAddress}`);
    console.log(`export MUMBAI_RPC_URL=${this.config.rpcUrl}`);
    console.log("");
    console.log("🎉 Your Advanced Arbitrage Engine is now live on Mumbai Testnet!");
    console.log("");
    console.log("📋 Next Steps:");
    console.log("1. Fund the contracts with testnet MATIC");
    console.log("2. Test arbitrage strategies with small amounts");
    console.log("3. Monitor performance via Polygonscan");
    console.log("4. Deploy to mainnet when ready");
  }
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const adminAddress = process.env.ADMIN_ADDRESS;
  const mumbaiRpcUrl = process.env.MUMBAI_RPC_URL || "https://polygon-mumbai.infura.io/v3/47a4155be9f941a5a5a6a6c841f01831";

  if (!privateKey || !adminAddress) {
    console.error("❌ Please set PRIVATE_KEY and ADMIN_ADDRESS environment variables");
    console.error("   Add these to your .env file:");
    console.error("   PRIVATE_KEY=your-private-key-here");
    console.error("   ADMIN_ADDRESS=your-admin-address-here");
    process.exit(1);
  }

  const config: MumbaiDeploymentConfig = {
    rpcUrl: mumbaiRpcUrl,
    privateKey: privateKey,
    adminAddress: adminAddress,
    gasPrice: "30",
    gasLimit: 5000000
  };

  const deployer = new MumbaiDeployer(config);

  try {
    await deployer.deploy();
  } catch (error) {
    console.error("❌ Mumbai deployment failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
