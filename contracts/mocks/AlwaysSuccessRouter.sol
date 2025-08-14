// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDexRouter.sol";

contract AlwaysSuccessRouter is IDexRouter {
    function swap(SwapParams calldata params) external override returns (uint256) {
        // Always succeed, return amountIn or minAmountOut
        return params.amountIn > 0 ? params.amountIn : params.minAmountOut;
    }
    function getAmountOut(SwapParams calldata params) external pure override returns (uint256) {
        return params.amountIn;
    }
    function getAmountIn(SwapParams calldata params) external pure override returns (uint256) {
        return params.amountIn;
    }

    function getReserves(address tokenA, address tokenB) external view override returns (uint256 reserveA, uint256 reserveB) {
        return (0, 0);
    }
} 