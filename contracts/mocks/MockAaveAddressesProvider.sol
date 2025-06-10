// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/interfaces/IPool.sol";

contract MockAaveAddressesProvider {
    address private immutable _pool;

    constructor(address pool) {
        _pool = pool;
    }

    function getPool() external view returns (address) {
        return _pool;
    }
} 