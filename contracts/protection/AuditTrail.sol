// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AuditTrail
 * @notice Comprehensive audit trail system for regulatory compliance and security monitoring
 * @dev Provides immutable logging of all critical operations with privacy protection
 */
contract AuditTrail is AccessControl, ReentrancyGuard, Pausable {
    
    // Access control roles
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant PRIVACY_ROLE = keccak256("PRIVACY_ROLE");
    
    // Audit trail configuration
    uint256 public maxLogEntries;
    uint256 public retentionPeriod;
    uint256 public privacyMode;
    
    // Log entry tracking
    mapping(uint256 => LogEntry) public logEntries;
    mapping(bytes32 => uint256[]) public operationLogs;
    mapping(address => uint256[]) public userLogs;
    mapping(uint256 => uint256[]) public timestampLogs;
    
    // Privacy and compliance
    mapping(address => bool) public privacyWhitelist;
    mapping(bytes32 => bool) public redactedOperations;
    mapping(uint256 => bool) public redactedEntries;
    
    // Statistics
    uint256 public totalLogEntries;
    uint256 public totalRedactedEntries;
    uint256 public lastAuditTimestamp;
    
    // Structs
    struct LogEntry {
        uint256 entryId;
        bytes32 operationHash;
        address user;
        address contractAddress;
        bytes4 functionSelector;
        bytes data;
        uint256 timestamp;
        uint256 blockNumber;
        uint256 gasUsed;
        uint256 gasPrice;
        bool isRedacted;
        string description;
        LogLevel level;
        LogCategory category;
    }
    
    enum LogLevel {
        INFO,
        WARNING,
        ERROR,
        CRITICAL
    }
    
    enum LogCategory {
        ARBITRAGE,
        SECURITY,
        COMPLIANCE,
        GOVERNANCE,
        FINANCIAL,
        TECHNICAL
    }
    
    // Events
    event LogEntryCreated(
        uint256 indexed entryId,
        bytes32 indexed operationHash,
        address indexed user,
        address contractAddress,
        bytes4 functionSelector,
        uint256 timestamp,
        LogLevel level,
        LogCategory category,
        string description
    );
    
    event LogEntryRedacted(
        uint256 indexed entryId,
        address indexed redactor,
        uint256 timestamp
    );
    
    event PrivacyWhitelistUpdated(
        address indexed address_,
        bool whitelisted,
        address indexed updater
    );
    
    event RetentionPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event MaxLogEntriesUpdated(uint256 oldMax, uint256 newMax);
    event PrivacyModeUpdated(uint256 oldMode, uint256 newMode);
    
    // Custom errors
    error LogEntryNotFound();
    error LogEntryAlreadyRedacted();
    error InsufficientPermissions();
    error InvalidRetentionPeriod();
    error InvalidMaxEntries();
    error PrivacyViolation();
    error DataTooLarge();
    error InvalidLogLevel();
    error InvalidLogCategory();
    
    constructor(
        uint256 _maxLogEntries,
        uint256 _retentionPeriod,
        uint256 _privacyMode,
        address _admin
    ) {
        maxLogEntries = _maxLogEntries;
        retentionPeriod = _retentionPeriod;
        privacyMode = _privacyMode;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(AUDITOR_ROLE, _admin);
        _grantRole(COMPLIANCE_ROLE, _admin);
        _grantRole(PRIVACY_ROLE, _admin);
    }
    
    /**
     * @notice Create a new log entry
     * @param operationHash Hash of the operation
     * @param user User address
     * @param contractAddress Contract address
     * @param functionSelector Function selector
     * @param data Function data
     * @param description Human-readable description
     * @param level Log level
     * @param category Log category
     * @return entryId Log entry identifier
     */
    function createLogEntry(
        bytes32 operationHash,
        address user,
        address contractAddress,
        bytes4 functionSelector,
        bytes calldata data,
        string calldata description,
        LogLevel level,
        LogCategory category
    ) external onlyRole(AUDITOR_ROLE) returns (uint256 entryId) {
        if (data.length > 1024) revert DataTooLarge();
        
        // Check privacy mode
        if (privacyMode > 0 && !privacyWhitelist[user]) {
            // In privacy mode, only log whitelisted addresses
            return 0;
        }
        
        entryId = totalLogEntries + 1;
        
        // Manage log entry limits
        if (entryId > maxLogEntries) {
            _cleanupOldEntries();
        }
        
        LogEntry memory entry = LogEntry({
            entryId: entryId,
            operationHash: operationHash,
            user: user,
            contractAddress: contractAddress,
            functionSelector: functionSelector,
            data: data,
            timestamp: block.timestamp,
            blockNumber: block.number,
            gasUsed: gasleft(),
            gasPrice: tx.gasprice,
            isRedacted: false,
            description: description,
            level: level,
            category: category
        });
        
        logEntries[entryId] = entry;
        operationLogs[operationHash].push(entryId);
        userLogs[user].push(entryId);
        timestampLogs[block.timestamp].push(entryId);
        
        totalLogEntries = entryId;
        
        emit LogEntryCreated(
            entryId,
            operationHash,
            user,
            contractAddress,
            functionSelector,
            block.timestamp,
            level,
            category,
            description
        );
    }
    
    /**
     * @notice Redact a log entry for privacy
     * @param entryId Log entry identifier
     */
    function redactLogEntry(uint256 entryId) external onlyRole(PRIVACY_ROLE) {
        LogEntry storage entry = logEntries[entryId];
        if (entry.entryId == 0) revert LogEntryNotFound();
        if (entry.isRedacted) revert LogEntryAlreadyRedacted();
        
        entry.isRedacted = true;
        totalRedactedEntries++;
        
        emit LogEntryRedacted(entryId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Update privacy whitelist
     * @param address_ Address to update
     * @param whitelisted Whether to whitelist
     */
    function updatePrivacyWhitelist(address address_, bool whitelisted) external onlyRole(PRIVACY_ROLE) {
        privacyWhitelist[address_] = whitelisted;
        
        emit PrivacyWhitelistUpdated(address_, whitelisted, msg.sender);
    }
    
    /**
     * @notice Update retention period
     * @param newRetentionPeriod New retention period
     */
    function updateRetentionPeriod(uint256 newRetentionPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRetentionPeriod < 1 days) revert InvalidRetentionPeriod();
        
        uint256 oldPeriod = retentionPeriod;
        retentionPeriod = newRetentionPeriod;
        
        emit RetentionPeriodUpdated(oldPeriod, newRetentionPeriod);
    }
    
    /**
     * @notice Update maximum log entries
     * @param newMaxEntries New maximum entries
     */
    function updateMaxLogEntries(uint256 newMaxEntries) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newMaxEntries < 1000) revert InvalidMaxEntries();
        
        uint256 oldMax = maxLogEntries;
        maxLogEntries = newMaxEntries;
        
        emit MaxLogEntriesUpdated(oldMax, newMaxEntries);
    }
    
    /**
     * @notice Update privacy mode
     * @param newPrivacyMode New privacy mode
     */
    function updatePrivacyMode(uint256 newPrivacyMode) external onlyRole(PRIVACY_ROLE) {
        uint256 oldMode = privacyMode;
        privacyMode = newPrivacyMode;
        
        emit PrivacyModeUpdated(oldMode, newPrivacyMode);
    }
    
    /**
     * @notice Get log entry by ID
     * @param entryId Log entry identifier
     * @return Log entry details
     */
    function getLogEntry(uint256 entryId) external view returns (LogEntry memory) {
        LogEntry memory entry = logEntries[entryId];
        if (entry.entryId == 0) revert LogEntryNotFound();
        
        // Check privacy permissions
        if (entry.isRedacted && !hasRole(PRIVACY_ROLE, msg.sender)) {
            revert PrivacyViolation();
        }
        
        return entry;
    }
    
    /**
     * @notice Get log entries for an operation
     * @param operationHash Operation hash
     * @return Array of log entry IDs
     */
    function getOperationLogs(bytes32 operationHash) external view returns (uint256[] memory) {
        return operationLogs[operationHash];
    }
    
    /**
     * @notice Get log entries for a user
     * @param user User address
     * @return Array of log entry IDs
     */
    function getUserLogs(address user) external view returns (uint256[] memory) {
        if (!hasRole(AUDITOR_ROLE, msg.sender) && !hasRole(COMPLIANCE_ROLE, msg.sender)) {
            revert InsufficientPermissions();
        }
        
        return userLogs[user];
    }
    
    /**
     * @notice Get log entries for a timestamp
     * @param timestamp Timestamp
     * @return Array of log entry IDs
     */
    function getTimestampLogs(uint256 timestamp) external view returns (uint256[] memory) {
        return timestampLogs[timestamp];
    }
    
    /**
     * @notice Get audit statistics
     * @return _totalLogEntries Total number of log entries
     * @return _totalRedactedEntries Total number of redacted entries
     * @return _lastAuditTimestamp Timestamp of last audit
     * @return _maxLogEntries Maximum number of log entries
     * @return _retentionPeriod Retention period in seconds
     */
    function getAuditStatistics() external view returns (
        uint256 _totalLogEntries,
        uint256 _totalRedactedEntries,
        uint256 _lastAuditTimestamp,
        uint256 _maxLogEntries,
        uint256 _retentionPeriod
    ) {
        return (
            totalLogEntries,
            totalRedactedEntries,
            lastAuditTimestamp,
            maxLogEntries,
            retentionPeriod
        );
    }
    
    /**
     * @notice Perform compliance audit
     * @param startTimestamp Start timestamp
     * @param endTimestamp End timestamp
     * @return auditResults Audit results
     */
    function performComplianceAudit(
        uint256 startTimestamp,
        uint256 endTimestamp
    ) external onlyRole(COMPLIANCE_ROLE) returns (bytes memory auditResults) {
        // This would implement compliance checking logic
        // For now, return empty results
        auditResults = "";
        lastAuditTimestamp = block.timestamp;
    }
    
    /**
     * @notice Clean up old log entries
     */
    function _cleanupOldEntries() internal {
        uint256 cutoffTime = block.timestamp - retentionPeriod;
        
        // This is a simplified cleanup - in production, you'd want more sophisticated logic
        // to avoid hitting gas limits
        if (totalLogEntries > maxLogEntries * 9 / 10) {
            // Trigger cleanup when 90% full
            // Implementation would remove entries older than retention period
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
}
