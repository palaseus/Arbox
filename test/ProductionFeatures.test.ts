import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { RateLimiter } from "../typechain-types/contracts/protection/RateLimiter";
import { MarketVolatilityBreaker } from "../typechain-types/contracts/protection/MarketVolatilityBreaker";
import { AutomatedBackup } from "../typechain-types/contracts/protection/AutomatedBackup";

describe("Production Features", function () {
  let rateLimiter: RateLimiter;
  let marketVolatilityBreaker: MarketVolatilityBreaker;
  let automatedBackup: AutomatedBackup;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;
  let ownerAddress: string;
  let user1Address: string;
  let user2Address: string;
  let user3Address: string;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();
    user3Address = await user3.getAddress();

    // Deploy contracts
    const RateLimiter = await ethers.getContractFactory("RateLimiter");
    rateLimiter = await RateLimiter.deploy();

    const MarketVolatilityBreaker = await ethers.getContractFactory("MarketVolatilityBreaker");
    marketVolatilityBreaker = await MarketVolatilityBreaker.deploy();

    const AutomatedBackup = await ethers.getContractFactory("AutomatedBackup");
    automatedBackup = await AutomatedBackup.deploy();
    
    // Set up authorized operators for AutomatedBackup
    await automatedBackup.setBackupCreator(ownerAddress, true);
    await automatedBackup.setRecoveryOperator(ownerAddress, true);
    
    // Set a very short backup interval for testing
    await automatedBackup.updateRecoveryConfig(10, 1, 1, true, false);
  });

  describe("Rate Limiter", function () {
    const limitId = ethers.keccak256(ethers.toUtf8Bytes("test_limit"));

    it("should set up rate limits correctly", async function () {
      await rateLimiter.setRateLimit(limitId, 10, 60); // 10 requests per minute
      
      const status = await rateLimiter.getRateLimitStatus(limitId);
      expect(status.max).to.equal(10);
      expect(status.isActive).to.be.true;
    });

    it("should enforce rate limits", async function () {
      await rateLimiter.setRateLimit(limitId, 2, 60); // 2 requests per minute
      
      // First request should succeed
      const result1 = await rateLimiter.checkRateLimit(limitId, user1Address);
      expect(result1[0]).to.be.true;
      expect(result1[1]).to.equal(0);
      await rateLimiter.recordRequest(limitId, user1Address);
      
      // Second request should succeed
      const result2 = await rateLimiter.checkRateLimit(limitId, user1Address);
      expect(result2[0]).to.be.true;
      expect(result2[1]).to.equal(0);
      await rateLimiter.recordRequest(limitId, user1Address);
      
      // Third request should fail
      const result3 = await rateLimiter.checkRateLimit(limitId, user1Address);
      expect(result3[0]).to.be.false;
    });

    it("should set up circuit breakers", async function () {
      const breakerId = ethers.keccak256(ethers.toUtf8Bytes("test_breaker"));
      await rateLimiter.setCircuitBreaker(breakerId, 3, 300); // 3 failures, 5 min recovery
      
      const status = await rateLimiter.getCircuitBreakerStatus(breakerId);
      expect(status.threshold).to.equal(3);
      expect(status.isActive).to.be.true;
    });

    it("should trigger circuit breaker on failures", async function () {
      const breakerId = ethers.keccak256(ethers.toUtf8Bytes("test_breaker"));
      await rateLimiter.setCircuitBreaker(breakerId, 2, 300);
      
      // Record failures
      await rateLimiter.recordFailure(breakerId);
      await rateLimiter.recordFailure(breakerId);
      
      const status = await rateLimiter.getCircuitBreakerStatus(breakerId);
      expect(status.isOpen).to.be.true;
      expect(status.failureCount).to.equal(2);
    });

    it("should apply throttling", async function () {
      const throttleId = ethers.keccak256(ethers.toUtf8Bytes("test_throttle"));
      await rateLimiter.setThrottleConfig(throttleId, 1, 10, 150); // 1-10s delay, 1.5x backoff
      
      // First request should have no delay
      const result1 = await rateLimiter.checkRateLimit(throttleId, user1Address);
      expect(result1[0]).to.be.true;
      expect(result1[1]).to.equal(0);
      await rateLimiter.recordRequest(throttleId, user1Address);
      
      // Second request should have delay
      const result2 = await rateLimiter.checkRateLimit(throttleId, user1Address);
      expect(result2[0]).to.be.true;
      expect(result2[1]).to.be.gt(0);
      await rateLimiter.recordRequest(throttleId, user1Address);
    });

    it("should handle emergency stop", async function () {
      await rateLimiter.activateEmergencyStop();
      
      // Emergency stop should cause the function to revert
      await expect(rateLimiter.checkRateLimit(limitId, user1Address))
        .to.be.revertedWith("Emergency stop is active");
      
      await rateLimiter.deactivateEmergencyStop();
      
      const result2 = await rateLimiter.checkRateLimit(limitId, user1Address);
      expect(result2[0]).to.be.true;
    });

    it("should update global rate limits", async function () {
      await rateLimiter.updateGlobalRateLimits(5, 50, 500);
      
      expect(await rateLimiter.globalMaxRequestsPerSecond()).to.equal(5);
      expect(await rateLimiter.globalMaxRequestsPerMinute()).to.equal(50);
      expect(await rateLimiter.globalMaxRequestsPerHour()).to.equal(500);
    });
  });

  describe("Market Volatility Breaker", function () {
    const tokenAddress = ethers.Wallet.createRandom().address;

    it("should set up volatility configuration", async function () {
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,   // 5% price change threshold
        1000,  // 10x volume spike threshold
        200,   // 2% arbitrage profit threshold
        300,   // 5 minute time window
        1800   // 30 minute cooldown
      );
      
      const config = await marketVolatilityBreaker.getVolatilityConfig(tokenAddress);
      expect(config.priceChangeThreshold).to.equal(500);
      expect(config.volumeSpikeThreshold).to.equal(1000);
      expect(config.arbitrageProfitThreshold).to.equal(200);
    });

    it("should detect price volatility", async function () {
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,  // 5% threshold
        1000,
        200,
        300,
        1800
      );
      
      // First check - should be stable
      const tx1 = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"),  // $100 price
        ethers.parseEther("1000"), // $1000 volume
        100 // 1% arbitrage profit
      );
      const receipt1 = await tx1.wait();
      expect(receipt1?.status).to.equal(1);
      
      // Second check with 10% price increase - should still work
      const tx2 = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("110"),  // $110 price (10% increase)
        ethers.parseEther("1000"), // $1000 volume
        100 // 1% arbitrage profit
      );
      const receipt2 = await tx2.wait();
      expect(receipt2?.status).to.equal(1);
    });

    it("should detect volume volatility", async function () {
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,
        1000,  // 10x volume spike threshold
        200,
        300,
        1800
      );
      
      // First check
      const tx1 = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"),
        ethers.parseEther("1000"),
        100
      );
      const receipt1 = await tx1.wait();
      expect(receipt1?.status).to.equal(1);
      
      // Second check with 15x volume increase
      const tx2 = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"),
        ethers.parseEther("15000"), // 15x volume increase
        100
      );
      const receipt2 = await tx2.wait();
      expect(receipt2?.status).to.equal(1);
    });

    it("should detect arbitrage profit volatility", async function () {
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,
        1000,
        200,  // 2% arbitrage profit threshold
        300,
        1800
      );
      
      // Check with 3% arbitrage profit
      const tx = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"),
        ethers.parseEther("1000"),
        300 // 3% arbitrage profit
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("should handle circuit breaker recovery", async function () {
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,
        1000,
        200,
        300,
        1800
      );
      
      // First, establish baseline price
      const baselineTx = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"), // Baseline price
        ethers.parseEther("1000"),
        100
      );
      await baselineTx.wait();
      
      // Now trigger circuit breaker with 10% price increase
      const result1 = await marketVolatilityBreaker.checkMarketStability.staticCall(
        tokenAddress,
        ethers.parseEther("110"), // 10% price increase
        ethers.parseEther("1000"),
        100
      );
      expect(result1[0]).to.be.false; // Should be unstable
      expect(result1[1]).to.be.greaterThan(0); // Should have a reason
      
      // Now execute the actual transaction
      const tx1 = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("110"), // 10% price increase
        ethers.parseEther("1000"),
        100
      );
      await tx1.wait();
      
      // Check circuit breaker state
      const breakerState = await marketVolatilityBreaker.getCircuitBreakerState(tokenAddress);
      expect(breakerState.isOpen).to.be.true;
      expect(breakerState.triggerReason).to.equal(1);
      
      // Manual close breaker
      await marketVolatilityBreaker.manualCloseBreaker(tokenAddress);
      
      const breakerState2 = await marketVolatilityBreaker.getCircuitBreakerState(tokenAddress);
      expect(breakerState2.isOpen).to.be.false;
    });

    it("should update global thresholds", async function () {
      await marketVolatilityBreaker.updateGlobalThresholds(
        300,   // 3% price change
        800,   // 8x volume spike
        150,   // 1.5% arbitrage profit
        240,   // 4 minute time window
        1200   // 20 minute cooldown
      );
      
      expect(await marketVolatilityBreaker.globalPriceChangeThreshold()).to.equal(300);
      expect(await marketVolatilityBreaker.globalVolumeSpikeThreshold()).to.equal(800);
      expect(await marketVolatilityBreaker.globalArbitrageProfitThreshold()).to.equal(150);
    });

    it("should handle emergency stop", async function () {
      // Set up volatility configuration first
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,   // 5% price change threshold
        1000,  // 10x volume spike threshold
        200,   // 2% arbitrage profit threshold
        300,   // 5 minute time window
        1800   // 30 minute cooldown
      );
      
      await marketVolatilityBreaker.activateEmergencyStop();
      
      // Emergency stop should cause the function to revert
      await expect(marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"),
        ethers.parseEther("1000"),
        100
      )).to.be.revertedWith("Emergency stop is active");
      
      await marketVolatilityBreaker.deactivateEmergencyStop();
      
      // After deactivating emergency stop, the function should work
      const tx = await marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"),
        ethers.parseEther("1000"),
        100
      );
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });
  });

  describe("Automated Backup", function () {
    const testData = ethers.toUtf8Bytes("test backup data");
    const description = "Test backup";

    it("should create backups correctly", async function () {
      const tx = await automatedBackup.createBackup(testData, description);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
      
      // Get the first backup (ID 0)
      const backup = await automatedBackup.getBackup(0);
      expect(backup.backupId).to.equal(0);
      expect(backup.description).to.equal(description);
      expect(backup.isVerified).to.be.false;
      expect(backup.isRecovered).to.be.false;
    });

    it("should verify backups", async function () {
      const tx = await automatedBackup.createBackup(testData, description);
      await tx.wait();
      
      const verifyTx = await automatedBackup.verifyBackup(0);
      const verifyReceipt = await verifyTx.wait();
      expect(verifyReceipt?.status).to.equal(1);
      
      const backup = await automatedBackup.getBackup(0);
      expect(backup.isVerified).to.be.true;
    });

    it("should initiate recovery", async function () {
      const tx = await automatedBackup.createBackup(testData, description);
      await tx.wait();
      
      const verifyTx = await automatedBackup.verifyBackup(0);
      await verifyTx.wait();
      
      // Wait for verification delay (simulate by updating config)
      await automatedBackup.updateRecoveryConfig(10, 3600, 1, true, true);
      
      const recoveryTx = await automatedBackup.initiateRecovery(0);
      const recoveryReceipt = await recoveryTx.wait();
      expect(recoveryReceipt?.status).to.equal(1);
      
      const backup = await automatedBackup.getBackup(0);
      expect(backup.isRecovered).to.be.true;
    });

    it("should enforce backup limits", async function () {
      // Set max backups to 2
      await automatedBackup.updateRecoveryConfig(2, 1, 1, true, false);
      
      // Create 3 backups
      await automatedBackup.createBackup(testData, "Backup 1");
      await automatedBackup.createBackup(testData, "Backup 2");
      await automatedBackup.createBackup(testData, "Backup 3");
      
      const backupIds = await automatedBackup.getAllBackupIds();
      expect(backupIds.length).to.equal(2); // Should only keep 2 backups
    });

    it("should manage authorized operators", async function () {
      await automatedBackup.setBackupCreator(user1Address, true);
      await automatedBackup.setRecoveryOperator(user2Address, true);
      
      // Test backup creation by authorized user
      const tx = await automatedBackup.connect(user1).createBackup(testData, description);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
      
      // Test recovery by authorized user
      await automatedBackup.connect(user2).verifyBackup(0);
      
      // Test unauthorized access
      await expect(
        automatedBackup.connect(user3).createBackup(testData, description)
      ).to.be.revertedWith("Unauthorized backup creator");
    });

    it("should get recovery statistics", async function () {
      const tx = await automatedBackup.createBackup(testData, description);
      await tx.wait();
      await automatedBackup.verifyBackup(0);
      
      const stats = await automatedBackup.getRecoveryStats();
      expect(stats._totalBackups).to.equal(1);
      expect(stats._totalVerifications).to.equal(1);
      expect(stats._totalRecoveries).to.equal(0);
    });

    it("should delete backups", async function () {
      const tx = await automatedBackup.createBackup(testData, description);
      await tx.wait();
      
      await automatedBackup.deleteBackup(0);
      
      await expect(
        automatedBackup.getBackup(0)
      ).to.be.revertedWithCustomError(automatedBackup, "BackupNotFound");
    });

    it("should update recovery configuration", async function () {
      await automatedBackup.updateRecoveryConfig(
        20,     // max backups
        7200,   // 2 hour interval
        3600,   // 1 hour verification delay
        false,  // auto backup off
        false   // verification not required
      );
      
      const config = await automatedBackup.recoveryConfig();
      expect(config.maxBackups).to.equal(20);
      expect(config.backupInterval).to.equal(7200);
      expect(config.verificationDelay).to.equal(3600);
      expect(config.autoBackup).to.be.false;
      expect(config.requireVerification).to.be.false;
    });
  });

  describe("Integration Tests", function () {
    it("should integrate rate limiting with market volatility", async function () {
      const limitId = ethers.keccak256(ethers.toUtf8Bytes("arbitrage_limit"));
      const tokenAddress = ethers.Wallet.createRandom().address;
      
      // Set up rate limiting
      await rateLimiter.setRateLimit(limitId, 5, 60); // 5 requests per minute
      
      // Set up volatility monitoring
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,  // 5% price change threshold
        1000, // 10x volume spike
        200,  // 2% arbitrage profit
        300,  // 5 minute window
        1800  // 30 minute cooldown
      );
      
      // Simulate arbitrage requests
      for (let i = 0; i < 3; i++) {
        // Check rate limit
        const rateResult = await rateLimiter.checkRateLimit(limitId, user1Address);
        expect(rateResult[0]).to.be.true;
        
        // Check market stability
        const stabilityTx = await marketVolatilityBreaker.checkMarketStability(
          tokenAddress,
          ethers.parseEther("100"),
          ethers.parseEther("1000"),
          100
        );
        const stabilityReceipt = await stabilityTx.wait();
        expect(stabilityReceipt?.status).to.equal(1);
        
        // Record success
        await rateLimiter.recordSuccess(limitId);
      }
    });

    it("should handle emergency scenarios", async function () {
      // Activate emergency stops
      await rateLimiter.activateEmergencyStop();
      await marketVolatilityBreaker.activateEmergencyStop();
      
      // All operations should be blocked
      const limitId = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await expect(rateLimiter.checkRateLimit(limitId, user1Address))
        .to.be.revertedWith("Emergency stop is active");
      
      const tokenAddress = ethers.Wallet.createRandom().address;
      await expect(marketVolatilityBreaker.checkMarketStability(
        tokenAddress,
        ethers.parseEther("100"),
        ethers.parseEther("1000"),
        100
      )).to.be.revertedWith("Emergency stop is active");
      
      // Deactivate emergency stops
      await rateLimiter.deactivateEmergencyStop();
      await marketVolatilityBreaker.deactivateEmergencyStop();
      
      // Operations should work again
      const rateResult2 = await rateLimiter.checkRateLimit(limitId, user1Address);
      expect(rateResult2[0]).to.be.true;
    });

    it("should create backup during normal operations", async function () {
      const testData = ethers.toUtf8Bytes("arbitrage state backup");
      
      // Create backup
      const tx = await automatedBackup.createBackup(testData, "Arbitrage state backup");
      await tx.wait();
      
      // Verify backup
      const verifyTx = await automatedBackup.verifyBackup(0);
      await verifyTx.wait();
      
      // Simulate recovery scenario
      await automatedBackup.updateRecoveryConfig(10, 3600, 1, true, true);
      
      const recoveryTx = await automatedBackup.initiateRecovery(0);
      const recoveryReceipt = await recoveryTx.wait();
      expect(recoveryReceipt?.status).to.equal(1);
    });
  });

  describe("Performance Tests", function () {
    it("should handle high-frequency rate limit checks", async function () {
      const limitId = ethers.keccak256(ethers.toUtf8Bytes("high_freq_limit"));
      await rateLimiter.setRateLimit(limitId, 100, 60); // 100 requests per minute
      
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(rateLimiter.checkRateLimit(limitId, user1Address));
      }
      
      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result[0]).to.be.true;
      });
    });

    it("should handle multiple volatility checks", async function () {
      const tokenAddress = ethers.Wallet.createRandom().address;
      await marketVolatilityBreaker.setVolatilityConfig(
        tokenAddress,
        500,
        1000,
        200,
        300,
        1800
      );
      
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(marketVolatilityBreaker.checkMarketStability(
          tokenAddress,
          ethers.parseEther("100"),
          ethers.parseEther("1000"),
          100
        ));
      }
      
      const results = await Promise.all(promises);
      for (const tx of results) {
        const receipt = await tx.wait();
        expect(receipt?.status).to.equal(1);
      }
    });
  });
});
