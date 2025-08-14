#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { task } from "hardhat/config";

interface DeploymentConfig {
  adminAddress: string;
  strategistAddress: string;
  operatorAddress: string;
  emergencyAddress: string;
  gasLimit: number;
  gasPrice: string;
}

interface DeployedContracts {
  mevProtector: string;
  aiStrategy: string;
  advancedEngine: string;
  deploymentHash: string;
}

class AdvancedArbitrageDeployer {
  private hre: HardhatRuntimeEnvironment;
  private config: DeploymentConfig;

  constructor(hre: HardhatRuntimeEnvironment, config: DeploymentConfig) {
    this.hre = hre;
    this.config = config;
  }

  /**
   * Deploy all advanced arbitrage contracts
   */
  async deploy(): Promise<DeployedContracts> {
    console.log("🚀 Starting Advanced Arbitrage Engine deployment...");
    console.log("Network:", await this.hre.ethers.provider.getNetwork());
    console.log("Deployer:", await this.hre.ethers.provider.getSigner().getAddress());
    console.log("Gas Price:", this.config.gasPrice);
    console.log("Gas Limit:", this.config.gasLimit);
    console.log("");

    try {
      // Deploy MEV Protector
      console.log("📦 Deploying MEV Protector...");
      const mevProtector = await this.deployMEVProtector();
      console.log("✅ MEV Protector deployed at:", mevProtector.address);
      console.log("   Transaction hash:", mevProtector.deploymentTransaction()?.hash);
      console.log("");

      // Deploy AI Strategy
      console.log("🤖 Deploying AI Arbitrage Strategy...");
      const aiStrategy = await this.deployAIStrategy();
      console.log("✅ AI Strategy deployed at:", aiStrategy.address);
      console.log("   Transaction hash:", aiStrategy.deploymentTransaction()?.hash);
      console.log("");

      // Deploy Advanced Arbitrage Engine
      console.log("⚡ Deploying Advanced Arbitrage Engine...");
      const advancedEngine = await this.deployAdvancedEngine(mevProtector.address);
      console.log("✅ Advanced Engine deployed at:", advancedEngine.address);
      console.log("   Transaction hash:", advancedEngine.deploymentTransaction()?.hash);
      console.log("");

      // Setup initial configuration
      console.log("⚙️  Setting up initial configuration...");
      await this.setupInitialConfig(advancedEngine, aiStrategy);
      console.log("✅ Initial configuration complete");
      console.log("");

      // Verify contracts (if on supported network)
      if (await this.shouldVerifyContracts()) {
        console.log("🔍 Verifying contracts on Etherscan...");
        await this.verifyContracts(mevProtector.address, aiStrategy.address, advancedEngine.address);
        console.log("✅ Contract verification complete");
        console.log("");
      }

      // Generate deployment summary
      const deploymentSummary = await this.generateDeploymentSummary(
        mevProtector.address,
        aiStrategy.address,
        advancedEngine.address
      );

      console.log("📋 DEPLOYMENT SUMMARY");
      console.log("=".repeat(50));
      console.log(deploymentSummary);

      return {
        mevProtector: mevProtector.address,
        aiStrategy: aiStrategy.address,
        advancedEngine: advancedEngine.address,
        deploymentHash: advancedEngine.deploymentTransaction()?.hash || ""
      };

    } catch (error) {
      console.error("❌ Deployment failed:", error);
      throw error;
    }
  }

  /**
   * Deploy MEV Protector contract
   */
  private async deployMEVProtector() {
    const MEVProtector = await this.hre.ethers.getContractFactory("MEVProtector");
    
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
    const AIStrategy = await this.hre.ethers.getContractFactory("AIArbitrageStrategy");
    
    return await AIStrategy.deploy({
      gasLimit: this.config.gasLimit,
      gasPrice: ethers.parseUnits(this.config.gasPrice, "gwei")
    });
  }

