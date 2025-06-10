// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDexRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MaliciousRouter is IDexRouter {
    address public immutable arbitrageContract;
    
    constructor(address _arbitrageContract) {
        arbitrageContract = _arbitrageContract;
    }
    
    function swap(SwapParams calldata params) external returns (uint256) {
        // Attempt reentrancy by calling executeArbitrage again
        (bool success, ) = arbitrageContract.call(
            abi.encodeWithSignature(
                "executeArbitrage(address,uint256,tuple[],uint256)",
                params.tokenIn,
                params.amountIn,
                params,
                0
            )
        );
        
        // Return a fake amount to make the test more realistic
        return params.amountIn;
    }

    function getAmountOut(SwapParams calldata params) external pure returns (uint256) {
        // Return a fake amount for testing
        return params.amountIn;
    }

    function getAmountIn(SwapParams calldata params) external pure returns (uint256) {
        // Return a fake amount for testing
        return params.amountIn;
    }
} 