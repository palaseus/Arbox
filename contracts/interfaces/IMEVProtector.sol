// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMEVProtector
 * @notice Interface for MEV protection mechanisms
 */
interface IMEVProtector {
    /**
     * @notice Protect a transaction from MEV attacks
     * @param tokenIn The input token address
     * @param amount The transaction amount
     * @param expectedProfit The expected profit
     * @return bundleHash The bundle hash for tracking
     */
    function protectTransaction(
        address tokenIn,
        uint256 amount,
        uint256 expectedProfit
    ) external returns (bytes32 bundleHash);
    
    /**
     * @notice Check if a transaction is protected from MEV
     * @param bundleHash The bundle hash to check
     * @return protected True if protected
     */
    function isProtected(bytes32 bundleHash) external view returns (bool protected);
    
    /**
     * @notice Get the current MEV protection status
     * @return active True if MEV protection is active
     * @return lastProtectionBlock The last block where protection was applied
     */
    function getProtectionStatus() external view returns (bool active, uint256 lastProtectionBlock);
    
    /**
     * @notice Update MEV protection parameters
     * @param newParams The new protection parameters
     */
    function updateProtectionParams(ProtectionParams calldata newParams) external;
    
    /**
     * @notice Get the protection parameters
     * @return params The current protection parameters
     */
    function getProtectionParams() external view returns (ProtectionParams memory params);
}

/**
 * @notice Struct for MEV protection parameters
 */
struct ProtectionParams {
    bool flashbotsEnabled;
    bool privateMempoolEnabled;
    uint256 maxGasPrice;
    uint256 minBribeAmount;
    uint256 protectionWindow;
    bool antiSandwichEnabled;
    bool frontrunProtectionEnabled;
}
