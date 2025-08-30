// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title PriceOracle
 * @notice Advanced price oracle system with multiple data sources and validation
 */
contract PriceOracle is Ownable, Pausable, ReentrancyGuard {

    // Price data structure
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        uint256 volume24h;
        uint256 marketCap;
        bool isValid;
    }

    // Oracle source structure
    struct OracleSource {
        address oracle;
        uint256 weight;
        bool isActive;
        uint256 lastUpdate;
        uint256 reliability;
    }

    // Token configuration
    struct TokenConfig {
        address token;
        uint256 heartbeat;
        uint256 deviationThreshold;
        uint256 maxPriceAge;
        bool isSupported;
        mapping(address => bool) authorizedOracles;
    }

    // State variables
    mapping(address => PriceData) public prices;
    mapping(address => OracleSource[]) public oracleSources;
    mapping(address => TokenConfig) public tokenConfigs;
    mapping(address => uint256) public lastPriceUpdate;
    
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MAX_DEVIATION = 5000; // 50%
    uint256 public constant MIN_CONFIDENCE = 7000; // 70%
    
    // Events
    event PriceUpdated(
        address indexed token,
        uint256 price,
        uint256 timestamp,
        uint256 confidence
    );
    
    event OracleAdded(
        address indexed token,
        address indexed oracle,
        uint256 weight
    );
    
    event OracleRemoved(
        address indexed token,
        address indexed oracle
    );
    
    event TokenSupported(
        address indexed token,
        uint256 heartbeat,
        uint256 deviationThreshold
    );
    
    event TokenUnsupported(address indexed token);
    
    event EmergencyPriceUpdate(
        address indexed token,
        uint256 price,
        uint256 timestamp
    );

    // Custom errors
    error InvalidPrice();
    error PriceTooOld();
    error InsufficientConfidence();
    error OracleNotAuthorized();
    error TokenNotSupported();
    error InvalidOracle();
    error DeviationTooHigh();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Add a new oracle source for a token
     * @param token The token address
     * @param oracle The oracle contract address
     * @param weight The weight for this oracle (0-10000)
     */
    function addOracle(
        address token,
        address oracle,
        uint256 weight
    ) external onlyOwner {
        require(weight <= 10000, "Invalid weight");
        require(oracle != address(0), "Invalid oracle address");
        
        OracleSource memory newOracle = OracleSource({
            oracle: oracle,
            weight: weight,
            isActive: true,
            lastUpdate: block.timestamp,
            reliability: 10000 // Start with 100% reliability
        });
        
        oracleSources[token].push(newOracle);
        tokenConfigs[token].authorizedOracles[oracle] = true;
        
        emit OracleAdded(token, oracle, weight);
    }

    /**
     * @notice Remove an oracle source
     * @param token The token address
     * @param oracleIndex The index of the oracle to remove
     */
    function removeOracle(address token, uint256 oracleIndex) external onlyOwner {
        require(oracleIndex < oracleSources[token].length, "Invalid oracle index");
        
        address oracle = oracleSources[token][oracleIndex].oracle;
        oracleSources[token][oracleIndex].isActive = false;
        tokenConfigs[token].authorizedOracles[oracle] = false;
        
        emit OracleRemoved(token, oracle);
    }

    /**
     * @notice Add support for a new token
     * @param token The token address
     * @param heartbeat The heartbeat interval in seconds
     * @param deviationThreshold The maximum allowed deviation (0-10000)
     */
    function addToken(
        address token,
        uint256 heartbeat,
        uint256 deviationThreshold
    ) external onlyOwner {
        require(deviationThreshold <= MAX_DEVIATION, "Deviation too high");
        
        TokenConfig storage config = tokenConfigs[token];
        config.token = token;
        config.heartbeat = heartbeat;
        config.deviationThreshold = deviationThreshold;
        config.maxPriceAge = heartbeat * 3; // 3x heartbeat for max age
        config.isSupported = true;
        
        emit TokenSupported(token, heartbeat, deviationThreshold);
    }

    /**
     * @notice Remove support for a token
     * @param token The token address
     */
    function removeToken(address token) external onlyOwner {
        tokenConfigs[token].isSupported = false;
        emit TokenUnsupported(token);
    }

    /**
     * @notice Update price from an authorized oracle
     * @param token The token address
     * @param price The new price
     * @param confidence The confidence level (0-10000)
     * @param volume24h 24-hour volume
     * @param marketCap Market capitalization
     */
    function updatePrice(
        address token,
        uint256 price,
        uint256 confidence,
        uint256 volume24h,
        uint256 marketCap
    ) external nonReentrant {
        require(tokenConfigs[token].isSupported, "Token not supported");
        require(tokenConfigs[token].authorizedOracles[msg.sender], "Oracle not authorized");
        require(price > 0, "Invalid price");
        require(confidence >= MIN_CONFIDENCE, "Insufficient confidence");
        
        // Validate price deviation
        PriceData storage currentPrice = prices[token];
        if (currentPrice.isValid && currentPrice.price > 0) {
            uint256 deviation = _calculateDeviation(currentPrice.price, price);
            require(deviation <= tokenConfigs[token].deviationThreshold, "Deviation too high");
        }
        
        // Update price data
        prices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            volume24h: volume24h,
            marketCap: marketCap,
            isValid: true
        });
        
        lastPriceUpdate[token] = block.timestamp;
        
        // Update oracle reliability
        _updateOracleReliability(token, msg.sender, true);
        
        emit PriceUpdated(token, price, block.timestamp, confidence);
    }

    /**
     * @notice Get the latest price for a token
     * @param token The token address
     * @return price The current price
     * @return timestamp The price timestamp
     * @return confidence The confidence level
     */
    function getPrice(address token) 
        external 
        view 
        returns (uint256 price, uint256 timestamp, uint256 confidence) 
    {
        require(tokenConfigs[token].isSupported, "Token not supported");
        
        PriceData storage priceData = prices[token];
        require(priceData.isValid, "No valid price");
        require(
            block.timestamp - priceData.timestamp <= tokenConfigs[token].maxPriceAge,
            "Price too old"
        );
        
        return (priceData.price, priceData.timestamp, priceData.confidence);
    }

    /**
     * @notice Get weighted average price from multiple oracles
     * @param token The token address
     * @return price The weighted average price
     * @return confidence The weighted confidence
     */
    function getWeightedPrice(address token) 
        external 
        view 
        returns (uint256 price, uint256 confidence) 
    {
        require(tokenConfigs[token].isSupported, "Token not supported");
        
        OracleSource[] storage sources = oracleSources[token];
        require(sources.length > 0, "No oracle sources");
        
        uint256 totalWeight = 0;
        uint256 weightedPrice = 0;
        uint256 weightedConfidence = 0;
        
        for (uint256 i = 0; i < sources.length; i++) {
            OracleSource storage source = sources[i];
            if (source.isActive && source.reliability > 5000) { // Only use reliable oracles
                // Get price from oracle (this would need to be implemented based on oracle interface)
                // For now, we'll use the stored price
                PriceData storage priceData = prices[token];
                if (priceData.isValid) {
                    uint256 effectiveWeight = source.weight * source.reliability / 10000;
                    weightedPrice = weightedPrice + (priceData.price * effectiveWeight);
                    weightedConfidence = weightedConfidence + (priceData.confidence * effectiveWeight);
                    totalWeight = totalWeight + effectiveWeight;
                }
            }
        }
        
        require(totalWeight > 0, "No valid oracle data");
        
        price = weightedPrice / totalWeight;
        confidence = weightedConfidence / totalWeight;
        
        return (price, confidence);
    }

    /**
     * @notice Emergency price update (owner only)
     * @param token The token address
     * @param price The emergency price
     */
    function emergencyPriceUpdate(address token, uint256 price) external onlyOwner {
        require(tokenConfigs[token].isSupported, "Token not supported");
        require(price > 0, "Invalid price");
        
        prices[token].price = price;
        prices[token].timestamp = block.timestamp;
        prices[token].confidence = 10000; // Full confidence for emergency updates
        prices[token].isValid = true;
        
        lastPriceUpdate[token] = block.timestamp;
        
        emit EmergencyPriceUpdate(token, price, block.timestamp);
    }

    /**
     * @notice Check if a price is stale
     * @param token The token address
     * @return isStale True if price is stale
     */
    function isPriceStale(address token) external view returns (bool isStale) {
        if (!tokenConfigs[token].isSupported) return true;
        
        PriceData storage priceData = prices[token];
        if (!priceData.isValid) return true;
        
        return block.timestamp - priceData.timestamp > tokenConfigs[token].maxPriceAge;
    }

    /**
     * @notice Get token configuration
     * @param token The token address
     * @return heartbeat The heartbeat interval
     * @return deviationThreshold The deviation threshold
     * @return maxPriceAge The maximum price age
     * @return isSupported Whether the token is supported
     */
    function getTokenConfig(address token) 
        external 
        view 
        returns (
            uint256 heartbeat,
            uint256 deviationThreshold,
            uint256 maxPriceAge,
            bool isSupported
        ) 
    {
        TokenConfig storage config = tokenConfigs[token];
        return (
            config.heartbeat,
            config.deviationThreshold,
            config.maxPriceAge,
            config.isSupported
        );
    }

    /**
     * @notice Get oracle sources for a token
     * @param token The token address
     * @return oracles Array of oracle addresses
     * @return weights Array of oracle weights
     * @return reliabilities Array of oracle reliabilities
     */
    function getOracleSources(address token) 
        external 
        view 
        returns (
            address[] memory oracles,
            uint256[] memory weights,
            uint256[] memory reliabilities
        ) 
    {
        OracleSource[] storage sources = oracleSources[token];
        uint256 activeCount = 0;
        
        // Count active oracles
        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i].isActive) activeCount++;
        }
        
        oracles = new address[](activeCount);
        weights = new uint256[](activeCount);
        reliabilities = new uint256[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i].isActive) {
                oracles[index] = sources[i].oracle;
                weights[index] = sources[i].weight;
                reliabilities[index] = sources[i].reliability;
                index++;
            }
        }
    }

    /**
     * @notice Pause the oracle system
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the oracle system
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // Internal functions

    /**
     * @notice Calculate price deviation percentage
     * @param oldPrice The old price
     * @param newPrice The new price
     * @return deviation The deviation percentage (0-10000)
     */
    function _calculateDeviation(uint256 oldPrice, uint256 newPrice) 
        internal 
        pure 
        returns (uint256 deviation) 
    {
        if (oldPrice == 0) return 0;
        
        uint256 difference = oldPrice > newPrice ? 
            oldPrice - newPrice : newPrice - oldPrice;
        
        return (difference * 10000) / oldPrice;
    }

    /**
     * @notice Update oracle reliability based on performance
     * @param token The token address
     * @param oracle The oracle address
     * @param success Whether the update was successful
     */
    function _updateOracleReliability(
        address token,
        address oracle,
        bool success
    ) internal {
        OracleSource[] storage sources = oracleSources[token];
        
        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i].oracle == oracle) {
                if (success) {
                    // Increase reliability slightly
                    sources[i].reliability = sources[i].reliability + 100;
                    if (sources[i].reliability > 10000) {
                        sources[i].reliability = 10000;
                    }
                } else {
                    // Decrease reliability significantly
                    sources[i].reliability = sources[i].reliability - 1000;
                    if (sources[i].reliability < 1000) {
                        sources[i].reliability = 1000;
                    }
                }
                sources[i].lastUpdate = block.timestamp;
                break;
            }
        }
    }
}