  /**
   * Deploy Advanced Arbitrage Engine contract
   */
  private async deployAdvancedEngine(mevProtectorAddress: string) {
    const AdvancedArbitrageEngine = await this.hre.ethers.getContractFactory("AdvancedArbitrageEngine");
    
    return await AdvancedArbitrageEngine.deploy(
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
  private async setupInitialConfig(advancedEngine: any, aiStrategy: any) {
    const [deployer] = await this.hre.ethers.getSigners();
    
    // Grant roles to specified addresses
    const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ROLE"));

    // Grant roles if different from admin
    if (this.config.strategistAddress !== this.config.adminAddress) {
      await advancedEngine.grantRole(STRATEGIST_ROLE, this.config.strategistAddress);
      console.log("   Granted STRATEGIST_ROLE to:", this.config.strategistAddress);
    }

    if (this.config.operatorAddress !== this.config.adminAddress) {
      await advancedEngine.grantRole(OPERATOR_ROLE, this.config.operatorAddress);
      console.log("   Granted OPERATOR_ROLE to:", this.config.operatorAddress);
    }

    if (this.config.emergencyAddress !== this.config.adminAddress) {
      await advancedEngine.grantRole(EMERGENCY_ROLE, this.config.emergencyAddress);
      console.log("   Granted EMERGENCY_ROLE to:", this.config.emergencyAddress);
    }

    // Add AI Strategy to the engine
    const strategyId = ethers.keccak256(ethers.toUtf8Bytes("ai_strategy_v1"));
    const strategyConfig = {
      isActive: true,
      minProfit: ethers.parseEther("0.1"),
      maxSlippage: 100,
      gasLimit: 500000,
      cooldownPeriod: 0,
      lastExecution: 0,
      successRate: 0,
      avgProfit: 0
    };

    await advancedEngine.addStrategy(strategyId, aiStrategy.address, strategyConfig);
    console.log("   Added AI Strategy with ID:", strategyId);
  }

  /**
   * Check if contracts should be verified
   */
  private async shouldVerifyContracts(): Promise<boolean> {
    const network = await this.hre.ethers.provider.getNetwork();
    const supportedNetworks = [1, 5, 10, 137, 42161]; // Mainnet, Goerli, Polygon, Arbitrum
    
    return supportedNetworks.includes(Number(network.chainId));
  }

  /**
   * Verify contracts on Etherscan
   */
  private async verifyContracts(mevProtectorAddress: string, aiStrategyAddress: string, advancedEngineAddress: string) {
    try {
      // Verify MEV Protector
      await this.hre.run("verify:verify", {
        address: mevProtectorAddress,
        constructorArguments: [this.config.adminAddress]
      });

      // Verify AI Strategy
      await this.hre.run("verify:verify", {
        address: aiStrategyAddress,
        constructorArguments: []
      });

      // Verify Advanced Engine
      await this.hre.run("verify:verify", {
        address: advancedEngineAddress,
        constructorArguments: [
          mevProtectorAddress,
          this.config.adminAddress
        ]
      });

    } catch (error) {
      console.warn("⚠️  Contract verification failed:", error);
    }
  }

  /**
   * Generate deployment summary
   */
  private async generateDeploymentSummary(mevProtectorAddress: string, aiStrategyAddress: string, advancedEngineAddress: string): Promise<string> {
    const network = await this.hre.ethers.provider.getNetwork();
    const [deployer] = await this.hre.ethers.getSigner();
    
    return `
Network: ${network.name} (Chain ID: ${network.chainId})
Deployer: ${deployer.address}
Deployment Time: ${new Date().toISOString()}

Contracts Deployed:
├── MEV Protector: ${mevProtectorAddress}
├── AI Strategy: ${aiStrategyAddress}
└── Advanced Engine: ${advancedEngineAddress}

Configuration:
├── Admin: ${this.config.adminAddress}
├── Strategist: ${this.config.strategistAddress}
├── Operator: ${this.config.operatorAddress}
└── Emergency: ${this.config.emergencyAddress}

Next Steps:
1. Fund the Advanced Engine with ETH for gas fees
2. Configure risk parameters via updateRiskParams()
3. Add additional strategies as needed
4. Set up monitoring via scripts/monitor.ts
5. Test with small amounts before main deployment

Environment Variables for Monitoring:
export ARBITRAGE_CONTRACT_ADDRESS=${advancedEngineAddress}
export MEV_PROTECTOR_ADDRESS=${mevProtectorAddress}
export MAINNET_RPC_URL=<your-rpc-url>

Monitor Command:
npx hardhat monitor --contract ${advancedEngineAddress} --mevProtector ${mevProtectorAddress}
`;
  }
}

// Hardhat task for deployment
task("deploy:advanced", "Deploy the advanced arbitrage engine and related contracts")
  .addParam("admin", "Address of the admin (will have all roles)")
  .addOptionalParam("strategist", "Address of the strategist (defaults to admin)")
  .addOptionalParam("operator", "Address of the operator (defaults to admin)")
  .addOptionalParam("emergency", "Address of the emergency role (defaults to admin)")
  .addOptionalParam("gasLimit", "Gas limit for deployment (default: 5000000)")
  .addOptionalParam("gasPrice", "Gas price in gwei (default: 50)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const [deployerSigner] = await hre.ethers.getSigners();
    
    const config: DeploymentConfig = {
      aavePoolAddress: taskArgs.aavePool,
      adminAddress: taskArgs.admin,
      strategistAddress: taskArgs.strategist || taskArgs.admin,
      operatorAddress: taskArgs.operator || taskArgs.admin,
      emergencyAddress: taskArgs.emergency || taskArgs.admin,
      gasLimit: parseInt(taskArgs.gasLimit) || 5000000,
      gasPrice: taskArgs.gasPrice || "50"
    };

    // Validate addresses
    if (!ethers.isAddress(config.adminAddress)) {
      throw new Error("Invalid admin address");
    }

    console.log("🔧 Deployment Configuration:");
    console.log("Admin:", config.adminAddress);
    console.log("Strategist:", config.strategistAddress);
    console.log("Operator:", config.operatorAddress);
    console.log("Emergency:", config.emergencyAddress);
    console.log("Gas Limit:", config.gasLimit);
    console.log("Gas Price:", config.gasPrice, "gwei");
    console.log("");

    const deployerInstance = new AdvancedArbitrageDeployer(hre, config);
    
    try {
      const result = await deployerInstance.deploy();
      
      console.log("🎉 Deployment completed successfully!");
      console.log("Contract addresses saved to deployment result");
      
      // Save deployment info to file
      const fs = require("fs");
      const deploymentInfo = {
        network: (await hre.ethers.provider.getNetwork()).name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId,
        deployer: deployerSigner.address,
        timestamp: new Date().toISOString(),
        contracts: result
      };
      
      fs.writeFileSync(
        `deployment-advanced-${Date.now()}.json`,
        JSON.stringify(deploymentInfo, null, 2)
      );
      
      console.log("📄 Deployment info saved to file");
      
    } catch (error) {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    }
  });

// Standalone execution
if (require.main === module) {
  const config: DeploymentConfig = {
    adminAddress: process.env.ADMIN_ADDRESS || "",
    strategistAddress: process.env.STRATEGIST_ADDRESS || process.env.ADMIN_ADDRESS || "",
    operatorAddress: process.env.OPERATOR_ADDRESS || process.env.ADMIN_ADDRESS || "",
    emergencyAddress: process.env.EMERGENCY_ADDRESS || process.env.ADMIN_ADDRESS || "",
    gasLimit: parseInt(process.env.GAS_LIMIT || "5000000"),
    gasPrice: process.env.GAS_PRICE || "50"
  };

  if (!config.adminAddress) {
    console.error("Please set ADMIN_ADDRESS environment variable");
    process.exit(1);
  }

  // Initialize hardhat
  require("hardhat");
  
  const hre = require("hardhat");
  const deployer = new AdvancedArbitrageDeployer(hre, config);

  deployer.deploy().catch(error => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
}
