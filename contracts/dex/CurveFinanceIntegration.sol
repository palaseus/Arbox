// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CurveFinanceIntegration
 * @notice Integration with Curve Finance for arbitrage opportunities
 */
// Curve Finance interfaces (simplified)
interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
    
    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);
    
    function coins(uint256 i) external view returns (address);
    function balances(uint256 i) external view returns (uint256);
    function fee() external view returns (uint256);
}

interface ICurveRegistry {
    function get_pool_from_lp_token(address lp_token) external view returns (address);
    function get_lp_token(address pool) external view returns (address);
    function get_n_coins(address pool) external view returns (uint256);
    function get_coins(address pool) external view returns (address[8] memory);
}

contract CurveFinanceIntegration is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // State variables
    ICurveRegistry public curveRegistry;
    mapping(address => PoolInfo) public poolInfo;
    mapping(address => bool) public authorizedTokens;
    mapping(address => bool) public authorizedPools;
    
    uint256 public totalSwaps;
    uint256 public totalVolume;
    uint256 public totalFees;
    
    // Pool information
    struct PoolInfo {
        address pool;
        address lpToken;
        address[] coins;
        uint256[] balances;
        uint256 fee;
        bool isActive;
        uint256 totalLiquidity;
        uint256 lastUpdate;
    }

    // Events
    event SwapExecuted(
        address indexed pool,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    
    event PoolRegistered(
        address indexed pool,
        address lpToken,
        address[] coins,
        uint256 fee
    );
    
    event TokenAuthorized(address indexed token);
    event TokenRevoked(address indexed token);
    event PoolAuthorized(address indexed pool);
    event PoolRevoked(address indexed pool);

    // Custom errors
    error PoolNotFound();
    error TokenNotAuthorized();
    error PoolNotAuthorized();
    error SwapFailed();
    error InsufficientLiquidity();
    error InvalidPool();

    constructor(address _curveRegistry) Ownable(msg.sender) {
        curveRegistry = ICurveRegistry(_curveRegistry);
    }

    /**
     * @notice Execute a swap on Curve Finance
     * @param pool The pool address
     * @param i The input token index
     * @param j The output token index
     * @param amountIn The input amount
     * @param minAmountOut The minimum output amount
     */
    function executeSwap(
        address pool,
        int128 i,
        int128 j,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(!paused(), "Contract paused");
        require(authorizedPools[pool], "Pool not authorized");
        require(poolInfo[pool].isActive, "Pool not active");
        
        // Get token addresses
        address tokenIn = ICurvePool(pool).coins(uint256(int256(i)));
        address tokenOut = ICurvePool(pool).coins(uint256(int256(j)));
        
        require(authorizedTokens[tokenIn] && authorizedTokens[tokenOut], "Token not authorized");
        
        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve Curve pool
        IERC20(tokenIn).approve(pool, amountIn);
        
        // Execute swap
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(msg.sender);
        
        try ICurvePool(pool).exchange(i, j, amountIn, minAmountOut) returns (uint256 calculatedAmount) {
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
        uint256 fee = (amountIn * 25) / 10000; // 0.25% fee
        totalFees += fee;
        
        emit SwapExecuted(pool, tokenIn, tokenOut, amountIn, amountOut, fee);
        
        return amountOut;
    }

    /**
     * @notice Query swap amount out
     * @param pool The pool address
     * @param i The input token index
     * @param j The output token index
     * @param amountIn The input amount
     * @return amountOut The expected output amount
     */
    function querySwap(
        address pool,
        int128 i,
        int128 j,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(authorizedPools[pool], "Pool not authorized");
        require(poolInfo[pool].isActive, "Pool not active");
        
        return ICurvePool(pool).get_dy(i, j, amountIn);
    }

    /**
     * @notice Register a Curve pool
     * @param pool The pool address
     */
    function registerPool(address pool) external onlyOwner {
        require(pool != address(0), "Invalid pool");
        
        // Get pool information from registry
        address lpToken = curveRegistry.get_lp_token(pool);
        uint256 nCoins = curveRegistry.get_n_coins(pool);
        address[8] memory coinsArray = curveRegistry.get_coins(pool);
        
        // Get pool fee
        uint256 fee = ICurvePool(pool).fee();
        
        // Get current balances
        address[] memory coins = new address[](nCoins);
        uint256[] memory balances = new uint256[](nCoins);
        uint256 totalLiquidity = 0;
        
        for (uint256 i = 0; i < nCoins; i++) {
            coins[i] = coinsArray[i];
            balances[i] = ICurvePool(pool).balances(i);
            totalLiquidity += balances[i];
            
            // Authorize tokens
            authorizedTokens[coins[i]] = true;
        }
        
        poolInfo[pool] = PoolInfo({
            pool: pool,
            lpToken: lpToken,
            coins: coins,
            balances: balances,
            fee: fee,
            isActive: true,
            totalLiquidity: totalLiquidity,
            lastUpdate: block.timestamp
        });
        
        authorizedPools[pool] = true;
        
        emit PoolRegistered(pool, lpToken, coins, fee);
    }

    /**
     * @notice Update pool information
     * @param pool The pool address
     * @param isActive Whether the pool is active
     */
    function updatePoolStatus(address pool, bool isActive) external onlyOwner {
        require(poolInfo[pool].pool != address(0), "Pool not found");
        poolInfo[pool].isActive = isActive;
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
     * @notice Authorize a pool
     * @param pool The pool address
     */
    function authorizePool(address pool) external onlyOwner {
        authorizedPools[pool] = true;
        emit PoolAuthorized(pool);
    }

    /**
     * @notice Revoke a pool
     * @param pool The pool address
     */
    function revokePool(address pool) external onlyOwner {
        authorizedPools[pool] = false;
        emit PoolRevoked(pool);
    }

    /**
     * @notice Get pool information
     * @param pool The pool address
     * @return info The pool information
     */
    function getPoolInfo(address pool) 
        external 
        view 
        returns (PoolInfo memory info) 
    {
        return poolInfo[pool];
    }

    /**
     * @notice Get pool coins
     * @param pool The pool address
     * @return coins The pool coins
     */
    function getPoolCoins(address pool) 
        external 
        view 
        returns (address[] memory coins) 
    {
        return poolInfo[pool].coins;
    }

    /**
     * @notice Get pool balances
     * @param pool The pool address
     * @return balances The pool balances
     */
    function getPoolBalances(address pool) 
        external 
        view 
        returns (uint256[] memory balances) 
    {
        return poolInfo[pool].balances;
    }

    /**
     * @notice Calculate optimal swap amount
     * @param pool The pool address
     * @param i The input token index
     * @param j The output token index
     * @param maxAmountIn The maximum input amount
     * @return optimalAmountIn The optimal input amount
     * @return expectedAmountOut The expected output amount
     */
    function calculateOptimalSwap(
        address pool,
        int128 i,
        int128 j,
        uint256 maxAmountIn
    ) external view returns (uint256 optimalAmountIn, uint256 expectedAmountOut) {
        require(authorizedPools[pool], "Pool not authorized");
        require(poolInfo[pool].isActive, "Pool not active");
        
        // Simple optimal amount calculation (40% of max amount for Curve)
        optimalAmountIn = (maxAmountIn * 40) / 100;
        
        // Query expected output
        expectedAmountOut = this.querySwap(pool, i, j, optimalAmountIn);
        
        return (optimalAmountIn, expectedAmountOut);
    }

    /**
     * @notice Get pool liquidity depth
     * @param pool The pool address
     * @param i The token index
     * @return liquidity The liquidity depth
     */
    function getPoolLiquidity(address pool, uint256 i) external view returns (uint256 liquidity) {
        require(authorizedPools[pool], "Pool not authorized");
        return ICurvePool(pool).balances(i);
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

    /**
     * @notice Update pool balances (called periodically)
     * @param pool The pool address
     */
    function updatePoolBalances(address pool) external {
        require(authorizedPools[pool], "Pool not authorized");
        
        PoolInfo storage info = poolInfo[pool];
        uint256 nCoins = info.coins.length;
        uint256 totalLiquidity = 0;
        
        for (uint256 i = 0; i < nCoins; i++) {
            info.balances[i] = ICurvePool(pool).balances(i);
            totalLiquidity += info.balances[i];
        }
        
        info.totalLiquidity = totalLiquidity;
        info.lastUpdate = block.timestamp;
    }
}
