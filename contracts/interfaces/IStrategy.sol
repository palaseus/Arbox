// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IDexRouter.sol";

/**
 * @title IStrategy
 * @notice Interface for arbitrage strategies
 */
interface IStrategy {
    /**
     * @notice Execute the arbitrage strategy
     * @param opportunity The arbitrage opportunity to execute
     * @return profit The actual profit generated
     */
    function execute(ArbitrageOpportunity calldata opportunity) external returns (uint256 profit);
    
    /**
     * @notice Get the strategy's risk score (0-10000, where 10000 is highest risk)
     * @return riskScore The risk score
     */
    function getRiskScore() external view returns (uint256 riskScore);
    
    /**
     * @notice Get the strategy's expected gas usage
     * @param opportunity The arbitrage opportunity
     * @return gasEstimate Estimated gas usage
     */
    function estimateGas(ArbitrageOpportunity calldata opportunity) external view returns (uint256 gasEstimate);
    
    /**
     * @notice Get the strategy's name
     * @return name The strategy name
     */
    function getName() external view returns (string memory name);
    
    /**
     * @notice Get the strategy's version
     * @return version The strategy version
     */
    function getVersion() external view returns (string memory version);
    
    /**
     * @notice Check if the strategy is compatible with the given opportunity
     * @param opportunity The arbitrage opportunity
     * @return compatible True if compatible
     */
    function isCompatible(ArbitrageOpportunity calldata opportunity) external view returns (bool compatible);
}

/**
 * @notice Struct for arbitrage opportunities
 */
struct ArbitrageOpportunity {
    address tokenIn;
    address tokenOut;
    uint256 amount;
    uint256 expectedProfit;
    uint256 gasEstimate;
    bytes32 strategyId;
    Route[] routes;
}

/**
 * @notice Struct for trading routes
 */
struct Route {
    address router;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;
    bytes path;
    uint256 fee;
    uint256 gasEstimate;
}
