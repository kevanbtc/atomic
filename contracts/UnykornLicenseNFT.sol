// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title UnykornLicenseNFT
 * @dev Enterprise licensing and subscription management for Unykorn ESG IP
 * @notice Provides time-based licensing with automated revenue distribution
 */
contract UnykornLicenseNFT is ERC1155, Ownable, ReentrancyGuard, Pausable {

    // License Tiers
    enum LicenseTier {
        DEVELOPER,      // $299/month - Sandbox access, API testing
        ENTERPRISE,     // $2,999/month - Production deployment rights
        INSTITUTIONAL,  // $9,999/month - Full CBDC integration + support
        CUSTOM          // Variable pricing - Bespoke enterprise solutions
    }

    // License Structure
    struct License {
        LicenseTier tier;
        uint256 price;              // Price in payment token
        uint256 duration;           // Duration in seconds
        uint256 startTime;          // License start time
        uint256 expiryTime;         // License expiry time
        address licensee;           // License holder
        bool isActive;              // License status
        uint256 renewalCount;       // Number of renewals
        bytes32 ipHash;             // Associated IP hash
    }

    // Revenue Distribution Structure
    struct RevenueDistribution {
        address creator;            // IP creator (60%)
        address platform;           // Platform vault (25%)
        address governance;         // Governance treasury (15%)
    }

    // State Variables
    mapping(uint256 => License) public licenses;
    mapping(address => mapping(LicenseTier => uint256)) public userLicenses;
    mapping(LicenseTier => uint256) public tierPrices;
    mapping(address => bool) public acceptedTokens;
    
    uint256 public nextLicenseId = 1;
    RevenueDistribution public revenueDistribution;
    
    // License tier token IDs for ERC1155
    uint256 public constant DEVELOPER_TOKEN_ID = 1;
    uint256 public constant ENTERPRISE_TOKEN_ID = 2;
    uint256 public constant INSTITUTIONAL_TOKEN_ID = 3;
    uint256 public constant CUSTOM_TOKEN_ID = 4;

    // Events
    event LicensePurchased(uint256 indexed licenseId, address indexed licensee, LicenseTier tier);
    event LicenseRenewed(uint256 indexed licenseId, uint256 newExpiryTime);
    event LicenseRevoked(uint256 indexed licenseId, string reason);
    event RevenueDistributed(uint256 amount, address creator, address platform, address governance);
    event TierPriceUpdated(LicenseTier tier, uint256 newPrice);

    constructor(
        string memory _uri,
        address _creator,
        address _platform,
        address _governance
    ) ERC1155(_uri) Ownable(msg.sender) {
        
        // Set revenue distribution addresses
        revenueDistribution = RevenueDistribution({
            creator: _creator,
            platform: _platform,
            governance: _governance
        });
        
        // Initialize tier prices (18 decimals for token compatibility)
        tierPrices[LicenseTier.DEVELOPER] = 299 * 10**18;      // $299
        tierPrices[LicenseTier.ENTERPRISE] = 2999 * 10**18;    // $2,999
        tierPrices[LicenseTier.INSTITUTIONAL] = 9999 * 10**18; // $9,999
        tierPrices[LicenseTier.CUSTOM] = 0;                    // Variable
    }

    /**
     * @dev Purchase new license
     */
    function purchaseLicense(
        LicenseTier _tier,
        uint256 _duration,
        bytes32 _ipHash,
        address _paymentToken,
        uint256 _customPrice
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        
        require(_duration >= 30 days, "Minimum 30 day license");
        
        uint256 totalCost;
        if (_tier == LicenseTier.CUSTOM) {
            require(_customPrice > 0, "Custom price required");
            totalCost = _customPrice;
        } else {
            totalCost = calculateLicenseCost(_tier, _duration);
        }

        // Handle payment
        if (_paymentToken == address(0)) {
            // ETH payment
            require(msg.value >= totalCost, "Insufficient ETH payment");
        } else {
            // ERC20 token payment
            require(acceptedTokens[_paymentToken], "Payment token not accepted");
            IERC20(_paymentToken).transferFrom(msg.sender, address(this), totalCost);
        }

        // Create license
        uint256 licenseId = nextLicenseId++;
        uint256 startTime = block.timestamp;
        uint256 expiryTime = startTime + _duration;

        licenses[licenseId] = License({
            tier: _tier,
            price: totalCost,
            duration: _duration,
            startTime: startTime,
            expiryTime: expiryTime,
            licensee: msg.sender,
            isActive: true,
            renewalCount: 0,
            ipHash: _ipHash
        });

        // Update user license mapping
        userLicenses[msg.sender][_tier] = licenseId;

        // Mint ERC1155 token
        uint256 tokenId = _getTokenIdForTier(_tier);
        _mint(msg.sender, tokenId, 1, "");

        // Distribute revenue
        _distributeRevenue(totalCost, _paymentToken);

        emit LicensePurchased(licenseId, msg.sender, _tier);
        return licenseId;
    }

    /**
     * @dev Renew existing license
     */
    function renewLicense(
        uint256 _licenseId,
        uint256 _additionalDuration,
        address _paymentToken
    ) external payable nonReentrant whenNotPaused {
        
        License storage license = licenses[_licenseId];
        require(license.licensee == msg.sender, "Not license owner");
        require(license.isActive, "License not active");
        
        uint256 renewalCost = calculateLicenseCost(license.tier, _additionalDuration);

        // Handle payment
        if (_paymentToken == address(0)) {
            require(msg.value >= renewalCost, "Insufficient ETH payment");
        } else {
            require(acceptedTokens[_paymentToken], "Payment token not accepted");
            IERC20(_paymentToken).transferFrom(msg.sender, address(this), renewalCost);
        }

        // Extend license
        if (license.expiryTime > block.timestamp) {
            // License still active, extend from current expiry
            license.expiryTime += _additionalDuration;
        } else {
            // License expired, extend from now
            license.expiryTime = block.timestamp + _additionalDuration;
        }
        
        license.renewalCount++;

        // Distribute revenue
        _distributeRevenue(renewalCost, _paymentToken);

        emit LicenseRenewed(_licenseId, license.expiryTime);
    }

    /**
     * @dev Check if user has active license for tier
     */
    function hasActiveLicense(
        address _user,
        LicenseTier _tier
    ) external view returns (bool) {
        uint256 licenseId = userLicenses[_user][_tier];
        if (licenseId == 0) return false;
        
        License memory license = licenses[licenseId];
        return license.isActive && license.expiryTime > block.timestamp;
    }

    /**
     * @dev Get user's license details
     */
    function getUserLicense(
        address _user,
        LicenseTier _tier
    ) external view returns (License memory) {
        uint256 licenseId = userLicenses[_user][_tier];
        return licenses[licenseId];
    }

    /**
     * @dev Calculate license cost based on tier and duration
     */
    function calculateLicenseCost(
        LicenseTier _tier,
        uint256 _duration
    ) public view returns (uint256) {
        uint256 monthlyPrice = tierPrices[_tier];
        uint256 months = _duration / 30 days;
        
        if (months == 0) months = 1; // Minimum 1 month billing
        
        uint256 totalCost = monthlyPrice * months;
        
        // Volume discounts
        if (months >= 12) {
            totalCost = (totalCost * 80) / 100; // 20% discount for annual
        } else if (months >= 6) {
            totalCost = (totalCost * 90) / 100; // 10% discount for 6+ months
        }
        
        return totalCost;
    }

    /**
     * @dev Internal function to distribute revenue
     */
    function _distributeRevenue(uint256 _amount, address _paymentToken) internal {
        uint256 creatorShare = (_amount * 60) / 100;    // 60%
        uint256 platformShare = (_amount * 25) / 100;   // 25%
        uint256 governanceShare = (_amount * 15) / 100; // 15%

        if (_paymentToken == address(0)) {
            // ETH distribution
            payable(revenueDistribution.creator).transfer(creatorShare);
            payable(revenueDistribution.platform).transfer(platformShare);
            payable(revenueDistribution.governance).transfer(governanceShare);
        } else {
            // ERC20 distribution
            IERC20 token = IERC20(_paymentToken);
            token.transfer(revenueDistribution.creator, creatorShare);
            token.transfer(revenueDistribution.platform, platformShare);
            token.transfer(revenueDistribution.governance, governanceShare);
        }

        emit RevenueDistributed(_amount, revenueDistribution.creator, revenueDistribution.platform, revenueDistribution.governance);
    }

    /**
     * @dev Get token ID for license tier
     */
    function _getTokenIdForTier(LicenseTier _tier) internal pure returns (uint256) {
        if (_tier == LicenseTier.DEVELOPER) return DEVELOPER_TOKEN_ID;
        if (_tier == LicenseTier.ENTERPRISE) return ENTERPRISE_TOKEN_ID;
        if (_tier == LicenseTier.INSTITUTIONAL) return INSTITUTIONAL_TOKEN_ID;
        return CUSTOM_TOKEN_ID;
    }

    /**
     * @dev Revoke license (owner only)
     */
    function revokeLicense(
        uint256 _licenseId,
        string memory _reason
    ) external onlyOwner {
        License storage license = licenses[_licenseId];
        require(license.isActive, "License already inactive");
        
        license.isActive = false;
        
        // Burn corresponding ERC1155 token
        uint256 tokenId = _getTokenIdForTier(license.tier);
        _burn(license.licensee, tokenId, 1);
        
        emit LicenseRevoked(_licenseId, _reason);
    }

    /**
     * @dev Update tier pricing (owner only)
     */
    function updateTierPrice(
        LicenseTier _tier,
        uint256 _newPrice
    ) external onlyOwner {
        tierPrices[_tier] = _newPrice;
        emit TierPriceUpdated(_tier, _newPrice);
    }

    /**
     * @dev Add accepted payment token (owner only)
     */
    function addPaymentToken(address _token) external onlyOwner {
        acceptedTokens[_token] = true;
    }

    /**
     * @dev Remove accepted payment token (owner only)
     */
    function removePaymentToken(address _token) external onlyOwner {
        acceptedTokens[_token] = false;
    }

    /**
     * @dev Update revenue distribution addresses (owner only)
     */
    function updateRevenueDistribution(
        address _creator,
        address _platform,
        address _governance
    ) external onlyOwner {
        revenueDistribution = RevenueDistribution({
            creator: _creator,
            platform: _platform,
            governance: _governance
        });
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Batch license information for multiple users
     */
    function batchGetUserLicenses(
        address[] memory _users,
        LicenseTier _tier
    ) external view returns (License[] memory) {
        License[] memory result = new License[](_users.length);
        
        for (uint256 i = 0; i < _users.length; i++) {
            uint256 licenseId = userLicenses[_users[i]][_tier];
            result[i] = licenses[licenseId];
        }
        
        return result;
    }

    /**
     * @dev Get license statistics
     */
    function getLicenseStats() external view returns (
        uint256 totalLicenses,
        uint256 activeLicenses,
        uint256 totalRevenue
    ) {
        // Implementation would track these metrics
        totalLicenses = nextLicenseId - 1;
        // Add logic to count active licenses and revenue
        return (totalLicenses, 0, 0);
    }

    /**
     * @dev Override _beforeTokenTransfer to handle license transfers
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        
        // Add logic to update license ownership if needed
        // This ensures license records stay in sync with token ownership
    }

    /**
     * @dev Emergency withdrawal function (owner only)
     */
    function emergencyWithdraw(address _token) external onlyOwner {
        if (_token == address(0)) {
            // Withdraw ETH
            uint256 balance = address(this).balance;
            payable(owner()).transfer(balance);
        } else {
            // Withdraw ERC20
            IERC20 token = IERC20(_token);
            uint256 balance = token.balanceOf(address(this));
            token.transfer(owner(), balance);
        }
    }
}