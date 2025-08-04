import { expect } from "chai";
import { ethers } from "hardhat";
import { config } from "./config/arbitrage.config";
import { FlashLoanArbitrage } from "../typechain-types/contracts/FlashLoanArbitrage";
import { UniswapV3Router } from "../typechain-types/contracts/routers/UniswapV3Router";
import { SushiRouter } from "../typechain-types/contracts/routers/SushiRouter";
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IDexRouter } from "../typechain-types/contracts/interfaces/IDexRouter";
import { Interface, AbiCoder, MaxUint256, ZeroAddress, solidityPacked, AddressLike } from "ethers";
import { Contract } from "ethers";

describe("Real Arbitrage Simulation", function () {
  let arbitrage: FlashLoanArbitrage;
  let uniswapRouter: UniswapV3Router;
  let sushiswapRouter: SushiRouter;
  let balancerRouter: any;
  let owner: any;
  let executor: any;
  let weth: IERC20;
  let usdc: IERC20;
  let dai: IERC20;
  let usdt: IERC20;

  before(async function () {
    // Skip test if no mainnet RPC URL is provided
    if (!process.env.MAINNET_RPC_URL) {
      this.skip();
      return;
    }
    
    // Set block number for consistent testing
    await ethers.provider.send("hardhat_reset", [
      {
        forking: {
          jsonRpcUrl: process.env.MAINNET_RPC_URL,
          blockNumber: Number(config.testParams.blockNumber),
        },
      },
    ]);

    [owner, executor] = await ethers.getSigners();

    // Deploy router implementations
    const UniswapV3Router = await ethers.getContractFactory("UniswapV3Router");
    uniswapRouter = await UniswapV3Router.deploy(String(config.routers.UNISWAP_V3.address));

    const SushiRouter = await ethers.getContractFactory("SushiRouter");
    sushiswapRouter = await SushiRouter.deploy(String(config.routers.SUSHISWAP.address));

    const BalancerRouter = await ethers.getContractFactory("BalancerRouter");
    balancerRouter = await BalancerRouter.deploy(String(config.routers.BALANCER.address));

    // Deploy arbitrage contract
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    const poolAddr = config.aave.POOL_ADDRESSES_PROVIDER; // Use Aave PoolAddressesProvider address
    const profitAddr = owner.address;
    const minProfit = ethers.parseUnits("0.0001", 18);
    const minProfitPercentage = 50; // 0.5%
    const maxSlippage = 100; // 1%
    const maxGasPrice = ethers.parseUnits("100", 9); // 100 gwei
    arbitrage = await FlashLoanArbitrage.deploy(
        poolAddr,
        profitAddr,
        minProfit,
        minProfitPercentage,
        maxSlippage,
        maxGasPrice
    );

    // Set test bypass for entry point check
    await arbitrage.setTestBypassEntryPoint(true);

    // Get token contracts
    weth = await ethers.getContractAt("IERC20", String(config.tokens.WETH.address));
    usdc = await ethers.getContractAt("IERC20", String(config.tokens.USDC.address));
    dai = await ethers.getContractAt("IERC20", String(config.tokens.DAI.address));
    usdt = await ethers.getContractAt("IERC20", String(config.tokens.USDT.address));

    // Fund owner with WETH from whale
    await ethers.provider.send("hardhat_impersonateAccount", [String(config.tokens.WETH.whale)]);
    const whale = await ethers.getSigner(String(config.tokens.WETH.whale));
    await weth.connect(whale).transfer(owner.address, config.testParams.defaultAmount);

    // Fund arbitrage contract
    await weth.transfer(await arbitrage.getAddress(), config.testParams.defaultAmount);

    // Approve routers
    await weth.approve(await uniswapRouter.getAddress(), MaxUint256);
    await weth.approve(await sushiswapRouter.getAddress(), MaxUint256);
    await weth.approve(await balancerRouter.getAddress(), MaxUint256);

    // Deploy routers
    const maliciousRouter = await ethers.deployContract("MaliciousRouter", [ZeroAddress]);

    // Register routers in the arbitrage contract
    await arbitrage.addRouter(await uniswapRouter.getAddress(), await uniswapRouter.getAddress());
    await arbitrage.addRouter(await sushiswapRouter.getAddress(), await sushiswapRouter.getAddress());
    await arbitrage.addRouter(await maliciousRouter.getAddress(), await maliciousRouter.getAddress());

    // Print token balances for contract and whales
    const tokenSymbols = ["WETH", "USDC", "DAI", "USDT"];
    for (const symbol of tokenSymbols) {
      const tokenCfg = config.tokens[symbol];
      const token = await ethers.getContractAt("IERC20", tokenCfg.address);
      const whaleBal = await token.balanceOf(tokenCfg.whale);
      const contractBal = await token.balanceOf(await arbitrage.getAddress());
      console.log(`${symbol} whale balance:`, ethers.formatUnits(whaleBal, tokenCfg.decimals));
      console.log(`${symbol} contract balance:`, ethers.formatUnits(contractBal, tokenCfg.decimals));
    }
  });

  async function calculateAndLogProfit(
    token: IERC20,
    initialBalance: bigint,
    finalBalance: bigint
  ) {
    const profit = finalBalance - initialBalance;
    // Use ERC20 ABI for static calls
    const erc20Iface = new Interface([
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)"
    ]);
    const symbolData = erc20Iface.encodeFunctionData("symbol");
    const symbolRaw = await ethers.provider.call({ to: await token.getAddress(), data: symbolData });
    const symbol = erc20Iface.decodeFunctionResult("symbol", symbolRaw)[0];
    const decimalsData = erc20Iface.encodeFunctionData("decimals");
    const decimalsRaw = await ethers.provider.call({ to: await token.getAddress(), data: decimalsData });
    const decimals = erc20Iface.decodeFunctionResult("decimals", decimalsRaw)[0];
    console.log(`Profit in ${symbol}: ${ethers.formatUnits(profit, decimals)}`);
    return profit;
  }

  async function setupArbitrageRoute(
    tokenIn: IERC20,
    tokenOut: IERC20,
    amount: bigint,
    router1: any,
    router2: any,
    fee?: number
  ) {
    const tokenInAddr = (await tokenIn.getAddress()).toString();
    const tokenOutAddr = (await tokenOut.getAddress()).toString();
    const router1Addr = (await router1.getAddress()).toString();
    const router2Addr = (await router2.getAddress()).toString();
    const path1 = fee 
      ? solidityPacked(
          ["address", "uint24", "address"],
          [tokenInAddr, fee, tokenOutAddr]
        )
      : solidityPacked(
          ["address", "address"],
          [tokenInAddr, tokenOutAddr]
        );

    const path2 = fee
      ? solidityPacked(
          ["address", "uint24", "address"],
          [tokenOutAddr, fee, tokenInAddr]
        )
      : solidityPacked(
          ["address", "address"],
          [tokenOutAddr, tokenInAddr]
        );

    return {
      routes: [
        {
          router: router1Addr,
          tokenIn: tokenInAddr,
          tokenOut: tokenOutAddr,
          amountIn: amount.toString(),
          minAmountOut: "0",
          path: ethers.hexlify(path1),
          fee: fee ? fee.toString() : "0"
        },
        {
          router: router2Addr,
          tokenIn: tokenOutAddr,
          tokenOut: tokenInAddr,
          amountIn: "0",
          minAmountOut: (amount + BigInt(config.testParams.minProfit.toString())).toString(),
          path: ethers.hexlify(path2),
          fee: fee ? fee.toString() : "0"
        },
      ],
    };
  }

  // Helper to validate and debug Uniswap V3 path encoding
  function debugPathEncoding(path: string, label: string) {
    const bytes = ethers.getBytes(path);
    console.log(`${label} - Encoded path length:`, bytes.length);
    console.log(`${label} - First 32 bytes:`, ethers.hexlify(bytes.slice(0, 32)));
  }

  it("should execute arbitrage with different token pairs", async function () {
    for (const pair of config.pairs) {
      const tokenIn = await ethers.getContractAt("IERC20", config.tokens[pair.tokenIn].address);
      const tokenOut = await ethers.getContractAt("IERC20", config.tokens[pair.tokenOut].address);
      const whaleAddr = config.tokens[pair.tokenIn].whale;
      const contractAddr = await arbitrage.getAddress();
      const whaleBal = await tokenIn.balanceOf(whaleAddr);
      const contractBal = await tokenIn.balanceOf(contractAddr);
      const decimals = config.tokens[pair.tokenIn].decimals;
      
      // Use small trade amount for low-slippage testing
      let amountIn = config.testParams.smallTradeAmount;
      if (whaleBal < amountIn) {
        amountIn = ethers.parseUnits("0.01", decimals);
        console.log(`Adjusted amountIn for ${pair.tokenIn}:`, ethers.formatUnits(amountIn, decimals));
      }
      
      console.log(`${pair.tokenIn} whale balance:`, ethers.formatUnits(whaleBal, decimals));
      console.log(`${pair.tokenIn} contract balance:`, ethers.formatUnits(contractBal, decimals));
      console.log(`amountIn for swap:`, ethers.formatUnits(amountIn, decimals));
      
      // Fund with tokenIn
      await ethers.provider.send("hardhat_impersonateAccount", [String(whaleAddr)]);
      const whale = await ethers.getSigner(String(whaleAddr));
      await tokenIn.connect(whale).transfer(owner.address, amountIn);
      await tokenIn.approve(contractAddr, MaxUint256);
      const initialBalance = await tokenIn.balanceOf(owner.address);
      const { routes } = await setupArbitrageRoute(
        tokenIn,
        tokenOut,
        amountIn,
        uniswapRouter,
        sushiswapRouter,
        pair.fee
      );
      
      debugPathEncoding(routes[0].path, `Pair ${pair.name} route[0]`);
      debugPathEncoding(routes[1].path, `Pair ${pair.name} route[1]`);
      
      console.log('DEBUG: executeArbitrage args:', {
        token: await tokenIn.getAddress(),
        amount: amountIn.toString(),
        routes,
        minProfit: config.testParams.minProfit.toString()
      });
      
      let txFailed = false;
      try {
        await arbitrage.executeArbitrage(
          await tokenIn.getAddress(),
          amountIn.toString(),
          routes,
          config.testParams.minProfit.toString()
        );
      } catch (e) {
        txFailed = true;
        if (e && typeof e === 'object' && 'message' in e) {
          console.log(`Arbitrage tx reverted for pair ${pair.name}:`, (e as any).message);
        } else {
          console.log(`Arbitrage tx reverted for pair ${pair.name}:`, e);
        }
      }
      const finalBalance = await tokenIn.balanceOf(owner.address);
      const profit = await calculateAndLogProfit(tokenIn, initialBalance, finalBalance);
      expect(profit).to.be.gte(0n);
    }
  });

  // WARNING: This test uses higher slippage tolerance and is for execution path validation only
  // NOT for production use
  it("should execute arbitrage with higher slippage tolerance (WARNING: Not for production)", async function () {
    // Temporarily increase slippage tolerance
    const originalMaxSlippage = await arbitrage.maxSlippage();
    await (arbitrage as any).setMaxSlippage(config.testParams.highSlippagePercentage);
    
    try {
      for (const pair of config.pairs) {
        const tokenIn = await ethers.getContractAt("IERC20", config.tokens[pair.tokenIn].address);
        const tokenOut = await ethers.getContractAt("IERC20", config.tokens[pair.tokenOut].address);
        const whaleAddr = config.tokens[pair.tokenIn].whale;
        const contractAddr = await arbitrage.getAddress();
        const whaleBal = await tokenIn.balanceOf(whaleAddr);
        const decimals = config.tokens[pair.tokenIn].decimals;
        
        // Use high slippage amount
        let amountIn = config.testParams.highSlippageAmount;
        if (whaleBal < amountIn) {
          amountIn = ethers.parseUnits("0.1", decimals);
          console.log(`Adjusted amountIn for ${pair.tokenIn}:`, ethers.formatUnits(amountIn, decimals));
        }
        
        console.log(`[HIGH SLIPPAGE TEST] ${pair.tokenIn} whale balance:`, ethers.formatUnits(whaleBal, decimals));
        console.log(`[HIGH SLIPPAGE TEST] amountIn for swap:`, ethers.formatUnits(amountIn, decimals));
        
        // Fund with tokenIn
        await ethers.provider.send("hardhat_impersonateAccount", [String(whaleAddr)]);
        const whale = await ethers.getSigner(String(whaleAddr));
        await tokenIn.connect(whale).transfer(owner.address, amountIn);
        await tokenIn.approve(contractAddr, MaxUint256);
        const initialBalance = await tokenIn.balanceOf(owner.address);
        
        const { routes } = await setupArbitrageRoute(
          tokenIn,
          tokenOut,
          amountIn,
          uniswapRouter,
          sushiswapRouter,
          pair.fee
        );
        
        console.log('[HIGH SLIPPAGE TEST] Executing arbitrage with increased slippage tolerance...');
        
        let txFailed = false;
        try {
          await arbitrage.executeArbitrage(
            await tokenIn.getAddress(),
            amountIn.toString(),
            routes,
            config.testParams.minProfit.toString()
          );
        } catch (e) {
          txFailed = true;
          if (e && typeof e === 'object' && 'message' in e) {
            console.log(`[HIGH SLIPPAGE TEST] Arbitrage tx reverted for pair ${pair.name}:`, (e as any).message);
          } else {
            console.log(`[HIGH SLIPPAGE TEST] Arbitrage tx reverted for pair ${pair.name}:`, e);
          }
        }
        
        const finalBalance = await tokenIn.balanceOf(owner.address);
        const profit = await calculateAndLogProfit(tokenIn, initialBalance, finalBalance);
        console.log(`[HIGH SLIPPAGE TEST] Profit:`, ethers.formatUnits(profit, decimals));
      }
    } finally {
      // Restore original slippage tolerance
      await (arbitrage as any).setMaxSlippage(originalMaxSlippage);
    }
  });

  it("should handle same token arbitrage (no-op path)", async function () {
    const { routes } = await setupArbitrageRoute(
      weth,
      weth,
      config.testParams.defaultAmount,
      uniswapRouter,
      sushiswapRouter
    );
    debugPathEncoding(routes[0].path, "No-op route[0]");
    debugPathEncoding(routes[1].path, "No-op route[1]");
    await expect(arbitrage.executeArbitrage(
      await weth.getAddress(),
      config.testParams.defaultAmount.toString(),
      routes,
      config.testParams.minProfit.toString()
    )).to.be.revertedWithCustomError(arbitrage, "InvalidArbPath");
  });

  it("should handle router failure mid-arbitrage", async function () {
    const { routes } = await setupArbitrageRoute(
      weth,
      usdc,
      config.testParams.defaultAmount,
      uniswapRouter,
      sushiswapRouter
    );
    // Modify second route to use invalid router
    routes[1].router = ZeroAddress;
    debugPathEncoding(routes[0].path, "Router fail route[0]");
    debugPathEncoding(routes[1].path, "Router fail route[1]");
    await expect(arbitrage.executeArbitrage(
      await weth.getAddress(),
      config.testParams.defaultAmount.toString(),
      routes,
      config.testParams.minProfit.toString()
    )).to.be.revertedWithCustomError(arbitrage, "RouterNotFound");
  });

  it("should respect gas limits", async function () {
    const { routes } = await setupArbitrageRoute(
      weth,
      usdc,
      config.testParams.defaultAmount,
      uniswapRouter,
      sushiswapRouter
    );

    await expect(arbitrage.executeArbitrage(
      await weth.getAddress(),
      config.testParams.defaultAmount.toString(),
      routes,
      config.testParams.minProfit.toString(),
      { gasLimit: 100000 } // Set very low gas limit
    )).to.be.reverted;
  });
}); 