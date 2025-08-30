// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TimeLock
 * @notice Time-lock mechanism for critical operations with multi-signature support
 * @dev Provides delayed execution of critical functions with governance oversight
 */
contract TimeLock is AccessControl, ReentrancyGuard, Pausable {
    
    // Access control roles
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    
    // Time-lock configuration
    uint256 public minDelay;
    uint256 public maxDelay;
    uint256 public gracePeriod;
    uint256 public minimumDelay;
    
    // Proposal tracking
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => bool) public queuedTransactions;
    
    // Multi-signature support
    mapping(bytes32 => mapping(address => bool)) public proposalApprovals;
    mapping(bytes32 => uint256) public proposalApprovalCount;
    uint256 public requiredApprovals;
    
    // Structs
    struct Proposal {
        address target;
        uint256 value;
        bytes data;
        uint256 eta;
        bool executed;
        bool cancelled;
        uint256 approvalCount;
        string description;
        address proposer;
        uint256 timestamp;
    }
    
    // Events
    event ProposalCreated(
        bytes32 indexed proposalId,
        address indexed target,
        uint256 value,
        bytes data,
        uint256 eta,
        string description,
        address proposer
    );
    
    event ProposalApproved(
        bytes32 indexed proposalId,
        address indexed approver,
        uint256 approvalCount
    );
    
    event ProposalExecuted(
        bytes32 indexed proposalId,
        address indexed target,
        uint256 value,
        bytes data
    );
    
    event ProposalCancelled(bytes32 indexed proposalId, address indexed canceller);
    event DelayUpdated(uint256 oldDelay, uint256 newDelay);
    event GracePeriodUpdated(uint256 oldGracePeriod, uint256 newGracePeriod);
    event RequiredApprovalsUpdated(uint256 oldRequired, uint256 newRequired);
    
    // Custom errors
    error ProposalNotFound();
    error ProposalAlreadyExecuted();
    error ProposalAlreadyCancelled();
    error ProposalNotReady();
    error ProposalExpired();
    error InsufficientApprovals();
    error AlreadyApproved();
    error NotAuthorized();
    error InvalidDelay();
    error InvalidTarget();
    error InvalidData();
    
    constructor(
        uint256 _minDelay,
        uint256 _maxDelay,
        uint256 _gracePeriod,
        uint256 _requiredApprovals,
        address _admin
    ) {
        minDelay = _minDelay;
        maxDelay = _maxDelay;
        gracePeriod = _gracePeriod;
        requiredApprovals = _requiredApprovals;
        minimumDelay = _minDelay;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PROPOSER_ROLE, _admin);
        _grantRole(EXECUTOR_ROLE, _admin);
        _grantRole(CANCELLER_ROLE, _admin);
    }
    
    /**
     * @notice Create a new proposal
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Function call data
     * @param description Human-readable description
     * @return proposalId Unique proposal identifier
     */
    function propose(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external onlyRole(PROPOSER_ROLE) returns (bytes32 proposalId) {
        if (target == address(0)) revert InvalidTarget();
        if (data.length == 0) revert InvalidData();
        
        proposalId = keccak256(abi.encode(target, value, data, block.timestamp));
        
        require(!queuedTransactions[proposalId], "Proposal already exists");
        
        uint256 eta = block.timestamp + minDelay;
        
        proposals[proposalId] = Proposal({
            target: target,
            value: value,
            data: data,
            eta: eta,
            executed: false,
            cancelled: false,
            approvalCount: 0,
            description: description,
            proposer: msg.sender,
            timestamp: block.timestamp
        });
        
        queuedTransactions[proposalId] = true;
        
        emit ProposalCreated(proposalId, target, value, data, eta, description, msg.sender);
    }
    
    /**
     * @notice Approve a proposal (multi-signature support)
     * @param proposalId Proposal identifier
     */
    function approveProposal(bytes32 proposalId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.target == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.cancelled) revert ProposalAlreadyCancelled();
        if (proposalApprovals[proposalId][msg.sender]) revert AlreadyApproved();
        
        proposalApprovals[proposalId][msg.sender] = true;
        proposal.approvalCount++;
        proposalApprovalCount[proposalId] = proposal.approvalCount;
        
        emit ProposalApproved(proposalId, msg.sender, proposal.approvalCount);
    }
    
    /**
     * @notice Execute a proposal after delay period
     * @param proposalId Proposal identifier
     */
    function execute(bytes32 proposalId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.target == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.cancelled) revert ProposalAlreadyCancelled();
        if (proposal.approvalCount < requiredApprovals) revert InsufficientApprovals();
        if (block.timestamp < proposal.eta) revert ProposalNotReady();
        if (block.timestamp > proposal.eta + gracePeriod) revert ProposalExpired();
        
        proposal.executed = true;
        
        // Execute the proposal
        (bool success, ) = proposal.target.call{value: proposal.value}(proposal.data);
        require(success, "Proposal execution failed");
        
        emit ProposalExecuted(proposalId, proposal.target, proposal.value, proposal.data);
    }
    
    /**
     * @notice Cancel a proposal
     * @param proposalId Proposal identifier
     */
    function cancel(bytes32 proposalId) external onlyRole(CANCELLER_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.target == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.cancelled) revert ProposalAlreadyCancelled();
        
        proposal.cancelled = true;
        queuedTransactions[proposalId] = false;
        
        emit ProposalCancelled(proposalId, msg.sender);
    }
    
    /**
     * @notice Update minimum delay
     * @param newDelay New minimum delay
     */
    function updateMinDelay(uint256 newDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newDelay < minimumDelay) revert InvalidDelay();
        if (newDelay > maxDelay) revert InvalidDelay();
        
        uint256 oldDelay = minDelay;
        minDelay = newDelay;
        
        emit DelayUpdated(oldDelay, newDelay);
    }
    
    /**
     * @notice Update grace period
     * @param newGracePeriod New grace period
     */
    function updateGracePeriod(uint256 newGracePeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldGracePeriod = gracePeriod;
        gracePeriod = newGracePeriod;
        
        emit GracePeriodUpdated(oldGracePeriod, newGracePeriod);
    }
    
    /**
     * @notice Update required approvals
     * @param newRequired New required approval count
     */
    function updateRequiredApprovals(uint256 newRequired) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldRequired = requiredApprovals;
        requiredApprovals = newRequired;
        
        emit RequiredApprovalsUpdated(oldRequired, newRequired);
    }
    
    /**
     * @notice Get proposal details
     * @param proposalId Proposal identifier
     * @return Proposal details
     */
    function getProposal(bytes32 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }
    
    /**
     * @notice Check if proposal is approved by address
     * @param proposalId Proposal identifier
     * @param approver Approver address
     * @return True if approved
     */
    function isApprovedBy(bytes32 proposalId, address approver) external view returns (bool) {
        return proposalApprovals[proposalId][approver];
    }
    
    /**
     * @notice Check if proposal is ready for execution
     * @param proposalId Proposal identifier
     * @return True if ready
     */
    function isReady(bytes32 proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.target == address(0)) return false;
        if (proposal.executed || proposal.cancelled) return false;
        if (proposal.approvalCount < requiredApprovals) return false;
        if (block.timestamp < proposal.eta) return false;
        if (block.timestamp > proposal.eta + gracePeriod) return false;
        
        return true;
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
