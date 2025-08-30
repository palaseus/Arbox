import { expect } from "chai";
import { ethers } from "hardhat";
import { CrossChainBridge } from "../typechain-types/contracts/bridges/CrossChainBridge";
import { BalancerV2Integration } from "../typechain-types/contracts/dex/BalancerV2Integration";
import { CurveFinanceIntegration } from "../typechain-types/contracts/dex/CurveFinanceIntegration";
import { MockERC20 } from "../typechain-types/contracts/mocks/MockERC20";

describe("Cross-Chain Bridge & DEX Integration Tests", function () {
  let crossChainBridge: CrossChainBridge;
  let balancerIntegration: BalancerV2Integration;
  let curveIntegration: CurveFinanceIntegration;
  let weth: MockERC20;
  let usdc: MockERC20;
  let dai: MockERC20;
  let owner: any;
  let user1: any;
  let user2: any;
  let relayer: any;
  let balancerVault: any;
  let curveRegistry: any;

  beforeEach(async function () {
    [owner, user1, user2, relayer, balancerVault, curveRegistry] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    weth = await MockToken.deploy("Wrapped Ether", "WETH", 18);
    usdc = await MockToken.deploy("USD Coin", "USDC", 6);
    dai = await MockToken.deploy("Dai Stablecoin", "DAI", 18);

    // Deploy Cross-Chain Bridge
    const CrossChainBridgeFactory = await ethers.getContractFactory("CrossChainBridge");
    crossChainBridge = await CrossChainBridgeFactory.deploy();

    // Deploy Balancer Integration
    const BalancerIntegrationFactory = await ethers.getContractFactory("BalancerV2Integration");
    balancerIntegration = await BalancerIntegrationFactory.deploy(balancerVault.address);

    // Deploy Curve Integration
    const CurveIntegrationFactory = await ethers.getContractFactory("CurveFinanceIntegration");
    curveIntegration = await CurveIntegrationFactory.deploy(curveRegistry.address);

    // Wait for deployments
    await weth.waitForDeployment();
    await usdc.waitForDeployment();
    await dai.waitForDeployment();
    await crossChainBridge.waitForDeployment();
    await balancerIntegration.waitForDeployment();
    await curveIntegration.waitForDeployment();

    // Setup initial balances
    await weth.mint(user1.address, ethers.parseEther("100"));
    await usdc.mint(user1.address, ethers.parseUnits("10000", 6));
    await dai.mint(user1.address, ethers.parseEther("10000"));
  });

  describe("Cross-Chain Bridge", function () {
    it("should support multiple networks", async function () {
      const ethereumNetwork = await crossChainBridge.getNetwork(1);
      expect(ethereumNetwork.isSupported).to.be.true;
      expect(ethereumNetwork.name).to.equal("Ethereum");

      const polygonNetwork = await crossChainBridge.getNetwork(137);
      expect(polygonNetwork.isSupported).to.be.true;
      expect(polygonNetwork.name).to.equal("Polygon");

      const arbitrumNetwork = await crossChainBridge.getNetwork(42161);
      expect(arbitrumNetwork.isSupported).to.be.true;
      expect(arbitrumNetwork.name).to.equal("Arbitrum");
    });

    it("should calculate transfer fees", async function () {
      const amount = ethers.parseEther("10");
      const fee = await crossChainBridge.calculateFee(amount, 137); // Polygon
      
      // Default fee is 0.5% (50 basis points)
      const expectedFee = (amount * 50n) / 10000n;
      expect(fee).to.equal(expectedFee);
    });

    it("should initiate cross-chain transfers", async function () {
      const amount = ethers.parseEther("5");
      const targetChainId = 137; // Polygon
      
      // Approve tokens
      await weth.approve(await crossChainBridge.getAddress(), amount);
      
      const requestId = await crossChainBridge.connect(user1).initiateTransfer(
        user2.address,
        await weth.getAddress(),
        amount,
        targetChainId
      );
      
      expect(requestId).to.be.gt(0);
      
      const request = await crossChainBridge.getTransferRequest(requestId);
      expect(request.sender).to.equal(user1.address);
      expect(request.recipient).to.equal(user2.address);
      expect(request.amount).to.equal(amount);
      expect(request.targetChainId).to.equal(targetChainId);
      expect(request.isExecuted).to.be.false;
    });

    it("should authorize relayers", async function () {
      await crossChainBridge.authorizeRelayer(relayer.address);
      
      // Test that relayer can execute transfers
      const amount = ethers.parseEther("1");
      await weth.approve(await crossChainBridge.getAddress(), amount);
      
      const requestId = await crossChainBridge.connect(user1).initiateTransfer(
        user2.address,
        await weth.getAddress(),
        amount,
        137
      );
      
      // Execute transfer as relayer
      const proof = ethers.keccak256(ethers.toUtf8Bytes("test_proof"));
      await crossChainBridge.connect(relayer).executeTransfer(requestId, proof);
      
      const request = await crossChainBridge.getTransferRequest(requestId);
      expect(request.isExecuted).to.be.true;
    });

    it("should update bridge configuration", async function () {
      const newMinAmount = ethers.parseEther("0.1");
      const newMaxAmount = ethers.parseEther("100");
      const newFee = 100; // 1%
      
      await crossChainBridge.updateBridgeConfig(
        137, // Polygon
        newMinAmount,
        newMaxAmount,
        newFee,
        500000, // gasLimit
        7200    // timeout
      );
      
      const config = await crossChainBridge.getBridgeConfig(137);
      expect(config.minAmount).to.equal(newMinAmount);
      expect(config.maxAmount).to.equal(newMaxAmount);
      expect(config.fee).to.equal(newFee);
    });

    it("should get bridge statistics", async function () {
      const stats = await crossChainBridge.getBridgeStats();
      expect(stats.totalTransfersCount).to.equal(0);
      expect(stats.totalVolumeAmount).to.equal(0);
      expect(stats.totalFeesAmount).to.equal(0);
    });
  });

  describe("Balancer V2 Integration", function () {
    it("should register pools", async function () {
      const poolId = ethers.keccak256(ethers.toUtf8Bytes("test_pool"));
      const pool = ethers.Wallet.createRandom().address;
      const tokens = [await weth.getAddress(), await usdc.getAddress()];
      const weights = [5000, 5000]; // 50-50 weights
      
      await balancerIntegration.registerPool(poolId, pool, tokens, weights);
      
      const poolInfo = await balancerIntegration.getPoolInfo(poolId);
      expect(poolInfo.pool).to.equal(pool);
      expect(poolInfo.isActive).to.be.true;
      expect(poolInfo.tokens).to.deep.equal(tokens);
      expect(poolInfo.weights).to.deep.equal(weights);
    });

    it("should authorize tokens", async function () {
      await balancerIntegration.authorizeToken(await weth.getAddress());
      await balancerIntegration.authorizeToken(await usdc.getAddress());
      
      // Test token authorization
      const poolId = ethers.keccak256(ethers.toUtf8Bytes("test_pool"));
      const pool = ethers.Wallet.createRandom().address;
      const tokens = [await weth.getAddress(), await usdc.getAddress()];
      const weights = [5000, 5000];
      
      await balancerIntegration.registerPool(poolId, pool, tokens, weights);
      
      // Should not revert due to token authorization
      expect(await balancerIntegration.getPoolTokens(poolId)).to.deep.equal(tokens);
    });

    it("should calculate optimal swap amounts", async function () {
      const poolId = ethers.keccak256(ethers.toUtf8Bytes("test_pool"));
      const pool = ethers.Wallet.createRandom().address;
      const tokens = [await weth.getAddress(), await usdc.getAddress()];
      const weights = [5000, 5000];
      
      await balancerIntegration.registerPool(poolId, pool, tokens, weights);
      
      const maxAmountIn = ethers.parseEther("10");
      const [optimalAmountIn, expectedAmountOut] = await balancerIntegration.calculateOptimalSwap(
        poolId,
        await weth.getAddress(),
        await usdc.getAddress(),
        maxAmountIn
      );
      
      // Should be 50% of max amount
      expect(optimalAmountIn).to.equal(maxAmountIn / 2n);
    });

    it("should get integration statistics", async function () {
      const stats = await balancerIntegration.getStats();
      expect(stats.totalSwapsCount).to.equal(0);
      expect(stats.totalVolumeAmount).to.equal(0);
      expect(stats.totalFeesAmount).to.equal(0);
    });
  });

  describe("Curve Finance Integration", function () {
    it("should register Curve pools", async function () {
      const pool = ethers.Wallet.createRandom().address;
      
      await curveIntegration.registerPool(pool);
      
      const poolInfo = await curveIntegration.getPoolInfo(pool);
      expect(poolInfo.pool).to.equal(pool);
      expect(poolInfo.isActive).to.be.true;
    });

    it("should authorize pools and tokens", async function () {
      const pool = ethers.Wallet.createRandom().address;
      
      await curveIntegration.authorizePool(pool);
      await curveIntegration.authorizeToken(await weth.getAddress());
      await curveIntegration.authorizeToken(await usdc.getAddress());
      
      // Test pool authorization
      expect(await curveIntegration.getPoolCoins(pool)).to.be.an('array');
    });

    it("should calculate optimal swap amounts for Curve", async function () {
      const pool = ethers.Wallet.createRandom().address;
      await curveIntegration.authorizePool(pool);
      
      const maxAmountIn = ethers.parseEther("10");
      const [optimalAmountIn, expectedAmountOut] = await curveIntegration.calculateOptimalSwap(
        pool,
        0, // i
        1, // j
        maxAmountIn
      );
      
      // Should be 40% of max amount for Curve
      expect(optimalAmountIn).to.equal((maxAmountIn * 40n) / 100n);
    });

    it("should get pool liquidity depth", async function () {
      const pool = ethers.Wallet.createRandom().address;
      await curveIntegration.authorizePool(pool);
      
      const liquidity = await curveIntegration.getPoolLiquidity(pool, 0);
      expect(liquidity).to.be.gte(0);
    });

    it("should update pool balances", async function () {
      const pool = ethers.Wallet.createRandom().address;
      await curveIntegration.registerPool(pool);
      
      await curveIntegration.updatePoolBalances(pool);
      
      const poolInfo = await curveIntegration.getPoolInfo(pool);
      expect(poolInfo.lastUpdate).to.be.gt(0);
    });
  });

  describe("Integration Tests", function () {
    it("should handle cross-chain arbitrage scenarios", async function () {
      // Setup cross-chain bridge
      await crossChainBridge.authorizeRelayer(relayer.address);
      
      // Setup DEX integrations
      const balancerPoolId = ethers.keccak256(ethers.toUtf8Bytes("balancer_pool"));
      const balancerPool = ethers.Wallet.createRandom().address;
      await balancerIntegration.registerPool(
        balancerPoolId,
        balancerPool,
        [await weth.getAddress(), await usdc.getAddress()],
        [5000, 5000]
      );
      
      const curvePool = ethers.Wallet.createRandom().address;
      await curveIntegration.registerPool(curvePool);
      
      // Simulate cross-chain arbitrage
      const amount = ethers.parseEther("5");
      
      // 1. Initiate cross-chain transfer
      await weth.approve(await crossChainBridge.getAddress(), amount);
      const requestId = await crossChainBridge.connect(user1).initiateTransfer(
        user1.address, // Same address on target chain
        await weth.getAddress(),
        amount,
        137 // Polygon
      );
      
      // 2. Execute transfer on target chain
      const proof = ethers.keccak256(ethers.toUtf8Bytes("arbitrage_proof"));
      await crossChainBridge.connect(relayer).executeTransfer(requestId, proof);
      
      // 3. Verify transfer was executed
      const request = await crossChainBridge.getTransferRequest(requestId);
      expect(request.isExecuted).to.be.true;
      
      // 4. Check bridge statistics
      const stats = await crossChainBridge.getBridgeStats();
      expect(stats.totalTransfersCount).to.equal(1);
      expect(stats.totalVolumeAmount).to.equal(amount);
    });

    it("should handle multi-DEX arbitrage", async function () {
      // Setup multiple DEX pools
      const balancerPoolId = ethers.keccak256(ethers.toUtf8Bytes("balancer_pool"));
      const balancerPool = ethers.Wallet.createRandom().address;
      await balancerIntegration.registerPool(
        balancerPoolId,
        balancerPool,
        [await weth.getAddress(), await usdc.getAddress()],
        [5000, 5000]
      );
      
      const curvePool = ethers.Wallet.createRandom().address;
      await curveIntegration.registerPool(curvePool);
      
      // Simulate arbitrage between DEXes
      const amount = ethers.parseEther("2");
      
      // 1. Calculate optimal amounts for each DEX
      const [balancerOptimal, balancerExpected] = await balancerIntegration.calculateOptimalSwap(
        balancerPoolId,
        await weth.getAddress(),
        await usdc.getAddress(),
        amount
      );
      
      const [curveOptimal, curveExpected] = await curveIntegration.calculateOptimalSwap(
        curvePool,
        0, // WETH index
        1, // USDC index
        amount
      );
      
      // 2. Verify calculations
      expect(balancerOptimal).to.be.gt(0);
      expect(curveOptimal).to.be.gt(0);
      
      // 3. Check which DEX offers better rates
      const balancerRate = balancerExpected * 1000000n / balancerOptimal; // USDC per WETH
      const curveRate = curveExpected * 1000000n / curveOptimal; // USDC per WETH
      
      console.log(`Balancer rate: ${balancerRate} USDC per WETH`);
      console.log(`Curve rate: ${curveRate} USDC per WETH`);
      
      // 4. Verify statistics are tracked
      const balancerStats = await balancerIntegration.getStats();
      const curveStats = await curveIntegration.getStats();
      
      expect(balancerStats.totalSwapsCount).to.equal(0); // No actual swaps yet
      expect(curveStats.totalSwapsCount).to.equal(0);
    });
  });

  describe("Performance Tests", function () {
    it("should handle multiple concurrent operations", async function () {
      // Setup multiple pools
      const pools = [];
      for (let i = 0; i < 5; i++) {
        const poolId = ethers.keccak256(ethers.toUtf8Bytes(`pool_${i}`));
        const pool = ethers.Wallet.createRandom().address;
        pools.push({ poolId, pool });
        
        await balancerIntegration.registerPool(
          poolId,
          pool,
          [await weth.getAddress(), await usdc.getAddress()],
          [5000, 5000]
        );
      }
      
      // Simulate concurrent queries
      const promises = pools.map(({ poolId }) =>
        balancerIntegration.calculateOptimalSwap(
          poolId,
          await weth.getAddress(),
          await usdc.getAddress(),
          ethers.parseEther("1")
        )
      );
      
      const results = await Promise.all(promises);
      results.forEach(([optimalAmount, expectedAmount]) => {
        expect(optimalAmount).to.be.gt(0);
        expect(expectedAmount).to.be.gte(0);
      });
    });

    it("should handle high-frequency cross-chain transfers", async function () {
      await crossChainBridge.authorizeRelayer(relayer.address);
      
      // Simulate multiple transfers
      const transfers = [];
      for (let i = 0; i < 10; i++) {
        const amount = ethers.parseEther("0.1");
        await weth.approve(await crossChainBridge.getAddress(), amount);
        
        const requestId = await crossChainBridge.connect(user1).initiateTransfer(
          user2.address,
          await weth.getAddress(),
          amount,
          137 // Polygon
        );
        
        transfers.push(requestId);
      }
      
      // Execute all transfers
      const proof = ethers.keccak256(ethers.toUtf8Bytes("batch_proof"));
      for (const requestId of transfers) {
        await crossChainBridge.connect(relayer).executeTransfer(requestId, proof);
      }
      
      // Verify all transfers were executed
      for (const requestId of transfers) {
        const request = await crossChainBridge.getTransferRequest(requestId);
        expect(request.isExecuted).to.be.true;
      }
      
      // Check final statistics
      const stats = await crossChainBridge.getBridgeStats();
      expect(stats.totalTransfersCount).to.equal(10);
    });
  });
});
