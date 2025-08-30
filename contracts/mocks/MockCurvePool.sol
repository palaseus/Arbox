// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockCurvePool
 * @dev Mock implementation of Curve Pool for testing
 */
contract MockCurvePool {
    address[] public coins;
    uint256[] public balances;
    uint256 public A = 100; // Amplification coefficient
    uint256 public fee = 4000000; // 0.04% fee
    uint256 public admin_fee = 5000000000; // 50% of fee
    bool public isActive = true;

    constructor() {
        // Initialize with default values
    }

    /**
     * @notice Get the number of coins in the pool
     * @return The number of coins
     */
    function getCoin(uint256 i) external view returns (address) {
        require(i < coins.length, "Index out of bounds");
        return coins[i];
    }

    /**
     * @notice Get the balance of a coin
     * @param i The coin index
     * @return The balance
     */
    function getBalance(uint256 i) external view returns (uint256) {
        require(i < balances.length, "Index out of bounds");
        return balances[i];
    }

    /**
     * @notice Get the amplification coefficient
     * @return The A value
     */
    function getA() external view returns (uint256) {
        return A;
    }

    /**
     * @notice Get the swap fee
     * @return The fee in basis points
     */
    function getFee() external view returns (uint256) {
        return fee;
    }

    /**
     * @notice Get the admin fee
     * @return The admin fee
     */
    function getAdminFee() external view returns (uint256) {
        return admin_fee;
    }

    /**
     * @notice Check if pool is active
     * @return True if active
     */
    function getIsActive() external view returns (bool) {
        return isActive;
    }

    /**
     * @notice Set pool coins
     * @param _coins The coin addresses
     */
    function setCoins(address[] memory _coins) external {
        coins = _coins;
        balances = new uint256[](_coins.length);
    }

    /**
     * @notice Set coin balance
     * @param i The coin index
     * @param balance The balance
     */
    function setBalance(uint256 i, uint256 balance) external {
        require(i < balances.length, "Index out of bounds");
        balances[i] = balance;
    }

    /**
     * @notice Set pool parameters
     * @param _A The amplification coefficient
     * @param _fee The swap fee
     * @param _admin_fee The admin fee
     */
    function setParameters(uint256 _A, uint256 _fee, uint256 _admin_fee) external {
        A = _A;
        fee = _fee;
        admin_fee = _admin_fee;
    }

    /**
     * @notice Set pool active status
     * @param _isActive The active status
     */
    function setActive(bool _isActive) external {
        isActive = _isActive;
    }

    /**
     * @notice Get the number of coins
     * @return The number of coins
     */
    function getNumberOfCoins() external view returns (uint256) {
        return coins.length;
    }

    /**
     * @notice Get all coins
     * @return The coin addresses
     */
    function getCoins() external view returns (address[] memory) {
        return coins;
    }

    /**
     * @notice Get all balances
     * @return The balances
     */
    function getBalances() external view returns (uint256[] memory) {
        return balances;
    }
}
