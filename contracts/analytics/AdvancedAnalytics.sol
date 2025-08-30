// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title AdvancedAnalytics
 * @dev Advanced analytics and machine learning models for arbitrage optimization
 * @author Arbox Team
 */
contract AdvancedAnalytics is Ownable, Pausable {
    using Math for uint256;

    // ============ STRUCTS ============

    struct MarketData {
        uint256 timestamp;
        uint256 price;
        uint256 volume;
        uint256 volatility;
        uint256 marketCap;
        uint256 liquidity;
    }

    struct PredictionModel {
        uint256 modelId;
        string modelType;
        uint256 accuracy;
        uint256 lastUpdate;
        bool isActive;
        uint256 predictionCount;
        uint256 successCount;
    }

    struct SentimentData {
        uint256 timestamp;
        int256 sentimentScore; // -100 to +100
        uint256 socialVolume;
        uint256 newsCount;
        uint256 fearGreedIndex;
    }

    struct CorrelationMatrix {
        address tokenA;
        address tokenB;
        int256 correlation; // -100 to +100
        uint256 confidence;
        uint256 lastUpdate;
    }

    struct VolatilityPrediction {
        uint256 timestamp;
        uint256 predictedVolatility;
        uint256 confidence;
        uint256 timeHorizon; // in hours
        bool isHighVolatility;
    }

    // ============ STATE VARIABLES ============

    mapping(address => MarketData[]) public marketDataHistory;
    mapping(uint256 => PredictionModel) public predictionModels;
    mapping(address => SentimentData[]) public sentimentHistory;
    mapping(bytes32 => CorrelationMatrix) public correlationMatrix;
    mapping(address => VolatilityPrediction[]) public volatilityPredictions;

    uint256 public modelCounter;
    uint256 public minDataPoints = 100;
    uint256 public maxHistoryLength = 1000;
    uint256 public volatilityThreshold = 50; // 50% volatility threshold
    uint256 public sentimentThreshold = 30; // 30% sentiment threshold

    // ============ EVENTS ============

    event MarketDataAdded(address indexed token, uint256 price, uint256 volume, uint256 timestamp);
    event PredictionModelCreated(uint256 indexed modelId, string modelType, address indexed creator);
    event PredictionModelUpdated(uint256 indexed modelId, uint256 accuracy, uint256 timestamp);
    event SentimentDataAdded(address indexed token, int256 sentimentScore, uint256 timestamp);
    event CorrelationUpdated(address indexed tokenA, address indexed tokenB, int256 correlation);
    event VolatilityPredictionAdded(address indexed token, uint256 predictedVolatility, uint256 timestamp);
    event AnalyticsThresholdUpdated(string thresholdType, uint256 oldValue, uint256 newValue);

    // ============ ERRORS ============

    error InsufficientDataPoints();
    error InvalidModelType();
    error ModelNotFound();
    error InvalidSentimentScore();
    error InvalidCorrelationValue();
    error InvalidVolatilityValue();
    error DataPointLimitExceeded();

    // ============ CONSTRUCTOR ============

    constructor() Ownable(msg.sender) {
        _initializeDefaultModels();
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @dev Add market data for a token
     * @param token Token address
     * @param price Current price
     * @param volume Trading volume
     * @param marketCap Market capitalization
     * @param liquidity Liquidity amount
     */
    function addMarketData(
        address token,
        uint256 price,
        uint256 volume,
        uint256 marketCap,
        uint256 liquidity
    ) external onlyOwner whenNotPaused {
        uint256 volatility = _calculateVolatility(token, price);
        
        MarketData memory data = MarketData({
            timestamp: block.timestamp,
            price: price,
            volume: volume,
            volatility: volatility,
            marketCap: marketCap,
            liquidity: liquidity
        });

        marketDataHistory[token].push(data);

        // Maintain history length limit
        if (marketDataHistory[token].length > maxHistoryLength) {
            // Remove oldest data point
            for (uint256 i = 0; i < marketDataHistory[token].length - 1; i++) {
                marketDataHistory[token][i] = marketDataHistory[token][i + 1];
            }
            marketDataHistory[token].pop();
        }

        emit MarketDataAdded(token, price, volume, block.timestamp);
    }

    /**
     * @dev Add sentiment data for a token
     * @param token Token address
     * @param sentimentScore Sentiment score (-100 to +100)
     * @param socialVolume Social media volume
     * @param newsCount News article count
     * @param fearGreedIndex Fear and greed index (0-100)
     */
    function addSentimentData(
        address token,
        int256 sentimentScore,
        uint256 socialVolume,
        uint256 newsCount,
        uint256 fearGreedIndex
    ) external onlyOwner whenNotPaused {
        if (sentimentScore < -100 || sentimentScore > 100) {
            revert InvalidSentimentScore();
        }

        SentimentData memory data = SentimentData({
            timestamp: block.timestamp,
            sentimentScore: sentimentScore,
            socialVolume: socialVolume,
            newsCount: newsCount,
            fearGreedIndex: fearGreedIndex
        });

        sentimentHistory[token].push(data);

        // Maintain history length limit
        if (sentimentHistory[token].length > maxHistoryLength) {
            for (uint256 i = 0; i < sentimentHistory[token].length - 1; i++) {
                sentimentHistory[token][i] = sentimentHistory[token][i + 1];
            }
            sentimentHistory[token].pop();
        }

        emit SentimentDataAdded(token, sentimentScore, block.timestamp);
    }

    /**
     * @dev Update correlation between two tokens
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param correlation Correlation value (-100 to +100)
     * @param confidence Confidence level (0-100)
     */
    function updateCorrelation(
        address tokenA,
        address tokenB,
        int256 correlation,
        uint256 confidence
    ) external onlyOwner whenNotPaused {
        if (correlation < -100 || correlation > 100) {
            revert InvalidCorrelationValue();
        }

        bytes32 key = _getCorrelationKey(tokenA, tokenB);
        
        correlationMatrix[key] = CorrelationMatrix({
            tokenA: tokenA,
            tokenB: tokenB,
            correlation: correlation,
            confidence: confidence,
            lastUpdate: block.timestamp
        });

        emit CorrelationUpdated(tokenA, tokenB, correlation);
    }

    /**
     * @dev Add volatility prediction for a token
     * @param token Token address
     * @param predictedVolatility Predicted volatility percentage
     * @param confidence Confidence level (0-100)
     * @param timeHorizon Time horizon in hours
     */
    function addVolatilityPrediction(
        address token,
        uint256 predictedVolatility,
        uint256 confidence,
        uint256 timeHorizon
    ) external onlyOwner whenNotPaused {
        if (predictedVolatility > 1000) { // Max 1000% volatility
            revert InvalidVolatilityValue();
        }

        VolatilityPrediction memory prediction = VolatilityPrediction({
            timestamp: block.timestamp,
            predictedVolatility: predictedVolatility,
            confidence: confidence,
            timeHorizon: timeHorizon,
            isHighVolatility: predictedVolatility > volatilityThreshold
        });

        volatilityPredictions[token].push(prediction);

        // Maintain history length limit
        if (volatilityPredictions[token].length > maxHistoryLength) {
            for (uint256 i = 0; i < volatilityPredictions[token].length - 1; i++) {
                volatilityPredictions[token][i] = volatilityPredictions[token][i + 1];
            }
            volatilityPredictions[token].pop();
        }

        emit VolatilityPredictionAdded(token, predictedVolatility, block.timestamp);
    }

    // ============ PREDICTION FUNCTIONS ============

    /**
     * @dev Predict profit probability for an arbitrage opportunity
     * @param tokenA First token in arbitrage
     * @param tokenB Second token in arbitrage
     * @param priceA Price of token A
     * @param priceB Price of token B
     * @return profitProbability Probability of profit (0-100)
     * @return confidence Confidence level (0-100)
     */
    function predictProfitProbability(
        address tokenA,
        address tokenB,
        uint256 priceA,
        uint256 priceB,
        uint256 /* volume */
    ) external view returns (uint256 profitProbability, uint256 confidence) {
        if (marketDataHistory[tokenA].length < minDataPoints || 
            marketDataHistory[tokenB].length < minDataPoints) {
            revert InsufficientDataPoints();
        }

        // Calculate base profit probability from price difference
        uint256 priceRatio = (priceB * 10000) / priceA;
        uint256 baseProbability = priceRatio > 10000 ? 
            Math.min((priceRatio - 10000) * 2, 100) : 0;

        // Adjust based on volatility
        uint256 volatilityA = _getCurrentVolatility(tokenA);
        uint256 volatilityB = _getCurrentVolatility(tokenB);
        uint256 avgVolatility = (volatilityA + volatilityB) / 2;
        
        if (avgVolatility > volatilityThreshold) {
            baseProbability = baseProbability * 80 / 100; // Reduce probability for high volatility
        }

        // Adjust based on sentiment
        int256 sentimentA = _getCurrentSentiment(tokenA);
        int256 sentimentB = _getCurrentSentiment(tokenB);
        int256 avgSentiment = (sentimentA + sentimentB) / 2;
        
        if (avgSentiment > int256(sentimentThreshold)) {
            baseProbability = baseProbability * 110 / 100; // Increase probability for positive sentiment
        } else if (avgSentiment < -int256(sentimentThreshold)) {
            baseProbability = baseProbability * 90 / 100; // Decrease probability for negative sentiment
        }

        // Adjust based on correlation
        int256 correlation = _getCorrelation(tokenA, tokenB);
        if (correlation > 50) {
            baseProbability = baseProbability * 95 / 100; // Slightly reduce for high correlation
        } else if (correlation < -50) {
            baseProbability = baseProbability * 105 / 100; // Slightly increase for negative correlation
        }

        // Calculate confidence based on data quality
        confidence = _calculateConfidence(tokenA, tokenB);

        return (Math.min(baseProbability, 100), confidence);
    }

    /**
     * @dev Get market sentiment analysis for a token
     * @param token Token address
     * @return sentimentScore Current sentiment score (-100 to +100)
     * @return trend Sentiment trend (increasing, decreasing, stable)
     * @return confidence Confidence level (0-100)
     */
    function getSentimentAnalysis(
        address token
    ) external view returns (int256 sentimentScore, string memory trend, uint256 confidence) {
        if (sentimentHistory[token].length < 2) {
            revert InsufficientDataPoints();
        }

        SentimentData[] memory history = sentimentHistory[token];
        sentimentScore = history[history.length - 1].sentimentScore;

        // Calculate trend
        int256 previousSentiment = history[history.length - 2].sentimentScore;
        int256 sentimentChange = sentimentScore - previousSentiment;

        if (sentimentChange > 10) {
            trend = "increasing";
        } else if (sentimentChange < -10) {
            trend = "decreasing";
        } else {
            trend = "stable";
        }

        // Calculate confidence based on data consistency
        confidence = _calculateSentimentConfidence(token);

        return (sentimentScore, trend, confidence);
    }

    /**
     * @dev Get volatility prediction for a token
     * @param token Token address
     * @param timeHorizon Time horizon in hours
     * @return predictedVolatility Predicted volatility percentage
     * @return confidence Confidence level (0-100)
     * @return isHighVolatility Whether volatility is predicted to be high
     */
    function getVolatilityPrediction(
        address token,
        uint256 timeHorizon
    ) external view returns (uint256 predictedVolatility, uint256 confidence, bool isHighVolatility) {
        if (volatilityPredictions[token].length == 0) {
            revert InsufficientDataPoints();
        }

        // Find the most recent prediction for the given time horizon
        VolatilityPrediction[] memory predictions = volatilityPredictions[token];
        VolatilityPrediction memory latestPrediction = predictions[predictions.length - 1];

        // If time horizon matches, use it; otherwise use the latest
        for (uint256 i = predictions.length - 1; i >= 0; i--) {
            if (predictions[i].timeHorizon == timeHorizon) {
                latestPrediction = predictions[i];
                break;
            }
        }

        return (
            latestPrediction.predictedVolatility,
            latestPrediction.confidence,
            latestPrediction.isHighVolatility
        );
    }

    // ============ UTILITY FUNCTIONS ============

    /**
     * @dev Calculate volatility based on price changes
     * @param token Token address
     * @param currentPrice Current price
     * @return volatility Volatility percentage
     */
    function _calculateVolatility(address token, uint256 currentPrice) internal view returns (uint256) {
        MarketData[] memory history = marketDataHistory[token];
        if (history.length < 2) {
            return 0;
        }

        // Simple volatility calculation to avoid overflow
        uint256 volatility = 0;
        
        // Just use the latest price for simple calculation
        if (history[history.length - 1].price > 0) {
            uint256 priceChange;
            if (currentPrice > history[history.length - 1].price) {
                priceChange = currentPrice - history[history.length - 1].price;
            } else {
                priceChange = history[history.length - 1].price - currentPrice;
            }
            
            // Simple percentage calculation
            if (priceChange > 0) {
                volatility = (priceChange * 100) / history[history.length - 1].price;
                // Cap volatility at 100%
                if (volatility > 100) {
                    volatility = 100;
                }
            }
        }

        return volatility;
    }

    /**
     * @dev Get current volatility for a token
     * @param token Token address
     * @return volatility Current volatility percentage
     */
    function _getCurrentVolatility(address token) internal view returns (uint256) {
        MarketData[] memory history = marketDataHistory[token];
        if (history.length == 0) {
            return 0;
        }
        return history[history.length - 1].volatility;
    }

    /**
     * @dev Get current sentiment for a token
     * @param token Token address
     * @return sentiment Current sentiment score
     */
    function _getCurrentSentiment(address token) internal view returns (int256) {
        SentimentData[] memory history = sentimentHistory[token];
        if (history.length == 0) {
            return 0;
        }
        return history[history.length - 1].sentimentScore;
    }

    /**
     * @dev Get correlation between two tokens
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return correlation Correlation value (-100 to +100)
     */
    function _getCorrelation(address tokenA, address tokenB) internal view returns (int256) {
        bytes32 key = _getCorrelationKey(tokenA, tokenB);
        return correlationMatrix[key].correlation;
    }

    /**
     * @dev Calculate confidence based on data quality
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return confidence Confidence level (0-100)
     */
    function _calculateConfidence(address tokenA, address tokenB) internal view returns (uint256) {
        uint256 dataPointsA = marketDataHistory[tokenA].length;
        uint256 dataPointsB = marketDataHistory[tokenB].length;
        
        uint256 minDataPointsLocal = Math.min(dataPointsA, dataPointsB);
        uint256 maxDataPoints = Math.max(dataPointsA, dataPointsB);
        
        // Base confidence on data availability
        uint256 baseConfidence = Math.min((minDataPointsLocal * 100) / this.minDataPoints(), 100);
        
        // Adjust for data consistency
        if (maxDataPoints > 0) {
            uint256 consistency = (minDataPointsLocal * 100) / maxDataPoints;
            baseConfidence = (baseConfidence + consistency) / 2;
        }
        
        return baseConfidence;
    }

    /**
     * @dev Calculate sentiment confidence
     * @param token Token address
     * @return confidence Confidence level (0-100)
     */
    function _calculateSentimentConfidence(address token) internal view returns (uint256) {
        SentimentData[] memory history = sentimentHistory[token];
        if (history.length < 2) {
            return 0;
        }

        // Calculate consistency of recent sentiment data
        uint256 consistency = 0;
        uint256 totalDeviation = 0;

        uint256 startIndex = history.length > 5 ? history.length - 5 : 0;
        for (uint256 i = history.length - 1; i > 0 && i >= startIndex; i--) {
            int256 deviation = history[i].sentimentScore > history[i - 1].sentimentScore ?
                history[i].sentimentScore - history[i - 1].sentimentScore :
                history[i - 1].sentimentScore - history[i].sentimentScore;
            
            // Use unchecked for the calculation
            unchecked {
                if (deviation >= 0) {
                    totalDeviation += uint256(deviation);
                } else {
                    totalDeviation += uint256(-deviation);
                }
            }
        }

        // Simple confidence calculation to avoid overflow
        if (totalDeviation > 0 && history.length > 0) {
            unchecked {
                // Cap the deviation to prevent overflow
                if (totalDeviation > 1000) {
                    totalDeviation = 1000;
                }
                consistency = 100 - (totalDeviation / 10); // Simple scaling
            }
        } else {
            consistency = 100;
        }

        return consistency;
    }

    /**
     * @dev Get correlation key for two tokens
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return key Correlation key
     */
    function _getCorrelationKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenA < tokenB ? tokenA : tokenB, tokenA < tokenB ? tokenB : tokenA));
    }

    /**
     * @dev Initialize default prediction models
     */
    function _initializeDefaultModels() internal {
        _createPredictionModel("profit_prediction", 85);
        _createPredictionModel("volatility_prediction", 78);
        _createPredictionModel("sentiment_analysis", 82);
        _createPredictionModel("correlation_analysis", 88);
    }

    /**
     * @dev Create a new prediction model
     * @param modelType Type of model
     * @param accuracy Initial accuracy
     */
    function _createPredictionModel(string memory modelType, uint256 accuracy) internal {
        modelCounter++;
        predictionModels[modelCounter] = PredictionModel({
            modelId: modelCounter,
            modelType: modelType,
            accuracy: accuracy,
            lastUpdate: block.timestamp,
            isActive: true,
            predictionCount: 0,
            successCount: 0
        });

        emit PredictionModelCreated(modelCounter, modelType, msg.sender);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Update analytics thresholds
     * @param thresholdType Type of threshold to update
     * @param newValue New threshold value
     */
    function updateThreshold(string memory thresholdType, uint256 newValue) external onlyOwner {
        uint256 oldValue;
        
        if (keccak256(bytes(thresholdType)) == keccak256(bytes("volatility"))) {
            oldValue = volatilityThreshold;
            volatilityThreshold = newValue;
        } else if (keccak256(bytes(thresholdType)) == keccak256(bytes("sentiment"))) {
            oldValue = sentimentThreshold;
            sentimentThreshold = newValue;
        } else if (keccak256(bytes(thresholdType)) == keccak256(bytes("minDataPoints"))) {
            oldValue = minDataPoints;
            minDataPoints = newValue;
        } else if (keccak256(bytes(thresholdType)) == keccak256(bytes("maxHistoryLength"))) {
            oldValue = maxHistoryLength;
            maxHistoryLength = newValue;
        } else {
            revert("Invalid threshold type");
        }

        emit AnalyticsThresholdUpdated(thresholdType, oldValue, newValue);
    }

    /**
     * @dev Pause analytics operations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause analytics operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get market data history length for a token
     * @param token Token address
     * @return length Number of data points
     */
    function getMarketDataLength(address token) external view returns (uint256) {
        return marketDataHistory[token].length;
    }

    /**
     * @dev Get sentiment history length for a token
     * @param token Token address
     * @return length Number of sentiment data points
     */
    function getSentimentDataLength(address token) external view returns (uint256) {
        return sentimentHistory[token].length;
    }

    /**
     * @dev Get volatility predictions length for a token
     * @param token Token address
     * @return length Number of volatility predictions
     */
    function getVolatilityPredictionsLength(address token) external view returns (uint256) {
        return volatilityPredictions[token].length;
    }

    /**
     * @dev Get latest market data for a token
     * @param token Token address
     * @return data Latest market data
     */
    function getLatestMarketData(address token) external view returns (MarketData memory) {
        MarketData[] memory history = marketDataHistory[token];
        if (history.length == 0) {
            revert InsufficientDataPoints();
        }
        return history[history.length - 1];
    }

    /**
     * @dev Get latest sentiment data for a token
     * @param token Token address
     * @return data Latest sentiment data
     */
    function getLatestSentimentData(address token) external view returns (SentimentData memory) {
        SentimentData[] memory history = sentimentHistory[token];
        if (history.length == 0) {
            revert InsufficientDataPoints();
        }
        return history[history.length - 1];
    }
}
