// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VPOINT is ERC20, Ownable {
    constructor() ERC20("VPOINT", "VPOINT") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 amount) internal {
        require(from == address(0) || to == address(0), "Soulbound");
        super._update(from, to, amount);
    }
}
