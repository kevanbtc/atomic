// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SubscriptionKeyNFT
 * @dev ERC-1155 contract for ESG system subscription keys with tiered access,
 *      revenue management, and automatic distribution
 */
contract SubscriptionKeyNFT is 
    ERC1155, 
    ERC1155Burnable, 
    ERC1155Supply, 
    AccessControl, 
    ReentrancyGuard, 
    Pausable 
{
    using SafeERC20 for IERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REVENUE_MANAGER_ROLE = keccak256("REVENUE_MANAGER_ROLE");
    bytes32 public constant SUBSCRIPTION_MANAGER_ROLE = keccak256("SUBSCRIPTION_MANAGER_ROLE");

    // Subscription tiers
    enum SubscriptionTier {
        Bronze,   // ID: 1 - 30 days
        Silver,   // ID: 2 - 90 days  
        Gold,     // ID: 3 - 365 days
        Platinum  // ID: 4 - Lifetime
    }

    // Subscription tier metadata
    struct TierInfo {
        string name;
        uint256 duration;           // Duration in seconds (0 = lifetime)
        uint256 price;             // Price in payment token
        uint256 maxSupply;         // Maximum supply (0 = unlimited)
        bool isActive;             // Active status
        uint256 accessLevel;       // Access level (higher = more access)
        string[] features;         // Array of included features
        uint256 royaltyRate;       // Royalty rate for secondary sales (basis points)
    }

    // User subscription data
    struct UserSubscription {
        uint256 tier;              // Subscription tier
        uint256 expiryTimestamp;   // Expiry timestamp (0 = lifetime)
        uint256 purchaseTimestamp; // Purchase timestamp
        bool isActive;             // Active status
        uint256 renewalCount;      // Number of renewals
        address referrer;          // Referrer for rewards
    }

    // Revenue distribution configuration
    struct RevenueDistribution {
        address recipient;         // Revenue recipient
        uint256 percentage;        // Percentage in basis points
        bool isActive;            // Active status
        string role;              // Role description
    }

    // Financial wrapper for revenue tracking
    struct RevenueMetrics {
        uint256 totalRevenue;      // Total revenue generated
        uint256 distributedAmount; // Amount distributed
        uint256 pendingAmount;     // Pending distribution
        uint256 lastDistribution;  // Last distribution timestamp
        mapping(address => uint256) recipientShares; // Individual shares
    }

    // Storage
    mapping(uint256 => TierInfo) public tierInfo;
    mapping(address => UserSubscription) public userSubscriptions;
    mapping(address => uint256) public userSubscriptionBalance; // Balance by tier
    RevenueDistribution[] public revenueRecipients;
    RevenueMetrics public revenueMetrics;
    
    // Payment configuration
    IERC20 public paymentToken;
    address public platformTreasury;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public referralRewardRate = 500; // 5% referral reward
    
    // Access control mappings
    mapping(address => mapping(string => bool)) public userFeatureAccess;
    mapping(uint256 => mapping(string => bool)) public tierFeatureMapping;
    mapping(address => bool) public blacklistedUsers;

    // Events
    event SubscriptionPurchased(
        address indexed user,
        uint256 indexed tier,
        uint256 duration,
        uint256 price,
        address referrer
    );
    event SubscriptionRenewed(
        address indexed user,
        uint256 indexed tier,
        uint256 newExpiry,
        uint256 price
    );
    event SubscriptionExpired(address indexed user, uint256 tier);
    event RevenueDistributed(uint256 totalAmount, uint256 timestamp);
    event TierConfigured(uint256 indexed tier, string name, uint256 price, uint256 duration);
    event FeatureAccessGranted(address indexed user, string feature, uint256 tier);
    event ReferralRewardPaid(address indexed referrer, address indexed user, uint256 amount);
    event UserBlacklisted(address indexed user, bool status);

    constructor(
        string memory uri,
        address _paymentToken,
        address _platformTreasury
    ) ERC1155(uri) {
        require(_paymentToken != address(0), "SubscriptionKeyNFT: Invalid payment token");
        require(_platformTreasury != address(0), "SubscriptionKeyNFT: Invalid treasury");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(REVENUE_MANAGER_ROLE, msg.sender);
        _grantRole(SUBSCRIPTION_MANAGER_ROLE, msg.sender);

        paymentToken = IERC20(_paymentToken);
        platformTreasury = _platformTreasury;

        // Initialize tier configurations
        _initializeTiers();
    }

    /**
     * @dev Purchase a subscription key
     */
    function purchaseSubscription(
        uint256 tier,
        address referrer
    ) external nonReentrant whenNotPaused {
        require(!blacklistedUsers[msg.sender], "SubscriptionKeyNFT: User blacklisted");
        require(tier >= 1 && tier <= 4, "SubscriptionKeyNFT: Invalid tier");
        require(tierInfo[tier].isActive, "SubscriptionKeyNFT: Tier not active");
        
        TierInfo memory info = tierInfo[tier];
        
        // Check max supply
        if (info.maxSupply > 0) {
            require(totalSupply(tier) < info.maxSupply, "SubscriptionKeyNFT: Max supply reached");
        }

        // Handle payment
        uint256 totalPrice = info.price;
        paymentToken.safeTransferFrom(msg.sender, address(this), totalPrice);

        // Handle referral reward
        uint256 referralReward = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referralReward = (totalPrice * referralRewardRate) / BASIS_POINTS;
            paymentToken.safeTransfer(referrer, referralReward);
            emit ReferralRewardPaid(referrer, msg.sender, referralReward);
        }

        // Update revenue metrics
        uint256 netRevenue = totalPrice - referralReward;
        revenueMetrics.totalRevenue += netRevenue;
        revenueMetrics.pendingAmount += netRevenue;

        // Calculate expiry
        uint256 expiry = info.duration > 0 
            ? block.timestamp + info.duration 
            : 0; // Lifetime

        // Update user subscription
        UserSubscription storage subscription = userSubscriptions[msg.sender];
        subscription.tier = tier;
        subscription.expiryTimestamp = expiry;
        subscription.purchaseTimestamp = block.timestamp;
        subscription.isActive = true;
        subscription.referrer = referrer;
        subscription.renewalCount = subscription.renewalCount + 1;

        // Mint subscription key NFT
        _mint(msg.sender, tier, 1, "");

        // Grant feature access
        _grantFeatureAccess(msg.sender, tier);

        emit SubscriptionPurchased(msg.sender, tier, info.duration, totalPrice, referrer);
    }

    /**
     * @dev Renew an existing subscription
     */
    function renewSubscription() external nonReentrant whenNotPaused {
        require(!blacklistedUsers[msg.sender], "SubscriptionKeyNFT: User blacklisted");
        
        UserSubscription storage subscription = userSubscriptions[msg.sender];
        require(subscription.isActive, "SubscriptionKeyNFT: No active subscription");
        require(subscription.tier >= 1 && subscription.tier <= 4, "SubscriptionKeyNFT: Invalid tier");

        TierInfo memory info = tierInfo[subscription.tier];
        require(info.isActive, "SubscriptionKeyNFT: Tier not active");
        require(info.duration > 0, "SubscriptionKeyNFT: Cannot renew lifetime subscription");

        // Handle payment
        paymentToken.safeTransferFrom(msg.sender, address(this), info.price);

        // Handle referral reward if referrer exists
        uint256 referralReward = 0;
        if (subscription.referrer != address(0)) {
            referralReward = (info.price * referralRewardRate) / BASIS_POINTS;
            paymentToken.safeTransfer(subscription.referrer, referralReward);
            emit ReferralRewardPaid(subscription.referrer, msg.sender, referralReward);
        }

        // Update revenue metrics
        uint256 netRevenue = info.price - referralReward;
        revenueMetrics.totalRevenue += netRevenue;
        revenueMetrics.pendingAmount += netRevenue;

        // Extend subscription
        uint256 currentExpiry = subscription.expiryTimestamp;
        uint256 baseTime = currentExpiry > block.timestamp ? currentExpiry : block.timestamp;
        subscription.expiryTimestamp = baseTime + info.duration;
        subscription.renewalCount += 1;

        emit SubscriptionRenewed(
            msg.sender, 
            subscription.tier, 
            subscription.expiryTimestamp, 
            info.price
        );
    }

    /**
     * @dev Check if user has active subscription
     */
    function hasActiveSubscription(address user) external view returns (bool) {
        if (blacklistedUsers[user]) return false;
        
        UserSubscription memory subscription = userSubscriptions[user];
        if (!subscription.isActive) return false;
        
        // Check expiry (0 = lifetime)
        return subscription.expiryTimestamp == 0 || block.timestamp <= subscription.expiryTimestamp;
    }

    /**
     * @dev Check if user has access to specific feature
     */
    function hasFeatureAccess(address user, string memory feature) external view returns (bool) {
        if (blacklistedUsers[user]) return false;
        if (!this.hasActiveSubscription(user)) return false;
        
        return userFeatureAccess[user][feature];
    }

    /**
     * @dev Get user's subscription tier level
     */
    function getUserAccessLevel(address user) external view returns (uint256) {
        if (blacklistedUsers[user]) return 0;
        if (!this.hasActiveSubscription(user)) return 0;
        
        uint256 tier = userSubscriptions[user].tier;
        return tierInfo[tier].accessLevel;
    }

    /**
     * @dev Distribute pending revenue to recipients
     */
    function distributeRevenue() external onlyRole(REVENUE_MANAGER_ROLE) nonReentrant {
        uint256 pendingAmount = revenueMetrics.pendingAmount;
        require(pendingAmount > 0, "SubscriptionKeyNFT: No pending revenue");

        uint256 totalDistributed = 0;
        uint256 totalPercentage = 0;

        // Calculate total active percentage
        for (uint i = 0; i < revenueRecipients.length; i++) {
            if (revenueRecipients[i].isActive) {
                totalPercentage += revenueRecipients[i].percentage;
            }
        }

        require(totalPercentage <= BASIS_POINTS, "SubscriptionKeyNFT: Invalid total percentage");

        // Distribute to recipients
        for (uint i = 0; i < revenueRecipients.length; i++) {
            RevenueDistribution memory recipient = revenueRecipients[i];
            if (recipient.isActive) {
                uint256 share = (pendingAmount * recipient.percentage) / BASIS_POINTS;
                if (share > 0) {
                    paymentToken.safeTransfer(recipient.recipient, share);
                    revenueMetrics.recipientShares[recipient.recipient] += share;
                    totalDistributed += share;
                }
            }
        }

        // Send remaining to treasury
        uint256 remaining = pendingAmount - totalDistributed;
        if (remaining > 0) {
            paymentToken.safeTransfer(platformTreasury, remaining);
        }

        // Update metrics
        revenueMetrics.distributedAmount += pendingAmount;
        revenueMetrics.pendingAmount = 0;
        revenueMetrics.lastDistribution = block.timestamp;

        emit RevenueDistributed(pendingAmount, block.timestamp);
    }

    /**
     * @dev Configure subscription tier
     */
    function configureTier(
        uint256 tier,
        string memory name,
        uint256 duration,
        uint256 price,
        uint256 maxSupply,
        uint256 accessLevel,
        string[] memory features,
        bool isActive
    ) external onlyRole(SUBSCRIPTION_MANAGER_ROLE) {
        require(tier >= 1 && tier <= 4, "SubscriptionKeyNFT: Invalid tier");

        tierInfo[tier] = TierInfo({
            name: name,
            duration: duration,
            price: price,
            maxSupply: maxSupply,
            isActive: isActive,
            accessLevel: accessLevel,
            features: features,
            royaltyRate: 500 // 5% default royalty
        });

        // Update feature mappings
        for (uint i = 0; i < features.length; i++) {
            tierFeatureMapping[tier][features[i]] = true;
        }

        emit TierConfigured(tier, name, price, duration);
    }

    /**
     * @dev Add revenue recipient
     */
    function addRevenueRecipient(
        address recipient,
        uint256 percentage,
        string memory role
    ) external onlyRole(REVENUE_MANAGER_ROLE) {
        require(recipient != address(0), "SubscriptionKeyNFT: Invalid recipient");
        require(percentage > 0 && percentage <= BASIS_POINTS, "SubscriptionKeyNFT: Invalid percentage");

        revenueRecipients.push(RevenueDistribution({
            recipient: recipient,
            percentage: percentage,
            isActive: true,
            role: role
        }));
    }

    /**
     * @dev Blacklist/unblacklist user
     */
    function setUserBlacklist(address user, bool blacklisted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklistedUsers[user] = blacklisted;
        
        if (blacklisted) {
            // Revoke all feature access
            UserSubscription storage subscription = userSubscriptions[user];
            subscription.isActive = false;
            _revokeFeatureAccess(user, subscription.tier);
        }
        
        emit UserBlacklisted(user, blacklisted);
    }

    /**
     * @dev Emergency functions
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Internal functions
     */
    function _initializeTiers() internal {
        // Bronze Tier (ID: 1)
        tierInfo[1] = TierInfo({
            name: "Bronze",
            duration: 30 days,
            price: 199 * 10**18, // 199 tokens
            maxSupply: 0, // Unlimited
            isActive: true,
            accessLevel: 1,
            features: new string[](0),
            royaltyRate: 500
        });

        // Silver Tier (ID: 2)
        tierInfo[2] = TierInfo({
            name: "Silver",
            duration: 90 days,
            price: 499 * 10**18, // 499 tokens
            maxSupply: 0, // Unlimited
            isActive: true,
            accessLevel: 2,
            features: new string[](0),
            royaltyRate: 500
        });

        // Gold Tier (ID: 3)
        tierInfo[3] = TierInfo({
            name: "Gold",
            duration: 365 days,
            price: 1999 * 10**18, // 1999 tokens
            maxSupply: 10000,
            isActive: true,
            accessLevel: 3,
            features: new string[](0),
            royaltyRate: 500
        });

        // Platinum Tier (ID: 4)
        tierInfo[4] = TierInfo({
            name: "Platinum",
            duration: 0, // Lifetime
            price: 9999 * 10**18, // 9999 tokens
            maxSupply: 1000,
            isActive: true,
            accessLevel: 4,
            features: new string[](0),
            royaltyRate: 1000 // 10% for lifetime
        });
    }

    function _grantFeatureAccess(address user, uint256 tier) internal {
        string[] memory features = tierInfo[tier].features;
        for (uint i = 0; i < features.length; i++) {
            userFeatureAccess[user][features[i]] = true;
            emit FeatureAccessGranted(user, features[i], tier);
        }
    }

    function _revokeFeatureAccess(address user, uint256 tier) internal {
        string[] memory features = tierInfo[tier].features;
        for (uint i = 0; i < features.length; i++) {
            userFeatureAccess[user][features[i]] = false;
        }
    }

    /**
     * @dev Required overrides
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}