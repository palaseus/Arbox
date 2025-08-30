import { expect } from "chai";
import { ethers } from "hardhat";
import { AdvancedAnalytics } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AdvancedAnalytics - Basic Tests", function () {
    let analytics: AdvancedAnalytics;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();
        
        const AdvancedAnalyticsFactory = await ethers.getContractFactory("AdvancedAnalytics");
        analytics = await AdvancedAnalyticsFactory.deploy();
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
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            const tx = await analytics.addMarketData(tokenAddress, price, volume, marketCap, liquidity);
            await expect(tx).to.emit(analytics, "MarketDataAdded");

            const dataLength = await analytics.getMarketDataLength(tokenAddress);
            expect(dataLength).to.equal(1);
        });
    });

    describe("Sentiment Data Management", function () {
        it("Should add sentiment data successfully", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const sentimentScore = 75; // Positive sentiment
            const socialVolume = 1000;
            const newsCount = 50;
            const fearGreedIndex = 70;

            const tx = await analytics.addSentimentData(tokenAddress, sentimentScore, socialVolume, newsCount, fearGreedIndex);
            await expect(tx).to.emit(analytics, "SentimentDataAdded");

            const dataLength = await analytics.getSentimentDataLength(tokenAddress);
            expect(dataLength).to.equal(1);
        });

        it("Should reject invalid sentiment scores", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const invalidScore = 150; // Above 100
            const socialVolume = 1000;
            const newsCount = 50;
            const fearGreedIndex = 70;

            await expect(analytics.addSentimentData(tokenAddress, invalidScore, socialVolume, newsCount, fearGreedIndex))
                .to.be.revertedWithCustomError(analytics, "InvalidSentimentScore");
        });

        it("Should fail sentiment analysis with insufficient data", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            await expect(analytics.getSentimentAnalysis(tokenAddress))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");
        });
    });

    describe("Correlation Management", function () {
        it("Should update correlation successfully", async function () {
            const tokenA = "0x1234567890123456789012345678901234567890";
            const tokenB = "0x2345678901234567890123456789012345678901";
            const correlation = 75; // High positive correlation
            const confidence = 85;

            await expect(analytics.updateCorrelation(tokenA, tokenB, correlation, confidence))
                .to.emit(analytics, "CorrelationUpdated")
                .withArgs(tokenA, tokenB, correlation);
        });

        it("Should reject invalid correlation values", async function () {
            const tokenA = "0x1234567890123456789012345678901234567890";
            const tokenB = "0x2345678901234567890123456789012345678901";
            const invalidCorrelation = 150; // Above 100
            const confidence = 85;

            await expect(analytics.updateCorrelation(tokenA, tokenB, invalidCorrelation, confidence))
                .to.be.revertedWithCustomError(analytics, "InvalidCorrelationValue");
        });

        it("Should handle negative correlation values", async function () {
            const tokenA = "0x1234567890123456789012345678901234567890";
            const tokenB = "0x2345678901234567890123456789012345678901";
            const correlation = -75; // High negative correlation
            const confidence = 85;

            await expect(analytics.updateCorrelation(tokenA, tokenB, correlation, confidence))
                .to.emit(analytics, "CorrelationUpdated")
                .withArgs(tokenA, tokenB, correlation);
        });
    });

    describe("Volatility Prediction", function () {
        it("Should add volatility prediction successfully", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const predictedVolatility = 45; // 45% volatility
            const confidence = 80;
            const timeHorizon = 24; // 24 hours

            const tx = await analytics.addVolatilityPrediction(tokenAddress, predictedVolatility, confidence, timeHorizon);
            await expect(tx).to.emit(analytics, "VolatilityPredictionAdded");

            const dataLength = await analytics.getVolatilityPredictionsLength(tokenAddress);
            expect(dataLength).to.equal(1);
        });

        it("Should reject invalid volatility values", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const invalidVolatility = 1500; // Above 1000%
            const confidence = 80;
            const timeHorizon = 24;

            await expect(analytics.addVolatilityPrediction(tokenAddress, invalidVolatility, confidence, timeHorizon))
                .to.be.revertedWithCustomError(analytics, "InvalidVolatilityValue");
        });

        it("Should fail volatility prediction with insufficient data", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            await expect(analytics.getVolatilityPrediction(tokenAddress, 24))
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

            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            await expect(analytics.addMarketData(tokenAddress, price, volume, marketCap, liquidity))
                .to.be.revertedWithCustomError(analytics, "EnforcedPause");
        });
    });

    describe("View Functions", function () {
        it("Should get correct data lengths", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            
            // Add some test data
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            await analytics.addMarketData(tokenAddress, price, volume, marketCap, liquidity);
            await analytics.addSentimentData(tokenAddress, 50, 1000, 50, 60);
            await analytics.addVolatilityPrediction(tokenAddress, 45, 80, 24);

            expect(await analytics.getMarketDataLength(tokenAddress)).to.equal(1);
            expect(await analytics.getSentimentDataLength(tokenAddress)).to.equal(1);
            expect(await analytics.getVolatilityPredictionsLength(tokenAddress)).to.equal(1);
        });

        it("Should get latest market data", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            const price = ethers.parseUnits("1000", 18);
            const volume = ethers.parseUnits("50000", 18);
            const marketCap = ethers.parseUnits("1000000", 18);
            const liquidity = ethers.parseUnits("100000", 18);

            await analytics.addMarketData(tokenAddress, price, volume, marketCap, liquidity);

            const data = await analytics.getLatestMarketData(tokenAddress);
            expect(data.price).to.equal(price);
            expect(data.volume).to.equal(volume);
        });

        it("Should get latest sentiment data", async function () {
            const tokenAddress = "0x1234567890123456789012345678901234567890";
            await analytics.addSentimentData(tokenAddress, 50, 1000, 50, 60);

            const data = await analytics.getLatestSentimentData(tokenAddress);
            expect(data.sentimentScore).to.equal(50);
            expect(data.socialVolume).to.equal(1000);
        });

        it("Should fail getting latest data for empty history", async function () {
            const emptyToken = "0x9999999999999999999999999999999999999999";
            
            await expect(analytics.getLatestMarketData(emptyToken))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");

            await expect(analytics.getLatestSentimentData(emptyToken))
                .to.be.revertedWithCustomError(analytics, "InsufficientDataPoints");
        });
    });
});
