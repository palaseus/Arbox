import { expect } from "chai";
import { ethers } from "hardhat";

describe("Simple Production Features Test", function () {
  it("should deploy RateLimiter contract", async function () {
    const RateLimiter = await ethers.getContractFactory("RateLimiter");
    const rateLimiter = await RateLimiter.deploy();
    await rateLimiter.waitForDeployment();
    
    expect(await rateLimiter.getAddress()).to.be.a("string");
    expect(await rateLimiter.globalMaxRequestsPerSecond()).to.equal(10);
  });

  it("should deploy MarketVolatilityBreaker contract", async function () {
    const MarketVolatilityBreaker = await ethers.getContractFactory("MarketVolatilityBreaker");
    const marketVolatilityBreaker = await MarketVolatilityBreaker.deploy();
    await marketVolatilityBreaker.waitForDeployment();
    
    expect(await marketVolatilityBreaker.getAddress()).to.be.a("string");
    expect(await marketVolatilityBreaker.globalPriceChangeThreshold()).to.equal(500);
  });

  it("should deploy AutomatedBackup contract", async function () {
    const AutomatedBackup = await ethers.getContractFactory("AutomatedBackup");
    const automatedBackup = await AutomatedBackup.deploy();
    await automatedBackup.waitForDeployment();
    
    expect(await automatedBackup.getAddress()).to.be.a("string");
    const config = await automatedBackup.recoveryConfig();
    expect(config.maxBackups).to.equal(10);
  });

  it("should set up rate limit", async function () {
    const RateLimiter = await ethers.getContractFactory("RateLimiter");
    const rateLimiter = await RateLimiter.deploy();
    await rateLimiter.waitForDeployment();
    
    const limitId = ethers.keccak256(ethers.toUtf8Bytes("test_limit"));
    await rateLimiter.setRateLimit(limitId, 10, 60);
    
    const status = await rateLimiter.getRateLimitStatus(limitId);
    expect(status.max).to.equal(10);
    expect(status.isActive).to.be.true;
  });

  it("should set up volatility config", async function () {
    const MarketVolatilityBreaker = await ethers.getContractFactory("MarketVolatilityBreaker");
    const marketVolatilityBreaker = await MarketVolatilityBreaker.deploy();
    await marketVolatilityBreaker.waitForDeployment();
    
    const tokenAddress = ethers.Wallet.createRandom().address;
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

  it("should create backup", async function () {
    const AutomatedBackup = await ethers.getContractFactory("AutomatedBackup");
    const automatedBackup = await AutomatedBackup.deploy();
    await automatedBackup.waitForDeployment();
    
    // Update config to allow more backups and shorter intervals
    await automatedBackup.updateRecoveryConfig(1, 1, 1, true, false);
    
    const testData = ethers.toUtf8Bytes("test backup data");
    const description = "Test backup";
    
    const tx = await automatedBackup.createBackup(testData, description);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    
    // Check if backup was created by looking at the event
    const events = await automatedBackup.queryFilter(automatedBackup.filters.BackupCreated());
    expect(events.length).to.be.gt(0);
    
    // Just verify the event was emitted correctly
    expect(events[0].args.description).to.equal(description);
  });
});
