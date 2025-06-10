// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDexRouter {
    struct SwapParams {
        address router;      // The router address to use for this swap
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes path;
        uint24 fee; // For Uniswap V3
    }

    function swap(SwapParams calldata params) external returns (uint256 amountOut);
    function getAmountOut(SwapParams calldata params) external view returns (uint256 amountOut);
    function getAmountIn(SwapParams calldata params) external view returns (uint256 amountIn);
} 