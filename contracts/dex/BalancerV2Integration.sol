// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BalancerV2Integration
 * @notice Integration with Balancer V2 for arbitrage opportunities
 */
// Balancer V2 data structures
struct SingleSwap {
    bytes32 poolId;
    SwapKind kind;
    address assetIn;
    address assetOut;
    uint256 amount;
    bytes userData;
}

struct FundManagement {
    address sender;
    bool fromInternalBalance;
    address payable recipient;
    bool toInternalBalance;
}

struct BatchSwapStep {
    bytes32 poolId;
    uint256 assetInIndex;
    uint256 assetOutIndex;
    uint256 amount;
    bytes userData;
}

enum SwapKind { GIVEN_IN, GIVEN_OUT }

// Balancer V2 interfaces (simplified)
interface IVault {
    function swap(
        SingleSwap memory singleSwap,
        FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external payable returns (uint256 amountCalculated);
    
    function queryBatchSwap(
        SwapKind kind,
        BatchSwapStep[] memory swaps,
        address[] memory assets,
        FundManagement memory funds
    ) external returns (int256[] memory);
}

interface IWeightedPool {
    function getNormalizedWeights() external view returns (uint256[] memory);
    function getRate() external view returns (uint256);
    function getSwapFeePercentage() external view returns (uint256);
}

contract BalancerV2Integration is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // State variables
    IVault public balancerVault;
    mapping(bytes32 => address) public poolAddresses;
    mapping(address => bool) public authorizedTokens;
    mapping(bytes32 => PoolInfo) public poolInfo;
    
    uint256 public totalSwaps;
    uint256 public totalVolume;
    uint256 public totalFees;
    
    // Pool information
    struct PoolInfo {
        address pool;
        address[] tokens;
        uint256[] weights;
        uint256 swapFee;
        bool isActive;
        uint256 totalLiquidity;
        uint256 lastUpdate;
    }

    // Events
    event SwapExecuted(
        bytes32 indexed poolId,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    
    event PoolRegistered(
        bytes32 indexed poolId,
        address pool,
        address[] tokens,
        uint256[] weights
    );
    
    event TokenAuthorized(address indexed token);
    event TokenRevoked(address indexed token);

    // Custom errors
    error PoolNotFound();
    error TokenNotAuthorized();
    error SwapFailed();
    error InsufficientLiquidity();
    error InvalidPool();

    constructor(address _balancerVault) Ownable(msg.sender) {
        balancerVault = IVault(_balancerVault);
    }

    /**
     * @notice Execute a swap on Balancer V2
     * @param poolId The pool ID
     * @param tokenIn The input token
     * @param tokenOut The output token
     * @param amountIn The input amount
     * @param minAmountOut The minimum output amount
     */
    function executeSwap(
        bytes32 poolId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(!paused(), "Contract paused");
        require(authorizedTokens[tokenIn] && authorizedTokens[tokenOut], "Token not authorized");
        require(poolInfo[poolId].isActive, "Pool not active");
        
        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve Balancer Vault
        IERC20(tokenIn).approve(address(balancerVault), amountIn);
        
        // Create swap parameters
        SingleSwap memory singleSwap = SingleSwap({
            poolId: poolId,
            kind: SwapKind.GIVEN_IN,
            assetIn: tokenIn,
            assetOut: tokenOut,
            amount: amountIn,
            userData: ""
        });
        
        FundManagement memory funds = FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(msg.sender),
            toInternalBalance: false
        });
        
        // Execute swap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(msg.sender);
        
        try balancerVault.swap(singleSwap, funds, minAmountOut, block.timestamp) returns (uint256 calculatedAmount) {
            amountOut = calculatedAmount;
        } catch {
            revert("Swap failed");
        }
        
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(msg.sender);
        amountOut = balanceAfter - balanceBefore;
        
        require(amountOut >= minAmountOut, "Insufficient output amount");
        
        // Update statistics
        totalSwaps++;
        totalVolume += amountIn;
        
        // Calculate and collect fee
        uint256 fee = (amountIn * 30) / 10000; // 0.3% fee
        totalFees += fee;
        
        emit SwapExecuted(poolId, tokenIn, tokenOut, amountIn, amountOut, fee);
        
