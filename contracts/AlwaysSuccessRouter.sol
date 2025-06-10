// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDexRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AlwaysSuccessRouter is IDexRouter {
    // Simulated profit percentage (200%)
    uint256 public constant PROFIT_PERCENTAGE = 200;
    
    function swap(SwapParams calldata params) external override returns (uint256) {
        // Calculate the amount after swap with profit
        uint256 amountAfterSwap = (params.amountIn * PROFIT_PERCENTAGE) / 100;
        
        // Transfer tokens to simulate the swap
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenOut).transfer(msg.sender, amountAfterSwap);
        
        return amountAfterSwap;
    }

    function getAmountOut(SwapParams calldata params) external view override returns (uint256) {
        // Return the expected output amount with profit
        return (params.amountIn * PROFIT_PERCENTAGE) / 100;
    }

    function getAmountIn(SwapParams calldata params) external view override returns (uint256) {
        // Return the required input amount for the desired output
        return (params.amountIn * 100) / PROFIT_PERCENTAGE;
    }
} 