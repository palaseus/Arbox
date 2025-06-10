// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAaveLendingPool {
    // Mock premium rate (0.09%)
    uint256 private constant PREMIUM_RATE = 9;

    function flashLoan(
        address receiver,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external {
        require(assets.length == amounts.length, "Invalid input");
        
        // Calculate premiums
        uint256[] memory premiums = new uint256[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            premiums[i] = (amounts[i] * PREMIUM_RATE) / 10000;
        }

        // Transfer tokens to receiver
        for (uint256 i = 0; i < assets.length; i++) {
            IERC20(assets[i]).transfer(receiver, amounts[i]);
        }

        // Call executeOperation
        (bool success, ) = receiver.call(
            abi.encodeWithSignature(
                "executeOperation(address[],uint256[],uint256[],address,bytes)",
                assets,
                amounts,
                premiums,
                onBehalfOf,
                params
            )
        );
        require(success, "executeOperation failed");

        // Transfer tokens back plus premium
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountToRepay = amounts[i] + premiums[i];
            require(
                IERC20(assets[i]).transferFrom(receiver, address(this), amountToRepay),
                "Repayment failed"
            );
        }
    }
} 