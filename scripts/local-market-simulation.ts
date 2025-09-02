import { ethers } from "hardhat";
import { AdvancedArbitrageEngine, MEVProtector } from "../typechain-types";

async function main() {
  console.log("🚀 LOCAL MARKET SIMULATION - Realistic Market Conditions\n");

  console.log("🌐 Using Local Hardhat Network for Simulation");
  console.log("📊 This simulation will create realistic market scenarios\n");

  // Get local network info
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const currentBlock = await ethers.provider.getBlock("latest");
  const gasPrice = await ethers.provider.getFeeData();

  console.log(`🔗 Connected to: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`🔢 Current Block: ${currentBlock?.number}`);
  console.log(`⏰ Block Time: ${new Date((currentBlock?.timestamp || 0) * 1000).toISOString()}`);
  console.log(`⛽ Gas Price: ${ethers.formatUnits(gasPrice.gasPrice || 0, "gwei")} gwei\n`);

  // Phase 1: Deploy Local Simulation Contracts
  console.log("🏗️ PHASE 1: Deploying Local Simulation Contracts");
  console.log("=" * 50);

  try {
    // Deploy MEV Protector locally
    console.log("🔒 Deploying MEV Protector...");
    const mevProtector = await ethers.deployContract("MEVProtector", [deployer.address]);
    await mevProtector.waitForDeployment();
    const mevProtectorAddress = await mevProtector.getAddress();
    console.log(`✅ MEV Protector deployed: ${mevProtectorAddress}`);

    // Deploy Advanced Arbitrage Engine locally
    console.log("\n⚡ Deploying Advanced Arbitrage Engine...");
    const arbitrageEngine = await ethers.deployContract("AdvancedArbitrageEngine", [
      mevProtectorAddress,
      deployer.address  // admin
    ]);
    await arbitrageEngine.waitForDeployment();
    const engineAddress = await arbitrageEngine.getAddress();
    console.log(`✅ Arbitrage Engine deployed: ${engineAddress}`);

    // Set up roles and configuration
    console.log("\n🔑 Setting up roles and configuration...");
    const OPERATOR_ROLE = await arbitrageEngine.OPERATOR_ROLE();
    const DEFAULT_ADMIN_ROLE = await arbitrageEngine.DEFAULT_ADMIN_ROLE();
    
    await arbitrageEngine.grantRole(OPERATOR_ROLE, deployer.address);
    await arbitrageEngine.grantRole(DEFAULT_ADMIN_ROLE, deployer.address);
    console.log("✅ Roles configured");

    // Configure risk parameters
    const riskParams = {
      maxExposurePerToken: ethers.parseEther("1000"),
      maxExposurePerStrategy: ethers.parseEther("5000"),
      maxGasPrice: ethers.parseUnits("50", "gwei"),
      minProfitThreshold: ethers.parseEther("0.01"),
      maxSlippageTolerance: 500, // 5%
      emergencyStopLoss: ethers.parseEther("100")
    };

    await arbitrageEngine.updateRiskParams(riskParams);
    console.log("✅ Risk parameters configured");

  } catch (error) {
    console.log(`❌ Local deployment failed: ${error}`);
    return;
  }

  // Phase 2: Market Data Simulation
  console.log("\n📊 PHASE 2: Market Data Simulation");
  console.log("=" * 50);

  try {
    // Simulate realistic market conditions
    console.log("📈 Simulating Realistic Market Conditions...\n");

    // Simulate current market state
    const marketData = simulateMarketData();
    
    console.log("💱 Simulated Market Data:");
    console.log(`  WETH Price: $${marketData.wethPrice.toFixed(2)} USD`);
    console.log(`  USDC Price: $${marketData.usdcPrice.toFixed(4)} USD`);
    console.log(`  DAI Price: $${marketData.daiPrice.toFixed(4)} USD`);
    console.log(`  LINK Price: $${marketData.linkPrice.toFixed(2)} USD`);
    console.log(`  Market Volatility: ${marketData.volatility.toFixed(2)}%`);
    console.log(`  Gas Price Trend: ${marketData.gasTrend}`);

    // Phase 3: Arbitrage Opportunity Detection
    console.log("\n🎯 PHASE 3: Arbitrage Opportunity Detection");
    console.log("=" * 50);

    const opportunities = generateArbitrageOpportunities(marketData, gasPrice.gasPrice || 0);
    
    console.log(`🎯 Found ${opportunities.length} Arbitrage Opportunities:\n`);
    
    for (let i = 0; i < opportunities.length; i++) {
      const opp = opportunities[i];
      console.log(`  Opportunity ${i + 1}:`);
      console.log(`    Token Pair: ${opp.tokenIn} → ${opp.tokenOut}`);
      console.log(`    Buy From: ${opp.buyDEX} at $${opp.buyPrice.toFixed(6)}`);
      console.log(`    Sell To: ${opp.sellDEX} at $${opp.sellPrice.toFixed(6)}`);
      console.log(`    Price Difference: ${opp.priceDifference.toFixed(4)}%`);
      console.log(`    Amount: ${ethers.formatEther(opp.amount)} ETH`);
      console.log(`    Expected Profit: ${ethers.formatEther(opp.expectedProfit)} ETH`);
      console.log(`    Gas Cost: ~${ethers.formatEther(opp.estimatedGasCost)} ETH`);
      console.log(`    Net Profit: ${ethers.formatEther(opp.netProfit)} ETH`);
      console.log(`    ROI: ${opp.roi.toFixed(2)}%`);
      console.log(`    Status: ${opp.profitable ? '✅ PROFITABLE' : '❌ NOT PROFITABLE'}`);
      console.log("");
    }

    // Phase 4: Risk Assessment
    console.log("⚖️ PHASE 4: Risk Assessment");
    console.log("=" * 50);

    assessRisk(opportunities, gasPrice.gasPrice || 0);

    // Phase 5: Strategy Optimization
    console.log("\n🔧 PHASE 5: Strategy Optimization");
    console.log("=" * 50);

    optimizeStrategy(opportunities);

    // Phase 6: Performance Simulation
    console.log("\n📊 PHASE 6: Performance Simulation");
    console.log("=" * 50);

    simulatePerformance(opportunities);

  } catch (error) {
    console.log(`❌ Simulation failed: ${error}`);
  }

  console.log("\n🎉 LOCAL MARKET SIMULATION COMPLETE!");
  console.log("=" * 50);
  console.log("✅ Simulated realistic market conditions");
  console.log("✅ Detected arbitrage opportunities");
  console.log("✅ Assessed market risks");
  console.log("✅ Optimized trading strategy");
  console.log("✅ Simulated performance outcomes");
  console.log("=" * 50);
  
  console.log("\n🎯 Key Insights:");
  console.log("• Market volatility affects opportunity frequency");
  console.log("• Gas prices impact profitability thresholds");
  console.log("• Different token pairs have varying arbitrage potential");
  console.log("• Risk management is crucial for success");
  
  console.log("\n🚀 Next Steps:");
  console.log("1. Run this simulation regularly to test different scenarios");
  console.log("2. Adjust risk parameters based on simulation results");
  console.log("3. Use insights to optimize your arbitrage strategy");
  console.log("4. When ready, deploy to testnet with confidence");
}

// Simulate realistic market data
function simulateMarketData() {
  const baseWethPrice = 2000 + (Math.random() - 0.5) * 200; // $1900-$2100
  const volatility = 0.5 + Math.random() * 2; // 0.5%-2.5%
  
  return {
    wethPrice: baseWethPrice,
    usdcPrice: 1.0 + (Math.random() - 0.5) * 0.002, // $0.999-$1.001
    daiPrice: 1.0 + (Math.random() - 0.5) * 0.004, // $0.998-$1.002
    linkPrice: 15 + (Math.random() - 0.5) * 4, // $13-$17
    volatility: volatility,
    gasTrend: Math.random() > 0.5 ? "↗️ RISING" : "↘️ FALLING"
  };
}

// Generate arbitrage opportunities based on market data
function generateArbitrageOpportunities(marketData: any, currentGasPrice: bigint) {
  const opportunities = [];
  
  // Simulate different DEX price variations
  const pairs = [
    { tokenIn: "WETH", tokenOut: "USDC", basePrice: marketData.wethPrice },
    { tokenIn: "WETH", tokenOut: "DAI", basePrice: marketData.wethPrice },
    { tokenIn: "USDC", tokenOut: "WETH", basePrice: 1 / marketData.wethPrice },
    { tokenIn: "DAI", tokenOut: "WETH", basePrice: 1 / marketData.wethPrice },
    { tokenIn: "LINK", tokenOut: "WETH", basePrice: marketData.linkPrice / marketData.wethPrice }
  ];

  for (const pair of pairs) {
    // Simulate realistic price differences across DEXes
    const basePrice = pair.basePrice;
    const uniswapV2Price = basePrice * (1 + (Math.random() - 0.5) * 0.015); // ±0.75%
    const uniswapV3Price = basePrice * (1 + (Math.random() - 0.5) * 0.012); // ±0.6%
    const sushiSwapPrice = basePrice * (1 + (Math.random() - 0.5) * 0.018); // ±0.9%

    const prices = [uniswapV2Price, uniswapV3Price, sushiSwapPrice];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceDifference = ((maxPrice - minPrice) / minPrice) * 100;

    // Only create opportunities if price difference is significant
    if (priceDifference > 0.2) {
      const buyDEX = prices.findIndex(p => p === minPrice) === 0 ? "Uniswap V2" : 
                    prices.findIndex(p => p === minPrice) === 1 ? "Uniswap V3" : "SushiSwap";
      const sellDEX = prices.findIndex(p => p === maxPrice) === 0 ? "Uniswap V2" : 
                     prices.findIndex(p => p === maxPrice) === 1 ? "Uniswap V3" : "SushiSwap";

      // Calculate profitability for different amounts
      const amounts = [
        ethers.parseEther("0.1"),
        ethers.parseEther("0.5"),
        ethers.parseEther("1.0"),
        ethers.parseEther("2.0")
      ];

      for (const amount of amounts) {
        const expectedProfit = amount * BigInt(Math.floor(priceDifference * 10000)) / BigInt(10000);
        const estimatedGas = 300000n; // Typical arbitrage gas
        const estimatedGasCost = (currentGasPrice * estimatedGas);
        const netProfit = expectedProfit - estimatedGasCost;
        const roi = (Number(netProfit) / Number(amount)) * 100;

        opportunities.push({
          tokenIn: pair.tokenIn,
          tokenOut: pair.tokenOut,
          buyDEX,
          sellDEX,
          buyPrice: minPrice,
          sellPrice: maxPrice,
          priceDifference,
          amount,
          expectedProfit,
          estimatedGasCost,
          netProfit,
          roi,
          profitable: netProfit > 0
        });
      }
    }
  }

  // Sort by ROI (highest first)
  return opportunities.sort((a, b) => b.roi - a.roi);
}

// Assess risk of arbitrage opportunities
function assessRisk(opportunities: any[], currentGasPrice: bigint) {
  console.log("🔍 Risk Assessment Results:\n");

  const profitableOpps = opportunities.filter(opp => opp.profitable);
  const totalOpportunities = opportunities.length;
  const successRate = (profitableOpps.length / totalOpportunities) * 100;

  console.log(`📊 Overall Risk Profile:`);
  console.log(`  Total Opportunities: ${totalOpportunities}`);
  console.log(`  Profitable: ${profitableOpps.length}`);
  console.log(`  Success Rate: ${successRate.toFixed(1)}%`);

  if (profitableOpps.length > 0) {
    const avgROI = profitableOpps.reduce((sum, opp) => sum + opp.roi, 0) / profitableOpps.length;
    const maxROI = Math.max(...profitableOpps.map(opp => opp.roi));
    const minROI = Math.min(...profitableOpps.map(opp => opp.roi));

    console.log(`\n💰 Profitability Metrics:`);
    console.log(`  Average ROI: ${avgROI.toFixed(2)}%`);
    console.log(`  Maximum ROI: ${maxROI.toFixed(2)}%`);
    console.log(`  Minimum ROI: ${minROI.toFixed(2)}%`);
  }

  // Gas price risk assessment
  const gasPriceRisk = currentGasPrice > ethers.parseUnits("50", "gwei") ? "HIGH" : 
                      currentGasPrice > ethers.parseUnits("30", "gwei") ? "MEDIUM" : "LOW";
  
  console.log(`\n⛽ Gas Price Risk: ${gasPriceRisk}`);
  console.log(`  Current Gas: ${ethers.formatUnits(currentGasPrice, "gwei")} gwei`);
  
  if (gasPriceRisk === "HIGH") {
    console.log(`  ⚠️  High gas prices may reduce profitability`);
  } else if (gasPriceRisk === "MEDIUM") {
    console.log(`  ⚖️  Moderate gas prices - proceed with caution`);
  } else {
    console.log(`  ✅ Low gas prices - favorable conditions`);
  }

  // Market volatility risk
  const priceDifferences = opportunities.map(opp => opp.priceDifference);
  const avgPriceDifference = priceDifferences.reduce((sum, diff) => sum + diff, 0) / priceDifferences.length;
  const volatilityRisk = avgPriceDifference > 1.0 ? "HIGH" : 
                        avgPriceDifference > 0.5 ? "MEDIUM" : "LOW";

  console.log(`\n📈 Market Volatility Risk: ${volatilityRisk}`);
  console.log(`  Average Price Difference: ${avgPriceDifference.toFixed(3)}%`);
  
  if (volatilityRisk === "HIGH") {
    console.log(`  🎯 High volatility - more opportunities but higher risk`);
  } else if (volatilityRisk === "MEDIUM") {
    console.log(`  ⚖️  Moderate volatility - balanced risk/reward`);
  } else {
    console.log(`  🔒 Low volatility - fewer opportunities but lower risk`);
  }
}

// Optimize arbitrage strategy
function optimizeStrategy(opportunities: any[]) {
  console.log("🔧 Strategy Optimization Recommendations:\n");

  const profitableOpps = opportunities.filter(opp => opp.profitable);
  
  if (profitableOpps.length === 0) {
    console.log("❌ No profitable opportunities - strategy needs adjustment");
    return;
  }

  // Analyze best performing pairs
  const pairPerformance = {};
  for (const opp of profitableOpps) {
    const pair = `${opp.tokenIn}/${opp.tokenOut}`;
    if (!pairPerformance[pair]) {
      pairPerformance[pair] = { count: 0, totalROI: 0, avgAmount: 0 };
    }
    pairPerformance[pair].count++;
    pairPerformance[pair].totalROI += opp.roi;
    pairPerformance[pair].avgAmount += Number(opp.amount);
  }

  // Calculate averages
  for (const pair in pairPerformance) {
    const perf = pairPerformance[pair];
    perf.avgROI = perf.totalROI / perf.count;
    perf.avgAmount = perf.avgAmount / perf.count;
  }

  console.log("📊 Top Performing Token Pairs:");
  const sortedPairs = Object.entries(pairPerformance)
    .sort(([,a], [,b]) => b.avgROI - a.avgROI)
    .slice(0, 3);

  for (let i = 0; i < sortedPairs.length; i++) {
    const [pair, perf] = sortedPairs[i];
    console.log(`  ${i + 1}. ${pair}:`);
    console.log(`     Opportunities: ${perf.count}`);
    console.log(`     Average ROI: ${perf.avgROI.toFixed(2)}%`);
    console.log(`     Average Amount: ${ethers.formatEther(BigInt(Math.floor(perf.avgAmount)))} ETH`);
  }

  // Optimal amount analysis
  const amountGroups = {
    small: profitableOpps.filter(opp => Number(opp.amount) < Number(ethers.parseEther("0.5"))),
    medium: profitableOpps.filter(opp => Number(opp.amount) >= Number(ethers.parseEther("0.5")) && Number(opp.amount) < Number(ethers.parseEther("2.0"))),
    large: profitableOpps.filter(opp => Number(opp.amount) >= Number(ethers.parseEther("2.0")))
  };

  console.log("\n💰 Optimal Trade Size Analysis:");
  for (const [size, opps] of Object.entries(amountGroups)) {
    if (opps.length > 0) {
      const avgROI = opps.reduce((sum, opp) => sum + opp.roi, 0) / opps.length;
      console.log(`  ${size.charAt(0).toUpperCase() + size.slice(1)} trades (${opps.length} opportunities):`);
      console.log(`    Average ROI: ${avgROI.toFixed(2)}%`);
    }
  }

  // Risk-adjusted recommendations
  console.log("\n🎯 Risk-Adjusted Recommendations:");
  
  const highROI = profitableOpps.filter(opp => opp.roi > 2.0);
  const mediumROI = profitableOpps.filter(opp => opp.roi > 1.0 && opp.roi <= 2.0);
  const lowROI = profitableOpps.filter(opp => opp.roi > 0 && opp.roi <= 1.0);

  if (highROI.length > 0) {
    console.log(`  🚀 High ROI (${highROI.length} opportunities): Focus on these for maximum returns`);
  }
  if (mediumROI.length > 0) {
    console.log(`  ⚖️  Medium ROI (${mediumROI.length} opportunities): Good balance of risk/reward`);
  }
  if (lowROI.length > 0) {
    console.log(`  🔒 Low ROI (${lowROI.length} opportunities): Consider only in low gas conditions`);
  }
}

// Simulate performance outcomes
function simulatePerformance(opportunities: any[]) {
  console.log("📊 Performance Simulation Results:\n");

  const profitableOpps = opportunities.filter(opp => opp.profitable);
  
  if (profitableOpps.length === 0) {
    console.log("❌ No profitable opportunities to simulate");
    return;
  }

  // Simulate different execution strategies
  const strategies = [
    { name: "Conservative", filter: (opp: any) => opp.roi > 1.5 && Number(opp.amount) < Number(ethers.parseEther("1.0")) },
    { name: "Balanced", filter: (opp: any) => opp.roi > 1.0 && Number(opp.amount) < Number(ethers.parseEther("2.0")) },
    { name: "Aggressive", filter: (opp: any) => opp.roi > 0.5 }
  ];

  for (const strategy of strategies) {
    const filteredOpps = profitableOpps.filter(strategy.filter);
    
    if (filteredOpps.length === 0) continue;

    const totalProfit = filteredOpps.reduce((sum, opp) => sum + Number(opp.netProfit), 0);
    const totalGasCost = filteredOpps.reduce((sum, opp) => sum + Number(opp.estimatedGasCost), 0);
    const avgROI = filteredOpps.reduce((sum, opp) => sum + opp.roi, 0) / filteredOpps.length;
    const successRate = (filteredOpps.length / profitableOpps.length) * 100;

    console.log(`📈 ${strategy.name} Strategy:`);
    console.log(`  Opportunities: ${filteredOpps.length} (${successRate.toFixed(1)}% of profitable)`);
    console.log(`  Total Profit: ${ethers.formatEther(BigInt(Math.floor(totalProfit)))} ETH`);
    console.log(`  Total Gas Cost: ${ethers.formatEther(BigInt(Math.floor(totalGasCost)))} ETH`);
    console.log(`  Net Profit: ${ethers.formatEther(BigInt(Math.floor(totalProfit - totalGasCost)))} ETH`);
    console.log(`  Average ROI: ${avgROI.toFixed(2)}%`);
    console.log(`  Profit/Gas Ratio: ${(totalProfit / totalGasCost).toFixed(2)}`);
    console.log("");
  }

  // Market timing analysis
  console.log("⏰ Market Timing Analysis:");
  const currentTime = new Date();
  const hour = currentTime.getHours();
  
  if (hour >= 9 && hour <= 17) {
    console.log("  🌅 Market Hours: Higher volatility, more opportunities");
  } else if (hour >= 18 && hour <= 23) {
    console.log("  🌆 Evening: Moderate activity, balanced opportunities");
  } else {
    console.log("  🌙 Off Hours: Lower volatility, fewer opportunities");
  }
}

main().catch((error) => {
  console.error("❌ Local market simulation failed:", error);
  process.exit(1);
});
