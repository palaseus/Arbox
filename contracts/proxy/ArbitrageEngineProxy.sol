// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ArbitrageEngineProxy
 * @notice Upgradeable proxy for AdvancedArbitrageEngine using ERC1967 pattern
 */
contract ArbitrageEngineProxy is ERC1967Proxy {
    constructor(
        address _implementation,
        bytes memory _data
    ) ERC1967Proxy(_implementation, _data) {}
}

/**
 * @title ArbitrageEngineProxyAdmin
 * @notice Admin contract for managing the ArbitrageEngineProxy
 */
contract ArbitrageEngineProxyAdmin is AccessControl {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    event ProxyUpgraded(address indexed implementation);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }
    
    /**
     * @notice Upgrade the proxy implementation
     * @param proxy The proxy contract address
     * @param implementation The new implementation address
     */
    function upgrade(address proxy, address implementation) 
        external 
        onlyRole(UPGRADER_ROLE) 
    {
        // Use low-level call to upgrade via ERC1967Proxy
        (bool success, ) = proxy.call(
            abi.encodeWithSignature("upgradeToAndCall(address,bytes)", implementation, "")
        );
        require(success, "Upgrade failed");
        emit ProxyUpgraded(implementation);
    }
    
    /**
     * @notice Upgrade the proxy implementation and call a function
     * @param proxy The proxy contract address
     * @param implementation The new implementation address
     * @param data The function call data
     */
    function upgradeAndCall(
        address proxy, 
        address implementation, 
        bytes memory data
    ) 
        external 
        onlyRole(UPGRADER_ROLE) 
    {
        // Use low-level call to upgrade and call
        (bool success, ) = proxy.call(
            abi.encodeWithSignature("upgradeToAndCall(address,bytes)", implementation, data)
        );
        require(success, "Upgrade and call failed");
        emit ProxyUpgraded(implementation);
    }
    
    /**
     * @notice Get the current implementation address
     * @param proxy The proxy contract address
     * @return The current implementation address
     */
    function getImplementation(address proxy) external view returns (address) {
        // ERC1967 implementation slot
        bytes32 slot = keccak256("eip1967.proxy.implementation");
        bytes32 value;
        assembly {
            value := sload(add(proxy, slot))
        }
        return address(uint160(uint256(value)));
    }
    
    /**
     * @notice Get the admin address
     * @param proxy The proxy contract address
     * @return The admin address
     */
    function getAdmin(address proxy) external view returns (address) {
        // ERC1967 admin slot
        bytes32 slot = keccak256("eip1967.proxy.admin");
        bytes32 value;
        assembly {
            value := sload(add(proxy, slot))
        }
        return address(uint160(uint256(value)));
    }
    
    /**
     * @notice Change the admin of the proxy
     * @param proxy The proxy contract address
     * @param newAdmin The new admin address
     */
    function changeProxyAdmin(address proxy, address newAdmin) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        address previousAdmin = this.getAdmin(proxy);
        
        // Use low-level call to change admin
        (bool success, ) = proxy.call(
            abi.encodeWithSignature("changeAdmin(address)", newAdmin)
        );
        require(success, "Change admin failed");
        
        emit AdminChanged(previousAdmin, newAdmin);
    }
}
