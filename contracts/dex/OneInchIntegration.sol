// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OneInchIntegration
 * @notice Integration with 1inch Protocol for optimal DEX routing and aggregation
 * @dev Provides access to 1inch's aggregation protocol for best swap routes
 */
contract OneInchIntegration is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // 1inch Protocol addresses
    address public constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address public constant ONEINCH_PROXY = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    
    // State variables
    mapping(address => bool) public authorizedOperators;
    mapping(address => uint256) public tokenBalances;
    mapping(bytes32 => bool) public executedSwaps;
    
    uint256 public totalSwaps;
    uint256 public totalVolume;
    uint256 public minProfitThreshold;
    uint256 public maxSlippage;
    
    // Events
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed user,
        bytes32 swapId
    );
    
    event SwapFailed(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        string reason,
        bytes32 swapId
    );
    
    event OperatorAuthorized(address indexed operator, bool authorized);
    event ProfitThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);

    // Custom errors
    error UnauthorizedOperator();
    error InsufficientBalance();
    error InvalidSwapData();
    error ProfitThresholdNotMet();
    error SlippageExceeded();
    error SwapAlreadyExecuted();

    constructor() Ownable(msg.sender) {
        minProfitThreshold = 50; // 0.5% minimum profit
        maxSlippage = 300; // 3% maximum slippage
        authorizedOperators[msg.sender] = true;
    }

    /**
     * @notice Execute a swap using 1inch Protocol
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum amount of output tokens
     * @param swapData 1inch swap data
     * @return amountOut Actual amount of output tokens received
     */
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapData
    ) external nonReentrant returns (uint256 amountOut) {
        require(authorizedOperators[msg.sender], "Unauthorized operator");
        require(amountIn > 0, "Invalid amount");
        require(tokenIn != tokenOut, "Same token swap");
        
        // Generate swap ID
        bytes32 swapId = keccak256(abi.encodePacked(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            block.timestamp
        ));
        
        require(!executedSwaps[swapId], "Swap already executed");
        
        // Check token balance
        uint256 balanceBefore = IERC20(tokenIn).balanceOf(address(this));
        require(balanceBefore >= amountIn, "Insufficient balance");
        
        // Approve 1inch router
        IERC20(tokenIn).approve(ONEINCH_ROUTER, amountIn);
        
        // Execute swap
        uint256 balanceOutBefore = IERC20(tokenOut).balanceOf(address(this));
        
        try this.performSwap(swapData) {
            uint256 balanceOutAfter = IERC20(tokenOut).balanceOf(address(this));
            amountOut = balanceOutAfter - balanceOutBefore;
            
            // Validate swap results
            require(amountOut >= minAmountOut, "Insufficient output amount");
            
            // Check profit threshold
            uint256 expectedAmount = calculateExpectedAmount(tokenIn, tokenOut, amountIn);
            uint256 profitPercent = calculateProfitPercent(expectedAmount, amountOut);
            require(profitPercent >= minProfitThreshold, "Profit threshold not met");
            
            // Update state
            executedSwaps[swapId] = true;
            totalSwaps++;
            totalVolume += amountIn;
            
            emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, msg.sender, swapId);
            
        } catch (bytes memory reason) {
            // Revert approval
            IERC20(tokenIn).approve(ONEINCH_ROUTER, 0);
            
            emit SwapFailed(tokenIn, tokenOut, amountIn, string(reason), swapId);
            revert("Swap failed");
        }
        
        // Revert approval
        IERC20(tokenIn).approve(ONEINCH_ROUTER, 0);
        
        return amountOut;
    }

    /**
     * @notice Execute a swap with 1inch router (external function for try/catch)
     * @param swapData 1inch swap data
     */
    function performSwap(bytes calldata swapData) external {
        require(msg.sender == address(this), "Internal call only");
        
        // Call 1inch router
        (bool success, bytes memory result) = ONEINCH_ROUTER.call(swapData);
        
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
     * @notice Get optimal swap route from 1inch
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param parts Number of parts for split routing
     * @return route Optimal swap route
     */
    function getOptimalRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 parts
    ) external view returns (bytes memory route) {
        // This would typically call 1inch API or use their SDK
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
     * @notice Get swap statistics
     * @return _totalSwaps Total number of swaps
     * @return _totalVolume Total volume traded
     * @return _minProfitThreshold Current profit threshold
     * @return _maxSlippage Current max slippage
     */
    function getSwapStats() external view returns (
        uint256 _totalSwaps,
        uint256 _totalVolume,
        uint256 _minProfitThreshold,
        uint256 _maxSlippage
    ) {
        return (totalSwaps, totalVolume, minProfitThreshold, maxSlippage);
    }

    /**
     * @notice Check if a swap has been executed
     * @param swapId Swap identifier
     * @return executed Whether the swap has been executed
     */
    function isSwapExecuted(bytes32 swapId) external view returns (bool executed) {
        return executedSwaps[swapId];
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
