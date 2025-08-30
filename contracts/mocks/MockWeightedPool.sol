// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockWeightedPool
 * @dev Mock implementation of Balancer V2 Weighted Pool for testing
 */
contract MockWeightedPool {
    uint256 public swapFeePercentage = 3000; // 0.3%
    address[] public tokens;
    uint256[] public weights;
    mapping(address => uint256) public balances;

    constructor() {
        // Initialize with default values
    }

    /**
     * @notice Get the swap fee percentage
     * @return The swap fee percentage in basis points
     */
    function getSwapFeePercentage() external view returns (uint256) {
        return swapFeePercentage;
    }

    /**
     * @notice Set the swap fee percentage
     * @param fee The new swap fee percentage
     */
    function setSwapFeePercentage(uint256 fee) external {
        swapFeePercentage = fee;
    }

    /**
     * @notice Set pool tokens and weights
     * @param _tokens The pool tokens
     * @param _weights The token weights
     */
    function setTokensAndWeights(address[] memory _tokens, uint256[] memory _weights) external {
        require(_tokens.length == _weights.length, "Invalid arrays");
        tokens = _tokens;
        weights = _weights;
    }

    /**
     * @notice Set token balance
     * @param token The token address
     * @param balance The token balance
     */
    function setBalance(address token, uint256 balance) external {
        balances[token] = balance;
    }

    /**
     * @notice Get token balance
     * @param token The token address
     * @return The token balance
     */
    function getBalance(address token) external view returns (uint256) {
        return balances[token];
    }

    /**
     * @notice Get all tokens
     * @return The pool tokens
     */
    function getTokens() external view returns (address[] memory) {
        return tokens;
    }

    /**
     * @notice Get all weights
     * @return The token weights
     */
    function getWeights() external view returns (uint256[] memory) {
        return weights;
    }
}
