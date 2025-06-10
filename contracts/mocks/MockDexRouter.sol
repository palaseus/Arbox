// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDexRouter.sol";

contract MockDexRouter is IDexRouter {
    function swap(SwapParams calldata params) external override returns (uint256) {
        return params.amountIn;
    }

    function getAmountOut(SwapParams calldata params) external pure override returns (uint256) {
        return params.amountIn;
    }

    function getAmountIn(SwapParams calldata params) external pure override returns (uint256) {
        return params.amountIn;
    }
} 