// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDexRouter.sol";

contract MockDexRouter is IDexRouter {
    uint256 public constant PROFIT_PERCENTAGE = 200;
    function swap(SwapParams calldata params) external override returns (uint256) {
        return params.amountIn;
    }

    function getAmountOut(SwapParams calldata params) external pure override returns (uint256) {
        return params.amountIn;
    }

    function getAmountIn(SwapParams calldata params) external view override returns (uint256) {
        // Return the required input amount for the desired output
        return (params.amountIn * 100) / PROFIT_PERCENTAGE;
    }

    function getReserves(address tokenA, address tokenB) external view override returns (uint256 reserveA, uint256 reserveB) {
        return (0, 0);
    }
} 