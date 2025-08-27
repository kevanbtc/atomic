// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AffiliateRouter is Ownable {
    IERC20 public immutable paymentToken;
    mapping(address => uint256) public balances;
    constructor(address token) Ownable(msg.sender) {
        paymentToken = IERC20(token);
    }

    function recordCommission(address referrer, uint256 amount) external onlyOwner {
        balances[referrer] += amount;
    }

    function claim() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "nothing");
        balances[msg.sender] = 0;
        require(paymentToken.transfer(msg.sender, bal), "transfer failed");
    }
}
