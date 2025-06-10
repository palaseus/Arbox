// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDexRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UniswapV3Router is IDexRouter {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable router;
    
    constructor(address _router) {
        router = ISwapRouter(_router);
    }

    function swap(SwapParams calldata params) external override returns (uint256 amountOut) {
        // Set allowance to 0 first for compatibility with some ERC20s
        IERC20(params.tokenIn).approve(address(router), 0);
        IERC20(params.tokenIn).approve(address(router), params.amountIn);
        
        ISwapRouter.ExactInputParams memory swapParams = ISwapRouter.ExactInputParams({
            path: params.path,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: params.amountIn,
            amountOutMinimum: params.minAmountOut
        });
        
        amountOut = router.exactInput(swapParams);
    }

    function getAmountOut(SwapParams calldata params) external view override returns (uint256 amountOut) {
        // For Uniswap V3, we need to use the Quoter contract
        // This is a simplified version - in production, you'd use the actual Quoter
        amountOut = params.amountIn; // Placeholder
    }

    function getAmountIn(SwapParams calldata params) external view override returns (uint256 amountIn) {
        // For Uniswap V3, we need to use the Quoter contract
        // This is a simplified version - in production, you'd use the actual Quoter
        amountIn = params.amountIn; // Placeholder
    }
} 