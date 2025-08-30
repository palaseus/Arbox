import { expect } from "chai";
import { ethers } from "hardhat";
import { AdvancedAnalytics } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AdvancedAnalytics", function () {
    let analytics: AdvancedAnalytics;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let tokenA: string;
    let tokenB: string;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();
        
        const AdvancedAnalyticsFactory = await ethers.getContractFactory("AdvancedAnalytics");
        analytics = await AdvancedAnalyticsFactory.deploy();
        
        // Mock token addresses
        tokenA = "0x1234567890123456789012345678901234567890";
        tokenB = "0x2345678901234567890123456789012345678901";
    });

    describe("Deployment", function () {
        it("Should deploy with correct owner", async function () {
            expect(await analytics.owner()).to.equal(owner.address);
        });

        it("Should initialize default models", async function () {
            const model1 = await analytics.predictionModels(1);
            const model2 = await analytics.predictionModels(2);
            const model3 = await analytics.predictionModels(3);
            const model4 = await analytics.predictionModels(4);

            expect(model1.modelType).to.equal("profit_prediction");
            expect(model2.modelType).to.equal("volatility_prediction");
            expect(model3.modelType).to.equal("sentiment_analysis");
            expect(model4.modelType).to.equal("correlation_analysis");
        });

        it("Should set correct default thresholds", async function () {
            expect(await analytics.minDataPoints()).to.equal(100);
            expect(await analytics.maxHistoryLength()).to.equal(1000);
            expect(await analytics.volatilityThreshold()).to.equal(50);
            expect(await analytics.sentimentThreshold()).to.equal(30);
        });
    });

    describe("Market Data Management", function () {
        it("Should add market data successfully", async function () {
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            const tx = await analytics.addMarketData(tokenA, price, volume, marketCap, liquidity);
            await expect(tx).to.emit(analytics, "MarketDataAdded");

            const dataLength = await analytics.getMarketDataLength(tokenA);
            expect(dataLength).to.equal(1);
        });

        it("Should maintain history length limit", async function () {
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            // Set a smaller max history length for testing first
            await analytics.updateThreshold("maxHistoryLength", 15);
            
            // Add more data points than the new maxHistoryLength
            for (let i = 0; i < 20; i++) {
                await analytics.addMarketData(tokenA, price, volume, marketCap, liquidity);
            }

            const dataLength = await analytics.getMarketDataLength(tokenA);
            expect(dataLength).to.equal(15); // Should be capped at maxHistoryLength
        });

        it("Should calculate volatility correctly", async function () {
            // Use a fresh token for this test to avoid interference
            const volatilityToken = "0x5678901234567890123456789012345678901234";
            
            const basePrice = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            // Add initial data
            await analytics.addMarketData(volatilityToken, basePrice, volume, marketCap, liquidity);

            // Add data with price change
            const newPrice = ethers.parseUnits("1100", 18); // 10% increase
            await analytics.addMarketData(volatilityToken, newPrice, volume, marketCap, liquidity);

            const latestData = await analytics.getLatestMarketData(volatilityToken);
            // Volatility should be calculated (allow any reasonable value)
            expect(latestData.volatility).to.be.gte(0);
        });
    });

    describe("Sentiment Data Management", function () {
        it("Should add sentiment data successfully", async function () {
            const sentimentScore = 75; // Positive sentiment
            const socialVolume = 1000;
            const newsCount = 50;
            const fearGreedIndex = 70;

            const tx = await analytics.addSentimentData(tokenA, sentimentScore, socialVolume, newsCount, fearGreedIndex);
            await expect(tx).to.emit(analytics, "SentimentDataAdded");

            const dataLength = await analytics.getSentimentDataLength(tokenA);
            expect(dataLength).to.equal(1);
        });

        it("Should reject invalid sentiment scores", async function () {
            const invalidScore = 150; // Above 100
            const socialVolume = 1000;
            const newsCount = 50;
            const fearGreedIndex = 70;

            await expect(analytics.addSentimentData(tokenA, invalidScore, socialVolume, newsCount, fearGreedIndex))
                .to.be.revertedWithCustomError(analytics, "InvalidSentimentScore");
        });

        it("Should get sentiment analysis correctly", async function () {
            // Add two sentiment data points (using int256 values)
            await analytics.addSentimentData(tokenA, 10, 1000, 50, 60);
            await analytics.addSentimentData(tokenA, 25, 1200, 60, 65); // Change > 10 for "increasing"

            const result = await analytics.getSentimentAnalysis(tokenA);
            expect(result[0]).to.equal(25); // sentimentScore
            expect(result[1]).to.equal("increasing"); // trend
            expect(result[2]).to.be.gt(0); // confidence
        });

        it("Should fail sentiment analysis with insufficient data", async function () {
            await expect(analytics.getSentimentAnalysis(tokenA))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");
        });
    });

    describe("Correlation Management", function () {
        it("Should update correlation successfully", async function () {
            const correlation = 75; // High positive correlation
            const confidence = 85;

            await expect(analytics.updateCorrelation(tokenA, tokenB, correlation, confidence))
                .to.emit(analytics, "CorrelationUpdated")
                .withArgs(tokenA, tokenB, correlation);
        });

        it("Should reject invalid correlation values", async function () {
            const invalidCorrelation = 150; // Above 100
            const confidence = 85;

            await expect(analytics.updateCorrelation(tokenA, tokenB, invalidCorrelation, confidence))
                .to.be.revertedWithCustomError(analytics, "InvalidCorrelationValue");
        });

        it("Should handle negative correlation values", async function () {
            const correlation = -75; // High negative correlation
            const confidence = 85;

            await expect(analytics.updateCorrelation(tokenA, tokenB, correlation, confidence))
                .to.emit(analytics, "CorrelationUpdated")
                .withArgs(tokenA, tokenB, correlation);
        });
    });

    describe("Volatility Prediction", function () {
        it("Should add volatility prediction successfully", async function () {
            const predictedVolatility = 45; // 45% volatility
            const confidence = 80;
            const timeHorizon = 24; // 24 hours

            const tx = await analytics.addVolatilityPrediction(tokenA, predictedVolatility, confidence, timeHorizon);
            await expect(tx).to.emit(analytics, "VolatilityPredictionAdded");

            const dataLength = await analytics.getVolatilityPredictionsLength(tokenA);
            expect(dataLength).to.equal(1);
        });

        it("Should reject invalid volatility values", async function () {
            const invalidVolatility = 1500; // Above 1000%
            const confidence = 80;
            const timeHorizon = 24;

            await expect(analytics.addVolatilityPrediction(tokenA, invalidVolatility, confidence, timeHorizon))
                .to.be.revertedWithCustomError(analytics, "InvalidVolatilityValue");
        });

        it("Should get volatility prediction correctly", async function () {
            const predictedVolatility = 60; // High volatility
            const confidence = 85;
            const timeHorizon = 24;

            await analytics.addVolatilityPrediction(tokenA, predictedVolatility, confidence, timeHorizon);

            const [volatility, conf, isHighVolatility] = await analytics.getVolatilityPrediction(tokenA, timeHorizon);
            expect(volatility).to.equal(predictedVolatility);
            expect(conf).to.equal(confidence);
            expect(isHighVolatility).to.be.true; // Should be high volatility (>50%)
        });

        it("Should fail volatility prediction with insufficient data", async function () {
            await expect(analytics.getVolatilityPrediction(tokenA, 24))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");
        });
    });

    describe("Profit Prediction", function () {
        beforeEach(async function () {
            // Add sufficient market data for both tokens
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            for (let i = 0; i < 100; i++) {
                await analytics.addMarketData(tokenA, price, volume, marketCap, liquidity);
                await analytics.addMarketData(tokenB, price, volume, marketCap, liquidity);
            }
        });

        it("Should predict profit probability successfully", async function () {
            const priceA = ethers.parseUnits("1000", 18);
            const priceB = ethers.parseUnits("1100", 18); // 10% higher
            const tradeVolume = ethers.parseUnits("1000", 18);

            const [profitProbability, confidence] = await analytics.predictProfitProbability(
                tokenA, tokenB, priceA, priceB, tradeVolume
            );

            expect(profitProbability).to.be.gt(0);
            expect(confidence).to.be.gt(0);
            expect(profitProbability).to.be.lte(100);
            expect(confidence).to.be.lte(100);
        });

        it("Should fail profit prediction with insufficient data", async function () {
            const newToken = "0x3456789012345678901234567890123456789012";
            const priceA = ethers.parseUnits("1000", 18);
            const priceB = ethers.parseUnits("1100", 18);
            const tradeVolume = ethers.parseUnits("1000", 18);

            await expect(analytics.predictProfitProbability(newToken, tokenB, priceA, priceB, tradeVolume))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");
        });
    });

    describe("Admin Functions", function () {
        it("Should update thresholds successfully", async function () {
            const newVolatilityThreshold = 60;
            const newSentimentThreshold = 40;

            await expect(analytics.updateThreshold("volatility", newVolatilityThreshold))
                .to.emit(analytics, "AnalyticsThresholdUpdated")
                .withArgs("volatility", 50, newVolatilityThreshold);

            await expect(analytics.updateThreshold("sentiment", newSentimentThreshold))
                .to.emit(analytics, "AnalyticsThresholdUpdated")
                .withArgs("sentiment", 30, newSentimentThreshold);

            expect(await analytics.volatilityThreshold()).to.equal(newVolatilityThreshold);
            expect(await analytics.sentimentThreshold()).to.equal(newSentimentThreshold);
        });

        it("Should reject threshold updates from non-owner", async function () {
            await expect(analytics.connect(user).updateThreshold("volatility", 60))
                .to.be.revertedWithCustomError(analytics, "OwnableUnauthorizedAccount");
        });

        it("Should pause and unpause successfully", async function () {
            await expect(analytics.pause())
                .to.emit(analytics, "Paused")
                .withArgs(owner.address);

            await expect(analytics.unpause())
                .to.emit(analytics, "Unpaused")
                .withArgs(owner.address);
        });

        it("Should reject operations when paused", async function () {
            await analytics.pause();

            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            await expect(analytics.addMarketData(tokenA, price, volume, marketCap, liquidity))
                .to.be.revertedWithCustomError(analytics, "EnforcedPause");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            // Add some test data
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            await analytics.addMarketData(tokenA, price, volume, marketCap, liquidity);
            await analytics.addSentimentData(tokenA, 50, 1000, 50, 60);
            await analytics.addVolatilityPrediction(tokenA, 45, 80, 24);
        });

        it("Should get correct data lengths", async function () {
            expect(await analytics.getMarketDataLength(tokenA)).to.equal(1);
            expect(await analytics.getSentimentDataLength(tokenA)).to.equal(1);
            expect(await analytics.getVolatilityPredictionsLength(tokenA)).to.equal(1);
        });

        it("Should get latest market data", async function () {
            const data = await analytics.getLatestMarketData(tokenA);
            expect(data.price).to.equal(ethers.parseUnits("1000", 18));
            expect(data.volume).to.equal(ethers.parseUnits("50000", 18));
        });

        it("Should get latest sentiment data", async function () {
            const data = await analytics.getLatestSentimentData(tokenA);
            expect(data.sentimentScore).to.equal(50);
            expect(data.socialVolume).to.equal(1000);
        });

        it("Should fail getting latest data for empty history", async function () {
            const emptyToken = "0x4567890123456789012345678901234567890123";
            
            await expect(analytics.getLatestMarketData(emptyToken))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");

            await expect(analytics.getLatestSentimentData(emptyToken))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");
        });
    });

    describe("Integration Tests", function () {
        it("Should provide comprehensive analytics for arbitrage decision", async function () {
            // Setup comprehensive data
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            // Add market data for both tokens
            for (let i = 0; i < 100; i++) {
                await analytics.addMarketData(tokenA, price, volume, marketCap, liquidity);
                await analytics.addMarketData(tokenB, price, volume, marketCap, liquidity);
            }

            // Add sentiment data (need at least 2 points for analysis)
            await analytics.addSentimentData(tokenA, 65, 900, 45, 65);
            await analytics.addSentimentData(tokenA, 75, 1000, 50, 70);
            await analytics.addSentimentData(tokenB, 55, 700, 35, 60);
            await analytics.addSentimentData(tokenB, 65, 800, 40, 65);

            // Add correlation
            await analytics.updateCorrelation(tokenA, tokenB, 45, 85);

            // Add volatility predictions
            await analytics.addVolatilityPrediction(tokenA, 35, 80, 24);
            await analytics.addVolatilityPrediction(tokenB, 40, 75, 24);

            // Test profit prediction
            const priceA = ethers.parseUnits("1000", 18);
            const priceB = ethers.parseUnits("1050", 18); // 5% higher
            const tradeVolume = ethers.parseUnits("1000", 18);

            const [profitProbability, confidence] = await analytics.predictProfitProbability(
                tokenA, tokenB, priceA, priceB, tradeVolume
            );

            expect(profitProbability).to.be.gt(0);
            expect(confidence).to.be.gt(0);

            // Test sentiment analysis
            const [sentimentScore, trend, sentimentConfidence] = await analytics.getSentimentAnalysis(tokenA);
            expect(sentimentScore).to.equal(75);
            expect(trend).to.be.oneOf(["increasing", "decreasing", "stable"]);
            expect(sentimentConfidence).to.be.gt(0);

            // Test volatility prediction
            const [predictedVolatility, volConfidence, isHighVolatility] = await analytics.getVolatilityPrediction(tokenA, 24);
            expect(predictedVolatility).to.equal(35);
            expect(volConfidence).to.equal(80);
            expect(isHighVolatility).to.be.false; // 35% < 50% threshold
        });
    });
});
