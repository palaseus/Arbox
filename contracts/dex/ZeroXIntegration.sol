// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ZeroXIntegration
 * @notice Integration with 0x Protocol for advanced DEX aggregation and RFQ
 * @dev Provides access to 0x's aggregation protocol and RFQ system
 */
contract ZeroXIntegration is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // 0x Protocol addresses
    address public constant ZEROX_EXCHANGE_PROXY = 0xDef1C0ded9bec7F1a1670819833240f027b25EfF;
    address public constant ZEROX_TRANSFORMER_DEPLOYER = 0x4C36388be6F416A29c8D8Ed537D4B4F4c6A3B5d5;
    
    // State variables
    mapping(address => bool) public authorizedOperators;
    mapping(bytes32 => bool) public executedOrders;
    mapping(address => uint256) public tokenBalances;
    
    uint256 public totalOrders;
    uint256 public totalVolume;
    uint256 public minProfitThreshold;
    uint256 public maxSlippage;
    uint256 public quoteExpiryTime;
    
    // Events
    event OrderExecuted(
        address indexed makerToken,
        address indexed takerToken,
        uint256 makerAmount,
        uint256 takerAmount,
        address indexed maker,
        bytes32 orderHash
    );
    
    event OrderFailed(
        address indexed makerToken,
        address indexed takerToken,
        uint256 makerAmount,
        string reason,
        bytes32 orderHash
    );
    
    event QuoteReceived(
        address indexed makerToken,
        address indexed takerToken,
        uint256 makerAmount,
        uint256 takerAmount,
        uint256 expiry
    );
    
    event OperatorAuthorized(address indexed operator, bool authorized);
    event ProfitThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event QuoteExpiryUpdated(uint256 oldExpiry, uint256 newExpiry);

    // Custom errors
    error UnauthorizedOperator();
    error InsufficientBalance();
    error InvalidOrderData();
    error ProfitThresholdNotMet();
    error SlippageExceeded();
    error OrderAlreadyExecuted();
    error QuoteExpired();

    constructor() Ownable(msg.sender) {
        minProfitThreshold = 50; // 0.5% minimum profit
        maxSlippage = 300; // 3% maximum slippage
        quoteExpiryTime = 300; // 5 minutes quote expiry
        authorizedOperators[msg.sender] = true;
    }

    /**
     * @notice Execute a swap using 0x Protocol
     * @param makerToken Token being bought
     * @param takerToken Token being sold
     * @param makerAmount Amount of maker tokens to receive
     * @param takerAmount Amount of taker tokens to sell
     * @param orderData 0x order data
     * @return actualMakerAmount Actual amount of maker tokens received
     */
    function executeSwap(
        address makerToken,
        address takerToken,
        uint256 makerAmount,
        uint256 takerAmount,
        bytes calldata orderData
    ) external nonReentrant returns (uint256 actualMakerAmount) {
        require(authorizedOperators[msg.sender], "Unauthorized operator");
        require(makerAmount > 0 && takerAmount > 0, "Invalid amounts");
        require(makerToken != takerToken, "Same token swap");
        
        // Generate order hash
        bytes32 orderHash = keccak256(abi.encodePacked(
            makerToken,
            takerToken,
            makerAmount,
            takerAmount,
            block.timestamp
        ));
        
        require(!executedOrders[orderHash], "Order already executed");
        
        // Check token balance
        uint256 balanceBefore = IERC20(takerToken).balanceOf(address(this));
        require(balanceBefore >= takerAmount, "Insufficient balance");
        
        // Approve 0x exchange proxy
        IERC20(takerToken).approve(ZEROX_EXCHANGE_PROXY, takerAmount);
        
        // Execute swap
        uint256 makerBalanceBefore = IERC20(makerToken).balanceOf(address(this));
        
        try this.performSwap(orderData) {
            uint256 makerBalanceAfter = IERC20(makerToken).balanceOf(address(this));
            actualMakerAmount = makerBalanceAfter - makerBalanceBefore;
            
            // Validate swap results
            require(actualMakerAmount >= makerAmount, "Insufficient output amount");
            
            // Check profit threshold
            uint256 expectedAmount = calculateExpectedAmount(takerToken, makerToken, takerAmount);
            uint256 profitPercent = calculateProfitPercent(expectedAmount, actualMakerAmount);
            require(profitPercent >= minProfitThreshold, "Profit threshold not met");
            
            // Update state
            executedOrders[orderHash] = true;
            totalOrders++;
            totalVolume += takerAmount;
            
            emit OrderExecuted(makerToken, takerToken, actualMakerAmount, takerAmount, msg.sender, orderHash);
            
        } catch (bytes memory reason) {
            // Revert approval
            IERC20(takerToken).approve(ZEROX_EXCHANGE_PROXY, 0);
            
            emit OrderFailed(makerToken, takerToken, takerAmount, string(reason), orderHash);
            revert("Order failed");
        }
        
        // Revert approval
        IERC20(takerToken).approve(ZEROX_EXCHANGE_PROXY, 0);
        
        return actualMakerAmount;
    }

    /**
     * @notice Execute a swap with 0x exchange proxy (external function for try/catch)
     * @param orderData 0x order data
     */
    function performSwap(bytes calldata orderData) external {
        require(msg.sender == address(this), "Internal call only");
        
        // Call 0x exchange proxy
        (bool success, bytes memory result) = ZEROX_EXCHANGE_PROXY.call(orderData);
        
        if (!success) {
            if (result.length > 0) {
                assembly {
                    let returndata_size := mload(result)
                    revert(add(32, result), returndata_size)
                }
            } else {
                revert("Swap failed");
            }
        }
    }

    /**
     * @notice Request a quote from 0x Protocol
     * @param makerToken Token being bought
     * @param takerToken Token being sold
     * @param takerAmount Amount of taker tokens to sell
     * @return makerAmount Amount of maker tokens to receive
     * @return expiry Quote expiry timestamp
     */
    function requestQuote(
        address makerToken,
        address takerToken,
        uint256 takerAmount
    ) external view returns (uint256 makerAmount, uint256 expiry) {
        // This would typically call 0x API or use their SDK
        // For now, return a simple calculation as placeholder
        makerAmount = calculateExpectedAmount(takerToken, makerToken, takerAmount);
        expiry = block.timestamp + quoteExpiryTime;
        
        return (makerAmount, expiry);
    }

    /**
     * @notice Get optimal route from 0x Protocol
     * @param makerToken Token being bought
     * @param takerToken Token being sold
     * @param takerAmount Amount of taker tokens to sell
     * @param source Source of liquidity (e.g., "0x", "uniswap", "sushiswap")
     * @return route Optimal swap route
     */
    function getOptimalRoute(
        address makerToken,
        address takerToken,
        uint256 takerAmount,
        string calldata source
    ) external view returns (bytes memory route) {
        // This would typically call 0x API or use their SDK
        // For now, return empty route as placeholder
        return "";
    }

    /**
     * @notice Calculate expected output amount based on current market rates
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return expectedAmount Expected output amount
     */
    function calculateExpectedAmount(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 expectedAmount) {
        // This would typically query price oracles or DEX reserves
        // For now, return a simple calculation as placeholder
        return amountIn; // Placeholder: 1:1 ratio
    }

    /**
     * @notice Calculate profit percentage
     * @param expectedAmount Expected output amount
     * @param actualAmount Actual output amount
     * @return profitPercent Profit percentage in basis points
     */
    function calculateProfitPercent(
        uint256 expectedAmount,
        uint256 actualAmount
    ) public pure returns (uint256 profitPercent) {
        if (expectedAmount == 0) return 0;
        
        if (actualAmount > expectedAmount) {
            return ((actualAmount - expectedAmount) * 10000) / expectedAmount;
        }
        return 0;
    }

    /**
     * @notice Get order statistics
     * @return _totalOrders Total number of orders
     * @return _totalVolume Total volume traded
     * @return _minProfitThreshold Current profit threshold
     * @return _maxSlippage Current max slippage
     */
    function getOrderStats() external view returns (
        uint256 _totalOrders,
        uint256 _totalVolume,
        uint256 _minProfitThreshold,
        uint256 _maxSlippage
    ) {
        return (totalOrders, totalVolume, minProfitThreshold, maxSlippage);
    }

    /**
     * @notice Check if an order has been executed
     * @param orderHash Order hash
     * @return executed Whether the order has been executed
     */
    function isOrderExecuted(bytes32 orderHash) external view returns (bool executed) {
        return executedOrders[orderHash];
    }

    /**
     * @notice Authorize or revoke operator
     * @param operator Address to authorize/revoke
     * @param authorized Whether to authorize
     */
    function setOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
        emit OperatorAuthorized(operator, authorized);
    }

    /**
     * @notice Update profit threshold
     * @param newThreshold New profit threshold in basis points
     */
    function updateProfitThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = minProfitThreshold;
        minProfitThreshold = newThreshold;
        emit ProfitThresholdUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Update max slippage
     * @param newSlippage New max slippage in basis points
     */
    function updateSlippage(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 1000, "Slippage too high"); // Max 10%
        uint256 oldSlippage = maxSlippage;
        maxSlippage = newSlippage;
        emit SlippageUpdated(oldSlippage, newSlippage);
    }

    /**
     * @notice Update quote expiry time
     * @param newExpiry New quote expiry time in seconds
     */
    function updateQuoteExpiry(uint256 newExpiry) external onlyOwner {
        require(newExpiry <= 3600, "Expiry too long"); // Max 1 hour
        uint256 oldExpiry = quoteExpiryTime;
        quoteExpiryTime = newExpiry;
        emit QuoteExpiryUpdated(oldExpiry, newExpiry);
    }

    /**
     * @notice Emergency withdraw tokens
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Get token balance
     * @param token Token address
     * @return balance Token balance
     */
    function getTokenBalance(address token) external view returns (uint256 balance) {
        try IERC20(token).balanceOf(address(this)) returns (uint256 tokenBalance) {
            return tokenBalance;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Check if address is authorized operator
     * @param operator Address to check
     * @return authorized Whether address is authorized
     */
    function isAuthorizedOperator(address operator) external view returns (bool authorized) {
        return authorizedOperators[operator];
    }
}
