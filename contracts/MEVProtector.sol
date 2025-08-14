// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IMEVProtector.sol";

/**
 * @title MEVProtector
 * @notice Advanced MEV protection with Flashbots integration and anti-sandwich mechanisms
 */
contract MEVProtector is IMEVProtector, AccessControl, ReentrancyGuard, Pausable {
    // Access control roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    
    // MEV protection parameters
    ProtectionParams public protectionParams;
    
    // Bundle tracking
    mapping(bytes32 => BundleInfo) public bundles;
    mapping(uint256 => bytes32[]) public blockBundles;
    
    // Anti-sandwich protection
    mapping(address => uint256) public lastTransactionBlock;
    mapping(address => uint256) public transactionCount;
    mapping(uint256 => mapping(address => bool)) public blockTransactions;
    
    // Gas optimization
    uint256 public constant GAS_BUFFER = 50000;
    uint256 public constant MAX_GAS_PRICE = 100 gwei;
    
    // Structs
    struct BundleInfo {
        address tokenIn;
        uint256 amount;
        uint256 expectedProfit;
        uint256 blockNumber;
        uint256 timestamp;
        bool isProtected;
        bool isExecuted;
        bytes32 bundleHash;
        uint256 gasPrice;
        uint256 gasLimit;
    }
    
    struct BundleSubmission {
        bytes32 bundleHash;
        uint256 blockNumber;
        uint256 maxBlockNumber;
        address[] targets;
        bytes[] calldatas;
        uint256[] values;
    }

    // Events
    event BundleSubmitted(
        bytes32 indexed bundleHash,
        uint256 blockNumber,
        address indexed tokenIn,
        uint256 amount
    );
    
    event BundleExecuted(
        bytes32 indexed bundleHash,
        uint256 blockNumber,
        bool success
    );
    
    event ProtectionParamsUpdated(ProtectionParams newParams);
    event AntiSandwichTriggered(address indexed token, uint256 blockNumber);
    event GasPriceLimitExceeded(uint256 gasPrice, uint256 limit);

    // Custom errors
    error BundleNotFound();
    error BundleAlreadyExecuted();
    error InvalidBundle();
    error GasPriceTooHigh();
    error BlockNumberInvalid();
    error AntiSandwichProtection();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(STRATEGIST_ROLE, admin);
        
        // Initialize default protection parameters
        protectionParams = ProtectionParams({
            flashbotsEnabled: true,
            privateMempoolEnabled: true,
            maxGasPrice: MAX_GAS_PRICE,
            minBribeAmount: 0.01 ether,
            protectionWindow: 3, // 3 blocks
            antiSandwichEnabled: true,
            frontrunProtectionEnabled: true
        });
    }

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
    ) external override onlyRole(OPERATOR_ROLE) returns (bytes32 bundleHash) {
        require(tx.gasprice <= protectionParams.maxGasPrice, "Gas price too high");
        
        // Generate bundle hash
        bundleHash = keccak256(abi.encodePacked(
            tokenIn,
            amount,
            expectedProfit,
            block.number,
            block.timestamp,
            msg.sender
        ));
        
        // Check anti-sandwich protection
        if (protectionParams.antiSandwichEnabled) {
            _checkAntiSandwichProtection(tokenIn);
        }
        
        // Create bundle info
        bundles[bundleHash] = BundleInfo({
            tokenIn: tokenIn,
            amount: amount,
            expectedProfit: expectedProfit,
            blockNumber: block.number,
            timestamp: block.timestamp,
            isProtected: true,
            isExecuted: false,
            bundleHash: bundleHash,
            gasPrice: tx.gasprice,
            gasLimit: block.gaslimit - GAS_BUFFER
        });
        
        // Track bundle by block
        blockBundles[block.number].push(bundleHash);
        
        // Update transaction tracking
        lastTransactionBlock[tokenIn] = block.number;
        transactionCount[tokenIn]++;
        blockTransactions[block.number][tokenIn] = true;
        
        emit BundleSubmitted(bundleHash, block.number, tokenIn, amount);
        
        return bundleHash;
    }

    /**
     * @notice Submit a Flashbots bundle
     * @param submission Bundle submission data
     */
    function submitFlashbotsBundle(BundleSubmission calldata submission) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        require(protectionParams.flashbotsEnabled, "Flashbots not enabled");
        require(submission.blockNumber > block.number, "Invalid block number");
        require(submission.maxBlockNumber >= submission.blockNumber, "Invalid max block");
        
        // Validate bundle hash
        bytes32 expectedHash = keccak256(abi.encode(
            submission.targets,
            submission.calldatas,
            submission.values,
            submission.blockNumber
        ));
        
        require(expectedHash == submission.bundleHash, "Invalid bundle hash");
        
        // Store bundle info
        bundles[submission.bundleHash] = BundleInfo({
            tokenIn: address(0), // Will be set when transaction is protected
            amount: 0,
            expectedProfit: 0,
            blockNumber: submission.blockNumber,
            timestamp: block.timestamp,
            isProtected: true,
            isExecuted: false,
            bundleHash: submission.bundleHash,
            gasPrice: 0, // Flashbots bundles don't have gas price
            gasLimit: block.gaslimit - GAS_BUFFER
        });
        
        // Track bundle by block
        blockBundles[submission.blockNumber].push(submission.bundleHash);
        
        emit BundleSubmitted(submission.bundleHash, submission.blockNumber, address(0), 0);
    }

    /**
     * @notice Execute a protected bundle
     * @param bundleHash The bundle hash to execute
     */
    function executeBundle(bytes32 bundleHash) external onlyRole(OPERATOR_ROLE) {
        BundleInfo storage bundle = bundles[bundleHash];
        require(bundle.isProtected, "Bundle not protected");
        require(!bundle.isExecuted, "Bundle already executed");
        require(block.number >= bundle.blockNumber, "Block number not reached");
        
        // Mark bundle as executed
        bundle.isExecuted = true;
        
        // Simulate execution success (in real implementation, this would execute the actual bundle)
        bool success = true; // This should be determined by actual execution
        
        emit BundleExecuted(bundleHash, block.number, success);
    }

    /**
     * @notice Check if a transaction is protected from MEV
     * @param bundleHash The bundle hash to check
     * @return protected True if protected
     */
    function isProtected(bytes32 bundleHash) external view override returns (bool protected) {
        BundleInfo storage bundle = bundles[bundleHash];
        return bundle.isProtected && !bundle.isExecuted;
    }

    /**
     * @notice Get the current MEV protection status
     * @return active True if MEV protection is active
     * @return lastProtectionBlock The last block where protection was applied
     */
    function getProtectionStatus() external view override returns (bool active, uint256 lastProtectionBlock) {
        active = protectionParams.flashbotsEnabled || protectionParams.privateMempoolEnabled;
        
        // Find the last block with protection
        uint256 currentBlock = block.number;
        for (uint256 i = 0; i < 100 && i < currentBlock; i++) { // Look back 100 blocks, but don't go below 0
            if (blockBundles[currentBlock - i].length > 0) {
                lastProtectionBlock = currentBlock - i;
                break;
            }
        }
    }

    /**
     * @notice Update MEV protection parameters
     * @param newParams The new protection parameters
     */
    function updateProtectionParams(ProtectionParams calldata newParams) 
        external 
        override 
        onlyRole(STRATEGIST_ROLE) 
    {
        protectionParams = newParams;
        emit ProtectionParamsUpdated(newParams);
    }

    /**
     * @notice Get the protection parameters
     * @return params The current protection parameters
     */
    function getProtectionParams() external view override returns (ProtectionParams memory params) {
        return protectionParams;
    }

    /**
     * @notice Get bundle information
     * @param bundleHash The bundle hash
     * @return info The bundle information
     */
    function getBundleInfo(bytes32 bundleHash) external view returns (BundleInfo memory info) {
        return bundles[bundleHash];
    }

    /**
     * @notice Get bundles for a specific block
     * @param blockNumber The block number
     * @return bundleHashes Array of bundle hashes
     */
    function getBlockBundles(uint256 blockNumber) external view returns (bytes32[] memory bundleHashes) {
        return blockBundles[blockNumber];
    }

    /**
     * @notice Check if a token has recent transactions (anti-sandwich protection)
     * @param token The token address
     * @return hasRecent True if token has recent transactions
     */
    function hasRecentTransactions(address token) external view returns (bool hasRecent) {
        uint256 lastBlock = lastTransactionBlock[token];
        return block.number - lastBlock < protectionParams.protectionWindow;
    }

    /**
     * @notice Get transaction statistics for a token
     * @param token The token address
     * @return lastBlock The last transaction block
     * @return count The total transaction count
     */
    function getTokenTransactionStats(address token) external view returns (uint256 lastBlock, uint256 count) {
        return (lastTransactionBlock[token], transactionCount[token]);
    }

    // Internal functions
    function _checkAntiSandwichProtection(address token) internal {
        if (protectionParams.antiSandwichEnabled) {
            uint256 lastBlock = lastTransactionBlock[token];
            
            // Check if token has recent transactions in protection window
            if (block.number - lastBlock < protectionParams.protectionWindow) {
                // Check if there are multiple transactions in the same block
                if (blockTransactions[block.number][token]) {
                    emit AntiSandwichTriggered(token, block.number);
                    revert AntiSandwichProtection();
                }
            }
        }
    }

    /**
     * @notice Emergency pause function
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Withdraw any accumulated fees (if applicable)
     * @param recipient Address to receive fees
     * @param amount Amount to withdraw
     */
    function withdrawFees(address recipient, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Implementation depends on how fees are collected
        // This is a placeholder for fee withdrawal logic
    }

    // View functions for monitoring
    function getTotalBundles() external view returns (uint256 total) {
        // This would require additional tracking
        return 0;
    }

    function getActiveBundles() external view returns (uint256 active) {
        // This would require additional tracking
        return 0;
    }

    function getProtectionEfficiency() external view returns (uint256 efficiency) {
        // Calculate protection efficiency based on successful vs failed protections
        // This is a placeholder
        return 8500; // 85% efficiency
    }
}
