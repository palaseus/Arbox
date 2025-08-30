import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types/contracts/oracles/PriceOracle";
import { AdvancedMEVProtector } from "../typechain-types/contracts/protection/AdvancedMEVProtector";
import { MockERC20 } from "../typechain-types/contracts/mocks/MockERC20";
import { Contract } from "ethers";

describe("Advanced Features Integration Tests", function () {
  let priceOracle: PriceOracle;
  let mevProtector: AdvancedMEVProtector;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let owner: any;
  let user1: any;
  let user2: any;
  let flashbotsRelay: any;

  beforeEach(async function () {
    [owner, user1, user2, flashbotsRelay] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    tokenA = await MockToken.deploy("Token A", "TKNA", 18);
    tokenB = await MockToken.deploy("Token B", "TKNB", 18);

    // Deploy Price Oracle
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy();

    // Deploy MEV Protector
    const MEVProtectorFactory = await ethers.getContractFactory("AdvancedMEVProtector");
    mevProtector = await MEVProtectorFactory.deploy(flashbotsRelay.address);

    // Wait for deployments
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();
    await priceOracle.waitForDeployment();
    await mevProtector.waitForDeployment();
  });

  describe("Price Oracle System", function () {
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

    it("should reject price updates from unauthorized oracles", async function () {
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);

      const price = ethers.parseEther("2500");
      const confidence = 8500;
      const volume24h = ethers.parseEther("1000000");
      const marketCap = ethers.parseEther("10000000");

      await expect(
        priceOracle.connect(user1).updatePrice(
          await tokenA.getAddress(),
          price,
          confidence,
          volume24h,
          marketCap
        )
      ).to.be.revertedWith("Oracle not authorized");
    });

    it("should reject prices with insufficient confidence", async function () {
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);
      await priceOracle.addOracle(await tokenA.getAddress(), user1.address, 5000);

      const price = ethers.parseEther("2500");
      const confidence = 5000; // 50% - below minimum
      const volume24h = ethers.parseEther("1000000");
      const marketCap = ethers.parseEther("10000000");

      await expect(
        priceOracle.connect(user1).updatePrice(
          await tokenA.getAddress(),
          price,
          confidence,
          volume24h,
          marketCap
        )
      ).to.be.revertedWith("Insufficient confidence");
    });

    it("should reject prices with high deviation", async function () {
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000); // 10% max deviation
      await priceOracle.addOracle(await tokenA.getAddress(), user1.address, 5000);

      // First price update
      await priceOracle.connect(user1).updatePrice(
        await tokenA.getAddress(),
        ethers.parseEther("2500"),
        8500,
        ethers.parseEther("1000000"),
        ethers.parseEther("10000000")
      );

      // Second price update with 20% deviation (should be rejected)
      await expect(
        priceOracle.connect(user1).updatePrice(
          await tokenA.getAddress(),
          ethers.parseEther("3000"), // 20% increase
          8500,
          ethers.parseEther("1000000"),
          ethers.parseEther("10000000")
        )
      ).to.be.revertedWith("Deviation too high");
    });

    it("should detect stale prices", async function () {
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

      // Price should not be stale immediately
      expect(await priceOracle.isPriceStale(await tokenA.getAddress())).to.be.false;

      // Fast forward time to make price stale
      await ethers.provider.send("evm_increaseTime", [1000]); // 16+ minutes
      await ethers.provider.send("evm_mine", []);

      // Price should now be stale
      expect(await priceOracle.isPriceStale(await tokenA.getAddress())).to.be.true;
    });

    it("should calculate weighted average prices", async function () {
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);
      await priceOracle.addOracle(await tokenA.getAddress(), user1.address, 6000); // 60% weight
      await priceOracle.addOracle(await tokenA.getAddress(), user2.address, 4000); // 40% weight

      // Update prices from both oracles
      await priceOracle.connect(user1).updatePrice(
        await tokenA.getAddress(),
        ethers.parseEther("2500"),
        8500,
        ethers.parseEther("1000000"),
        ethers.parseEther("10000000")
      );

      await priceOracle.connect(user2).updatePrice(
        await tokenA.getAddress(),
        ethers.parseEther("2600"),
        9000,
        ethers.parseEther("1200000"),
        ethers.parseEther("12000000")
      );

      const [weightedPrice, weightedConfidence] = await priceOracle.getWeightedPrice(await tokenA.getAddress());
      
      // Expected weighted price: (2500 * 0.6) + (2600 * 0.4) = 2540
      expect(weightedPrice).to.be.closeTo(ethers.parseEther("2540"), ethers.parseEther("100"));
    });
  });

  describe("Advanced MEV Protection", function () {
    it("should submit transaction bundles", async function () {
      const targetBlock = (await ethers.provider.getBlockNumber()) + 5; // Use higher target block
      const transactions = [
        "0x1234567890abcdef", // Mock transaction data
        "0xfedcba0987654321"
      ];
      const bribeAmount = ethers.parseEther("0.01");

      const tx = await mevProtector.submitBundle(targetBlock, transactions, bribeAmount);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Get bundleHash from the BundleSubmitted event
      const bundleEvent = receipt?.logs.find(log => {
        try {
          const parsed = mevProtector.interface.parseLog(log);
          return parsed?.name === 'BundleSubmitted';
        } catch {
          return false;
        }
      });
      expect(bundleEvent).to.not.be.undefined;
      const bundleHash = mevProtector.interface.parseLog(bundleEvent!)?.args[0];

      const [bundleTargetBlock, bundleBribeAmount, isActive] = await mevProtector.getBundle(bundleHash);
      expect(bundleTargetBlock).to.equal(targetBlock);
      expect(bundleBribeAmount).to.equal(bribeAmount);
      expect(isActive).to.be.true;
    });

    it("should reject bundles with insufficient bribe", async function () {
      const targetBlock = (await ethers.provider.getBlockNumber()) + 5; // Use higher target block
      const transactions = ["0x1234567890abcdef"];
      const bribeAmount = ethers.parseEther("0.005"); // Below minimum

      await expect(
        mevProtector.submitBundle(targetBlock, transactions, bribeAmount)
      ).to.be.revertedWith("Bribe too low");
    });

      it("should protect against MEV attacks", async function () {
    const target = await tokenA.getAddress();
    const gasPrice = ethers.parseUnits("150", "gwei"); // High gas price
    const slippage = 1000; // 10% slippage

    const tx = await mevProtector.protectAgainstMEV(target, gasPrice, slippage);
    const receipt = await tx.wait();
    expect(receipt?.status).to.equal(1);
  });

    it("should detect and record attacks", async function () {
      const target = await tokenA.getAddress();
      const gasPrice = ethers.parseUnits("250", "gwei"); // Very high gas price (attack) - above 2x maxGasPrice
      const slippage = 500; // 5% slippage

      await mevProtector.protectAgainstMEV(target, gasPrice, slippage);

      const metrics = await mevProtector.getAttackMetrics(target);
      expect(metrics.totalProtections).to.equal(1);
      expect(metrics.frontrunAttempts).to.be.gt(0);
    });

    it("should detect if address is under attack", async function () {
      const target = await tokenA.getAddress();

      // Simulate multiple attacks
      for (let i = 0; i < 5; i++) {
        await mevProtector.protectAgainstMEV(target, ethers.parseUnits("200", "gwei"), 1000);
        await ethers.provider.send("evm_increaseTime", [10]); // 10 seconds apart
        await ethers.provider.send("evm_mine", []);
      }

      const [isUnderAttack, attackType] = await mevProtector.isUnderAttack(target);
      expect(isUnderAttack).to.be.true;
      expect(attackType).to.be.gt(0);
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

    it("should track protection statistics", async function () {
      const target = await tokenA.getAddress();

      // Perform some protections
      await mevProtector.protectAgainstMEV(target, ethers.parseUnits("50", "gwei"), 500);
      await mevProtector.protectAgainstMEV(target, ethers.parseUnits("100", "gwei"), 1000);
      await mevProtector.protectAgainstMEV(target, ethers.parseUnits("150", "gwei"), 1500);

      const stats = await mevProtector.getProtectionStats();
      expect(stats.totalProtectionsCount).to.equal(3);
      expect(stats.successfulProtectionsCount).to.be.gt(0);
    });

      it("should execute bundles from Flashbots relay", async function () {
    const targetBlock = (await ethers.provider.getBlockNumber()) + 5; // Use higher target block
    const transactions = ["0x1234567890abcdef"];
    const bribeAmount = ethers.parseEther("0.01");

    const tx = await mevProtector.submitBundle(targetBlock, transactions, bribeAmount);
    const receipt = await tx.wait();
    
    // Get bundleHash from the BundleSubmitted event
    const bundleEvent = receipt?.logs.find(log => {
      try {
        const parsed = mevProtector.interface.parseLog(log);
        return parsed?.name === 'BundleSubmitted';
      } catch {
        return false;
      }
    });
    const bundleHash = mevProtector.interface.parseLog(bundleEvent!)?.args[0];

    // Fast forward to target block
    let currentBlock = await ethers.provider.getBlockNumber();
    while (currentBlock < targetBlock) {
      await ethers.provider.send("evm_mine", []);
      currentBlock = await ethers.provider.getBlockNumber();
    }

    // Ensure we're at the exact target block
    expect(await ethers.provider.getBlockNumber()).to.equal(targetBlock);

    // Execute bundle as Flashbots relay
    const executeTx = await mevProtector.connect(flashbotsRelay).executeBundle(bundleHash);
    await executeTx.wait();

    const [executedTargetBlock, executedBribeAmount, isActive] = await mevProtector.getBundle(bundleHash);
    expect(isActive).to.be.false; // Bundle should be executed
  });

      it("should reject bundle execution from non-relay", async function () {
    const targetBlock = (await ethers.provider.getBlockNumber()) + 5; // Use higher target block
    const transactions = ["0x1234567890abcdef"];
    const bribeAmount = ethers.parseEther("0.01");

    const tx = await mevProtector.submitBundle(targetBlock, transactions, bribeAmount);
    const receipt = await tx.wait();
    
    // Get bundleHash from the BundleSubmitted event
    const bundleEvent = receipt?.logs.find(log => {
      try {
        const parsed = mevProtector.interface.parseLog(log);
        return parsed?.name === 'BundleSubmitted';
      } catch {
        return false;
      }
    });
    const bundleHash = mevProtector.interface.parseLog(bundleEvent!)?.args[0];

    await expect(
      mevProtector.connect(user1).executeBundle(bundleHash)
    ).to.be.revertedWith("Only Flashbots relay");
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
      const gasPrice = ethers.parseUnits("150", "gwei"); // Above maxGasPrice to trigger attack
      const slippage = 500; // 5%

      const tx = await mevProtector.protectAgainstMEV(target, gasPrice, slippage);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Verify protection was recorded
      const metrics = await mevProtector.getAttackMetrics(target);
      expect(metrics.totalProtections).to.equal(1);
    });

    it("should handle high-frequency trading scenarios", async function () {
      const target = await tokenA.getAddress();

      // Simulate high-frequency trading with gas prices that trigger attacks
      for (let i = 0; i < 20; i++) {
        await mevProtector.protectAgainstMEV(target, ethers.parseUnits("150", "gwei") + (ethers.parseUnits("10", "gwei") * BigInt(i)), 500);
        await ethers.provider.send("evm_increaseTime", [5]); // 5 seconds apart
        await ethers.provider.send("evm_mine", []);
      }

      const metrics = await mevProtector.getAttackMetrics(target);
      expect(metrics.totalProtections).to.equal(20);
      expect(metrics.attackFrequency).to.be.gt(0);
    });

    it("should handle emergency scenarios", async function () {
      // Setup price oracle
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);
      await priceOracle.addOracle(await tokenA.getAddress(), user1.address, 5000);

      // Normal price update
      await priceOracle.connect(user1).updatePrice(
        await tokenA.getAddress(),
        ethers.parseEther("2500"),
        8500,
        ethers.parseEther("1000000"),
        ethers.parseEther("10000000")
      );

      // Emergency price update
      await priceOracle.emergencyPriceUpdate(
        await tokenA.getAddress(),
        ethers.parseEther("3000")
      );

      const [emergencyPrice, timestamp, confidence] = await priceOracle.getPrice(await tokenA.getAddress());
      expect(emergencyPrice).to.equal(ethers.parseEther("3000"));
      expect(confidence).to.equal(10000); // Full confidence for emergency updates
    });
  });

  describe("Performance Tests", function () {
    it("should handle multiple oracle sources efficiently", async function () {
      await priceOracle.addToken(await tokenA.getAddress(), 300, 1000);

      // Add multiple oracle sources
      for (let i = 0; i < 10; i++) {
        const oracle = new ethers.Wallet(ethers.hexlify(ethers.randomBytes(32)), ethers.provider);
        await priceOracle.addOracle(await tokenA.getAddress(), oracle.address, 1000);
      }

      const sources = await priceOracle.getOracleSources(await tokenA.getAddress());
      expect(sources.oracles.length).to.equal(10);
    });

    it("should handle multiple bundles efficiently", async function () {
      const targetBlock = (await ethers.provider.getBlockNumber()) + 5; // Use higher target block

      // Submit multiple bundles
      for (let i = 0; i < 5; i++) {
        const transactions = [`0x${i.toString().padStart(64, '0')}`];
        const bribeAmount = ethers.parseEther("0.01");
        
        await mevProtector.submitBundle(targetBlock + i, transactions, bribeAmount);
      }

      const stats = await mevProtector.getProtectionStats();
      expect(stats.totalBundlesCount).to.equal(5);
    });

    it("should handle concurrent protections", async function () {
      const targets = [
        await tokenA.getAddress(),
        await tokenB.getAddress()
      ];

          // Simulate concurrent protections
    const promises = targets.map(target =>
      mevProtector.protectAgainstMEV(target, ethers.parseUnits("50", "gwei"), 500)
    );

    const results = await Promise.all(promises);
    for (const result of results) {
      const receipt = await result.wait();
      expect(receipt?.status).to.equal(1);
    }

      const stats = await mevProtector.getProtectionStats();
      expect(stats.totalProtectionsCount).to.equal(2);
    });
  });
});
