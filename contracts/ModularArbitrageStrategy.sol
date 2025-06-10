// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ModularArbitrageStrategy {
    uint256 public lastExecutionGas;

    function executeStrategy() external returns (uint256) {
        uint256 startGas = gasleft();
        // Simulate some arbitrage logic
        uint256 dummy = 0;
        for (uint256 i = 0; i < 10; i++) {
            dummy += i;
        }
        lastExecutionGas = startGas - gasleft();
        return lastExecutionGas;
    }
} 