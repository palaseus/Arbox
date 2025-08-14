// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDexRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBalancerVault {
    struct SingleSwap {
        bytes32 poolId;
        uint8 kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address recipient;
        bool toInternalBalance;
    }

    function swap(
        SingleSwap memory singleSwap,
        FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external payable returns (uint256);
}

contract BalancerRouter is IDexRouter {
    IBalancerVault public immutable vault;
    
    constructor(address _vault) {
        vault = IBalancerVault(_vault);
    }

    function swap(SwapParams calldata params) external override returns (uint256) {
        // Decode pool ID from path
        bytes32 poolId = abi.decode(params.path, (bytes32));
        
        // Create swap parameters
        IBalancerVault.SingleSwap memory singleSwap = IBalancerVault.SingleSwap({
            poolId: poolId,
            kind: 0, // GIVEN_IN
            assetIn: params.tokenIn,
            assetOut: params.tokenOut,
            amount: params.amountIn,
            userData: ""
        });

        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: msg.sender,
            fromInternalBalance: false,
            recipient: msg.sender,
            toInternalBalance: false
        });

        // Approve vault to spend tokens
        IERC20(params.tokenIn).approve(address(vault), params.amountIn);

        // Execute swap
        uint256 amountOut = vault.swap(
            singleSwap,
            funds,
            params.minAmountOut,
            block.timestamp + 300
        );

        return amountOut;
    }

    function getAmountOut(
        SwapParams calldata params
    ) external pure override returns (uint256) {
        // For testing purposes, return a mock amount
        // In production, this would query Balancer's price oracle
        return params.amountIn;
    }

    function getAmountIn(
        SwapParams calldata params
    ) external pure override returns (uint256) {
        // For testing purposes, return a mock amount
        // In production, this would query Balancer's price oracle
        return params.amountIn;
    }

    function getReserves(address tokenA, address tokenB) external view override returns (uint256 reserveA, uint256 reserveB) {
        return (0, 0);
    }
} 