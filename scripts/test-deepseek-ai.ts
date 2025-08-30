#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import DeepSeekAIService, { MarketData, ArbitrageOpportunity, Route, MarketConditions } from "../services/DeepSeekAIService";

dotenvConfig();

async function main() {
  console.log("🤖 DEEPSEEK AI ARBITRAGE ENGINE - INTEGRATION TEST");
  console.log("=".repeat(60));
  console.log("");

  // Initialize DeepSeek AI Service
  const aiService = new DeepSeekAIService();
  console.log("✅ DeepSeek AI Service initialized");
  console.log("");

  // Simulate market data
  const marketData: MarketData[] = [
    {
      tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      price: 2500.50,
      volume24h: 1500000000,
      marketCap: 30000000000,
      priceChange24h: 2.5,
      volatility: 0.25,
      liquidity: 500000000,
      timestamp: Date.now()
    },
    {
      tokenAddress: "0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8", // USDC
      price: 1.00,
      volume24h: 2000000000,
      marketCap: 25000000000,
      priceChange24h: 0.1,
      volatility: 0.05,
      liquidity: 800000000,
      timestamp: Date.now()
    },
    {
      tokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
      price: 1.00,
      volume24h: 800000000,
      marketCap: 5000000000,
      priceChange24h: 0.05,
      volatility: 0.03,
      liquidity: 300000000,
      timestamp: Date.now()
    }
  ];

  console.log("📊 MARKET DATA SIMULATION:");
  marketData.forEach(data => {
    console.log(`   ${data.tokenAddress.slice(0, 10)}...: $${data.price} (${data.priceChange24h > 0 ? '+' : ''}${data.priceChange24h}%)`);
  });
  console.log("");

  // Create arbitrage opportunity
  const routes: Route[] = [
    {
      router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
      tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      tokenOut: "0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8", // USDC
      amountIn: ethers.parseEther("10").toString(),
      minAmountOut: ethers.parseUnits("24000", 6).toString(),
      path: "0x",
      fee: 3000,
      gasEstimate: 150000,
      expectedOutput: ethers.parseUnits("25000", 6).toString()
    },
    {
      router: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap
      tokenIn: "0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8", // USDC
      tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      amountIn: ethers.parseUnits("25000", 6).toString(),
      minAmountOut: ethers.parseEther("9.8").toString(),
      path: "0x",
      fee: 3000,
      gasEstimate: 150000,
      expectedOutput: ethers.parseEther("10.2").toString()
    }
  ];

  const marketConditions: MarketConditions = {
    gasPrice: 25, // 25 gwei
    networkCongestion: 4, // 4/10
    volatilityIndex: 35, // 35%
    marketSentiment: 'bullish',
    liquidityDepth: 75, // 75%
    competitionLevel: 6 // 6/10
  };

  const opportunity: ArbitrageOpportunity = {
    tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH (back to WETH)
    amount: ethers.parseEther("10").toString(),
    expectedProfit: ethers.parseEther("0.2").toString(), // 0.2 ETH profit
    gasEstimate: 300000,
    strategyId: ethers.keccak256(ethers.toUtf8Bytes("deepseek_arbitrage")),
    routes: routes,
    confidence: 75,
    riskScore: 35,
    marketConditions: marketConditions
  };

  console.log("🎯 ARBITRAGE OPPORTUNITY:");
  console.log(`   Token In: ${opportunity.tokenIn.slice(0, 10)}... (WETH)`);
  console.log(`   Token Out: ${opportunity.tokenOut.slice(0, 10)}... (WETH)`);
  console.log(`   Amount: ${ethers.formatEther(opportunity.amount)} WETH`);
  console.log(`   Expected Profit: ${ethers.formatEther(opportunity.expectedProfit)} WETH`);
  console.log(`   Routes: ${opportunity.routes.length}`);
  console.log("");

  // Historical performance data
  const historicalData = [
    { date: "2024-01-25", profit: "0.15", success: true, gasUsed: 280000, riskScore: 30, marketConditions: "bullish" },
    { date: "2024-01-25", profit: "0.12", success: true, gasUsed: 275000, riskScore: 35, marketConditions: "bullish" },
    { date: "2024-01-25", profit: "0.18", success: true, gasUsed: 290000, riskScore: 25, marketConditions: "bullish" },
    { date: "2024-01-25", profit: "0.08", success: true, gasUsed: 265000, riskScore: 40, marketConditions: "neutral" },
    { date: "2024-01-25", profit: "0.22", success: true, gasUsed: 300000, riskScore: 20, marketConditions: "bullish" },
    { date: "2024-01-24", profit: "0.05", success: false, gasUsed: 250000, riskScore: 60, marketConditions: "bearish" },
    { date: "2024-01-24", profit: "0.10", success: true, gasUsed: 270000, riskScore: 45, marketConditions: "neutral" },
    { date: "2024-01-24", profit: "0.16", success: true, gasUsed: 285000, riskScore: 30, marketConditions: "bullish" }
  ];

  console.log("📈 HISTORICAL PERFORMANCE (Last 8 trades):");
  historicalData.forEach((trade, index) => {
    const status = trade.success ? "✅" : "❌";
    console.log(`   ${status} ${trade.date}: ${trade.profit} ETH profit, ${trade.gasUsed} gas, Risk: ${trade.riskScore}`);
  });
  console.log("");

  try {
    console.log("🤖 REQUESTING DEEPSEEK AI ANALYSIS...");
    console.log("");

    // Get AI analysis
    const analysis = await aiService.analyzeOpportunity(opportunity, marketData, historicalData);
    
    console.log("🎯 AI ANALYSIS RESULTS:");
    console.log(`   Should Execute: ${analysis.shouldExecute ? "✅ YES" : "❌ NO"}`);
    console.log(`   Confidence: ${analysis.confidence}%`);
    console.log(`   Risk Score: ${analysis.riskScore}%`);
    console.log(`   Optimal Amount: ${ethers.formatEther(analysis.optimalAmount)} WETH`);
    console.log(`   Expected Profit: ${ethers.formatEther(analysis.expectedProfit)} WETH`);
    console.log(`   Gas Estimate: ${analysis.gasEstimate.toLocaleString()} gas`);
    console.log(`   Strategy: ${analysis.strategy}`);
    console.log(`   Reasoning: ${analysis.reasoning}`);
    console.log("");

    if (analysis.marketInsights.length > 0) {
      console.log("💡 MARKET INSIGHTS:");
      analysis.marketInsights.forEach((insight, index) => {
        console.log(`   ${index + 1}. ${insight}`);
      });
      console.log("");
    }

    if (analysis.recommendations.length > 0) {
      console.log("📋 RECOMMENDATIONS:");
      analysis.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
      console.log("");
    }

    // Calculate gas costs and net profit
    const gasCost = aiService.estimateGasCosts(marketConditions.gasPrice, analysis.gasEstimate);
    const netProfit = aiService.calculateNetProfit(analysis.expectedProfit, gasCost);

    console.log("💰 PROFITABILITY ANALYSIS:");
    console.log(`   Expected Profit: ${ethers.formatEther(analysis.expectedProfit)} WETH`);
    console.log(`   Gas Cost: ${ethers.formatEther(gasCost)} WETH`);
    console.log(`   Net Profit: ${ethers.formatEther(netProfit)} WETH`);
    console.log(`   ROI: ${((parseFloat(ethers.formatEther(netProfit)) / parseFloat(ethers.formatEther(opportunity.amount))) * 100).toFixed(2)}%`);
    console.log("");

    // Get market insights
    console.log("🔍 REQUESTING MARKET INSIGHTS...");
    const insights = await aiService.getMarketInsights(marketData);
    
    console.log("📊 MARKET INSIGHTS:");
    insights.forEach((insight, index) => {
      console.log(`   ${index + 1}. ${insight}`);
    });
    console.log("");

    // Calculate market sentiment and volatility
    const sentiment = aiService.calculateMarketSentiment(marketData);
    const volatility = aiService.calculateVolatilityIndex(marketData);

    console.log("📊 MARKET METRICS:");
    console.log(`   Market Sentiment: ${sentiment}% (${sentiment > 60 ? 'Bullish' : sentiment < 40 ? 'Bearish' : 'Neutral'})`);
    console.log(`   Volatility Index: ${volatility}%`);
    console.log(`   Gas Price: ${marketConditions.gasPrice} gwei`);
    console.log(`   Network Congestion: ${marketConditions.networkCongestion}/10`);
    console.log(`   Competition Level: ${marketConditions.competitionLevel}/10`);
    console.log("");

    // Strategy optimization
    console.log("⚙️ REQUESTING STRATEGY OPTIMIZATION...");
    const currentParams = {
      learningRate: 0.001,
      momentum: 0.9,
      volatilityThreshold: 0.05,
      maxExposure: "1000",
      minProfitThreshold: "0.01",
      maxSlippage: 200,
      confidenceThreshold: 7000,
      riskTolerance: 5000
    };

    const optimizedParams = await aiService.optimizeStrategy(historicalData, currentParams);
    
    console.log("🔧 OPTIMIZED PARAMETERS:");
    Object.entries(optimizedParams).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log("");

    // Final decision
    console.log("🎯 FINAL DECISION:");
    if (analysis.shouldExecute && parseFloat(ethers.formatEther(netProfit)) > 0) {
      console.log("✅ EXECUTE ARBITRAGE");
      console.log(`   Strategy: ${analysis.strategy}`);
      console.log(`   Amount: ${ethers.formatEther(analysis.optimalAmount)} WETH`);
      console.log(`   Expected Net Profit: ${ethers.formatEther(netProfit)} WETH`);
      console.log(`   Confidence: ${analysis.confidence}%`);
    } else {
      console.log("❌ DO NOT EXECUTE");
      if (!analysis.shouldExecute) {
        console.log("   Reason: AI analysis suggests not to execute");
      }
      if (parseFloat(ethers.formatEther(netProfit)) <= 0) {
        console.log("   Reason: Net profit would be negative after gas costs");
      }
    }
    console.log("");

  } catch (error) {
    console.error("❌ AI ANALYSIS FAILED:", error);
    console.log("   Using fallback analysis...");
    
    // Fallback analysis
    const fallbackAnalysis = {
      shouldExecute: false,
      confidence: 30,
      riskScore: 70,
      optimalAmount: "0",
      expectedProfit: "0",
      gasEstimate: 300000,
      strategy: "fallback",
      reasoning: "AI service unavailable, using conservative fallback",
      marketInsights: ["AI service temporarily unavailable"],
      recommendations: ["Wait for AI service to resume", "Use manual analysis"]
    };
    
    console.log("🔄 FALLBACK ANALYSIS:");
    console.log(`   Should Execute: ${fallbackAnalysis.shouldExecute ? "✅ YES" : "❌ NO"}`);
    console.log(`   Confidence: ${fallbackAnalysis.confidence}%`);
    console.log(`   Risk Score: ${fallbackAnalysis.riskScore}%`);
    console.log(`   Strategy: ${fallbackAnalysis.strategy}`);
    console.log(`   Reasoning: ${fallbackAnalysis.reasoning}`);
  }

  console.log("🎉 DEEPSEEK AI INTEGRATION TEST COMPLETE!");
  console.log("=".repeat(60));
  console.log("");
  console.log("🚀 Your Advanced AI-Powered Arbitrage Engine is ready!");
  console.log("");
  console.log("💡 Key Features:");
  console.log("   • DeepSeek AI-powered decision making");
  console.log("   • Real-time market analysis");
  console.log("   • Dynamic risk assessment");
  console.log("   • Strategy optimization");
  console.log("   • Gas cost optimization");
  console.log("   • Performance tracking");
  console.log("");
  console.log("🎯 Ready to generate profits with AI precision!");
}

main().catch(console.error);
