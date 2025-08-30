// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RateLimiter
 * @notice Production-grade rate limiting system with circuit breaker functionality
 * @dev Provides configurable rate limits, throttling, and emergency circuit breakers
 */
contract RateLimiter is Ownable, Pausable, ReentrancyGuard {

    // Rate limiting configuration
    struct RateLimit {
        uint256 maxRequests;        // Maximum requests per time window
        uint256 timeWindow;         // Time window in seconds
        uint256 currentRequests;    // Current requests in window
        uint256 windowStart;        // Start time of current window
        bool isActive;              // Whether this rate limit is active
    }

    // Circuit breaker configuration
    struct CircuitBreaker {
        uint256 failureThreshold;   // Number of failures before triggering
        uint256 recoveryTime;       // Time to wait before attempting recovery
        uint256 failureCount;       // Current failure count
        uint256 lastFailureTime;    // Timestamp of last failure
        bool isOpen;                // Whether circuit breaker is open
        bool isActive;              // Whether circuit breaker is active
    }

    // Throttling configuration
    struct ThrottleConfig {
        uint256 minDelay;           // Minimum delay between requests (seconds)
        uint256 maxDelay;           // Maximum delay between requests (seconds)
        uint256 currentDelay;       // Current delay being applied
        uint256 backoffMultiplier;  // Multiplier for exponential backoff
        bool isActive;              // Whether throttling is active
    }

    // State variables
    mapping(bytes32 => RateLimit) public rateLimits;
    mapping(bytes32 => CircuitBreaker) public circuitBreakers;
    mapping(bytes32 => ThrottleConfig) public throttleConfigs;
    
    mapping(address => uint256) public userLastRequestTime;
    mapping(address => uint256) public userRequestCount;
    
    uint256 private _requestIdCounter;
    
    // Global settings
    uint256 public globalMaxRequestsPerSecond;
    uint256 public globalMaxRequestsPerMinute;
    uint256 public globalMaxRequestsPerHour;
    
    bool public emergencyStop;
    uint256 public emergencyStopTime;
    
    // Events
    event RateLimitExceeded(bytes32 indexed limitId, address indexed user, uint256 requestCount);
    event CircuitBreakerOpened(bytes32 indexed breakerId, uint256 failureCount);
    event CircuitBreakerClosed(bytes32 indexed breakerId);
    event ThrottleApplied(bytes32 indexed throttleId, address indexed user, uint256 delay);
    event EmergencyStopActivated(address indexed by, uint256 timestamp);
    event EmergencyStopDeactivated(address indexed by, uint256 timestamp);
    event RateLimitUpdated(bytes32 indexed limitId, uint256 maxRequests, uint256 timeWindow);
    event CircuitBreakerUpdated(bytes32 indexed breakerId, uint256 failureThreshold, uint256 recoveryTime);
    event ThrottleConfigUpdated(bytes32 indexed throttleId, uint256 minDelay, uint256 maxDelay);

    // Custom errors
    error RateLimitExceededError(bytes32 limitId, uint256 current, uint256 max);
    error CircuitBreakerOpenError(bytes32 breakerId);
    error EmergencyStopActiveError();
    error InvalidRateLimitConfig();
    error InvalidCircuitBreakerConfig();
    error InvalidThrottleConfig();
    error RecoveryTimeNotElapsed();

    constructor() Ownable(msg.sender) {
        globalMaxRequestsPerSecond = 10;
        globalMaxRequestsPerMinute = 100;
        globalMaxRequestsPerHour = 1000;
    }

    /**
     * @notice Check if a request is allowed based on rate limits
     * @param limitId Unique identifier for the rate limit
     * @param user Address of the user making the request
     * @return allowed Whether the request is allowed
     * @return delay Additional delay to apply (if throttling)
     */
    function checkRateLimit(bytes32 limitId, address user) 
        external 
        returns (bool allowed, uint256 delay) 
    {
        require(!emergencyStop, "Emergency stop is active");
        
        // Check global rate limits
        if (!checkGlobalRateLimits(user)) {
            return (false, 0);
        }
        
        // Check specific rate limit
        RateLimit storage limit = rateLimits[limitId];
        if (limit.isActive && !checkSpecificRateLimit(limitId, user)) {
            return (false, 0);
        }
        
        // Check circuit breaker
        CircuitBreaker storage breaker = circuitBreakers[limitId];
        if (breaker.isActive && breaker.isOpen) {
            if (block.timestamp - breaker.lastFailureTime < breaker.recoveryTime) {
                revert CircuitBreakerOpenError(limitId);
            } else {
                // Attempt recovery
                breaker.isOpen = false;
                breaker.failureCount = 0;
                emit CircuitBreakerClosed(limitId);
            }
        }
        
        // Apply throttling
        delay = calculateThrottleDelay(limitId, user);
        
        // Update user request tracking
        userLastRequestTime[user] = block.timestamp;
        userRequestCount[user]++;
        
        return (true, delay);
    }

    /**
     * @notice Record a successful request
     * @param limitId Rate limit identifier
     */
    function recordSuccess(bytes32 limitId) external {
        CircuitBreaker storage breaker = circuitBreakers[limitId];
        if (breaker.isActive && breaker.failureCount > 0) {
            breaker.failureCount = 0;
        }
    }

    /**
     * @notice Record a failed request and potentially trigger circuit breaker
     * @param limitId Rate limit identifier
     */
    function recordFailure(bytes32 limitId) external {
        CircuitBreaker storage breaker = circuitBreakers[limitId];
        if (breaker.isActive) {
            breaker.failureCount++;
            breaker.lastFailureTime = block.timestamp;
            
            if (breaker.failureCount >= breaker.failureThreshold) {
                breaker.isOpen = true;
                emit CircuitBreakerOpened(limitId, breaker.failureCount);
            }
        }
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
     * @notice Set up a new rate limit
     * @param limitId Unique identifier
     * @param maxRequests Maximum requests per time window
     * @param timeWindow Time window in seconds
     */
    function setRateLimit(
        bytes32 limitId, 
        uint256 maxRequests, 
        uint256 timeWindow
    ) external onlyOwner {
        if (maxRequests == 0 || timeWindow == 0) {
            revert InvalidRateLimitConfig();
        }
        
        rateLimits[limitId] = RateLimit({
            maxRequests: maxRequests,
            timeWindow: timeWindow,
            currentRequests: 0,
            windowStart: block.timestamp,
            isActive: true
        });
        
        emit RateLimitUpdated(limitId, maxRequests, timeWindow);
    }

    /**
     * @notice Set up a new circuit breaker
     * @param breakerId Unique identifier
     * @param failureThreshold Number of failures before triggering
     * @param recoveryTime Time to wait before recovery attempt
     */
    function setCircuitBreaker(
        bytes32 breakerId,
        uint256 failureThreshold,
        uint256 recoveryTime
    ) external onlyOwner {
        if (failureThreshold == 0 || recoveryTime == 0) {
            revert InvalidCircuitBreakerConfig();
        }
        
        circuitBreakers[breakerId] = CircuitBreaker({
            failureThreshold: failureThreshold,
            recoveryTime: recoveryTime,
            failureCount: 0,
            lastFailureTime: 0,
            isOpen: false,
            isActive: true
        });
        
        emit CircuitBreakerUpdated(breakerId, failureThreshold, recoveryTime);
    }

    /**
     * @notice Set up throttling configuration
     * @param throttleId Unique identifier
     * @param minDelay Minimum delay between requests
     * @param maxDelay Maximum delay between requests
     * @param backoffMultiplier Multiplier for exponential backoff
     */
    function setThrottleConfig(
        bytes32 throttleId,
        uint256 minDelay,
        uint256 maxDelay,
        uint256 backoffMultiplier
    ) external onlyOwner {
        if (minDelay > maxDelay || backoffMultiplier == 0) {
            revert InvalidThrottleConfig();
        }
        
        throttleConfigs[throttleId] = ThrottleConfig({
            minDelay: minDelay,
            maxDelay: maxDelay,
            currentDelay: minDelay,
            backoffMultiplier: backoffMultiplier,
            isActive: true
        });
        
        emit ThrottleConfigUpdated(throttleId, minDelay, maxDelay);
    }

    /**
     * @notice Update global rate limits
     * @param perSecond Maximum requests per second
     * @param perMinute Maximum requests per minute
     * @param perHour Maximum requests per hour
     */
    function updateGlobalRateLimits(
        uint256 perSecond,
        uint256 perMinute,
        uint256 perHour
    ) external onlyOwner {
        globalMaxRequestsPerSecond = perSecond;
        globalMaxRequestsPerMinute = perMinute;
        globalMaxRequestsPerHour = perHour;
    }

    /**
     * @notice Disable a rate limit
     * @param limitId Rate limit identifier
     */
    function disableRateLimit(bytes32 limitId) external onlyOwner {
        rateLimits[limitId].isActive = false;
    }

    /**
     * @notice Disable a circuit breaker
     * @param breakerId Circuit breaker identifier
     */
    function disableCircuitBreaker(bytes32 breakerId) external onlyOwner {
        circuitBreakers[breakerId].isActive = false;
    }

    /**
     * @notice Disable throttling
     * @param throttleId Throttle identifier
     */
    function disableThrottle(bytes32 throttleId) external onlyOwner {
        throttleConfigs[throttleId].isActive = false;
    }

    /**
     * @notice Get current rate limit status
     * @param limitId Rate limit identifier
     * @return current Current requests in window
     * @return max Maximum requests allowed
     * @return windowStart Start time of current window
     * @return isActive Whether limit is active
     */
    function getRateLimitStatus(bytes32 limitId) 
        external 
        view 
        returns (uint256 current, uint256 max, uint256 windowStart, bool isActive) 
    {
        RateLimit storage limit = rateLimits[limitId];
        return (limit.currentRequests, limit.maxRequests, limit.windowStart, limit.isActive);
    }

    /**
     * @notice Get circuit breaker status
     * @param breakerId Circuit breaker identifier
     * @return failureCount Current failure count
     * @return threshold Failure threshold
     * @return isOpen Whether breaker is open
     * @return isActive Whether breaker is active
     */
    function getCircuitBreakerStatus(bytes32 breakerId)
        external
        view
        returns (uint256 failureCount, uint256 threshold, bool isOpen, bool isActive)
    {
        CircuitBreaker storage breaker = circuitBreakers[breakerId];
        return (breaker.failureCount, breaker.failureThreshold, breaker.isOpen, breaker.isActive);
    }

    // Internal functions
    function checkGlobalRateLimits(address user) internal view returns (bool) {
        uint256 userCount = userRequestCount[user];
        uint256 timeSinceLastRequest = block.timestamp - userLastRequestTime[user];
        
        // Check per-second limit
        if (timeSinceLastRequest < 1 && userCount > globalMaxRequestsPerSecond) {
            return false;
        }
        
        // Check per-minute limit (simplified)
        if (timeSinceLastRequest < 60 && userCount > globalMaxRequestsPerMinute) {
            return false;
        }
        
        return true;
    }

    function checkSpecificRateLimit(bytes32 limitId, address user) internal returns (bool) {
        RateLimit storage limit = rateLimits[limitId];
        
        // Reset window if needed
        if (block.timestamp - limit.windowStart >= limit.timeWindow) {
            limit.currentRequests = 0;
            limit.windowStart = block.timestamp;
        }
        
        // Check if limit would be exceeded
        if (limit.currentRequests >= limit.maxRequests) {
            emit RateLimitExceeded(limitId, user, limit.currentRequests);
            return false;
        }
        
        // Increment request count
        limit.currentRequests++;
        return true;
    }

    function calculateThrottleDelay(bytes32 throttleId, address user) internal returns (uint256) {
        ThrottleConfig storage throttle = throttleConfigs[throttleId];
        if (!throttle.isActive) {
            return 0;
        }
        
        uint256 timeSinceLastRequest = block.timestamp - userLastRequestTime[user];
        
        // If enough time has passed, reset delay
        if (timeSinceLastRequest >= throttle.currentDelay) {
            return 0;
        }
        
        // Calculate remaining delay
        uint256 remainingDelay = throttle.currentDelay - timeSinceLastRequest;
        
        // Apply exponential backoff if needed
        if (remainingDelay > 0) {
            throttle.currentDelay = throttle.currentDelay * throttle.backoffMultiplier / 100;
            if (throttle.currentDelay > throttle.maxDelay) {
                throttle.currentDelay = throttle.maxDelay;
            }
        }
        
        emit ThrottleApplied(throttleId, user, remainingDelay);
        return remainingDelay;
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
