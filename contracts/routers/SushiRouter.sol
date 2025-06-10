// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDexRouter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SushiRouter is IDexRouter {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public immutable router;
    
    constructor(address _router) {
        router = IUniswapV2Router02(_router);
    }

    function swap(SwapParams calldata params) external override returns (uint256 amountOut) {
        // Set allowance to 0 first for compatibility with some ERC20s
        IERC20(params.tokenIn).approve(address(router), 0);
        IERC20(params.tokenIn).approve(address(router), params.amountIn);
        
        address[] memory path = abi.decode(params.path, (address[]));
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            params.amountIn,
            params.minAmountOut,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        amountOut = amounts[amounts.length - 1];
    }

    function getAmountOut(SwapParams calldata params) external view override returns (uint256 amountOut) {
        address[] memory path = abi.decode(params.path, (address[]));
        uint256[] memory amounts = router.getAmountsOut(params.amountIn, path);
        amountOut = amounts[amounts.length - 1];
    }

    function getAmountIn(SwapParams calldata params) external view override returns (uint256 amountIn) {
        address[] memory path = abi.decode(params.path, (address[]));
        uint256[] memory amounts = router.getAmountsIn(params.amountIn, path);
        amountIn = amounts[0];
    }
} 