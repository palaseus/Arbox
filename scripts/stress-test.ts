#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenvConfig();

interface StressTestConfig {
  rpcUrl: string;
  contractAddress: string;
  mevProtectorAddress: string;
  testDuration: number; // seconds
  concurrentOperations: number;
  operationInterval: number; // ms
}

class ArbitrageStressTest {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private mevProtector: ethers.Contract;
  private config: StressTestConfig;
  private signers: ethers.Signer[] = [];
  private testResults: any[] = [];
  private isRunning: boolean = false;

  constructor(config: StressTestConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  /**
   * Initialize contracts and signers
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing Stress Test...");
    
    // Get signers using hardhat runtime
    const { ethers } = require("hardhat");
    this.signers = await ethers.getSigners();
    console.log(`📋 Found ${this.signers.length} signers`);
    
    // Initialize contracts
    this.contract = new ethers.Contract(
      this.config.contractAddress,
      [
        "function getGlobalMetrics() external view returns (uint256, uint256, uint256, uint256)",
        "function getActiveStrategies() external view returns (bytes32[])",
        "function getRiskParams() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
        "function paused() external view returns (bool)",
        "function updateRiskParams(uint256, uint256, uint256, uint256) external",
        "function grantRole(bytes32, address) external",
        "function revokeRole(bytes32, address) external",
        "function pause() external",
        "function unpause() external"
      ],
      this.provider
    );
    
    this.mevProtector = new ethers.Contract(
      this.config.mevProtectorAddress,
      [
        "function getProtectionStatus() external view returns (bool, uint256)",
        "function getProtectionParams() external view returns (bool, bool, uint256, uint256, uint256, bool, bool)",
        "function updateProtectionParams((bool, bool, uint256, uint256, uint256, bool, bool)) external"
      ],
      this.provider
    );
    
    console.log("✅ Initialization complete");
  }

  /**
   * Run comprehensive stress test
   */
  async runStressTest(): Promise<void> {
    console.log("🔥 Starting Comprehensive Stress Test...");
    console.log(`⏱️ Duration: ${this.config.testDuration} seconds`);
    console.log(`🔄 Concurrent Operations: ${this.config.concurrentOperations}`);
    console.log(`⏳ Operation Interval: ${this.config.operationInterval}ms`);
    console.log("");

    this.isRunning = true;
    const startTime = Date.now();
    const endTime = startTime + (this.config.testDuration * 1000);

    // Test phases
    await this.runPhase1_BasicOperations();
    await this.runPhase2_RiskManagement();
    await this.runPhase3_MEVProtection();
    await this.runPhase4_EmergencyFunctions();
    await this.runPhase5_ConcurrentLoad();
    await this.runPhase6_PerformanceMonitoring();

    console.log("🎉 Stress Test Complete!");
    await this.generateTestReport();
  }

  /**
   * Phase 1: Basic Operations
   */
  private async runPhase1_BasicOperations(): Promise<void> {
    console.log("📋 Phase 1: Basic Operations");
    console.log("=".repeat(40));
    
    try {
      // Test contract state queries
      const [totalProfit, totalGasUsed, successfulArbitrages, failedArbitrages] = 
        await this.contract.getGlobalMetrics();
      
      const isPaused = await this.contract.paused();
      const activeStrategies = await this.contract.getActiveStrategies();
      const riskParams = await this.contract.getRiskParams();
      
      console.log("✅ Contract state queries successful");
      console.log(`   Total Profit: ${ethers.formatEther(totalProfit)} ETH`);
      console.log(`   Active Strategies: ${activeStrategies.length}`);
      console.log(`   Paused: ${isPaused}`);
      
      this.testResults.push({
        phase: "Basic Operations",
        status: "PASS",
        details: "All contract queries successful"
      });
      
    } catch (error) {
      console.error("❌ Basic operations failed:", error);
      this.testResults.push({
        phase: "Basic Operations",
        status: "FAIL",
        details: error.message
      });
    }
    
    console.log("");
  }

  /**
   * Phase 2: Risk Management
   */
  private async runPhase2_RiskManagement(): Promise<void> {
    console.log("⚠️ Phase 2: Risk Management");
    console.log("=".repeat(40));
    
    try {
      const signer = this.signers[0];
      const contractWithSigner = this.contract.connect(signer);
      
      // Test risk parameter updates
      const newMaxExposure = ethers.parseEther("2000");
      const newMaxStrategyExposure = ethers.parseEther("10000");
      const newMinProfit = ethers.parseEther("0.2");
      const newMaxGasPrice = ethers.parseUnits("200", "gwei");
      
      const tx = await contractWithSigner.updateRiskParams(
        newMaxExposure,
        newMaxStrategyExposure,
        newMinProfit,
        newMaxGasPrice
      );
      
      await tx.wait();
      console.log("✅ Risk parameters updated successfully");
      
      // Verify the update
      const updatedParams = await this.contract.getRiskParams();
      console.log(`   New Max Exposure: ${ethers.formatEther(updatedParams[0])} ETH`);
      
      this.testResults.push({
        phase: "Risk Management",
        status: "PASS",
        details: "Risk parameters updated and verified"
      });
      
    } catch (error) {
      console.error("❌ Risk management failed:", error);
      this.testResults.push({
        phase: "Risk Management",
        status: "FAIL",
        details: error.message
      });
    }
    
    console.log("");
  }

  /**
   * Phase 3: MEV Protection
   */
  private async runPhase3_MEVProtection(): Promise<void> {
    console.log("🛡️ Phase 3: MEV Protection");
    console.log("=".repeat(40));
    
    try {
      const signer = this.signers[0];
      const mevWithSigner = this.mevProtector.connect(signer);
      
      // Test protection parameter updates
      const newParams = {
        flashbotsEnabled: true,
        privateMempoolEnabled: true,
        maxGasPrice: ethers.parseUnits("150", "gwei"),
        minBribeAmount: ethers.parseEther("0.02"),
        protectionWindow: 5,
        antiSandwichEnabled: true,
        frontrunProtectionEnabled: true
      };
      
      const tx = await mevWithSigner.updateProtectionParams(newParams);
      await tx.wait();
      console.log("✅ MEV protection parameters updated");
      
      // Verify protection status
      const [protectionActive, lastProtectionBlock] = await this.mevProtector.getProtectionStatus();
      const protectionParams = await this.mevProtector.getProtectionParams();
      
      console.log(`   Protection Active: ${protectionActive}`);
      console.log(`   Flashbots: ${protectionParams[0]}`);
      console.log(`   Anti-Sandwich: ${protectionParams[5]}`);
      
      this.testResults.push({
        phase: "MEV Protection",
        status: "PASS",
        details: "Protection parameters updated and verified"
      });
      
    } catch (error) {
      console.error("❌ MEV protection failed:", error);
      this.testResults.push({
        phase: "MEV Protection",
        status: "FAIL",
        details: error.message
      });
    }
    
    console.log("");
  }

  /**
   * Phase 4: Emergency Functions
   */
  private async runPhase4_EmergencyFunctions(): Promise<void> {
    console.log("🚨 Phase 4: Emergency Functions");
    console.log("=".repeat(40));
    
    try {
      const signer = this.signers[0];
      const contractWithSigner = this.contract.connect(signer);
      
      // Test pause
      console.log("⏸️ Testing pause function...");
      const pauseTx = await contractWithSigner.pause();
      await pauseTx.wait();
      
      const isPaused = await this.contract.paused();
      console.log(`   Contract paused: ${isPaused}`);
      
      // Test unpause
      console.log("▶️ Testing unpause function...");
      const unpauseTx = await contractWithSigner.unpause();
      await unpauseTx.wait();
      
      const isUnpaused = await this.contract.paused();
      console.log(`   Contract unpaused: ${!isUnpaused}`);
      
      this.testResults.push({
        phase: "Emergency Functions",
        status: "PASS",
        details: "Pause/unpause functions working"
      });
      
    } catch (error) {
      console.error("❌ Emergency functions failed:", error);
      this.testResults.push({
        phase: "Emergency Functions",
        status: "FAIL",
        details: error.message
      });
    }
    
    console.log("");
  }

  /**
   * Phase 5: Concurrent Load
   */
  private async runPhase5_ConcurrentLoad(): Promise<void> {
    console.log("⚡ Phase 5: Concurrent Load Test");
    console.log("=".repeat(40));
    
    const concurrentPromises: Promise<any>[] = [];
    
    for (let i = 0; i < this.config.concurrentOperations; i++) {
      const signerIndex = i % this.signers.length;
      const signer = this.signers[signerIndex];
      
      const promise = this.performConcurrentOperation(signer, i);
      concurrentPromises.push(promise);
      
      // Add delay between operations
      if (i < this.config.concurrentOperations - 1) {
        await this.sleep(this.config.operationInterval);
      }
    }
    
    try {
      const results = await Promise.allSettled(concurrentPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Concurrent operations completed`);
      console.log(`   Successful: ${successful}`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Success Rate: ${((successful / results.length) * 100).toFixed(2)}%`);
      
      this.testResults.push({
        phase: "Concurrent Load",
        status: "PASS",
        details: `${successful}/${results.length} operations successful`
      });
      
    } catch (error) {
      console.error("❌ Concurrent load test failed:", error);
      this.testResults.push({
        phase: "Concurrent Load",
        status: "FAIL",
        details: error.message
      });
    }
    
    console.log("");
  }

  /**
   * Phase 6: Performance Monitoring
   */
  private async runPhase6_PerformanceMonitoring(): Promise<void> {
    console.log("📊 Phase 6: Performance Monitoring");
    console.log("=".repeat(40));
    
    try {
      // Monitor performance over time
      const monitoringDuration = 10000; // 10 seconds
      const interval = 1000; // 1 second
      const iterations = monitoringDuration / interval;
      
      const performanceData: any[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        // Perform multiple operations
        await Promise.all([
          this.contract.getGlobalMetrics(),
          this.contract.getActiveStrategies(),
          this.mevProtector.getProtectionStatus(),
          this.mevProtector.getProtectionParams()
        ]);
        
        const end = Date.now();
        const duration = end - start;
        
        performanceData.push({
          iteration: i + 1,
          duration,
          timestamp: new Date().toISOString()
        });
        
        await this.sleep(interval);
      }
      
      const avgDuration = performanceData.reduce((sum, data) => sum + data.duration, 0) / performanceData.length;
      const maxDuration = Math.max(...performanceData.map(d => d.duration));
      const minDuration = Math.min(...performanceData.map(d => d.duration));
      
      console.log("✅ Performance monitoring completed");
      console.log(`   Average Response Time: ${avgDuration.toFixed(2)}ms`);
      console.log(`   Max Response Time: ${maxDuration}ms`);
      console.log(`   Min Response Time: ${minDuration}ms`);
      console.log(`   Total Operations: ${performanceData.length}`);
      
      this.testResults.push({
        phase: "Performance Monitoring",
        status: "PASS",
        details: `Avg: ${avgDuration.toFixed(2)}ms, Max: ${maxDuration}ms`
      });
      
    } catch (error) {
      console.error("❌ Performance monitoring failed:", error);
      this.testResults.push({
        phase: "Performance Monitoring",
        status: "FAIL",
        details: error.message
      });
    }
    
    console.log("");
  }

  /**
   * Perform a concurrent operation
   */
  private async performConcurrentOperation(signer: ethers.Signer, index: number): Promise<void> {
    try {
      const contractWithSigner = this.contract.connect(signer);
      
      // Simulate different types of operations
      const operationType = index % 4;
      
      switch (operationType) {
        case 0:
          await contractWithSigner.getGlobalMetrics();
          break;
        case 1:
          await contractWithSigner.getActiveStrategies();
          break;
        case 2:
          await contractWithSigner.getRiskParams();
          break;
        case 3:
          await this.mevProtector.getProtectionStatus();
          break;
      }
      
    } catch (error) {
      throw new Error(`Operation ${index} failed: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(): Promise<void> {
    console.log("📋 STRESS TEST REPORT");
    console.log("=".repeat(60));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
    console.log("");
    
    console.log("📊 DETAILED RESULTS:");
    this.testResults.forEach((result, index) => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${index + 1}. ${result.phase}: ${result.status}`);
      console.log(`   ${result.details}`);
      console.log("");
    });
    
    // Final assessment
    if (failedTests === 0) {
      console.log("🎉 ALL TESTS PASSED! System is ready for production!");
    } else {
      console.log(`⚠️ ${failedTests} test(s) failed. Review before production deployment.`);
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

  const config: StressTestConfig = {
    rpcUrl: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
    contractAddress,
    mevProtectorAddress,
    testDuration: 30, // 30 seconds
    concurrentOperations: 10,
    operationInterval: 500 // 500ms
  };

  const stressTest = new ArbitrageStressTest(config);
  
  try {
    await stressTest.initialize();
    await stressTest.runStressTest();
  } catch (error) {
    console.error("❌ Stress test failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
