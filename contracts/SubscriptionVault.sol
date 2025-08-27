// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SubscriptionVault is Ownable {
    uint256 public constant PRICE = 199 ether; // Example price
    IERC20 public immutable paymentToken;

    mapping(address => uint256) public subscribedUntil;
    mapping(address => address) public referrerOf;

    event Subscribed(address indexed user, uint256 until, address referrer);

    constructor(address token) Ownable(msg.sender) {
        paymentToken = IERC20(token);
    }

    function subscribe(address referrer) external {
        require(paymentToken.transferFrom(msg.sender, address(this), PRICE), "payment failed");
        uint256 until = block.timestamp + 30 days;
        if (subscribedUntil[msg.sender] < until) {
            subscribedUntil[msg.sender] = until;
        }
        if (referrer != address(0) && referrerOf[msg.sender] == address(0)) {
            referrerOf[msg.sender] = referrer;
        }
        emit Subscribed(msg.sender, subscribedUntil[msg.sender], referrer);
    }
}
