// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockAavePool {
    using SafeERC20 for IERC20;

    // Mock premium rate (0.09%)
    uint256 private constant PREMIUM_RATE = 9;

    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external {
        // Calculate premiums
        uint256[] memory premiums = new uint256[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            premiums[i] = (amounts[i] * PREMIUM_RATE) / 10000;
        }

        // Transfer tokens to receiver
        for (uint256 i = 0; i < assets.length; i++) {
            IERC20(assets[i]).safeTransfer(receiverAddress, amounts[i]);
        }

        // Call executeOperation on receiver
        (bool success, bytes memory returndata) = receiverAddress.call(
            abi.encodeWithSignature(
                "executeOperation(address[],uint256[],uint256[],address,bytes)",
                assets,
                amounts,
                premiums,
                onBehalfOf,
                params
            )
        );
        if (!success) {
            if (returndata.length > 0) {
                // Bubble up revert reason
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("Flash loan callback failed");
            }
        }

        // Transfer tokens back plus premium
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountToRepay = amounts[i] + premiums[i];
            IERC20(assets[i]).safeTransferFrom(
                receiverAddress,
                address(this),
                amountToRepay
            );
        }
    }

    function _collectPremiums(address receiver, address[] calldata assets, uint256[] calldata amounts) internal {
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 premium = 0;
            IERC20(assets[i]).safeTransferFrom(
                receiver,
                address(this),
                amounts[i] + premium
            );
        }
    }
} 