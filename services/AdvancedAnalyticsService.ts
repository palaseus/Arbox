import axios from 'axios';
import { ethers } from 'ethers';

// Types for analytics data
export interface MarketSentimentData {
    token: string;
    sentimentScore: number; // -100 to +100
    socialVolume: number;
    newsCount: number;
    fearGreedIndex: number;
    timestamp: number;
}

export interface CorrelationData {
    tokenA: string;
    tokenB: string;
    correlation: number; // -100 to +100
    confidence: number;
    timestamp: number;
}

export interface VolatilityPrediction {
    token: string;
    predictedVolatility: number;
    confidence: number;
    timeHorizon: number; // in hours
    timestamp: number;
}

export interface MarketData {
    token: string;
    price: number;
    volume: number;
    marketCap: number;
    liquidity: number;
    volatility: number;
    timestamp: number;
}

export interface ProfitPrediction {
    tokenA: string;
    tokenB: string;
    priceA: number;
    priceB: number;
    volume: number;
    profitProbability: number;
    confidence: number;
    factors: {
        volatility: number;
        sentiment: number;
        correlation: number;
        marketTrend: number;
    };
}

export class AdvancedAnalyticsService {
    private provider: ethers.Provider;
    private analyticsContract: any;
    private apiKeys: {
        coinGecko?: string;
        newsApi?: string;
        twitterApi?: string;
        sentimentApi?: string;
    };

    constructor(
        provider: ethers.Provider,
        analyticsContractAddress: string,
        analyticsContractABI: any,
        apiKeys?: {
            coinGecko?: string;
            newsApi?: string;
            twitterApi?: string;
            sentimentApi?: string;
        }
    ) {
        this.provider = provider;
        this.analyticsContract = new ethers.Contract(
            analyticsContractAddress,
            analyticsContractABI,
            provider
        );
        this.apiKeys = apiKeys || {};
    }

