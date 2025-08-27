// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VCHAN is ERC20, ERC20Burnable, Pausable, Ownable {
    constructor() ERC20("VCHAN", "VCHAN") Ownable(msg.sender) {
        _mint(msg.sender, 100_000 ether);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(address from, address to, uint256 amount) internal whenNotPaused {
        super._update(from, to, amount);
    }
}
