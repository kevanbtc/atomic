// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title UnykornESGProof
 * @dev Intellectual Property Protection and Ownership Verification System
 * @notice Combines NFT ownership proof with subscription licensing and revenue management
 */
contract UnykornESGProof is ERC721, ERC1155, Ownable, ReentrancyGuard, Pausable {
    using Strings for uint256;

    // IP Proof Structure
    struct IPProof {
        string projectName;
        string version;
        bytes32 repoHash;           // SHA-256 of entire repository
        bytes32 auditHash;          // SHA-256 of audit report
        string ipfsCID;             // IPFS content identifier
        bytes32 pgpSignature;       // PGP signature hash
        uint256 appraisalValue;     // Current appraised value in USD
        uint256 timestamp;          // Creation timestamp
        address creator;            // Original IP creator
        bool isActive;              // IP protection status
    }

    // Subscription Tiers
    enum SubscriptionTier {
        DEVELOPER,      // Sandbox access, API testing
        ENTERPRISE,     // Production deployment rights
        INSTITUTIONAL   // Full CBDC integration + support
    }

    // Subscription Key Structure
    struct SubscriptionKey {
        SubscriptionTier tier;
        uint256 price;              // Price in USDC/USDT
        uint256 duration;           // Duration in seconds
        uint256 expiryTime;         // Expiry timestamp
        bool isActive;              // Key status
        uint256 revenueGenerated;   // Total revenue from this key
    }

    // State Variables
    mapping(uint256 => IPProof) public ipProofs;
    mapping(uint256 => SubscriptionKey) public subscriptionKeys;
    mapping(address => mapping(SubscriptionTier => uint256)) public userSubscriptions;
    mapping(SubscriptionTier => uint256) public tierPrices;
    
    uint256 public nextProofId = 1;
    uint256 public nextKeyId = 1;
    uint256 public totalRevenue;
    address public revenueVault;

    // Events
    event IPProofMinted(uint256 indexed proofId, address indexed creator, string projectName);
    event SubscriptionPurchased(address indexed user, SubscriptionTier tier, uint256 keyId);
    event RevenueDistributed(address indexed vault, uint256 amount);
    event AppraisalUpdated(uint256 indexed proofId, uint256 newValue);

    constructor(
        address _revenueVault
    ) ERC721("Unykorn ESG IP Proof", "UESGIP") ERC1155("") Ownable(msg.sender) {
        revenueVault = _revenueVault;
        
        // Initialize subscription tier prices (in USD, 18 decimals)
        tierPrices[SubscriptionTier.DEVELOPER] = 299 * 10**18;      // $299/month
        tierPrices[SubscriptionTier.ENTERPRISE] = 2999 * 10**18;    // $2,999/month
        tierPrices[SubscriptionTier.INSTITUTIONAL] = 9999 * 10**18; // $9,999/month
    }

    /**
     * @dev Mint IP ownership proof NFT
     */
    function mintIPProof(
        string memory _projectName,
        string memory _version,
        bytes32 _repoHash,
        bytes32 _auditHash,
        string memory _ipfsCID,
        bytes32 _pgpSignature,
        uint256 _appraisalValue
    ) external onlyOwner returns (uint256) {
        uint256 proofId = nextProofId++;

        ipProofs[proofId] = IPProof({
            projectName: _projectName,
            version: _version,
            repoHash: _repoHash,
            auditHash: _auditHash,
            ipfsCID: _ipfsCID,
            pgpSignature: _pgpSignature,
            appraisalValue: _appraisalValue,
            timestamp: block.timestamp,
            creator: msg.sender,
            isActive: true
        });

        _mint(msg.sender, proofId);

        emit IPProofMinted(proofId, msg.sender, _projectName);
        return proofId;
    }

    /**
     * @dev Purchase subscription access key
     */
    function purchaseSubscription(
        SubscriptionTier _tier,
        uint256 _duration
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(_duration >= 30 days, "Minimum 30 day subscription");
        
        uint256 totalCost = calculateSubscriptionCost(_tier, _duration);
        require(msg.value >= totalCost, "Insufficient payment");

        uint256 keyId = nextKeyId++;
        uint256 expiryTime = block.timestamp + _duration;

        subscriptionKeys[keyId] = SubscriptionKey({
            tier: _tier,
            price: totalCost,
            duration: _duration,
            expiryTime: expiryTime,
            isActive: true,
            revenueGenerated: totalCost
        });

        userSubscriptions[msg.sender][_tier] = keyId;
        totalRevenue += totalCost;

        // Mint ERC1155 subscription key
        _mint(msg.sender, keyId, 1, "");

        // Distribute revenue
        _distributeRevenue(totalCost);

        emit SubscriptionPurchased(msg.sender, _tier, keyId);
        return keyId;
    }

    /**
     * @dev Calculate subscription cost based on tier and duration
     */
    function calculateSubscriptionCost(
        SubscriptionTier _tier,
        uint256 _duration
    ) public view returns (uint256) {
        uint256 monthlyPrice = tierPrices[_tier];
        uint256 months = _duration / 30 days;
        
        // Volume discount: 10% off for 6+ months, 20% off for 12+ months
        uint256 totalCost = monthlyPrice * months;
        if (months >= 12) {
            totalCost = (totalCost * 80) / 100; // 20% discount
        } else if (months >= 6) {
            totalCost = (totalCost * 90) / 100; // 10% discount
        }
        
        return totalCost;
    }

    /**
     * @dev Check if user has active subscription
     */
    function hasActiveSubscription(
        address _user,
        SubscriptionTier _tier
    ) external view returns (bool) {
        uint256 keyId = userSubscriptions[_user][_tier];
        if (keyId == 0) return false;
        
        SubscriptionKey memory key = subscriptionKeys[keyId];
        return key.isActive && key.expiryTime > block.timestamp;
    }

    /**
     * @dev Update IP appraisal value
     */
    function updateAppraisal(
        uint256 _proofId,
        uint256 _newValue
    ) external onlyOwner {
        require(_exists(_proofId), "IP proof does not exist");
        
        ipProofs[_proofId].appraisalValue = _newValue;
        emit AppraisalUpdated(_proofId, _newValue);
    }

    /**
     * @dev Get IP proof details
     */
    function getIPProof(uint256 _proofId) external view returns (IPProof memory) {
        require(_exists(_proofId), "IP proof does not exist");
        return ipProofs[_proofId];
    }

    /**
     * @dev Get subscription key details
     */
    function getSubscriptionKey(uint256 _keyId) external view returns (SubscriptionKey memory) {
        return subscriptionKeys[_keyId];
    }

    /**
     * @dev Internal function to distribute revenue
     */
    function _distributeRevenue(uint256 _amount) internal {
        // 95% to revenue vault, 5% stays in contract for operations
        uint256 vaultAmount = (_amount * 95) / 100;
        
        (bool success, ) = payable(revenueVault).call{value: vaultAmount}("");
        require(success, "Revenue distribution failed");
        
        emit RevenueDistributed(revenueVault, vaultAmount);
    }

    /**
     * @dev Generate verifiable hash manifest for IP proof
     */
    function generateHashManifest(
        bytes32 _repoHash,
        bytes32 _auditHash,
        string memory _ipfsCID,
        bytes32 _pgpSignature
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_repoHash, _auditHash, _ipfsCID, _pgpSignature));
    }

    /**
     * @dev Emergency pause functionality
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Set revenue vault address
     */
    function setRevenueVault(address _newVault) external onlyOwner {
        require(_newVault != address(0), "Invalid vault address");
        revenueVault = _newVault;
    }

    /**
     * @dev Update subscription tier prices
     */
    function updateTierPrice(
        SubscriptionTier _tier,
        uint256 _newPrice
    ) external onlyOwner {
        tierPrices[_tier] = _newPrice;
    }

    /**
     * @dev Withdraw accumulated operational funds
     */
    function withdrawOperationalFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Override tokenURI for IP proof metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        IPProof memory proof = ipProofs[tokenId];
        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            _encodeBase64(abi.encodePacked(
                '{"name":"', proof.projectName, ' IP Proof #', tokenId.toString(),
                '","description":"Unykorn ESG System Intellectual Property Ownership Proof",',
                '"image":"ipfs://', proof.ipfsCID, '",',
                '"attributes":[',
                    '{"trait_type":"Project","value":"', proof.projectName, '"},',
                    '{"trait_type":"Version","value":"', proof.version, '"},',
                    '{"trait_type":"Appraisal Value","value":"$', (proof.appraisalValue / 10**18).toString(), 'M"},',
                    '{"trait_type":"Creator","value":"', Strings.toHexString(uint160(proof.creator), 20), '"}',
                ']}'
            ))
        ));
    }

    /**
     * @dev Simple base64 encoding for metadata
     */
    function _encodeBase64(bytes memory data) internal pure returns (string memory) {
        // Simplified base64 encoding - in production use a library
        return "placeholder_base64_encoded_data";
    }

    /**
     * @dev Override supportsInterface for dual ERC721/ERC1155 support
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC1155) returns (bool) {
        return ERC721.supportsInterface(interfaceId) || ERC1155.supportsInterface(interfaceId);
    }
}