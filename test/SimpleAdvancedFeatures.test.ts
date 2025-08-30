import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types/contracts/oracles/PriceOracle";
import { AdvancedMEVProtector } from "../typechain-types/contracts/protection/AdvancedMEVProtector";
import { MockERC20 } from "../typechain-types/contracts/mocks/MockERC20";

describe("Simple Advanced Features Tests", function () {
  let priceOracle: PriceOracle;
  let mevProtector: AdvancedMEVProtector;
  let tokenA: MockERC20;
  let owner: any;
  let user1: any;
  let flashbotsRelay: any;

  beforeEach(async function () {
    [owner, user1, flashbotsRelay] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockERC20");
    tokenA = await MockToken.deploy("Token A", "TKNA", 18);

    // Deploy Price Oracle
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy();

    // Deploy MEV Protector
    const MEVProtectorFactory = await ethers.getContractFactory("AdvancedMEVProtector");
    mevProtector = await MEVProtectorFactory.deploy(flashbotsRelay.address);

    // Wait for deployments
    await tokenA.waitForDeployment();
    await priceOracle.waitForDeployment();
    await mevProtector.waitForDeployment();
  });

  describe("Price Oracle Basic Functionality", function () {
    it("should add supported tokens", async function () {
      await priceOracle.addToken(
        await tokenA.getAddress(),
        300, // 5 minute heartbeat
        1000 // 10% deviation threshold
      );

      const config = await priceOracle.getTokenConfig(await tokenA.getAddress());
      expect(config.isSupported).to.be.true;
      expect(config.heartbeat).to.equal(300);
      expect(config.deviationThreshold).to.equal(1000);
    });

    it("should add oracle sources", async function () {
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);
      await priceOracle.addOracle(await tokenA.getAddress(), user1.address, 5000); // 50% weight

      const sources = await priceOracle.getOracleSources(await tokenA.getAddress());
      expect(sources.oracles.length).to.equal(1);
      expect(sources.oracles[0]).to.equal(user1.address);
      expect(sources.weights[0]).to.equal(5000);
    });

    it("should update prices from authorized oracles", async function () {
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);
      await priceOracle.addOracle(await tokenA.getAddress(), user1.address, 5000);

      const price = ethers.parseEther("2500"); // $2500
      const confidence = 8500; // 85%
      const volume24h = ethers.parseEther("1000000"); // $1M volume
      const marketCap = ethers.parseEther("10000000"); // $10M market cap

      await priceOracle.connect(user1).updatePrice(
        await tokenA.getAddress(),
        price,
        confidence,
        volume24h,
        marketCap
      );

      const [currentPrice, timestamp, currentConfidence] = await priceOracle.getPrice(await tokenA.getAddress());
      expect(currentPrice).to.equal(price);
      expect(currentConfidence).to.equal(confidence);
    });
  });

  describe("MEV Protection Basic Functionality", function () {
    it("should submit transaction bundles", async function () {
      const targetBlock = (await ethers.provider.getBlockNumber()) + 1;
      const transactions = [
        "0x1234567890abcdef", // Mock transaction data
        "0xfedcba0987654321"
      ];
      const bribeAmount = ethers.parseEther("0.01");

      const bundleHash = await mevProtector.submitBundle(targetBlock, transactions, bribeAmount);

      const [bundleTargetBlock, bundleBribeAmount, isActive] = await mevProtector.getBundle(bundleHash);
      expect(bundleTargetBlock).to.equal(targetBlock);
      expect(bundleBribeAmount).to.equal(bribeAmount);
      expect(isActive).to.be.true;
    });

    it("should protect against MEV attacks", async function () {
      const target = await tokenA.getAddress();
      const gasPrice = ethers.parseUnits("150", "gwei"); // High gas price
      const slippage = 1000; // 10% slippage

      const isProtected = await mevProtector.protectAgainstMEV(target, gasPrice, slippage);
      expect(isProtected).to.be.true;
    });

    it("should detect and record attacks", async function () {
      const target = await tokenA.getAddress();
      const gasPrice = ethers.parseUnits("200", "gwei"); // Very high gas price (attack)
      const slippage = 500; // 5% slippage

      await mevProtector.protectAgainstMEV(target, gasPrice, slippage);

      const metrics = await mevProtector.getAttackMetrics(target);
      expect(metrics.totalProtections).to.equal(1);
      expect(metrics.frontrunAttempts).to.be.gt(0);
    });

    it("should update protection configuration", async function () {
      const newMaxGasPrice = ethers.parseUnits("150", "gwei");
      const newMinBribeAmount = ethers.parseEther("0.02");

      await mevProtector.updateConfig(
        true, // flashbotsEnabled
        true, // privateMempoolEnabled
        newMaxGasPrice,
        newMinBribeAmount
      );

      const config = await mevProtector.config();
      expect(config.maxGasPrice).to.equal(newMaxGasPrice);
      expect(config.minBribeAmount).to.equal(newMinBribeAmount);
    });
  });

  describe("Integration Tests", function () {
    it("should integrate price oracle with MEV protection", async function () {
      // Setup price oracle
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);
      await priceOracle.addOracle(await tokenA.getAddress(), user1.address, 5000);

      // Update price
      await priceOracle.connect(user1).updatePrice(
        await tokenA.getAddress(),
        ethers.parseEther("2500"),
        8500,
        ethers.parseEther("1000000"),
        ethers.parseEther("10000000")
      );

      // Get price for MEV protection
      const [price, timestamp, confidence] = await priceOracle.getPrice(await tokenA.getAddress());
      
      // Use price data for MEV protection
      const target = await tokenA.getAddress();
      const gasPrice = ethers.parseUnits("100", "gwei");
      const slippage = 500; // 5%

      const isProtected = await mevProtector.protectAgainstMEV(target, gasPrice, slippage);
      expect(isProtected).to.be.true;

      // Verify protection was recorded
      const metrics = await mevProtector.getAttackMetrics(target);
      expect(metrics.totalProtections).to.equal(1);
    });
  });
});
