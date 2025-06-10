// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract MockAaveAddressesProvider {
    address private immutable _pool;

    constructor(address pool) {
        _pool = pool;
    }

    function getPool() external view returns (address) {
        return _pool;
    }
} 