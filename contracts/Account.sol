// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAccount.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "hardhat/console.sol";

/**
 * @title Account
 * @notice Account contract for ERC-4337 that handles user operations
 */
contract Account is IAccount {
    // Storage for account owner
    address public owner;
    
    // Storage for account nonce
    uint256 public nonce;
    
    // Storage for entry point address
    address public entryPoint;
    
    // Events
    event AccountInitialized(address indexed owner);
    event OperationExecuted(address indexed target, uint256 value, bytes data);
    event DebugSignature(
        bytes32 userOpHash,
        bytes32 messageHash,
        address recovered,
        address expectedOwner
    );
    event DebugRecover(
        bytes32 userOpHash,
        bytes32 prefixedHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address recovered
    );
    event DebugHashConstruction(
        bytes32 hash,
        bytes prefix,
        bytes message,
        bytes prefixedMessage,
        bytes32 finalHash
    );
    event DebugSplitSignature(bytes sig, uint256 len, bytes32 r, bytes32 s, uint8 v, uint8 vHex);
    
    /**
     * @notice Constructor
     * @param _owner The owner of the account
     * @param _entryPoint The entry point address
     */
    constructor(address _owner, address _entryPoint) {
        owner = _owner;
        entryPoint = _entryPoint;
    }
    
    /**
     * @notice Initialize the account
     * @param _owner The owner of the account
     */
    function initialize(address _owner) external {
        require(owner == address(0), "Already initialized");
        owner = _owner;
        emit AccountInitialized(_owner);
    }
    
    /**
     * @notice Validate a user operation
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds The missing account funds
     * @return validationData The validation data
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        console.log("\n=== validateUserOp Debug ===");
        console.log("userOpHash");
        console.logBytes32(userOpHash);
        console.log("Raw signature bytes:");
        console.logBytes(userOp.signature);
        
        // Extract RSV components (ethers v6 format)
        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(userOp.signature);
        console.log("\nExtracted signature components:");
        console.log("v (decimal)");
        console.logUint(uint256(v));
        console.log("v (hex)");
        console.logUint(uint256(v));
        console.log("r");
        console.logBytes32(r);
        console.log("s");
        console.logBytes32(s);

        // Get the prefixed hash
        bytes32 prefixedHash = _ethSignedMessageHash(userOpHash);
        console.log("\nHash values:");
        console.log("userOpHash");
        console.logBytes32(userOpHash);
        console.log("prefixedHash");
        console.logBytes32(prefixedHash);

        // Recover signer
        address recovered = ecrecover(prefixedHash, v, r, s);
        console.log("\nRecovery results:");
        console.log("Recovered address");
        console.logAddress(recovered);
        console.log("Expected owner");
        console.logAddress(owner);
        console.log("=== End validateUserOp Debug ===\n");

        require(recovered == owner, "Invalid signature");
        require(nonce++ == userOp.nonce, "Invalid nonce");
        
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Failed to pay missing funds");
        }
        
        return 0;
    }
    
    function _recoverSigner(bytes32 messageHash, bytes memory signature) internal returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        // Extract r, s, v from raw signature
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        // Normalize v value
        if (v < 27) {
            v += 27;
        }
        
        // Try recovery
        address signer = ecrecover(messageHash, v, r, s);
        require(signer != address(0), "Invalid signature");
        return signer;
    }
    
    function _ethSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        console.log("\n=== _ethSignedMessageHash Debug ===");
        console.log("Input hash");
        console.logBytes32(hash);
        
        // Match ethers.js prefix exactly
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes memory message = abi.encodePacked(hash);
        bytes memory prefixedMessage = abi.encodePacked(prefix, message);
        bytes32 finalHash = keccak256(prefixedMessage);
        
        console.log("Prefix bytes:");
        console.logBytes(prefix);
        console.log("Message bytes:");
        console.logBytes(message);
        console.log("Prefixed message bytes:");
        console.logBytes(prefixedMessage);
        console.log("Final hash:");
        console.logBytes32(finalHash);
        console.log("=== End _ethSignedMessageHash Debug ===\n");
        
        return finalHash;
    }
    
    /**
     * @notice Execute a transaction
     * @param dest The destination address
     * @param value The value to send
     * @param func The function data
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external override {
        require(msg.sender == entryPoint, "Not entry point");
        
        (bool success, ) = dest.call{value: value}(func);
        require(success, "Execution failed");
        
        emit OperationExecuted(dest, value, func);
    }
    
    /**
     * @dev Splits a signature into r, s, v components
     * @param sig The signature to split
     * @return v The v component
     * @return r The r component
     * @return s The s component
     */
    function _splitSignature(bytes memory sig) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        console.log("\n=== _splitSignature Debug ===");
        console.log("Signature length");
        console.logUint(sig.length);
        console.log("Raw signature bytes:");
        console.logBytes(sig);
        
        require(sig.length == 65, "Invalid signature length");
        
        assembly {
            // First 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // Second 32 bytes
            s := mload(add(sig, 64))
            // Final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
        
        // Normalize v value
        if (v < 27) {
            v += 27;
        }
        
        console.log("\nExtracted components:");
        console.log("r");
        console.logBytes32(r);
        console.log("s");
        console.logBytes32(s);
        console.log("v (decimal)");
        console.logUint(uint256(v));
        console.log("v (hex)");
        console.logUint(uint256(v));
        console.log("=== End _splitSignature Debug ===\n");
        
        return (v, r, s);
    }
    
    /**
     * @notice Get the owner of the account
     * @return The owner of the account
     */
    function getOwner() external view returns (address) {
        return owner;
    }
    
    /**
     * @notice Get the nonce of the account
     * @return The nonce of the account
     */
    function getNonce() external view returns (uint256) {
        return nonce;
    }

    receive() external payable {}
} 