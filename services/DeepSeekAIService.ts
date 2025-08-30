import axios from 'axios';
import { ethers } from 'ethers';

export interface MarketData {
  tokenAddress: string;
  price: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  volatility: number;
  liquidity: number;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  expectedProfit: string;
  gasEstimate: number;
  strategyId: string;
  routes: Route[];
  confidence: number;
  riskScore: number;
  marketConditions: MarketConditions;
}

export interface Route {
  router: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  path: string;
  fee: number;
  gasEstimate: number;
  expectedOutput: string;
}

export interface MarketConditions {
  gasPrice: number;
  networkCongestion: number;
  volatilityIndex: number;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  liquidityDepth: number;
  competitionLevel: number;
}

export interface AIAnalysis {
  shouldExecute: boolean;
  confidence: number;
  riskScore: number;
  optimalAmount: string;
  expectedProfit: string;
  gasEstimate: number;
  strategy: string;
  reasoning: string;
  marketInsights: string[];
  recommendations: string[];
}

export class DeepSeekAIService {
  private apiKey: string;
  private apiUrl: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
    this.model = process.env.AI_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS || '4000');
    this.temperature = parseFloat(process.env.AI_TEMPERATURE || '0.7');
    
    if (!this.apiKey) {
      console.warn('⚠️  DeepSeek API key not found in environment variables. AI features will use fallback analysis.');
    }
  }

  /**
   * Analyze arbitrage opportunity using DeepSeek AI
   */
  async analyzeOpportunity(
    opportunity: ArbitrageOpportunity,
    marketData: MarketData[],
    historicalData: any[]
  ): Promise<AIAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(opportunity, marketData, historicalData);
      
      const response = await this.callDeepSeekAPI(prompt);
      
      return this.parseAIResponse(response);
    } catch (error) {
      console.error('DeepSeek AI analysis failed:', error);
      return this.getFallbackAnalysis(opportunity);
    }
  }

  /**
   * Get market insights and predictions
   */
  async getMarketInsights(marketData: MarketData[]): Promise<string[]> {
    try {
      const prompt = this.buildMarketInsightsPrompt(marketData);
      
      const response = await this.callDeepSeekAPI(prompt);
      
      return this.parseMarketInsights(response);
    } catch (error) {
      console.error('DeepSeek market insights failed:', error);
      return ['Market analysis temporarily unavailable'];
    }
  }

  /**
   * Optimize strategy parameters based on performance
   */
  async optimizeStrategy(
    performanceHistory: any[],
    currentParams: any
  ): Promise<any> {
    try {
      const prompt = this.buildOptimizationPrompt(performanceHistory, currentParams);
      
      const response = await this.callDeepSeekAPI(prompt);
      
      return this.parseOptimizationResponse(response);
    } catch (error) {
      console.error('DeepSeek strategy optimization failed:', error);
      return currentParams;
    }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(
    opportunity: ArbitrageOpportunity,
    marketData: MarketData[],
    historicalData: any[]
  ): string {
    return `You are an expert DeFi arbitrage AI analyst. Analyze this arbitrage opportunity and provide detailed insights.

OPPORTUNITY DETAILS:
- Token In: ${opportunity.tokenIn}
- Token Out: ${opportunity.tokenOut}
- Amount: ${opportunity.amount}
- Expected Profit: ${opportunity.expectedProfit}
- Gas Estimate: ${opportunity.gasEstimate}
- Routes: ${opportunity.routes.length}

MARKET DATA:
${marketData.map(data => `
- ${data.tokenAddress}: Price $${data.price}, Vol ${data.volume24h}, MC $${data.marketCap}, Change ${data.priceChange24h}%, Volatility ${data.volatility}
`).join('')}

HISTORICAL PERFORMANCE:
${historicalData.slice(-10).map(h => `- ${h.date}: Profit ${h.profit}, Success ${h.success}`).join('\n')}

CURRENT MARKET CONDITIONS:
- Gas Price: ${opportunity.marketConditions.gasPrice} gwei
- Network Congestion: ${opportunity.marketConditions.networkCongestion}/10
- Volatility Index: ${opportunity.marketConditions.volatilityIndex}
- Market Sentiment: ${opportunity.marketConditions.marketSentiment}
- Liquidity Depth: ${opportunity.marketConditions.liquidityDepth}
- Competition Level: ${opportunity.marketConditions.competitionLevel}/10

Please provide a detailed analysis in the following JSON format:
{
  "shouldExecute": boolean,
  "confidence": number (0-100),
  "riskScore": number (0-100),
  "optimalAmount": string,
  "expectedProfit": string,
  "gasEstimate": number,
  "strategy": string,
  "reasoning": string,
  "marketInsights": [string],
  "recommendations": [string]
}

Focus on:
1. Risk assessment and mitigation
2. Profit potential vs gas costs
3. Market timing and conditions
4. Strategy optimization
5. Competitive analysis
6. Technical indicators

Provide specific, actionable insights.`;
  }

  /**
   * Build market insights prompt
   */
  private buildMarketInsightsPrompt(marketData: MarketData[]): string {
    return `You are a DeFi market analyst. Analyze this market data and provide insights.

MARKET DATA:
${marketData.map(data => `
Token: ${data.tokenAddress}
- Price: $${data.price}
- 24h Volume: $${data.volume24h}
- Market Cap: $${data.marketCap}
- 24h Change: ${data.priceChange24h}%
- Volatility: ${data.volatility}
- Liquidity: $${data.liquidity}
`).join('')}

Provide 5 key market insights in JSON array format:
["insight1", "insight2", "insight3", "insight4", "insight5"]

Focus on:
- Price trends and momentum
- Liquidity patterns
- Volatility analysis
- Market sentiment
- Arbitrage opportunities`;
  }

  /**
   * Build strategy optimization prompt
   */
  private buildOptimizationPrompt(performanceHistory: any[], currentParams: any): string {
    return `You are a DeFi strategy optimization expert. Analyze performance history and suggest parameter improvements.

PERFORMANCE HISTORY (last 50 trades):
${performanceHistory.map(p => `
- Date: ${p.date}
- Profit: ${p.profit}
- Success: ${p.success}
- Gas Used: ${p.gasUsed}
- Risk Score: ${p.riskScore}
- Market Conditions: ${p.marketConditions}
`).join('')}

CURRENT PARAMETERS:
${JSON.stringify(currentParams, null, 2)}

Suggest optimized parameters in JSON format:
{
  "learningRate": number,
  "momentum": number,
  "volatilityThreshold": number,
  "maxExposure": string,
  "minProfitThreshold": string,
  "maxSlippage": number,
  "confidenceThreshold": number,
  "riskTolerance": number
}

Focus on:
- Performance improvement
- Risk reduction
- Gas optimization
- Market adaptation`;
  }

  /**
   * Call DeepSeek API
   */
  private async callDeepSeekAPI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured');
    }
    
    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert DeFi arbitrage AI analyst with deep knowledge of blockchain, smart contracts, and market dynamics. Provide accurate, actionable insights in JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('DeepSeek API call failed:', error);
      throw error;
    }
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(response: string): AIAnalysis {
    try {
      const parsed = JSON.parse(response);
      
      return {
        shouldExecute: parsed.shouldExecute || false,
        confidence: parsed.confidence || 50,
        riskScore: parsed.riskScore || 50,
        optimalAmount: parsed.optimalAmount || "0",
        expectedProfit: parsed.expectedProfit || "0",
        gasEstimate: parsed.gasEstimate || 200000,
        strategy: parsed.strategy || "default",
        reasoning: parsed.reasoning || "Analysis unavailable",
        marketInsights: parsed.marketInsights || [],
        recommendations: parsed.recommendations || []
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Parse market insights
   */
  private parseMarketInsights(response: string): string[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : ['Market analysis completed'];
    } catch (error) {
      console.error('Failed to parse market insights:', error);
      return ['Market analysis temporarily unavailable'];
    }
  }

  /**
   * Parse optimization response
   */
  private parseOptimizationResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse optimization response:', error);
      return {};
    }
  }

  /**
   * Get fallback analysis when AI fails
   */
  private getFallbackAnalysis(opportunity?: ArbitrageOpportunity): AIAnalysis {
    return {
      shouldExecute: false,
      confidence: 30,
      riskScore: 70,
      optimalAmount: opportunity?.amount || "0",
      expectedProfit: opportunity?.expectedProfit || "0",
      gasEstimate: opportunity?.gasEstimate || 200000,
      strategy: "fallback",
      reasoning: "AI analysis unavailable, using conservative fallback",
      marketInsights: ["AI service temporarily unavailable"],
      recommendations: ["Wait for AI service to resume", "Use manual analysis"]
    };
  }

  /**
   * Calculate market sentiment score
   */
  calculateMarketSentiment(marketData: MarketData[]): number {
    if (marketData.length === 0) return 50;

    const priceChanges = marketData.map(d => d.priceChange24h);
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    
    // Convert to 0-100 scale
    return Math.max(0, Math.min(100, 50 + (avgChange * 10)));
  }

  /**
   * Calculate volatility index
   */
  calculateVolatilityIndex(marketData: MarketData[]): number {
    if (marketData.length === 0) return 50;

    const volatilities = marketData.map(d => d.volatility);
    const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
    
    return Math.max(0, Math.min(100, avgVolatility * 100));
  }

  /**
   * Estimate gas costs
   */
  estimateGasCosts(gasPrice: number, gasEstimate: number): string {
    const gasCost = gasPrice * gasEstimate;
    return ethers.formatEther(gasCost.toString());
  }

  /**
   * Calculate profit after gas
   */
  calculateNetProfit(expectedProfit: string, gasCost: string): string {
    const profit = ethers.parseEther(expectedProfit);
    const gas = ethers.parseEther(gasCost);
    const net = profit - gas;
    return ethers.formatEther(net.toString());
  }
}

export default DeepSeekAIService;
