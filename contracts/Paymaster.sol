// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAccount.sol";

/**
 * @title Paymaster
 * @notice Paymaster contract for ERC-4337 that handles gasless transactions
 */
contract Paymaster {
    // Storage for paymaster balances
    mapping(address => uint256) public balances;
    
    // Storage for allowed accounts
    mapping(address => bool) public allowedAccounts;
    
    // Events
    event AccountAllowed(address indexed account);
    event AccountDisallowed(address indexed account);
    event FundsDeposited(address indexed account, uint256 amount);
    event FundsWithdrawn(address indexed account, uint256 amount);
    
    /**
     * @notice Allow an account to use the paymaster
     * @param account The account to allow
     */
    function allowAccount(address account) external {
        allowedAccounts[account] = true;
        emit AccountAllowed(account);
    }
    
    /**
     * @notice Disallow an account from using the paymaster
     * @param account The account to disallow
     */
    function disallowAccount(address account) external {
        allowedAccounts[account] = false;
        emit AccountDisallowed(account);
    }
    
    /**
     * @notice Deposit funds for the paymaster
     */
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw funds from the paymaster
     * @param amount The amount to withdraw
     */
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
        emit FundsWithdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Validate a user operation
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param maxCost The maximum cost of the operation
     * @return context The context for the operation
     * @return validationData The validation data
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(allowedAccounts[userOp.sender], "Account not allowed");
        require(balances[msg.sender] >= maxCost, "Insufficient paymaster balance");
        
        // Return empty context and validation data
        return ("", 0);
    }
    
    /**
     * @notice Post-operation callback
     * @param context The context from validatePaymasterUserOp
     * @param actualGasCost The actual gas cost of the operation
     */
    function postOp(
        bytes calldata context,
        uint256 actualGasCost
    ) external {
        // Deduct the actual gas cost from the paymaster's balance
        balances[address(this)] -= actualGasCost;
    }
    
    /**
     * @notice Get the balance of the paymaster
     * @return The balance of the paymaster
     */
    function getBalance() external view returns (uint256) {
        return balances[address(this)];
    }
    
    /**
     * @notice Check if an account is allowed to use the paymaster
     * @param account The account to check
     * @return Whether the account is allowed
     */
    function isAllowed(address account) external view returns (bool) {
        return allowedAccounts[account];
    }
} 