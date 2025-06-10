// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAccount
 * @notice Interface for ERC-4337 compatible accounts
 */
interface IAccount {
    /**
     * @notice Validate user operation
     * @param userOp The user operation to validate
     * @param userOpHash Hash of the user operation
     * @param missingAccountFunds Funds needed to be deposited to the account
     * @return validationData Validation data for the operation
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);

    /**
     * @notice Execute a transaction
     * @param dest Destination address
     * @param value ETH value to send
     * @param func Function call data
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external;
}

/**
 * @title UserOperation
 * @notice Structure for ERC-4337 user operations
 */
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
} 