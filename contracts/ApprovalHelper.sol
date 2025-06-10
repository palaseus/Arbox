// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ApprovalHelper
 * @dev Helper contract to set token approvals from any address's context
 */
contract ApprovalHelper {
    /**
     * @notice Approve tokens for a spender from the caller's context
     * @param token The token to approve
     * @param spender The address to approve for
     * @param amount The amount to approve
     */
    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, 0); // Reset to 0 first
        IERC20(token).approve(spender, amount);
    }

    /**
     * @notice Get the current allowance for a token and spender
     * @param token The token to check
     * @param owner The owner of the tokens
     * @param spender The spender to check
     * @return The current allowance
     */
    function getAllowance(address token, address owner, address spender) external view returns (uint256) {
        return IERC20(token).allowance(owner, spender);
    }

    /**
     * @notice Allow the contract to receive ETH
     */
    receive() external payable {}
} 