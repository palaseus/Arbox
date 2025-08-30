// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CrossChainBridge
 * @notice Cross-chain bridge for arbitrage opportunities across multiple networks
 */
contract CrossChainBridge is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Bridge configuration
    struct BridgeConfig {
        uint256 chainId;
        string name;
        bool isActive;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 fee;
        uint256 gasLimit;
        uint256 timeout;
    }

    // Transfer request
    struct TransferRequest {
        uint256 requestId;
        address sender;
        address recipient;
        address token;
        uint256 amount;
        uint256 sourceChainId;
        uint256 targetChainId;
        uint256 timestamp;
        bool isExecuted;
        bool isCancelled;
        bytes32 proof;
    }

    // Supported networks
    struct Network {
        uint256 chainId;
        string name;
        bool isSupported;
        uint256 gasPrice;
        uint256 blockTime;
        uint256 confirmations;
    }

    // State variables
    mapping(uint256 => BridgeConfig) public bridgeConfigs;
    mapping(uint256 => TransferRequest) public transferRequests;
    mapping(uint256 => Network) public supportedNetworks;
    mapping(address => bool) public authorizedRelayers;
    mapping(address => uint256) public userBalances;
    
    uint256 public requestCounter;
    uint256 public totalTransfers;
    uint256 public totalVolume;
    uint256 public totalFees;
    
    // Events
    event TransferInitiated(
        uint256 indexed requestId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId
    );
    
    event TransferExecuted(
        uint256 indexed requestId,
        address indexed recipient,
        uint256 amount,
        uint256 targetChainId
    );
    
    event TransferCancelled(
        uint256 indexed requestId,
        address indexed sender,
        uint256 amount
    );
    
    event BridgeConfigUpdated(
        uint256 indexed chainId,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 fee
    );
    
    event NetworkAdded(
        uint256 indexed chainId,
        string name,
        uint256 gasPrice,
        uint256 blockTime
    );
    
    event RelayerAuthorized(address indexed relayer);
    event RelayerRevoked(address indexed relayer);

    // Custom errors
    error InvalidChainId();
    error NetworkNotSupported();
    error InvalidAmount();
    error TransferNotFound();
    error TransferAlreadyExecuted();
    error TransferExpired();
    error InsufficientBalance();
    error UnauthorizedRelayer();
    error InvalidProof();

    constructor() Ownable(msg.sender) {
        // Initialize with Ethereum mainnet
        _addNetwork(1, "Ethereum", 20 gwei, 12, 12);
        _addNetwork(137, "Polygon", 30 gwei, 2, 256);
        _addNetwork(42161, "Arbitrum", 0.1 gwei, 1, 1);
        _addNetwork(10, "Optimism", 0.001 gwei, 2, 1);
        _addNetwork(8453, "Base", 0.001 gwei, 2, 1);
        _addNetwork(43114, "Avalanche", 25 gwei, 2, 1);
    }

    /**
     * @notice Initiate a cross-chain transfer
     * @param recipient The recipient address on target chain
     * @param token The token address
     * @param amount The amount to transfer
     * @param targetChainId The target chain ID
     */
    function initiateTransfer(
        address recipient,
        address token,
        uint256 amount,
        uint256 targetChainId
    ) external nonReentrant returns (uint256 requestId) {
        require(!paused(), "Bridge paused");
        require(supportedNetworks[targetChainId].isSupported, "Network not supported");
        require(amount > 0, "Invalid amount");
        
        BridgeConfig storage config = bridgeConfigs[targetChainId];
        require(amount >= config.minAmount, "Amount too low");
        require(amount <= config.maxAmount, "Amount too high");
        
        // Calculate fee
        uint256 fee = (amount * config.fee) / 10000;
        uint256 totalAmount = amount + fee;
        
        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);
        
        // Create transfer request
        requestId = ++requestCounter;
        transferRequests[requestId] = TransferRequest({
            requestId: requestId,
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            sourceChainId: block.chainid,
            targetChainId: targetChainId,
            timestamp: block.timestamp,
            isExecuted: false,
            isCancelled: false,
            proof: bytes32(0)
        });
        
        totalTransfers++;
        totalVolume += amount;
        totalFees += fee;
        
        emit TransferInitiated(requestId, msg.sender, recipient, token, amount, block.chainid, targetChainId);
    }

    /**
     * @notice Execute a cross-chain transfer (called by authorized relayers)
     * @param requestId The transfer request ID
     * @param proof The proof of the transfer
     */
    function executeTransfer(uint256 requestId, bytes32 proof) external nonReentrant {
        require(authorizedRelayers[msg.sender], "Unauthorized relayer");
        
        TransferRequest storage request = transferRequests[requestId];
        require(request.requestId != 0, "Transfer not found");
        require(!request.isExecuted, "Transfer already executed");
        require(!request.isCancelled, "Transfer cancelled");
        require(block.timestamp <= request.timestamp + bridgeConfigs[request.targetChainId].timeout, "Transfer expired");
        
        // Verify proof (in a real implementation, this would verify cross-chain proof)
        require(_verifyProof(request, proof), "Invalid proof");
        
        // Execute transfer
        request.isExecuted = true;
        request.proof = proof;
        
        // Transfer tokens to recipient
        IERC20(request.token).safeTransfer(request.recipient, request.amount);
        
        emit TransferExecuted(requestId, request.recipient, request.amount, request.targetChainId);
    }

    /**
     * @notice Cancel a transfer request
     * @param requestId The transfer request ID
     */
    function cancelTransfer(uint256 requestId) external nonReentrant {
        TransferRequest storage request = transferRequests[requestId];
        require(request.sender == msg.sender, "Not the sender");
        require(!request.isExecuted, "Transfer already executed");
        require(!request.isCancelled, "Transfer already cancelled");
        require(block.timestamp > request.timestamp + bridgeConfigs[request.targetChainId].timeout, "Transfer not expired");
        
        request.isCancelled = true;
        
        // Calculate fee
        BridgeConfig storage config = bridgeConfigs[request.targetChainId];
        uint256 fee = (request.amount * config.fee) / 10000;
        uint256 refundAmount = request.amount + fee;
        
        // Refund tokens to sender
        IERC20(request.token).safeTransfer(msg.sender, refundAmount);
        
        emit TransferCancelled(requestId, msg.sender, refundAmount);
    }

    /**
     * @notice Add a supported network
     * @param chainId The chain ID
     * @param name The network name
     * @param gasPrice The typical gas price
     * @param blockTime The average block time
     * @param confirmations Required confirmations
     */
    function addNetwork(
        uint256 chainId,
        string memory name,
        uint256 gasPrice,
        uint256 blockTime,
        uint256 confirmations
    ) external onlyOwner {
        _addNetwork(chainId, name, gasPrice, blockTime, confirmations);
    }

    /**
     * @notice Update bridge configuration
     * @param chainId The chain ID
     * @param minAmount Minimum transfer amount
     * @param maxAmount Maximum transfer amount
     * @param fee Fee percentage (basis points)
     * @param gasLimit Gas limit for transfers
     * @param timeout Transfer timeout
     */
    function updateBridgeConfig(
        uint256 chainId,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 fee,
        uint256 gasLimit,
        uint256 timeout
    ) external onlyOwner {
        require(supportedNetworks[chainId].isSupported, "Network not supported");
        require(fee <= 1000, "Fee too high"); // Max 10%
        
        bridgeConfigs[chainId] = BridgeConfig({
            chainId: chainId,
            name: supportedNetworks[chainId].name,
            isActive: true,
            minAmount: minAmount,
            maxAmount: maxAmount,
            fee: fee,
            gasLimit: gasLimit,
            timeout: timeout
        });
        
        emit BridgeConfigUpdated(chainId, minAmount, maxAmount, fee);
    }

    /**
     * @notice Authorize a relayer
     * @param relayer The relayer address
     */
    function authorizeRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "Invalid relayer");
        authorizedRelayers[relayer] = true;
        emit RelayerAuthorized(relayer);
    }

    /**
     * @notice Revoke a relayer
     * @param relayer The relayer address
     */
    function revokeRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = false;
        emit RelayerRevoked(relayer);
    }

    /**
     * @notice Get transfer request details
     * @param requestId The request ID
     * @return request The transfer request
     */
    function getTransferRequest(uint256 requestId) 
        external 
        view 
        returns (TransferRequest memory request) 
    {
        return transferRequests[requestId];
    }

    /**
     * @notice Get bridge configuration
     * @param chainId The chain ID
     * @return config The bridge configuration
     */
    function getBridgeConfig(uint256 chainId) 
        external 
        view 
        returns (BridgeConfig memory config) 
    {
        return bridgeConfigs[chainId];
    }

    /**
     * @notice Get network information
     * @param chainId The chain ID
     * @return network The network information
     */
    function getNetwork(uint256 chainId) 
        external 
        view 
        returns (Network memory network) 
    {
        return supportedNetworks[chainId];
    }

    /**
     * @notice Calculate transfer fee
     * @param amount The transfer amount
     * @param targetChainId The target chain ID
     * @return fee The calculated fee
     */
    function calculateFee(uint256 amount, uint256 targetChainId) 
        external 
        view 
        returns (uint256 fee) 
    {
        BridgeConfig storage config = bridgeConfigs[targetChainId];
        return (amount * config.fee) / 10000;
    }

    /**
     * @notice Get bridge statistics
     * @return totalTransfersCount Total number of transfers
     * @return totalVolumeAmount Total volume transferred
     * @return totalFeesAmount Total fees collected
     */
    function getBridgeStats() 
        external 
        view 
        returns (
            uint256 totalTransfersCount,
            uint256 totalVolumeAmount,
            uint256 totalFeesAmount
        ) 
    {
        return (totalTransfers, totalVolume, totalFees);
    }

    /**
     * @notice Pause the bridge
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the bridge
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw collected fees
     * @param token The token to withdraw
     * @param amount The amount to withdraw
     */
    function withdrawFees(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // Internal functions

    /**
     * @notice Add a network
     * @param chainId The chain ID
     * @param name The network name
     * @param gasPrice The typical gas price
     * @param blockTime The average block time
     * @param confirmations Required confirmations
     */
    function _addNetwork(
        uint256 chainId,
        string memory name,
        uint256 gasPrice,
        uint256 blockTime,
        uint256 confirmations
    ) internal {
        supportedNetworks[chainId] = Network({
            chainId: chainId,
            name: name,
            isSupported: true,
            gasPrice: gasPrice,
            blockTime: blockTime,
            confirmations: confirmations
        });
        
        // Set default bridge config
        bridgeConfigs[chainId] = BridgeConfig({
            chainId: chainId,
            name: name,
            isActive: true,
            minAmount: 0.001 ether,
            maxAmount: 1000 ether,
            fee: 50, // 0.5%
            gasLimit: 500000,
            timeout: 3600 // 1 hour
        });
        
        emit NetworkAdded(chainId, name, gasPrice, blockTime);
    }

    /**
     * @notice Verify cross-chain proof (simplified)
     * @param request The transfer request
     * @param proof The proof
     * @return isValid Whether the proof is valid
     */
    function _verifyProof(TransferRequest storage request, bytes32 proof) 
        internal 
        view 
        returns (bool isValid) 
    {
        // In a real implementation, this would verify the cross-chain proof
        // For now, we'll use a simplified verification
        return proof != bytes32(0);
    }
}
