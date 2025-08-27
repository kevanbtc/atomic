pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTStaking is ReentrancyGuard {
    IERC721Enumerable public immutable nftContract;
    uint256 public rewardRate = 1 ether; // reward per second per NFT

    struct StakeInfo {
        uint256 tokenId;
        uint256 startTime;
    }

    mapping(address => StakeInfo[]) public stakes;
    mapping(uint256 => address) public tokenOwner;
    mapping(address => uint256) public rewards;

    constructor(address _nftContract) {
        nftContract = IERC721Enumerable(_nftContract);
    }

    function stake(uint256 tokenId) external nonReentrant {
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        stakes[msg.sender].push(StakeInfo({tokenId: tokenId, startTime: block.timestamp}));
        tokenOwner[tokenId] = msg.sender;
    }

    function _calculateRewards(address user) internal view returns (uint256) {
        StakeInfo[] memory userStakes = stakes[user];
        uint256 total;
        for (uint256 i = 0; i < userStakes.length; i++) {
            total += (block.timestamp - userStakes[i].startTime) * rewardRate;
        }
        return total;
    }

    function claimRewards() public nonReentrant {
        uint256 reward = _calculateRewards(msg.sender) + rewards[msg.sender];
        require(reward > 0, "No rewards available");
        delete stakes[msg.sender];
        rewards[msg.sender] = 0;
        payable(msg.sender).transfer(reward);
    }

    function unstake(uint256 tokenId) external nonReentrant {
        require(tokenOwner[tokenId] == msg.sender, "Not token owner");
        uint256 index;
        StakeInfo[] storage userStakes = stakes[msg.sender];
        for (uint256 i = 0; i < userStakes.length; i++) {
            if (userStakes[i].tokenId == tokenId) {
                index = i;
                break;
            }
        }
        rewards[msg.sender] += (block.timestamp - userStakes[index].startTime) * rewardRate;
        userStakes[index] = userStakes[userStakes.length - 1];
        userStakes.pop();
        tokenOwner[tokenId] = address(0);
        nftContract.transferFrom(address(this), msg.sender, tokenId);
    }

    receive() external payable {}
}

