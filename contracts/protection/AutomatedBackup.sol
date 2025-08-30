// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AutomatedBackup
 * @notice Automated backup and recovery system for critical contract state
 * @dev Provides backup creation, verification, and recovery mechanisms
 */
contract AutomatedBackup is Ownable, Pausable, ReentrancyGuard {

    // Backup data structure
    struct BackupData {
        uint256 backupId;           // Unique backup identifier
        uint256 timestamp;          // When backup was created
        bytes32 dataHash;           // Hash of backup data
        bytes data;                 // Actual backup data
        bool isVerified;            // Whether backup has been verified
        bool isRecovered;           // Whether backup has been used for recovery
        string description;         // Human-readable description
    }

    // Recovery configuration
    struct RecoveryConfig {
        uint256 maxBackups;         // Maximum number of backups to keep
        uint256 backupInterval;     // Minimum interval between backups (seconds)
        uint256 verificationDelay;  // Delay before backup can be used (seconds)
        bool autoBackup;            // Whether to create backups automatically
        bool requireVerification;   // Whether backup verification is required
    }

    // State variables
    mapping(uint256 => BackupData) public backups;
    mapping(bytes32 => bool) public verifiedHashes;
    mapping(address => bool) public authorizedBackupCreators;
    mapping(address => bool) public authorizedRecoveryOperators;
    
    uint256 private _backupIdCounter;
    
    RecoveryConfig public recoveryConfig;
    
    uint256 public lastBackupTime;
    uint256 public totalBackups;
    uint256 public totalRecoveries;
    uint256 public totalVerifications;
    
    // Events
    event BackupCreated(
        uint256 indexed backupId,
        bytes32 indexed dataHash,
        uint256 timestamp,
        string description
    );
    
    event BackupVerified(
        uint256 indexed backupId,
        bytes32 indexed dataHash,
        address indexed verifier
    );
    
    event RecoveryInitiated(
        uint256 indexed backupId,
        address indexed operator,
        uint256 timestamp
    );
    
    event RecoveryCompleted(
        uint256 indexed backupId,
        address indexed operator,
        bool success
    );
    
    event BackupDeleted(
        uint256 indexed backupId,
        address indexed operator
    );
    
    event RecoveryConfigUpdated(
        uint256 maxBackups,
        uint256 backupInterval,
        uint256 verificationDelay,
        bool autoBackup,
        bool requireVerification
    );
    
    event AuthorizedOperatorUpdated(
        address indexed operator,
        bool isAuthorized,
        string role
    );

    // Custom errors
    error BackupNotFound(uint256 backupId);
    error BackupNotVerified(uint256 backupId);
    error BackupAlreadyRecovered(uint256 backupId);
    error BackupIntervalNotElapsed();
    error MaxBackupsExceeded();
    error VerificationDelayNotElapsed();
    error UnauthorizedOperator();
    error InvalidBackupData();
    error RecoveryFailed();
    error InvalidRecoveryConfig();

    constructor() Ownable(msg.sender) {
        recoveryConfig = RecoveryConfig({
            maxBackups: 10,
            backupInterval: 3600, // 1 hour
            verificationDelay: 1800, // 30 minutes
            autoBackup: true,
            requireVerification: true
        });
        
        // Authorize owner as backup creator and recovery operator
        authorizedBackupCreators[msg.sender] = true;
        authorizedRecoveryOperators[msg.sender] = true;
    }

    /**
     * @notice Create a new backup
     * @param data Backup data
     * @param description Human-readable description
     * @return backupId ID of the created backup
     */
    function createBackup(bytes calldata data, string calldata description) 
        external 
        returns (uint256 backupId) 
    {
        require(authorizedBackupCreators[msg.sender], "Unauthorized backup creator");
        require(data.length > 0, "Backup data cannot be empty");
        
        // Check backup interval
        if (block.timestamp - lastBackupTime < recoveryConfig.backupInterval) {
            revert BackupIntervalNotElapsed();
        }
        
        // Check max backups limit
        if (totalBackups >= recoveryConfig.maxBackups) {
            // Delete oldest backup
            deleteOldestBackup();
        }
        
        backupId = _backupIdCounter;
        _backupIdCounter++;
        
        bytes32 dataHash = keccak256(data);
        
        backups[backupId] = BackupData({
            backupId: backupId,
            timestamp: block.timestamp,
            dataHash: dataHash,
            data: data,
            isVerified: false,
            isRecovered: false,
            description: description
        });
        
        totalBackups++;
        lastBackupTime = block.timestamp;
        
        emit BackupCreated(backupId, dataHash, block.timestamp, description);
        
        return backupId;
    }

    /**
     * @notice Verify a backup
     * @param backupId ID of the backup to verify
     * @return success Whether verification was successful
     */
    function verifyBackup(uint256 backupId) external returns (bool success) {
        require(authorizedRecoveryOperators[msg.sender], "Unauthorized recovery operator");
        
        BackupData storage backup = backups[backupId];
        if (backup.timestamp == 0) {
            revert BackupNotFound(backupId);
        }
        
        // Verify data integrity
        bytes32 calculatedHash = keccak256(backup.data);
        if (calculatedHash != backup.dataHash) {
            return false;
        }
        
        backup.isVerified = true;
        verifiedHashes[backup.dataHash] = true;
        totalVerifications++;
        
        emit BackupVerified(backupId, backup.dataHash, msg.sender);
        
        return true;
    }

    /**
     * @notice Initiate recovery from a backup
     * @param backupId ID of the backup to recover from
     * @return success Whether recovery was successful
     */
    function initiateRecovery(uint256 backupId) external returns (bool success) {
        require(authorizedRecoveryOperators[msg.sender], "Unauthorized recovery operator");
        
        BackupData storage backup = backups[backupId];
        if (backup.timestamp == 0) {
            revert BackupNotFound(backupId);
        }
        
        if (backup.isRecovered) {
            revert BackupAlreadyRecovered(backupId);
        }
        
        if (recoveryConfig.requireVerification && !backup.isVerified) {
            revert BackupNotVerified(backupId);
        }
        
        // Check verification delay
        if (block.timestamp - backup.timestamp < recoveryConfig.verificationDelay) {
            revert VerificationDelayNotElapsed();
        }
        
        emit RecoveryInitiated(backupId, msg.sender, block.timestamp);
        
        // Perform recovery (this would be implemented by the calling contract)
        success = performRecovery(backup.data);
        
        if (success) {
            backup.isRecovered = true;
            totalRecoveries++;
        }
        
        emit RecoveryCompleted(backupId, msg.sender, success);
        
        return success;
    }

    /**
     * @notice Delete a backup
     * @param backupId ID of the backup to delete
     */
    function deleteBackup(uint256 backupId) external onlyOwner {
        BackupData storage backup = backups[backupId];
        if (backup.timestamp == 0) {
            revert BackupNotFound(backupId);
        }
        
        delete backups[backupId];
        totalBackups--;
        
        emit BackupDeleted(backupId, msg.sender);
    }

    /**
     * @notice Update recovery configuration
     * @param maxBackups Maximum number of backups to keep
     * @param backupInterval Minimum interval between backups
     * @param verificationDelay Delay before backup can be used
     * @param autoBackup Whether to create backups automatically
     * @param requireVerification Whether backup verification is required
     */
    function updateRecoveryConfig(
        uint256 maxBackups,
        uint256 backupInterval,
        uint256 verificationDelay,
        bool autoBackup,
        bool requireVerification
    ) external onlyOwner {
        if (maxBackups == 0 || backupInterval == 0 || verificationDelay == 0) {
            revert InvalidRecoveryConfig();
        }
        
        recoveryConfig = RecoveryConfig({
            maxBackups: maxBackups,
            backupInterval: backupInterval,
            verificationDelay: verificationDelay,
            autoBackup: autoBackup,
            requireVerification: requireVerification
        });
        
        emit RecoveryConfigUpdated(maxBackups, backupInterval, verificationDelay, autoBackup, requireVerification);
    }

    /**
     * @notice Authorize or revoke backup creator
     * @param operator Address to authorize/revoke
     * @param isAuthorized Whether to authorize
     */
    function setBackupCreator(address operator, bool isAuthorized) external onlyOwner {
        authorizedBackupCreators[operator] = isAuthorized;
        emit AuthorizedOperatorUpdated(operator, isAuthorized, "backup_creator");
    }

    /**
     * @notice Authorize or revoke recovery operator
     * @param operator Address to authorize/revoke
     * @param isAuthorized Whether to authorize
     */
    function setRecoveryOperator(address operator, bool isAuthorized) external onlyOwner {
        authorizedRecoveryOperators[operator] = isAuthorized;
        emit AuthorizedOperatorUpdated(operator, isAuthorized, "recovery_operator");
    }

    /**
     * @notice Get backup data
     * @param backupId ID of the backup
     * @return backup Backup data structure
     */
    function getBackup(uint256 backupId) external view returns (BackupData memory backup) {
        backup = backups[backupId];
        if (backup.timestamp == 0) {
            revert BackupNotFound(backupId);
        }
        return backup;
    }

    /**
     * @notice Get all backup IDs
     * @return backupIds Array of backup IDs
     */
    function getAllBackupIds() external view returns (uint256[] memory backupIds) {
        backupIds = new uint256[](totalBackups);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _backupIdCounter; i++) {
            if (backups[i].timestamp != 0) {
                backupIds[index] = i;
                index++;
            }
        }
        
        return backupIds;
    }

    /**
     * @notice Check if backup is verified
     * @param backupId ID of the backup
     * @return verified Whether backup is verified
     */
    function isBackupVerified(uint256 backupId) external view returns (bool verified) {
        BackupData storage backup = backups[backupId];
        if (backup.backupId == 0) {
            revert BackupNotFound(backupId);
        }
        return backup.isVerified;
    }

    /**
     * @notice Get recovery statistics
     * @return _totalBackups Number of total backups
     * @return _totalRecoveries Number of total recoveries
     * @return _totalVerifications Number of total verifications
     * @return _lastBackupTime Timestamp of last backup
     */
    function getRecoveryStats() external view returns (
        uint256 _totalBackups,
        uint256 _totalRecoveries,
        uint256 _totalVerifications,
        uint256 _lastBackupTime
    ) {
        return (totalBackups, totalRecoveries, totalVerifications, lastBackupTime);
    }

    // Internal functions
    function deleteOldestBackup() internal {
        uint256 oldestBackupId = type(uint256).max;
        uint256 oldestTimestamp = type(uint256).max;
        
        for (uint256 i = 0; i < _backupIdCounter; i++) {
            BackupData storage backup = backups[i];
            if (backup.timestamp != 0 && backup.timestamp < oldestTimestamp) {
                oldestBackupId = i;
                oldestTimestamp = backup.timestamp;
            }
        }
        
        if (oldestBackupId != type(uint256).max) {
            delete backups[oldestBackupId];
            totalBackups--;
        }
    }

    function performRecovery(bytes memory data) internal returns (bool success) {
        // This function would be implemented by the calling contract
        // For now, we'll just return true as a placeholder
        // In a real implementation, this would:
        // 1. Decode the backup data
        // 2. Validate the data structure
        // 3. Apply the recovery logic
        // 4. Return success/failure
        
        try this.decodeBackupData(data) returns (bool) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @notice Decode backup data (external function for try/catch)
     * @param data Backup data to decode
     * @return success Whether decoding was successful
     */
    function decodeBackupData(bytes memory data) external pure returns (bool success) {
        // This is a placeholder implementation
        // In a real system, this would decode the backup data
        // and validate its structure
        
        if (data.length == 0) {
            return false;
        }
        
        // Basic validation - check if data has minimum required structure
        // This would be more sophisticated in a real implementation
        
        return true;
    }

    /**
     * @notice Pause the contract (emergency function)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
