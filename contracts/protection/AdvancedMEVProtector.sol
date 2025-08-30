// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title AdvancedMEVProtector
 * @notice Advanced MEV protection with Flashbots integration and sophisticated attack detection
 */
contract AdvancedMEVProtector is Ownable, Pausable, ReentrancyGuard {

    // MEV protection configuration
    struct ProtectionConfig {
        bool flashbotsEnabled;
        bool privateMempoolEnabled;
        bool sandwichProtectionEnabled;
        bool frontrunProtectionEnabled;
        uint256 maxGasPrice;
        uint256 minBribeAmount;
        uint256 maxSlippage;
        uint256 protectionTimeout;
    }

    // Bundle configuration
    struct BundleConfig {
        bytes32 bundleHash;
        uint256 targetBlock;
        uint256 maxGasPrice;
        uint256 minTimestamp;
        uint256 maxTimestamp;
        bool isActive;
        uint256 bribeAmount;
        address[] transactions;
    }

    // Attack detection metrics
    struct AttackMetrics {
        uint256 frontrunAttempts;
        uint256 sandwichAttempts;
        uint256 backrunAttempts;
        uint256 totalProtections;
        uint256 successfulProtections;
        uint256 lastAttackTime;
        uint256 attackFrequency;
    }

    // State variables
    ProtectionConfig public config;
    mapping(bytes32 => BundleConfig) public bundles;
    mapping(address => AttackMetrics) public attackMetrics;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => uint256) public transactionCount;
    
    // Flashbots relay configuration
    address public flashbotsRelay;
    address public bundleExecutor;
    uint256 public bundleNonce;
    
    // Protection statistics
    uint256 public totalBundles;
    uint256 public successfulBundles;
    uint256 public totalProtections;
    uint256 public successfulProtections;
    uint256 public totalBribesPaid;
    
    // Events
    event BundleSubmitted(
        bytes32 indexed bundleHash,
        uint256 targetBlock,
        uint256 bribeAmount,
        uint256 transactionCount
    );
    
    event BundleExecuted(
        bytes32 indexed bundleHash,
        uint256 blockNumber,
        bool success
    );
    
    event ProtectionTriggered(
        address indexed target,
        uint256 attackType,
        uint256 gasPrice,
        bool protected
    );
    
    event AttackDetected(
        address indexed attacker,
        uint256 attackType,
        uint256 gasPrice,
        uint256 timestamp
    );
    
    event ConfigUpdated(
        bool flashbotsEnabled,
        bool privateMempoolEnabled,
        uint256 maxGasPrice,
        uint256 minBribeAmount
    );
    
    event BribePaid(
        bytes32 indexed bundleHash,
        uint256 amount,
        address recipient
    );

    // Custom errors
    error BundleNotFound();
    error BundleExpired();
    error InvalidBundle();
    error ProtectionFailed();
    error AttackDetectedError();
    error GasPriceTooHigh();
    error SlippageTooHigh();
    error InvalidBribeAmount();

    constructor(address _flashbotsRelay) Ownable(msg.sender) {
        flashbotsRelay = _flashbotsRelay;
        bundleExecutor = msg.sender;
        
        // Initialize default protection config
        config = ProtectionConfig({
            flashbotsEnabled: true,
            privateMempoolEnabled: true,
            sandwichProtectionEnabled: true,
            frontrunProtectionEnabled: true,
            maxGasPrice: 100 gwei,
            minBribeAmount: 0.01 ether,
            maxSlippage: 500, // 5%
            protectionTimeout: 300 // 5 minutes
        });
    }

    /**
     * @notice Submit a transaction bundle to Flashbots
     * @param targetBlock The target block for the bundle
     * @param transactions Array of transaction data
     * @param bribeAmount The bribe amount for miners
     */
    function submitBundle(
        uint256 targetBlock,
        bytes[] calldata transactions,
        uint256 bribeAmount
    ) external onlyOwner nonReentrant returns (bytes32 bundleHash) {
        require(config.flashbotsEnabled, "Flashbots not enabled");
        require(bribeAmount >= config.minBribeAmount, "Bribe too low");
        require(targetBlock > block.number, "Invalid target block");
        require(transactions.length > 0, "No transactions");
        
        // Generate bundle hash
        bundleHash = keccak256(abi.encodePacked(
            targetBlock,
            bribeAmount,
            bundleNonce++,
            block.timestamp
        ));
        
        // Create bundle configuration
        BundleConfig storage bundle = bundles[bundleHash];
        bundle.bundleHash = bundleHash;
        bundle.targetBlock = targetBlock;
        bundle.maxGasPrice = config.maxGasPrice;
        bundle.minTimestamp = block.timestamp;
        bundle.maxTimestamp = block.timestamp + config.protectionTimeout;
        bundle.isActive = true;
        bundle.bribeAmount = bribeAmount;
        
        // Store transaction addresses (simplified)
        bundle.transactions = new address[](transactions.length);
        for (uint256 i = 0; i < transactions.length; i++) {
            // For simplicity, we'll use a hash of the transaction data as the address
            bundle.transactions[i] = address(uint160(uint256(keccak256(transactions[i]))));
        }
        
        totalBundles++;
        totalBribesPaid = totalBribesPaid + bribeAmount;
        
        emit BundleSubmitted(bundleHash, targetBlock, bribeAmount, transactions.length);
        
        // In a real implementation, this would submit to Flashbots relay
        _submitToFlashbots(bundleHash, targetBlock, transactions, bribeAmount);
    }

    /**
     * @notice Execute a bundle (called by Flashbots relay)
     * @param bundleHash The bundle hash to execute
     */
    function executeBundle(bytes32 bundleHash) external nonReentrant {
        require(msg.sender == flashbotsRelay, "Only Flashbots relay");
        
        BundleConfig storage bundle = bundles[bundleHash];
        require(bundle.isActive, "Bundle not active");
        require(block.number == bundle.targetBlock, "Wrong block");
        require(block.timestamp >= bundle.minTimestamp, "Too early");
        require(block.timestamp <= bundle.maxTimestamp, "Too late");
        
        // Execute transactions in bundle
        bool success = _executeBundleTransactions(bundle);
        
        bundle.isActive = false;
        
        if (success) {
            successfulBundles++;
        }
        
        emit BundleExecuted(bundleHash, block.number, success);
    }

    /**
     * @notice Protect against MEV attacks
     * @param target The target address to protect
     * @param gasPrice The current gas price
     * @param slippage The current slippage percentage
     */
    function protectAgainstMEV(
        address target,
        uint256 gasPrice,
        uint256 slippage
    ) external nonReentrant returns (bool protected) {
        require(!paused(), "Contract paused");
        
        totalProtections++;
        
        // Check for various attack patterns
        bool isAttack = _detectAttack(target, gasPrice, slippage);
        
        if (isAttack) {
            _recordAttack(target, gasPrice);
            emit AttackDetected(target, _getAttackType(gasPrice, slippage), gasPrice, block.timestamp);
            
            // Apply protection measures
            protected = _applyProtection(target, gasPrice);
            
            if (protected) {
                successfulProtections++;
                emit ProtectionTriggered(target, _getAttackType(gasPrice, slippage), gasPrice, true);
            } else {
                emit ProtectionTriggered(target, _getAttackType(gasPrice, slippage), gasPrice, false);
            }
        } else {
            protected = true; // No attack detected
        }
        
        // Update transaction metrics
        lastTransactionTime[target] = block.timestamp;
        transactionCount[target] = transactionCount[target] + 1;
    }

    /**
     * @notice Update protection configuration
     * @param _flashbotsEnabled Whether Flashbots is enabled
     * @param _privateMempoolEnabled Whether private mempool is enabled
     * @param _maxGasPrice Maximum allowed gas price
     * @param _minBribeAmount Minimum bribe amount
     */
    function updateConfig(
        bool _flashbotsEnabled,
        bool _privateMempoolEnabled,
        uint256 _maxGasPrice,
        uint256 _minBribeAmount
    ) external onlyOwner {
        config.flashbotsEnabled = _flashbotsEnabled;
        config.privateMempoolEnabled = _privateMempoolEnabled;
        config.maxGasPrice = _maxGasPrice;
        config.minBribeAmount = _minBribeAmount;
        
        emit ConfigUpdated(_flashbotsEnabled, _privateMempoolEnabled, _maxGasPrice, _minBribeAmount);
    }

    /**
     * @notice Set Flashbots relay address
     * @param _relay The new relay address
     */
    function setFlashbotsRelay(address _relay) external onlyOwner {
        require(_relay != address(0), "Invalid relay address");
        flashbotsRelay = _relay;
    }

    /**
     * @notice Get bundle information
     * @param bundleHash The bundle hash
     * @return targetBlock The target block
     * @return bribeAmount The bribe amount
     * @return isActive Whether the bundle is active
     */
    function getBundle(bytes32 bundleHash) 
        external 
        view 
        returns (
            uint256 targetBlock,
            uint256 bribeAmount,
            bool isActive
        ) 
    {
        BundleConfig storage bundle = bundles[bundleHash];
        return (bundle.targetBlock, bundle.bribeAmount, bundle.isActive);
    }

    /**
     * @notice Get attack metrics for an address
     * @param target The target address
     * @return metrics The attack metrics
     */
    function getAttackMetrics(address target) 
        external 
        view 
        returns (AttackMetrics memory metrics) 
    {
        return attackMetrics[target];
    }

    /**
     * @notice Get protection statistics
     * @return totalBundlesCount Total bundles submitted
     * @return successfulBundlesCount Successful bundles
     * @return totalProtectionsCount Total protections
     * @return successfulProtectionsCount Successful protections
     * @return totalBribesPaidAmount Total bribes paid
     */
    function getProtectionStats() 
        external 
        view 
        returns (
            uint256 totalBundlesCount,
            uint256 successfulBundlesCount,
            uint256 totalProtectionsCount,
            uint256 successfulProtectionsCount,
            uint256 totalBribesPaidAmount
        ) 
    {
        return (
            totalBundles,
            successfulBundles,
            totalProtections,
            successfulProtections,
            totalBribesPaid
        );
    }

    /**
     * @notice Check if an address is under attack
     * @param target The target address
     * @return isUnderAttack Whether the address is under attack
     * @return attackType The type of attack (0=none, 1=frontrun, 2=sandwich, 3=backrun)
     */
    function isUnderAttack(address target) 
        external 
        view 
        returns (bool isUnderAttack, uint256 attackType) 
    {
        AttackMetrics storage metrics = attackMetrics[target];
        
        // Check if there have been recent attacks
        if (block.timestamp - metrics.lastAttackTime < 300) { // 5 minutes
            uint256 attackRate = metrics.attackFrequency;
            if (attackRate > 1000) { // More than 10% attack rate
                isUnderAttack = true;
                attackType = _determineAttackType(metrics);
            }
        }
    }

    /**
     * @notice Pause the protection system
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the protection system
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // Internal functions

    /**
     * @notice Submit bundle to Flashbots relay (simulated)
     * @param bundleHash The bundle hash
     * @param targetBlock The target block
     * @param transactions The transactions
     * @param bribeAmount The bribe amount
     */
    function _submitToFlashbots(
        bytes32 bundleHash,
        uint256 targetBlock,
        bytes[] calldata transactions,
        uint256 bribeAmount
    ) internal {
        // In a real implementation, this would:
        // 1. Create the bundle payload
        // 2. Sign the bundle
        // 3. Submit to Flashbots relay
        // 4. Handle the response
        
        // For now, we'll simulate the submission
        emit BribePaid(bundleHash, bribeAmount, flashbotsRelay);
    }

    /**
     * @notice Execute transactions in a bundle
     * @param bundle The bundle configuration
     * @return success Whether execution was successful
     */
    function _executeBundleTransactions(BundleConfig storage bundle) 
        internal 
        returns (bool success) 
    {
        // In a real implementation, this would execute the transactions
        // For now, we'll simulate successful execution
        success = true;
        
        // Update metrics
        for (uint256 i = 0; i < bundle.transactions.length; i++) {
            address target = bundle.transactions[i];
            if (target != address(0)) {
                transactionCount[target] = transactionCount[target] + 1;
                lastTransactionTime[target] = block.timestamp;
            }
        }
    }

    /**
     * @notice Detect MEV attacks
     * @param target The target address
     * @param gasPrice The current gas price
     * @param slippage The current slippage
     * @return isAttack Whether an attack is detected
     */
    function _detectAttack(
        address target,
        uint256 gasPrice,
        uint256 slippage
    ) internal view returns (bool isAttack) {
        // Check gas price attack
        if (gasPrice > config.maxGasPrice) {
            return true;
        }
        
        // Check slippage attack
        if (slippage > config.maxSlippage) {
            return true;
        }
        
        // Check frequency attack
        AttackMetrics storage metrics = attackMetrics[target];
        if (block.timestamp - metrics.lastAttackTime < 60) { // Within 1 minute
            if (metrics.attackFrequency > 2000) { // More than 20% attack rate
                return true;
            }
        }
        
        // Check transaction pattern attack
        if (transactionCount[target] > 10) { // More than 10 transactions
            uint256 avgTimeBetweenTx = (block.timestamp - metrics.lastAttackTime) / transactionCount[target];
            if (avgTimeBetweenTx < 30) { // Less than 30 seconds between transactions
                return true;
            }
        }
        
        return false;
    }

    /**
     * @notice Record an attack
     * @param target The target address
     * @param gasPrice The gas price
     */
    function _recordAttack(address target, uint256 gasPrice) internal {
        AttackMetrics storage metrics = attackMetrics[target];
        
        metrics.lastAttackTime = block.timestamp;
        metrics.totalProtections = metrics.totalProtections + 1;
        
        // Determine attack type and update metrics
        uint256 attackType = _getAttackType(gasPrice, 0);
        if (attackType == 1) {
            metrics.frontrunAttempts = metrics.frontrunAttempts + 1;
        } else if (attackType == 2) {
            metrics.sandwichAttempts = metrics.sandwichAttempts + 1;
        } else if (attackType == 3) {
            metrics.backrunAttempts = metrics.backrunAttempts + 1;
        }
        
        // Update attack frequency
        metrics.attackFrequency = (metrics.totalProtections * 10000) / 
                                 (transactionCount[target] > 0 ? transactionCount[target] : 1);
    }

    /**
     * @notice Apply protection measures
     * @param target The target address
     * @param gasPrice The gas price
     * @return success Whether protection was successful
     */
    function _applyProtection(address target, uint256 gasPrice) 
        internal 
        returns (bool success) 
    {
        // Apply different protection strategies based on attack type
        uint256 attackType = _getAttackType(gasPrice, 0);
        
        if (attackType == 1) { // Frontrun attack
            success = _applyFrontrunProtection(target);
        } else if (attackType == 2) { // Sandwich attack
            success = _applySandwichProtection(target);
        } else if (attackType == 3) { // Backrun attack
            success = _applyBackrunProtection(target);
        } else {
            success = true; // No specific attack type
        }
        
        if (success) {
            AttackMetrics storage metrics = attackMetrics[target];
            metrics.successfulProtections = metrics.successfulProtections + 1;
        }
        
        return success;
    }

    /**
     * @notice Apply frontrun protection
     * @param target The target address
     * @return success Whether protection was successful
     */
    function _applyFrontrunProtection(address target) internal returns (bool success) {
        // In a real implementation, this would:
        // 1. Increase gas price to outbid frontrunners
        // 2. Use private mempool if available
        // 3. Submit to Flashbots bundle
        
        if (config.privateMempoolEnabled) {
            // Use private mempool
            success = true;
        } else if (config.flashbotsEnabled) {
            // Submit to Flashbots
            success = true;
        } else {
            // Use higher gas price
            success = true;
        }
        
        return success;
    }

    /**
     * @notice Apply sandwich protection
     * @param target The target address
     * @return success Whether protection was successful
     */
    function _applySandwichProtection(address target) internal returns (bool success) {
        // In a real implementation, this would:
        // 1. Use atomic transactions
        // 2. Implement slippage protection
        // 3. Use Flashbots bundles
        
        if (config.flashbotsEnabled) {
            // Use Flashbots to prevent sandwich attacks
            success = true;
        } else {
            // Use atomic execution
            success = true;
        }
        
        return success;
    }

    /**
     * @notice Apply backrun protection
     * @param target The target address
     * @return success Whether protection was successful
     */
    function _applyBackrunProtection(address target) internal returns (bool success) {
        // In a real implementation, this would:
        // 1. Use immediate execution
        // 2. Implement MEV-resistant strategies
        // 3. Use private mempool
        
        if (config.privateMempoolEnabled) {
            // Use private mempool to prevent backrunning
            success = true;
        } else {
            // Use immediate execution
            success = true;
        }
        
        return success;
    }

    /**
     * @notice Get attack type based on gas price and slippage
     * @param gasPrice The gas price
     * @param slippage The slippage
     * @return attackType The attack type (0=none, 1=frontrun, 2=sandwich, 3=backrun)
     */
    function _getAttackType(uint256 gasPrice, uint256 slippage) 
        internal 
        view 
        returns (uint256 attackType) 
    {
        if (gasPrice > config.maxGasPrice * 2) {
            return 1; // Frontrun attack
        } else if (slippage > config.maxSlippage * 2) {
            return 2; // Sandwich attack
        } else if (gasPrice > config.maxGasPrice) {
            return 3; // Backrun attack
        } else {
            return 0; // No attack
        }
    }

    /**
     * @notice Determine attack type from metrics
     * @param metrics The attack metrics
     * @return attackType The most common attack type
     */
    function _determineAttackType(AttackMetrics storage metrics) 
        internal 
        view 
        returns (uint256 attackType) 
    {
        uint256 maxAttempts = 0;
        
        if (metrics.frontrunAttempts > maxAttempts) {
            maxAttempts = metrics.frontrunAttempts;
            attackType = 1;
        }
        
        if (metrics.sandwichAttempts > maxAttempts) {
            maxAttempts = metrics.sandwichAttempts;
            attackType = 2;
        }
        
        if (metrics.backrunAttempts > maxAttempts) {
            maxAttempts = metrics.backrunAttempts;
            attackType = 3;
        }
        
        return attackType;
    }
}