    /**
     * Fetch market data from CoinGecko API
     */
    async fetchMarketData(tokenAddress: string): Promise<MarketData | null> {
        try {
            const response = await axios.get(
                `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd&include_24hr_vol=true&include_market_cap=true&include_24hr_change=true`
            );

            const data = response.data as any;
            const tokenData = data[tokenAddress.toLowerCase()];
            if (!tokenData) {
                console.warn(`No market data found for token: ${tokenAddress}`);
                return null;
            }

            // Calculate volatility from 24hr change
            const volatility = Math.abs(tokenData.usd_24h_change || 0);

            return {
                token: tokenAddress,
                price: tokenData.usd || 0,
                volume: tokenData.usd_24h_vol || 0,
                marketCap: tokenData.usd_market_cap || 0,
                liquidity: tokenData.usd_24h_vol || 0, // Using volume as proxy for liquidity
                volatility: volatility,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching market data:', error);
            return null;
        }
    }

    /**
     * Fetch sentiment data from multiple sources
     */
    async fetchSentimentData(tokenAddress: string): Promise<MarketSentimentData | null> {
        try {
            const [socialSentiment, newsSentiment, fearGreedIndex] = await Promise.all([
                this.fetchSocialSentiment(tokenAddress),
                this.fetchNewsSentiment(tokenAddress),
                this.fetchFearGreedIndex()
            ]);

            // Combine sentiment scores
            const combinedSentiment = this.combineSentimentScores(
                socialSentiment,
                newsSentiment,
                fearGreedIndex
            );

            return {
                token: tokenAddress,
                sentimentScore: combinedSentiment.score,
                socialVolume: socialSentiment.volume,
                newsCount: newsSentiment.count,
                fearGreedIndex: fearGreedIndex,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching sentiment data:', error);
            return null;
        }
    }

    /**
     * Fetch social media sentiment
     */
    private async fetchSocialSentiment(tokenAddress: string): Promise<{ score: number; volume: number }> {
        try {
            // Simulate social media sentiment analysis
            // In production, this would integrate with Twitter API, Reddit API, etc.
            const mockSentiment = Math.random() * 200 - 100; // -100 to +100
            const mockVolume = Math.floor(Math.random() * 10000);

            return {
                score: mockSentiment,
                volume: mockVolume
            };
        } catch (error) {
            console.error('Error fetching social sentiment:', error);
            return { score: 0, volume: 0 };
        }
    }

    /**
     * Fetch news sentiment
     */
    private async fetchNewsSentiment(tokenAddress: string): Promise<{ score: number; count: number }> {
        try {
            // Simulate news sentiment analysis
            // In production, this would integrate with news APIs
            const mockSentiment = Math.random() * 200 - 100; // -100 to +100
            const mockCount = Math.floor(Math.random() * 100);

            return {
                score: mockSentiment,
                count: mockCount
            };
        } catch (error) {
            console.error('Error fetching news sentiment:', error);
            return { score: 0, count: 0 };
        }
    }

    /**
     * Fetch fear and greed index
     */
    private async fetchFearGreedIndex(): Promise<number> {
        try {
            // Simulate fear and greed index
            // In production, this would fetch from a real API
            return Math.floor(Math.random() * 100);
        } catch (error) {
            console.error('Error fetching fear and greed index:', error);
            return 50; // Neutral
        }
    }

    /**
     * Combine sentiment scores from multiple sources
     */
    private combineSentimentScores(
        social: { score: number; volume: number },
        news: { score: number; count: number },
        fearGreed: number
    ): { score: number } {
        // Weighted average of different sentiment sources
        const socialWeight = 0.4;
        const newsWeight = 0.3;
        const fearGreedWeight = 0.3;

        // Convert fear/greed index to sentiment score (-100 to +100)
        const fearGreedSentiment = (fearGreed - 50) * 2;

        const combinedScore = 
            (social.score * socialWeight) +
            (news.score * newsWeight) +
            (fearGreedSentiment * fearGreedWeight);

        return {
            score: Math.max(-100, Math.min(100, combinedScore))
        };
    }

    /**
     * Calculate correlation between two tokens
     */
    async calculateCorrelation(tokenA: string, tokenB: string): Promise<CorrelationData | null> {
        try {
            // Fetch historical price data for both tokens
            const [dataA, dataB] = await Promise.all([
                this.fetchHistoricalData(tokenA),
                this.fetchHistoricalData(tokenB)
            ]);

            if (!dataA || !dataB || dataA.length < 30 || dataB.length < 30) {
                console.warn('Insufficient historical data for correlation calculation');
                return null;
            }

            // Calculate correlation coefficient
            const correlation = this.calculateCorrelationCoefficient(dataA, dataB);
            const confidence = this.calculateCorrelationConfidence(dataA, dataB);

            return {
                tokenA,
                tokenB,
                correlation: correlation * 100, // Convert to -100 to +100 scale
                confidence,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error calculating correlation:', error);
            return null;
        }
    }

    /**
     * Fetch historical price data
     */
    private async fetchHistoricalData(tokenAddress: string): Promise<number[]> {
        try {
            // Simulate historical data
            // In production, this would fetch from CoinGecko or other APIs
            const prices: number[] = [];
            let basePrice = 100 + Math.random() * 900; // Random base price

            for (let i = 0; i < 30; i++) {
                const change = (Math.random() - 0.5) * 0.1; // ±5% change
                basePrice *= (1 + change);
                prices.push(basePrice);
            }

            return prices;
        } catch (error) {
            console.error('Error fetching historical data:', error);
            return [];
        }
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    private calculateCorrelationCoefficient(dataA: number[], dataB: number[]): number {
        const n = Math.min(dataA.length, dataB.length);
        if (n < 2) return 0;

        const meanA = dataA.reduce((sum, val) => sum + val, 0) / n;
        const meanB = dataB.reduce((sum, val) => sum + val, 0) / n;

        let numerator = 0;
        let denominatorA = 0;
        let denominatorB = 0;

        for (let i = 0; i < n; i++) {
            const diffA = dataA[i] - meanA;
            const diffB = dataB[i] - meanB;
            numerator += diffA * diffB;
            denominatorA += diffA * diffA;
            denominatorB += diffB * diffB;
        }

        const denominator = Math.sqrt(denominatorA * denominatorB);
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Calculate correlation confidence
     */
    private calculateCorrelationConfidence(dataA: number[], dataB: number[]): number {
        const n = Math.min(dataA.length, dataB.length);
        // Confidence increases with more data points
        return Math.min((n / 30) * 100, 100);
    }

    /**
     * Predict volatility for a token
     */
    async predictVolatility(tokenAddress: string, timeHorizon: number): Promise<VolatilityPrediction | null> {
        try {
            const historicalData = await this.fetchHistoricalData(tokenAddress);
            if (historicalData.length < 10) {
                console.warn('Insufficient data for volatility prediction');
                return null;
            }

            // Calculate historical volatility
            const returns = [];
            for (let i = 1; i < historicalData.length; i++) {
                const return_ = (historicalData[i] - historicalData[i - 1]) / historicalData[i - 1];
                returns.push(return_);
            }

            const meanReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
            const variance = returns.reduce((sum, val) => sum + Math.pow(val - meanReturn, 2), 0) / returns.length;
            const volatility = Math.sqrt(variance) * 100; // Convert to percentage

            // Adjust volatility based on time horizon
            const adjustedVolatility = volatility * Math.sqrt(timeHorizon / 24); // Scale to time horizon

            // Calculate confidence based on data quality
            const confidence = Math.min((historicalData.length / 30) * 100, 100);

            return {
                token: tokenAddress,
                predictedVolatility: Math.min(adjustedVolatility, 1000), // Cap at 1000%
                confidence,
                timeHorizon,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error predicting volatility:', error);
            return null;
        }
    }

    /**
     * Predict profit probability for arbitrage opportunity
     */
    async predictProfitProbability(
        tokenA: string,
        tokenB: string,
        priceA: number,
        priceB: number,
        volume: number
    ): Promise<ProfitPrediction | null> {
        try {
            // Fetch all relevant data
            const [marketDataA, marketDataB, sentimentA, sentimentB, correlation, volatilityA, volatilityB] = await Promise.all([
                this.fetchMarketData(tokenA),
                this.fetchMarketData(tokenB),
                this.fetchSentimentData(tokenA),
                this.fetchSentimentData(tokenB),
                this.calculateCorrelation(tokenA, tokenB),
                this.predictVolatility(tokenA, 24),
                this.predictVolatility(tokenB, 24)
            ]);

            if (!marketDataA || !marketDataB) {
                console.warn('Missing market data for profit prediction');
                return null;
            }

            // Calculate base profit probability from price difference
            const priceRatio = priceB / priceA;
            let baseProbability = priceRatio > 1 ? Math.min((priceRatio - 1) * 200, 100) : 0;

            // Adjust based on various factors
            const factors = {
                volatility: this.calculateVolatilityFactor(volatilityA, volatilityB),
                sentiment: this.calculateSentimentFactor(sentimentA, sentimentB),
                correlation: this.calculateCorrelationFactor(correlation),
                marketTrend: this.calculateMarketTrendFactor(marketDataA, marketDataB)
            };

            // Apply factor adjustments
            baseProbability *= factors.volatility;
            baseProbability *= factors.sentiment;
            baseProbability *= factors.correlation;
            baseProbability *= factors.marketTrend;

            // Calculate overall confidence
            const confidence = this.calculateOverallConfidence(
                marketDataA, marketDataB, sentimentA, sentimentB, correlation
            );

            return {
                tokenA,
                tokenB,
                priceA,
                priceB,
                volume,
                profitProbability: Math.max(0, Math.min(100, baseProbability)),
                confidence,
                factors
            };
        } catch (error) {
            console.error('Error predicting profit probability:', error);
            return null;
        }
    }

    /**
     * Calculate volatility adjustment factor
     */
    private calculateVolatilityFactor(volatilityA: VolatilityPrediction | null, volatilityB: VolatilityPrediction | null): number {
        const avgVolatility = volatilityA && volatilityB ? 
            (volatilityA.predictedVolatility + volatilityB.predictedVolatility) / 2 : 50;

        // Reduce probability for high volatility
        if (avgVolatility > 50) {
            return 0.8; // 20% reduction
        } else if (avgVolatility > 30) {
            return 0.9; // 10% reduction
        }
        return 1.0; // No adjustment
    }

    /**
     * Calculate sentiment adjustment factor
     */
    private calculateSentimentFactor(sentimentA: MarketSentimentData | null, sentimentB: MarketSentimentData | null): number {
        if (!sentimentA || !sentimentB) return 1.0;

        const avgSentiment = (sentimentA.sentimentScore + sentimentB.sentimentScore) / 2;

        if (avgSentiment > 30) {
            return 1.1; // 10% increase for positive sentiment
        } else if (avgSentiment < -30) {
            return 0.9; // 10% decrease for negative sentiment
        }
        return 1.0; // No adjustment
    }

    /**
     * Calculate correlation adjustment factor
     */
    private calculateCorrelationFactor(correlation: CorrelationData | null): number {
        if (!correlation) return 1.0;

        const absCorrelation = Math.abs(correlation.correlation);
        if (absCorrelation > 50) {
            return 0.95; // 5% reduction for high correlation
        }
        return 1.0; // No adjustment
    }

    /**
     * Calculate market trend adjustment factor
     */
    private calculateMarketTrendFactor(marketDataA: MarketData, marketDataB: MarketData): number {
        // Simple trend calculation based on recent price changes
        // In production, this would use more sophisticated trend analysis
        return 1.0; // No adjustment for now
    }

    /**
     * Calculate overall confidence
     */
    private calculateOverallConfidence(
        marketDataA: MarketData,
        marketDataB: MarketData,
        sentimentA: MarketSentimentData | null,
        sentimentB: MarketSentimentData | null,
        correlation: CorrelationData | null
    ): number {
        let confidence = 50; // Base confidence

        // Increase confidence based on data availability
        if (marketDataA && marketDataB) confidence += 20;
        if (sentimentA && sentimentB) confidence += 15;
        if (correlation) confidence += 15;

        return Math.min(confidence, 100);
    }

    /**
     * Update analytics contract with new data
     */
    async updateAnalyticsContract(
        signer: ethers.Signer,
        marketData: MarketData,
        sentimentData: MarketSentimentData | null,
        correlationData: CorrelationData | null,
        volatilityPrediction: VolatilityPrediction | null
    ): Promise<void> {
        try {
            const contract = this.analyticsContract.connect(signer) as any;

            // Update market data
            await contract.addMarketData(
                marketData.token,
                ethers.parseUnits(marketData.price.toString(), 18),
                ethers.parseUnits(marketData.volume.toString(), 18),
                ethers.parseUnits(marketData.marketCap.toString(), 18),
                ethers.parseUnits(marketData.liquidity.toString(), 18)
            );

            // Update sentiment data if available
            if (sentimentData) {
                await contract.addSentimentData(
                    sentimentData.token,
                    Math.round(sentimentData.sentimentScore),
                    sentimentData.socialVolume,
                    sentimentData.newsCount,
                    sentimentData.fearGreedIndex
                );
            }

            // Update correlation data if available
            if (correlationData) {
                await contract.updateCorrelation(
                    correlationData.tokenA,
                    correlationData.tokenB,
                    Math.round(correlationData.correlation),
                    Math.round(correlationData.confidence)
                );
            }

            // Update volatility prediction if available
            if (volatilityPrediction) {
                await contract.addVolatilityPrediction(
                    volatilityPrediction.token,
                    Math.round(volatilityPrediction.predictedVolatility),
                    Math.round(volatilityPrediction.confidence),
                    volatilityPrediction.timeHorizon
                );
            }

            console.log('Analytics contract updated successfully');
        } catch (error) {
            console.error('Error updating analytics contract:', error);
            throw error;
        }
    }

    /**
     * Get analytics data from contract
     */
    async getAnalyticsData(tokenAddress: string): Promise<{
        marketData: any;
        sentimentData: any;
        volatilityPrediction: any;
    }> {
        try {
            const [marketData, sentimentData, volatilityPrediction] = await Promise.all([
                this.analyticsContract.getLatestMarketData(tokenAddress),
                this.analyticsContract.getLatestSentimentData(tokenAddress),
                this.analyticsContract.getVolatilityPrediction(tokenAddress, 24)
            ]);

            return {
                marketData,
                sentimentData,
                volatilityPrediction
            };
        } catch (error) {
            console.error('Error getting analytics data:', error);
            throw error;
        }
    }
}
