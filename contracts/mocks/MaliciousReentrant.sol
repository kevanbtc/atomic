// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWaterVault {
    function transferCredits(uint256 creditId, address to) external;
}

contract MaliciousReentrant {
    bool private attacking = false;
    
    function attemptReentrancy(address waterVault, uint256 creditId) external {
        if (!attacking) {
            attacking = true;
            // This should fail due to ReentrancyGuard
            IWaterVault(waterVault).transferCredits(creditId, address(this));
        }
    }
    
    // This would be called if reentrancy was possible
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public returns (bytes4) {
        if (attacking) {
            // Try to reenter
            IWaterVault(msg.sender).transferCredits(1, address(this));
        }
        return this.onERC721Received.selector;
    }
}