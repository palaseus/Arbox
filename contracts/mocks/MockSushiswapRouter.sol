// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockSushiswapRouter {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256[2])) public reserves;

    // Mock fee rate (0.3%)
    uint256 private constant FEE_RATE = 30;

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external {
        reserves[tokenA][tokenB][0] += amountA;
        reserves[tokenA][tokenB][1] += amountB;
    }

    

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return denominator == 0 ? 0 : numerator / denominator;
    }

    function exactInputSingle(
        bytes calldata path,
        address recipient,
        uint256 deadline,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut) {
        require(deadline >= block.timestamp, "Expired");
        
        // Decode path
        (address tokenIn, uint24 fee, address tokenOut) = abi.decode(path, (address, uint24, address));
        
        // Calculate amount out
        uint256 reserveIn = reserves[tokenIn][tokenOut][0];
        uint256 reserveOut = reserves[tokenIn][tokenOut][1];
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMinimum, "Insufficient output amount");
        
        // Transfer tokens
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(recipient, amountOut);
        
        // Update reserves
        reserves[tokenIn][tokenOut][0] += amountIn;
        reserves[tokenIn][tokenOut][1] -= amountOut;
        
        return amountOut;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minAmountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        
        // Get token addresses
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        
        // Calculate amount out
        uint256 amountOut = this.getAmountOut(
            amountIn,
            reserves[tokenIn][tokenOut][0],
            reserves[tokenIn][tokenOut][1]
        );
        require(amountOut >= minAmountOut, "Insufficient output amount");
        
        // Transfer tokens
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(to, amountOut);
        
        // Update reserves
        reserves[tokenIn][tokenOut][0] += amountIn;
        reserves[tokenIn][tokenOut][1] -= amountOut;
        
        // Return amounts array
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[amounts.length - 1] = amountOut;
        
        return amounts;
    }

    function getReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB) {
        return (reserves[tokenA][tokenB][0], reserves[tokenA][tokenB][1]);
    }
} 