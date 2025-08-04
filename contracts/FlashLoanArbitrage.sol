// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "./interfaces/IDexRouter.sol";
import "./interfaces/IAccount.sol";

/**
 * @title FlashLoanArbitrage
 * @notice Contract for executing flash loan arbitrage using ERC-4337 account abstraction
 */
contract FlashLoanArbitrage is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Struct for route information
    struct Route {
        address router;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes path;
        uint256 fee;
    }

    // Struct for Uniswap V3 exactInputSingle
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    // Aave V3 Pool
    IPool public immutable pool;
    
    // DEX Routers
    mapping(address => address) public routers;
    
    // Token whitelist for security
    mapping(address => bool) public whitelistedTokens;
    
    // Chain ID
    uint256 public immutable chainId;
    
    // Profit recipient
    address public profitRecipient;
    
    // Minimum profit required for arbitrage
    uint256 public minProfit;
    
    // Constants for gas optimization
    uint256 private constant GAS_BUFFER = 10000;
    uint256 private constant MAX_ROUTES = 4;
    uint256 private constant MAX_SWAP_DEADLINE = 300;
    
    // Risk management parameters (optimized for gas)
    uint128 public minProfitPercentage; // Minimum profit as percentage of flash loan amount
    uint64 public maxSlippage; // Maximum allowed slippage in basis points (1 = 0.01%)
    uint64 public maxGasPrice; // Maximum gas price in wei

    // Events
    event ArbitrageExecuted(
        address indexed account,
        address indexed token,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed,
        uint256 gasPrice
    );
    
    event SlippageViolation(
        address indexed router,
        uint256 expectedAmount,
        uint256 actualAmount,
        uint256 slippage
    );
    
    event FlashLoanFailed(
        address indexed token,
        uint256 amount,
        string reason
    );
    
    event ProfitRecipientUpdated(address indexed newRecipient);
    event RouterAdded(address indexed router, address indexed factory);
    event RouterRemoved(address indexed router);
    event TokenWhitelisted(address indexed token);
    event TokenRemovedFromWhitelist(address indexed token);
    event GasCheckpoint(string label, uint256 gasLeft);
    event SwapExecuted(address indexed router, uint256 amountIn, uint256 amountOut);

    // Custom errors
    error RouterNotFound();
    error InsufficientProfit();
    error NotEnoughToRepay();
    error InvalidArbPath();
    error GasLimitExceeded();
    error TokenNotWhitelisted(address token);
    error InvalidTokenAddress();
    error InvalidAmount();
    error InvalidRouterAddress();

    bool public testBypassEntryPoint = false;

    constructor(
        address _poolAddressesProvider,
        address _profitRecipient,
        uint256 _minProfit,
        uint128 _minProfitPercentage,
        uint64 _maxSlippage,
        uint64 _maxGasPrice
    ) Ownable(msg.sender) {
        IPoolAddressesProvider provider = IPoolAddressesProvider(_poolAddressesProvider);
        pool = IPool(provider.getPool());
        profitRecipient = _profitRecipient;
        chainId = block.chainid;
        minProfit = _minProfit;
        minProfitPercentage = _minProfitPercentage;
        maxSlippage = _maxSlippage;
        maxGasPrice = _maxGasPrice;
    }

    /**
     * @notice Add a DEX router
     * @param router The router address
     * @param factory The factory address
     */
    function addRouter(address router, address factory) external onlyOwner nonReentrant {
        if (router == address(0)) revert InvalidRouterAddress();
        if (factory == address(0)) revert InvalidRouterAddress();
        routers[router] = factory;
        emit RouterAdded(router, factory);
    }

    /**
     * @notice Remove a DEX router
     * @param router The router address
     */
    function removeRouter(address router) external onlyOwner nonReentrant {
        if (router == address(0)) revert InvalidRouterAddress();
        delete routers[router];
        emit RouterRemoved(router);
    }

    /**
     * @notice Set test bypass entry point flag (for testing only)
     * @param bypass Whether to bypass entry point check
     */
    function setTestBypassEntryPoint(bool bypass) external onlyOwner {
        testBypassEntryPoint = bypass;
    }

    /**
     * @notice Add a token to the whitelist
     * @param token The token address to whitelist
     */
    function whitelistToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidTokenAddress();
        whitelistedTokens[token] = true;
        emit TokenWhitelisted(token);
    }

    /**
     * @notice Remove a token from the whitelist
     * @param token The token address to remove
     */
    function removeTokenFromWhitelist(address token) external onlyOwner {
        if (token == address(0)) revert InvalidTokenAddress();
        whitelistedTokens[token] = false;
        emit TokenRemovedFromWhitelist(token);
    }

    /**
     * @notice Execute arbitrage
     * @param token The token to arbitrage
     * @param amount The amount to borrow
     * @param routes The routes to execute
     */
    function executeArbitrage(
        address token,
        uint256 amount,
        Route[] calldata routes,
        uint256 minProfitRequired
    ) external nonReentrant {
        uint256 startGas = gasleft();
        emit GasCheckpoint("start_executeArbitrage", startGas);
        
        if (!testBypassEntryPoint) {
            require(msg.sender == address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789), "Not entry point");
        }
        
        // Check gas price
        uint256 currentGasPrice = tx.gasprice;
        require(currentGasPrice <= maxGasPrice, "Gas price too high");
        
        require(gasleft() > GAS_BUFFER, "Gas too low, aborting");
        require(routes.length == 2, "Invalid routes length");
        
        // Input validation
        if (token == address(0)) revert InvalidTokenAddress();
        if (amount == 0) revert InvalidAmount();
        if (!whitelistedTokens[token]) revert TokenNotWhitelisted(token);
        
        // Calculate minimum required profit including gas costs
        uint256 estimatedGasCost = currentGasPrice * 500000; // Estimate 500k gas
        uint256 minProfitWithGas;
        unchecked {
            minProfitWithGas = minProfitRequired + estimatedGasCost;
        }
        require(minProfitWithGas >= minProfit, "Insufficient min profit");
        
        // Calculate minimum profit percentage
        uint256 minProfitAmount;
        unchecked {
            minProfitAmount = (amount * minProfitPercentage) / 10000; // Convert basis points to percentage
        }
        require(minProfitWithGas >= minProfitAmount, "Insufficient profit percentage");
        
        // Request flash loan
        address[] memory assets = new address[](1);
        assets[0] = token;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // 0 = no debt, 1 = stable, 2 = variable
        
        address onBehalfOf = address(this);
        bytes memory params = abi.encode(routes);
        uint16 referralCode = 0;
        
        pool.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
        
        uint256 gasUsed;
        unchecked {
            gasUsed = startGas - gasleft();
        }
        emit GasCheckpoint("end_executeArbitrage", gasleft());
        emit ArbitrageExecuted(msg.sender, token, amount, 0, gasUsed, currentGasPrice);
    }

    /**
     * @notice Execute operation after flash loan
     * @param assets The assets borrowed
     * @param amounts The amounts borrowed
     * @param premiums The premiums to repay
     * @param initiator The initiator of the flash loan
     * @param params The parameters for the operation
     * @return Whether the operation was successful
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        uint256 startGas = gasleft();
        emit GasCheckpoint("start_executeOperation", startGas);
        
        require(msg.sender == address(pool), "Not pool");
        require(initiator == address(this), "Not initiator");
        if (gasleft() <= GAS_BUFFER) revert GasLimitExceeded();
        require(assets.length == 1 && amounts.length == 1 && premiums.length == 1, "Invalid arrays length");
        
        // Approve pool for repayment
        uint256 amountToRepay = amounts[0] + premiums[0];
        IERC20(assets[0]).approve(address(pool), amountToRepay);
        
        // Decode routes
        Route[] memory routes = abi.decode(params, (Route[]));
        if (routes.length != 2) revert InvalidArbPath();
        // No-op path: both routes are identical or tokenIn == tokenOut for both
        if (
            routes[0].tokenIn == routes[0].tokenOut &&
            routes[1].tokenIn == routes[1].tokenOut &&
            routes[0].tokenIn == routes[1].tokenIn
        ) {
            revert InvalidArbPath();
        }
        // Check routers exist
        if (routers[routes[0].router] == address(0)) revert RouterNotFound();
        if (routers[routes[1].router] == address(0)) revert RouterNotFound();
        emit GasCheckpoint("after_decode_routes", gasleft());
        
        // Execute swaps
        address token = assets[0];
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];
        
        // First swap (Uniswap V3)
        emit GasCheckpoint("before_first_swap", gasleft());
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).approve(routes[0].router, amount);
        
        // Calculate minimum output with slippage protection
        uint256 minOutputWithSlippage = amount - ((amount * maxSlippage) / 10000);
        require(routes[0].minAmountOut >= minOutputWithSlippage, "Slippage too high");
        
        // Uniswap V3: exactInputSingle
        bool success = false;
        (success, ) = routes[0].router.call(
            abi.encodeWithSignature(
                "exactInputSingle(address,address,uint24,address,uint256,uint256,uint256,uint160)",
                routes[0].tokenIn,
                routes[0].tokenOut,
                uint24(routes[0].fee),
                address(this),
                block.timestamp + MAX_SWAP_DEADLINE,
                amount,
                routes[0].minAmountOut,
                uint160(0)
            )
        );
        require(success, "First swap failed");
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        emit SwapExecuted(routes[0].router, amount, balanceAfter - balanceBefore);
        emit GasCheckpoint("after_first_swap", gasleft());
        
        if (gasleft() <= GAS_BUFFER) revert GasLimitExceeded();
        
        // Second swap (Sushiswap): swapExactTokensForTokens
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).approve(routes[1].router, balance);
        
        emit GasCheckpoint("before_second_swap", gasleft());
        balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Calculate minimum output with slippage protection
        minOutputWithSlippage = balance - ((balance * maxSlippage) / 10000);
        require(routes[1].minAmountOut >= minOutputWithSlippage, "Slippage too high");
        
        address[] memory path = new address[](2);
        path[0] = routes[1].tokenIn;
        path[1] = routes[1].tokenOut;
        (success, ) = routes[1].router.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
                balance,
                routes[1].minAmountOut,
                path,
                address(this),
                block.timestamp + MAX_SWAP_DEADLINE
            )
        );
        require(success, "Second swap failed");
        
        balanceAfter = IERC20(token).balanceOf(address(this));
        emit SwapExecuted(routes[1].router, balance, balanceAfter - balanceBefore);
        emit GasCheckpoint("after_second_swap", gasleft());
        
        if (gasleft() <= GAS_BUFFER) revert GasLimitExceeded();
        
        // Check profit
        uint256 finalBalance = IERC20(token).balanceOf(address(this));
        require(finalBalance >= amount + premium, "Insufficient funds");
        
        uint256 profit = finalBalance - (amount + premium);
        uint256 gasUsed = startGas - gasleft();
        uint256 gasCost = tx.gasprice * gasUsed;
        
        // Check if profit covers gas costs
        require(profit > gasCost, "Profit doesn't cover gas costs");
        
        // Check minimum profit percentage
        uint256 minProfitAmount = (amount * minProfitPercentage) / 10000;
        require(profit >= minProfitAmount, "Insufficient profit percentage");
        
        emit GasCheckpoint("after_profit_check", gasleft());
        
        emit ArbitrageExecuted(
            initiator,
            token,
            amount,
            profit,
            gasUsed,
            tx.gasprice
        );
        
        emit GasCheckpoint("end_executeOperation", gasleft());
        return true;
    }
    
    /**
     * @notice Get the path for a swap
     * @param token The token to swap
     * @param router The router to use
     * @return The path for the swap
     */
    function getPath(
        address token,
        address router
    ) internal view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = router;
        return path;
    }
    
    /**
     * @notice Get the router factory
     * @param router The router address
     * @return The factory address
     */
    function getRouterFactory(address router) external view returns (address) {
        return routers[router];
    }

    /**
     * @notice Set profit recipient
     * @param newRecipient The new profit recipient address
     */
    function setProfitRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        profitRecipient = newRecipient;
        emit ProfitRecipientUpdated(newRecipient);
    }

    /**
     * @notice Set maximum allowed slippage
     * @param newMaxSlippage New maximum slippage in basis points (1 = 0.01%)
     */
    function setMaxSlippage(uint64 newMaxSlippage) external onlyOwner {
        require(newMaxSlippage <= 500, "Slippage too high"); // Max 5%
        maxSlippage = newMaxSlippage;
    }

    /**
     * @notice Emergency withdraw tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Approve tokens for a router
     */
    function approveToken(address token, address spender, uint256 amount) external onlyOwner {
        IERC20(token).approve(spender, 0);
        IERC20(token).approve(spender, amount);
    }

    /**
     * @notice Allow the contract to receive ETH
     */
    receive() external payable {}
} 