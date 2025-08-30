// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MarketVolatilityBreaker
 * @notice Circuit breaker system for detecting and responding to market volatility
 * @dev Monitors price movements, volume spikes, and arbitrage opportunities for volatility
 */
contract MarketVolatilityBreaker is Ownable, Pausable, ReentrancyGuard {

    // Volatility thresholds and configuration
    struct VolatilityConfig {
        uint256 priceChangeThreshold;    // Maximum allowed price change percentage (basis points)
        uint256 volumeSpikeThreshold;    // Maximum allowed volume increase percentage
        uint256 arbitrageProfitThreshold; // Maximum allowed arbitrage profit percentage
        uint256 timeWindow;              // Time window for volatility calculation (seconds)
        uint256 cooldownPeriod;          // Cooldown period after breaker triggers (seconds)
        bool isActive;                   // Whether this config is active
    }

    // Market state tracking
    struct MarketState {
        uint256 lastPrice;               // Last recorded price
        uint256 lastVolume;              // Last recorded volume
        uint256 lastUpdateTime;          // Last update timestamp
        uint256 priceChangeCount;        // Number of significant price changes
        uint256 volumeSpikeCount;        // Number of volume spikes
        uint256 arbitrageCount;          // Number of arbitrage opportunities
        bool isVolatile;                 // Whether market is currently volatile
    }

    // Circuit breaker state
    struct CircuitBreakerState {
        bool isOpen;                     // Whether circuit breaker is open
        uint256 triggerTime;             // When breaker was triggered
        uint256 triggerReason;           // Reason for triggering (1=price, 2=volume, 3=arbitrage)
        uint256 recoveryAttempts;        // Number of recovery attempts
        uint256 maxRecoveryAttempts;     // Maximum recovery attempts allowed
    }

    // State variables
    mapping(address => VolatilityConfig) public volatilityConfigs;
    mapping(address => MarketState) public marketStates;
    mapping(address => CircuitBreakerState) public circuitBreakers;
    
    // Global settings
    uint256 public globalPriceChangeThreshold;
    uint256 public globalVolumeSpikeThreshold;
    uint256 public globalArbitrageProfitThreshold;
    uint256 public globalTimeWindow;
    uint256 public globalCooldownPeriod;
    
    bool public emergencyStop;
    uint256 public emergencyStopTime;
    
    // Statistics
    uint256 public totalBreakerTriggers;
    uint256 public totalRecoveryAttempts;
    uint256 public totalSuccessfulRecoveries;
    
    // Events
    event VolatilityDetected(
        address indexed token,
        uint256 indexed reason,
        uint256 priceChange,
        uint256 volumeChange,
        uint256 arbitrageProfit
    );
    
    event CircuitBreakerOpened(
        address indexed token,
        uint256 indexed reason,
        uint256 triggerTime
    );
    
    event CircuitBreakerClosed(
        address indexed token,
        uint256 recoveryAttempts
    );
    
    event VolatilityConfigUpdated(
        address indexed token,
        uint256 priceThreshold,
        uint256 volumeThreshold,
        uint256 arbitrageThreshold
    );
    
    event EmergencyStopActivated(address indexed by, uint256 timestamp);
    event EmergencyStopDeactivated(address indexed by, uint256 timestamp);

    // Custom errors
    error CircuitBreakerOpenError(address token, uint256 reason);
    error EmergencyStopActiveError();
    error InvalidVolatilityConfig();
    error CooldownPeriodNotElapsed();
    error MaxRecoveryAttemptsExceeded();
    error InvalidPriceData();
    error InvalidVolumeData();

    constructor() Ownable(msg.sender) {
        // Set default global thresholds (in basis points)
        globalPriceChangeThreshold = 500;    // 5% price change
        globalVolumeSpikeThreshold = 1000;   // 10x volume increase
        globalArbitrageProfitThreshold = 200; // 2% arbitrage profit
        globalTimeWindow = 300;              // 5 minutes
        globalCooldownPeriod = 1800;         // 30 minutes
    }

    /**
     * @notice Check if market is stable enough for arbitrage
     * @param token Token address to check
     * @param currentPrice Current token price
     * @param currentVolume Current trading volume
     * @param arbitrageProfit Expected arbitrage profit percentage
     * @return stable Whether market is stable
     * @return reason Reason for instability (0 if stable)
     */
    function checkMarketStability(
        address token,
        uint256 currentPrice,
        uint256 currentVolume,
        uint256 arbitrageProfit
    ) external returns (bool stable, uint256 reason) {
        require(!emergencyStop, "Emergency stop is active");
        
        // Check if circuit breaker is open
        CircuitBreakerState storage breaker = circuitBreakers[token];
        if (breaker.isOpen) {
            // Check if cooldown period has elapsed
            if (block.timestamp - breaker.triggerTime < getCooldownPeriod(token)) {
                revert CircuitBreakerOpenError(token, breaker.triggerReason);
            }
            
            // Attempt recovery
            if (breaker.recoveryAttempts >= breaker.maxRecoveryAttempts) {
                revert MaxRecoveryAttemptsExceeded();
            }
            
            breaker.recoveryAttempts++;
            totalRecoveryAttempts++;
            
            // Check if market has stabilized
            if (checkMarketStabilization(token, currentPrice, currentVolume, arbitrageProfit)) {
                breaker.isOpen = false;
                breaker.triggerReason = 0;
                totalSuccessfulRecoveries++;
                emit CircuitBreakerClosed(token, breaker.recoveryAttempts);
            } else {
                revert CircuitBreakerOpenError(token, breaker.triggerReason);
            }
        }
        
        // Check for new volatility
        reason = detectVolatility(token, currentPrice, currentVolume, arbitrageProfit);
        
        if (reason > 0) {
            // Trigger circuit breaker
            triggerCircuitBreaker(token, reason);
            return (false, reason);
        }
        
        // Update market state
        updateMarketState(token, currentPrice, currentVolume);
        
        return (true, 0);
    }

    /**
     * @notice Set volatility configuration for a specific token
     * @param token Token address
     * @param priceThreshold Price change threshold (basis points)
     * @param volumeThreshold Volume spike threshold (percentage)
     * @param arbitrageThreshold Arbitrage profit threshold (basis points)
     * @param timeWindow Time window for calculations (seconds)
     * @param cooldownPeriod Cooldown period (seconds)
     */
    function setVolatilityConfig(
        address token,
        uint256 priceThreshold,
        uint256 volumeThreshold,
        uint256 arbitrageThreshold,
        uint256 timeWindow,
        uint256 cooldownPeriod
    ) external onlyOwner {
        if (priceThreshold == 0 || volumeThreshold == 0 || arbitrageThreshold == 0 || 
            timeWindow == 0 || cooldownPeriod == 0) {
            revert InvalidVolatilityConfig();
        }
        
        volatilityConfigs[token] = VolatilityConfig({
            priceChangeThreshold: priceThreshold,
            volumeSpikeThreshold: volumeThreshold,
            arbitrageProfitThreshold: arbitrageThreshold,
            timeWindow: timeWindow,
            cooldownPeriod: cooldownPeriod,
            isActive: true
        });
        
        emit VolatilityConfigUpdated(token, priceThreshold, volumeThreshold, arbitrageThreshold);
    }

    /**
     * @notice Update global volatility thresholds
     * @param priceThreshold Global price change threshold
     * @param volumeThreshold Global volume spike threshold
     * @param arbitrageThreshold Global arbitrage profit threshold
     * @param timeWindow Global time window
     * @param cooldownPeriod Global cooldown period
     */
    function updateGlobalThresholds(
        uint256 priceThreshold,
        uint256 volumeThreshold,
        uint256 arbitrageThreshold,
        uint256 timeWindow,
        uint256 cooldownPeriod
    ) external onlyOwner {
        globalPriceChangeThreshold = priceThreshold;
        globalVolumeSpikeThreshold = volumeThreshold;
        globalArbitrageProfitThreshold = arbitrageThreshold;
        globalTimeWindow = timeWindow;
        globalCooldownPeriod = cooldownPeriod;
    }

    /**
     * @notice Manually trigger circuit breaker for a token
     * @param token Token address
     * @param reason Reason for triggering
     */
    function manualTriggerBreaker(address token, uint256 reason) external onlyOwner {
        triggerCircuitBreaker(token, reason);
    }

    /**
     * @notice Manually close circuit breaker for a token
     * @param token Token address
     */
    function manualCloseBreaker(address token) external onlyOwner {
        CircuitBreakerState storage breaker = circuitBreakers[token];
        breaker.isOpen = false;
        breaker.triggerReason = 0;
        breaker.recoveryAttempts = 0;
        emit CircuitBreakerClosed(token, 0);
    }

    /**
     * @notice Activate emergency stop
     */
    function activateEmergencyStop() external onlyOwner {
        emergencyStop = true;
        emergencyStopTime = block.timestamp;
        emit EmergencyStopActivated(msg.sender, block.timestamp);
    }

    /**
     * @notice Deactivate emergency stop
     */
    function deactivateEmergencyStop() external onlyOwner {
        emergencyStop = false;
        emit EmergencyStopDeactivated(msg.sender, block.timestamp);
    }

    /**
     * @notice Get current market state for a token
     * @param token Token address
     * @return lastPrice Last recorded price
     * @return lastVolume Last recorded volume
     * @return lastUpdateTime Last update timestamp
     * @return isVolatile Whether market is volatile
     */
    function getMarketState(address token) 
        external 
        view 
        returns (uint256 lastPrice, uint256 lastVolume, uint256 lastUpdateTime, bool isVolatile) 
    {
        MarketState storage state = marketStates[token];
        return (state.lastPrice, state.lastVolume, state.lastUpdateTime, state.isVolatile);
    }

    /**
     * @notice Get circuit breaker state for a token
     * @param token Token address
     * @return isOpen Whether breaker is open
     * @return triggerTime When breaker was triggered
     * @return triggerReason Reason for triggering
     * @return recoveryAttempts Number of recovery attempts
     */
    function getCircuitBreakerState(address token)
        external
        view
        returns (bool isOpen, uint256 triggerTime, uint256 triggerReason, uint256 recoveryAttempts)
    {
        CircuitBreakerState storage breaker = circuitBreakers[token];
        return (breaker.isOpen, breaker.triggerTime, breaker.triggerReason, breaker.recoveryAttempts);
    }

    /**
     * @notice Get volatility configuration for a token
     * @param token Token address
     * @return config Volatility configuration
     */
    function getVolatilityConfig(address token) 
        external 
        view 
        returns (VolatilityConfig memory config) 
    {
        return volatilityConfigs[token];
    }

    // Internal functions
    function detectVolatility(
        address token,
        uint256 currentPrice,
        uint256 currentVolume,
        uint256 arbitrageProfit
    ) internal returns (uint256 reason) {
        MarketState storage state = marketStates[token];
        VolatilityConfig storage config = getEffectiveConfig(token);
        
        // Check price volatility
        if (state.lastPrice > 0 && currentPrice > 0) {
            uint256 priceChange = calculatePriceChange(state.lastPrice, currentPrice);
            if (priceChange > config.priceChangeThreshold) {
                state.priceChangeCount++;
                emit VolatilityDetected(token, 1, priceChange, 0, 0);
                return 1; // Price volatility
            }
        }
        
        // Check volume volatility
        if (state.lastVolume > 0 && currentVolume > 0) {
            uint256 volumeChange = calculateVolumeChange(state.lastVolume, currentVolume);
            if (volumeChange > config.volumeSpikeThreshold) {
                state.volumeSpikeCount++;
                emit VolatilityDetected(token, 2, 0, volumeChange, 0);
                return 2; // Volume volatility
            }
        }
        
        // Check arbitrage profit volatility
        if (arbitrageProfit > config.arbitrageProfitThreshold) {
            state.arbitrageCount++;
            emit VolatilityDetected(token, 3, 0, 0, arbitrageProfit);
            return 3; // Arbitrage profit volatility
        }
        
        return 0; // No volatility detected
    }

    function triggerCircuitBreaker(address token, uint256 reason) internal {
        CircuitBreakerState storage breaker = circuitBreakers[token];
        breaker.isOpen = true;
        breaker.triggerTime = block.timestamp;
        breaker.triggerReason = reason;
        breaker.maxRecoveryAttempts = 5; // Default max attempts
        
        totalBreakerTriggers++;
        emit CircuitBreakerOpened(token, reason, block.timestamp);
    }

    function checkMarketStabilization(
        address token,
        uint256 currentPrice,
        uint256 currentVolume,
        uint256 arbitrageProfit
    ) internal returns (bool) {
        // Check if volatility has decreased below thresholds
        uint256 reason = detectVolatility(token, currentPrice, currentVolume, arbitrageProfit);
        return reason == 0;
    }

    function updateMarketState(
        address token,
        uint256 currentPrice,
        uint256 currentVolume
    ) internal {
        MarketState storage state = marketStates[token];
        state.lastPrice = currentPrice;
        state.lastVolume = currentVolume;
        state.lastUpdateTime = block.timestamp;
        state.isVolatile = false;
    }

    function getEffectiveConfig(address token) internal view returns (VolatilityConfig storage) {
        VolatilityConfig storage config = volatilityConfigs[token];
        if (config.isActive) {
            return config;
        }
        
        // Return global config as fallback
        // Note: This is a simplified implementation
        revert("No active config found");
    }

    function getCooldownPeriod(address token) internal view returns (uint256) {
        VolatilityConfig storage config = volatilityConfigs[token];
        if (config.isActive) {
            return config.cooldownPeriod;
        }
        return globalCooldownPeriod;
    }

    function calculatePriceChange(uint256 oldPrice, uint256 newPrice) internal pure returns (uint256) {
        if (oldPrice == 0) return 0;
        
        uint256 change;
        if (newPrice > oldPrice) {
            change = newPrice - oldPrice;
        } else {
            change = oldPrice - newPrice;
        }
        
        return change * 10000 / oldPrice; // Return in basis points
    }

    function calculateVolumeChange(uint256 oldVolume, uint256 newVolume) internal pure returns (uint256) {
        if (oldVolume == 0) return 0;
        
        if (newVolume > oldVolume) {
            return newVolume * 100 / oldVolume; // Return as percentage
        }
        return 0;
    }

    /**
     * @notice Pause the contract (emergency function)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