        return amountOut;
    }

    /**
     * @notice Query swap amount out
     * @param poolId The pool ID
     * @param tokenIn The input token
     * @param tokenOut The output token
     * @param amountIn The input amount
     * @return amountOut The expected output amount
     */
    function querySwap(
        bytes32 poolId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        require(poolInfo[poolId].isActive, "Pool not active");
        
        // Create batch swap for query
        BatchSwapStep[] memory swaps = new BatchSwapStep[](1);
        swaps[0] = BatchSwapStep({
            poolId: poolId,
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: ""
        });
        
        address[] memory assets = new address[](2);
        assets[0] = tokenIn;
        assets[1] = tokenOut;
        
        FundManagement memory funds = FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(address(this)),
            toInternalBalance: false
        });
        
        // Query swap
        int256[] memory deltas = balancerVault.queryBatchSwap(SwapKind.GIVEN_IN, swaps, assets, funds);
        
        // Convert to positive amount
        amountOut = uint256(-deltas[1]);
        
        return amountOut;
    }

    /**
     * @notice Register a Balancer pool
     * @param poolId The pool ID
     * @param pool The pool address
     * @param tokens The pool tokens
     * @param weights The token weights
     */
    function registerPool(
        bytes32 poolId,
        address pool,
        address[] memory tokens,
        uint256[] memory weights
    ) external onlyOwner {
        require(tokens.length == weights.length, "Invalid arrays");
        require(tokens.length > 0, "No tokens");
        
        // Get pool fee
        uint256 swapFee = IWeightedPool(pool).getSwapFeePercentage();
        
        // Calculate total liquidity (simplified)
        uint256 totalLiquidity = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            totalLiquidity += IERC20(tokens[i]).balanceOf(pool);
        }
        
        poolInfo[poolId] = PoolInfo({
            pool: pool,
            tokens: tokens,
            weights: weights,
            swapFee: swapFee,
            isActive: true,
            totalLiquidity: totalLiquidity,
            lastUpdate: block.timestamp
        });
        
        poolAddresses[poolId] = pool;
        
        // Authorize tokens
        for (uint256 i = 0; i < tokens.length; i++) {
            authorizedTokens[tokens[i]] = true;
        }
        
        emit PoolRegistered(poolId, pool, tokens, weights);
    }

    /**
     * @notice Update pool information
     * @param poolId The pool ID
     * @param isActive Whether the pool is active
     */
    function updatePoolStatus(bytes32 poolId, bool isActive) external onlyOwner {
        require(poolInfo[poolId].pool != address(0), "Pool not found");
        poolInfo[poolId].isActive = isActive;
    }

    /**
     * @notice Authorize a token
     * @param token The token address
     */
    function authorizeToken(address token) external onlyOwner {
        authorizedTokens[token] = true;
        emit TokenAuthorized(token);
    }

    /**
     * @notice Revoke a token
     * @param token The token address
     */
    function revokeToken(address token) external onlyOwner {
        authorizedTokens[token] = false;
        emit TokenRevoked(token);
    }

    /**
     * @notice Get pool information
     * @param poolId The pool ID
     * @return info The pool information
     */
    function getPoolInfo(bytes32 poolId) 
        external 
        view 
        returns (PoolInfo memory info) 
    {
        return poolInfo[poolId];
    }

    /**
     * @notice Get pool tokens
     * @param poolId The pool ID
     * @return tokens The pool tokens
     */
    function getPoolTokens(bytes32 poolId) 
        external 
        view 
        returns (address[] memory tokens) 
    {
        return poolInfo[poolId].tokens;
    }

    /**
     * @notice Get pool weights
     * @param poolId The pool ID
     * @return weights The pool weights
     */
    function getPoolWeights(bytes32 poolId) 
        external 
        view 
        returns (uint256[] memory weights) 
    {
        return poolInfo[poolId].weights;
    }

    /**
     * @notice Calculate optimal swap amount
     * @param poolId The pool ID
     * @param tokenIn The input token
     * @param tokenOut The output token
     * @param maxAmountIn The maximum input amount
     * @return optimalAmountIn The optimal input amount
     * @return expectedAmountOut The expected output amount
     */
    function calculateOptimalSwap(
        bytes32 poolId,
        address tokenIn,
        address tokenOut,
        uint256 maxAmountIn
    ) external view returns (uint256 optimalAmountIn, uint256 expectedAmountOut) {
        require(poolInfo[poolId].isActive, "Pool not active");
        
        // Simple optimal amount calculation (50% of max amount)
        optimalAmountIn = maxAmountIn / 2;
        
        // Simple expected output calculation (90% of input for demo)
        expectedAmountOut = (optimalAmountIn * 90) / 100;
        
        return (optimalAmountIn, expectedAmountOut);
    }

    /**
     * @notice Get integration statistics
     * @return totalSwapsCount Total number of swaps
     * @return totalVolumeAmount Total volume traded
     * @return totalFeesAmount Total fees collected
     */
    function getStats() 
        external 
        view 
        returns (
            uint256 totalSwapsCount,
            uint256 totalVolumeAmount,
            uint256 totalFeesAmount
        ) 
    {
        return (totalSwaps, totalVolume, totalFees);
    }

    /**
     * @notice Pause the integration
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the integration
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw collected fees
     * @param token The token to withdraw
     * @param amount The amount to withdraw
     */
    function withdrawFees(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Emergency withdraw tokens
     * @param token The token to withdraw
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
