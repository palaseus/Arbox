// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAccount.sol";

/**
 * @title EntryPoint
 * @notice Entry point contract for ERC-4337 account abstraction
 */
contract EntryPoint {
    // Storage for account nonces
    mapping(address => uint256) public nonces;
    
    // Storage for account balances
    mapping(address => uint256) public balances;
    
    // Events
    event UserOperationExecuted(
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success,
        uint256 actualGasCost
    );
    
    event AccountDeposited(
        address indexed account,
        uint256 amount
    );
    
    event AccountWithdrawn(
        address indexed account,
        address indexed withdrawAddress,
        uint256 amount
    );

    /**
     * @notice Execute a user operation
     * @param userOp The user operation to execute
     * @param beneficiary The address to receive the gas refund
     */
    function handleOps(
        UserOperation calldata userOp,
        address payable beneficiary
    ) external {
        // Validate user operation
        uint256 validationData = IAccount(userOp.sender).validateUserOp(
            userOp,
            getUserOpHash(userOp),
            0 // missingAccountFunds
        );
        require(validationData == 0, "Invalid user operation");

        // Paymaster validation
        if (userOp.paymasterAndData.length >= 20) {
            address paymaster = address(uint160(bytes20(userOp.paymasterAndData[:20])));
            (bool ok, bytes memory result) = paymaster.call(
                abi.encodeWithSignature(
                    "validatePaymasterUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32,uint256)",
                    userOp,
                    getUserOpHash(userOp),
                    0
                )
            );
            require(ok, getRevertMsg(result));
        }

        // Execute the operation
        (bool success, ) = userOp.sender.call(userOp.callData);
        
        // Calculate gas cost
        uint256 gasCost = (userOp.callGasLimit + userOp.verificationGasLimit) * 
            userOp.maxFeePerGas;
            
        // Transfer gas cost to beneficiary
        if (gasCost > 0 && beneficiary != address(0) && address(this).balance >= gasCost) {
            (bool transferSuccess, ) = beneficiary.call{value: gasCost}("");
            require(transferSuccess, "Gas refund failed");
        }
        
        emit UserOperationExecuted(
            userOp.sender,
            address(0), // paymaster
            userOp.nonce,
            success,
            gasCost
        );
    }
    
    /**
     * @notice Get the hash of a user operation
     * @param userOp The user operation to hash
     * @return The hash of the user operation
     */
    function getUserOpHash(UserOperation calldata userOp) public view returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            userOp.initCode,
            userOp.callData,
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            userOp.paymasterAndData
        ));
    }
    
    /**
     * @notice Deposit funds for an account
     * @param account The account to deposit funds for
     */
    function depositFor(address account) external payable {
        balances[account] += msg.value;
        emit AccountDeposited(account, msg.value);
    }
    
    /**
     * @notice Withdraw funds from an account
     * @param withdrawAddress The address to withdraw funds to
     * @param amount The amount to withdraw
     */
    function withdrawTo(address payable withdrawAddress, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = withdrawAddress.call{value: amount}("");
        require(success, "Withdrawal failed");
        emit AccountWithdrawn(msg.sender, withdrawAddress, amount);
    }
    
    /**
     * @notice Get the balance of an account
     * @param account The account to get the balance of
     * @return The balance of the account
     */
    function getBalance(address account) external view returns (uint256) {
        return balances[account];
    }
    
    /**
     * @notice Get the nonce of an account
     * @param account The account to get the nonce of
     * @return The nonce of the account
     */
    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }

    // Helper to extract revert reason
    function getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        if (_returnData.length < 68) return 'Paymaster validation reverted';
        assembly {
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string));
    }
} 