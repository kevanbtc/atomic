// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title SovereigntyProof
 * @dev Unykorn Sovereignty Proof system for sovereign identity verification,
 *      cross-chain proof aggregation, governance rights enforcement, and economic sovereignty tracking
 */
contract SovereigntyProof is AccessControl, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant SOVEREIGNTY_VALIDATOR_ROLE = keccak256("SOVEREIGNTY_VALIDATOR_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant CROSS_CHAIN_RELAYER_ROLE = keccak256("CROSS_CHAIN_RELAYER_ROLE");
    bytes32 public constant ECONOMIC_MANAGER_ROLE = keccak256("ECONOMIC_MANAGER_ROLE");

    // Sovereignty levels
    enum SovereigntyLevel {
        None,           // 0 - No sovereignty
        Basic,          // 1 - Basic user sovereignty  
        Verified,       // 2 - KYC verified sovereignty
        Enhanced,       // 3 - Enhanced with staking
        Institutional,  // 4 - Institutional sovereignty
        Governance,     // 5 - Governance sovereignty
        Ultimate        // 6 - Ultimate sovereignty (founders, core team)
    }

    // Sovereignty identity structure
    struct SovereignIdentity {
        bytes32 identityId;         // Unique identity identifier
        address sovereignAddress;    // Primary sovereign address
        SovereigntyLevel level;     // Sovereignty level
        uint256 stakeAmount;        // Staked tokens for sovereignty
        uint256 establishedAt;      // When sovereignty was established
        uint256 lastUpdate;         // Last verification/update
        uint256 expirationTime;     // Sovereignty expiration (0 = permanent)
        string jurisdictionCode;    // Legal jurisdiction (ISO 3166)
        bytes32 credentialHash;     // Hash of identity credentials
        bool isActive;              // Active status
        uint256 governanceWeight;   // Voting weight in governance
        uint256[] linkedChains;     // Cross-chain sovereignty records
        mapping(bytes32 => bool) verifiedClaims; // Verified identity claims
    }

    // Cross-chain proof structure
    struct CrossChainProof {
        bytes32 proofId;           // Unique proof identifier
        uint256 sourceChain;       // Source blockchain ID
        uint256 targetChain;       // Target blockchain ID
        bytes32 identityId;        // Associated identity
        bytes32 merkleRoot;        // Merkle root of proof data
        bytes[] validatorSignatures; // Validator signatures
        uint256 blockNumber;       // Source block number
        uint256 timestamp;         // Proof timestamp
        bool isVerified;          // Verification status
        uint256 confirmations;    // Number of confirmations
        bytes proofData;          // Encoded proof data
    }

    // Governance rights structure
    struct GovernanceRights {
        bytes32 identityId;        // Identity holder
        uint256 votingPower;       // Base voting power
        uint256 proposalThreshold; // Minimum tokens to propose
        bool canCreateProposals;   // Proposal creation rights
        bool canVeto;              // Veto rights for critical decisions
        uint256[] committeeIds;    // Committee memberships
        mapping(bytes32 => uint256) delegatedPower; // Delegated voting power
        uint256 lastParticipation; // Last governance participation
    }

    // Economic sovereignty tracking
    struct EconomicSovereignty {
        bytes32 identityId;        // Identity holder
        uint256 totalStaked;       // Total staked across all protocols
        uint256 liquidityProvided; // Liquidity provided to AMMs
        uint256 revenueGenerated;  // Revenue generated through platform
        uint256 taxPaid;           // Taxes/fees paid to platform
        mapping(address => uint256) tokenBalances; // Token balances
        mapping(bytes32 => uint256) assetOwnership; // Asset ownership records
        uint256 economicScore;     // Calculated economic impact score
        uint256 lastScoreUpdate;   // Last score calculation
    }

    // Verification requirement structure
    struct VerificationRequirement {
        SovereigntyLevel minLevel; // Minimum sovereignty level required
        uint256 minStake;          // Minimum stake required
        string[] requiredClaims;   // Required verified claims
        uint256 timelock;          // Time delay for actions
        bool requiresGovernance;   // Requires governance approval
    }

    // Storage mappings
    mapping(bytes32 => SovereignIdentity) public sovereignIdentities;
    mapping(address => bytes32) public addressToIdentity;
    mapping(bytes32 => CrossChainProof) public crossChainProofs;
    mapping(bytes32 => GovernanceRights) public governanceRights;
    mapping(bytes32 => EconomicSovereignty) public economicSovereignty;
    mapping(bytes32 => VerificationRequirement) public actionRequirements;
    mapping(uint256 => address[]) public chainValidators;
    mapping(bytes32 => mapping(string => bytes32)) public identityClaims;
    
    // Staking configuration
    IERC20 public sovereigntyToken;
    uint256[] public stakeRequirements = [0, 1000e18, 5000e18, 25000e18, 100000e18, 500000e18, 1000000e18]; // Per level
    uint256 public constant BLOCKS_PER_DAY = 7200; // Approximate blocks per day
    uint256 public stakingRewardRate = 500; // 5% annual reward
    
    // Global configuration
    uint256 public totalSovereignCount;
    uint256 public totalStakedAmount;
    bytes32 public genesisIdentityId;
    address public economicTreasury;
    uint256 public crossChainConfirmationThreshold = 3;

    // Events
    event SovereigntyEstablished(
        bytes32 indexed identityId,
        address indexed sovereign,
        SovereigntyLevel level,
        uint256 stakeAmount
    );
    event SovereigntyUpgraded(
        bytes32 indexed identityId,
        SovereigntyLevel oldLevel,
        SovereigntyLevel newLevel,
        uint256 additionalStake
    );
    event CrossChainProofCreated(
        bytes32 indexed proofId,
        uint256 sourceChain,
        uint256 targetChain,
        bytes32 identityId
    );
    event CrossChainProofVerified(bytes32 indexed proofId, uint256 confirmations);
    event GovernanceRightsGranted(bytes32 indexed identityId, uint256 votingPower);
    event EconomicScoreUpdated(bytes32 indexed identityId, uint256 oldScore, uint256 newScore);
    event ClaimVerified(bytes32 indexed identityId, string claimType, bytes32 claimHash);
    event SovereigntyRevoked(bytes32 indexed identityId, string reason);

    modifier onlySovereign(bytes32 identityId) {
        require(sovereignIdentities[identityId].sovereignAddress == msg.sender, "SovereigntyProof: Not sovereign");
        require(sovereignIdentities[identityId].isActive, "SovereigntyProof: Sovereignty not active");
        _;
    }

    modifier requiresSovereigntyLevel(SovereigntyLevel minLevel) {
        bytes32 identityId = addressToIdentity[msg.sender];
        require(identityId != bytes32(0), "SovereigntyProof: No sovereignty found");
        require(
            sovereignIdentities[identityId].level >= minLevel,
            "SovereigntyProof: Insufficient sovereignty level"
        );
        _;
    }

    constructor(
        address _sovereigntyToken,
        address _economicTreasury
    ) {
        require(_sovereigntyToken != address(0), "SovereigntyProof: Invalid token address");
        require(_economicTreasury != address(0), "SovereigntyProof: Invalid treasury address");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SOVEREIGNTY_VALIDATOR_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(ECONOMIC_MANAGER_ROLE, msg.sender);

        sovereigntyToken = IERC20(_sovereigntyToken);
        economicTreasury = _economicTreasury;

        // Create genesis sovereignty for deployer
        genesisIdentityId = keccak256(abi.encodePacked("GENESIS", msg.sender, block.timestamp));
        _createGenesisIdentity();
    }

    /**
     * @dev Establish sovereignty with staking requirement
     */
    function establishSovereignty(
        bytes32 identityId,
        SovereigntyLevel desiredLevel,
        string memory jurisdictionCode,
        bytes32 credentialHash
    ) external nonReentrant whenNotPaused returns (bool) {
        require(identityId != bytes32(0), "SovereigntyProof: Invalid identity ID");
        require(desiredLevel > SovereigntyLevel.None, "SovereigntyProof: Invalid level");
        require(desiredLevel <= SovereigntyLevel.Enhanced, "SovereigntyProof: Level too high for self-establishment");
        require(sovereignIdentities[identityId].identityId == bytes32(0), "SovereigntyProof: Identity exists");
        require(addressToIdentity[msg.sender] == bytes32(0), "SovereigntyProof: Address already has sovereignty");

        uint256 requiredStake = stakeRequirements[uint256(desiredLevel)];
        if (requiredStake > 0) {
            sovereigntyToken.transferFrom(msg.sender, address(this), requiredStake);
        }

        SovereignIdentity storage identity = sovereignIdentities[identityId];
        identity.identityId = identityId;
        identity.sovereignAddress = msg.sender;
        identity.level = desiredLevel;
        identity.stakeAmount = requiredStake;
        identity.establishedAt = block.timestamp;
        identity.lastUpdate = block.timestamp;
        identity.jurisdictionCode = jurisdictionCode;
        identity.credentialHash = credentialHash;
        identity.isActive = true;
        identity.governanceWeight = _calculateGovernanceWeight(desiredLevel, requiredStake);

        // Update mappings
        addressToIdentity[msg.sender] = identityId;
        totalSovereignCount++;
        totalStakedAmount += requiredStake;

        // Initialize governance rights
        _initializeGovernanceRights(identityId, desiredLevel);

        // Initialize economic sovereignty
        _initializeEconomicSovereignty(identityId);

        emit SovereigntyEstablished(identityId, msg.sender, desiredLevel, requiredStake);
        return true;
    }

    /**
     * @dev Upgrade sovereignty level
     */
    function upgradeSovereignty(
        bytes32 identityId,
        SovereigntyLevel newLevel
    ) external onlySovereign(identityId) nonReentrant whenNotPaused returns (bool) {
        SovereignIdentity storage identity = sovereignIdentities[identityId];
        require(newLevel > identity.level, "SovereigntyProof: Cannot downgrade");
        require(newLevel <= SovereigntyLevel.Enhanced, "SovereigntyProof: Level requires governance approval");

        uint256 currentStake = identity.stakeAmount;
        uint256 requiredStake = stakeRequirements[uint256(newLevel)];
        uint256 additionalStake = requiredStake > currentStake ? requiredStake - currentStake : 0;

        if (additionalStake > 0) {
            sovereigntyToken.transferFrom(msg.sender, address(this), additionalStake);
        }

        SovereigntyLevel oldLevel = identity.level;
        identity.level = newLevel;
        identity.stakeAmount = requiredStake;
        identity.lastUpdate = block.timestamp;
        identity.governanceWeight = _calculateGovernanceWeight(newLevel, requiredStake);

        totalStakedAmount += additionalStake;

        // Update governance rights
        _updateGovernanceRights(identityId, newLevel);

        emit SovereigntyUpgraded(identityId, oldLevel, newLevel, additionalStake);
        return true;
    }

    /**
     * @dev Create cross-chain sovereignty proof
     */
    function createCrossChainProof(
        bytes32 proofId,
        uint256 sourceChain,
        uint256 targetChain,
        bytes32 identityId,
        bytes32 merkleRoot,
        bytes memory proofData
    ) external requiresSovereigntyLevel(SovereigntyLevel.Verified) nonReentrant whenNotPaused returns (bool) {
        require(proofId != bytes32(0), "SovereigntyProof: Invalid proof ID");
        require(sourceChain != targetChain, "SovereigntyProof: Same chain");
        require(crossChainProofs[proofId].proofId == bytes32(0), "SovereigntyProof: Proof exists");
        require(sovereignIdentities[identityId].isActive, "SovereigntyProof: Identity not active");

        CrossChainProof storage proof = crossChainProofs[proofId];
        proof.proofId = proofId;
        proof.sourceChain = sourceChain;
        proof.targetChain = targetChain;
        proof.identityId = identityId;
        proof.merkleRoot = merkleRoot;
        proof.blockNumber = block.number;
        proof.timestamp = block.timestamp;
        proof.proofData = proofData;

        emit CrossChainProofCreated(proofId, sourceChain, targetChain, identityId);
        return true;
    }

    /**
     * @dev Verify cross-chain proof with validator signatures
     */
    function verifyCrossChainProof(
        bytes32 proofId,
        bytes[] memory validatorSignatures
    ) external onlyRole(CROSS_CHAIN_RELAYER_ROLE) nonReentrant returns (bool) {
        CrossChainProof storage proof = crossChainProofs[proofId];
        require(proof.proofId != bytes32(0), "SovereigntyProof: Proof not found");
        require(!proof.isVerified, "SovereigntyProof: Already verified");
        require(validatorSignatures.length >= crossChainConfirmationThreshold, "SovereigntyProof: Insufficient signatures");

        // Verify validator signatures
        bytes32 messageHash = keccak256(abi.encodePacked(proofId, proof.merkleRoot, proof.timestamp));
        uint256 validSignatures = 0;

        for (uint i = 0; i < validatorSignatures.length; i++) {
            address signer = messageHash.toEthSignedMessageHash().recover(validatorSignatures[i]);
            if (_isValidValidator(proof.sourceChain, signer)) {
                validSignatures++;
            }
        }

        require(validSignatures >= crossChainConfirmationThreshold, "SovereigntyProof: Invalid signatures");

        proof.validatorSignatures = validatorSignatures;
        proof.isVerified = true;
        proof.confirmations = validSignatures;

        // Update identity's cross-chain records
        sovereignIdentities[proof.identityId].linkedChains.push(proof.targetChain);

        emit CrossChainProofVerified(proofId, validSignatures);
        return true;
    }

    /**
     * @dev Verify identity claim
     */
    function verifyClaim(
        bytes32 identityId,
        string memory claimType,
        bytes32 claimHash,
        bytes memory verificationProof
    ) external onlyRole(SOVEREIGNTY_VALIDATOR_ROLE) nonReentrant returns (bool) {
        require(sovereignIdentities[identityId].isActive, "SovereigntyProof: Identity not active");
        require(bytes(claimType).length > 0, "SovereigntyProof: Invalid claim type");
        require(claimHash != bytes32(0), "SovereigntyProof: Invalid claim hash");

        sovereignIdentities[identityId].verifiedClaims[claimHash] = true;
        identityClaims[identityId][claimType] = claimHash;

        emit ClaimVerified(identityId, claimType, claimHash);
        return true;
    }

    /**
     * @dev Update economic sovereignty metrics
     */
    function updateEconomicMetrics(
        bytes32 identityId,
        uint256 totalStaked,
        uint256 liquidityProvided,
        uint256 revenueGenerated,
        uint256 taxPaid
    ) external onlyRole(ECONOMIC_MANAGER_ROLE) nonReentrant returns (bool) {
        EconomicSovereignty storage economics = economicSovereignty[identityId];
        require(economics.identityId != bytes32(0), "SovereigntyProof: Economic record not found");

        uint256 oldScore = economics.economicScore;
        
        economics.totalStaked = totalStaked;
        economics.liquidityProvided = liquidityProvided;
        economics.revenueGenerated = revenueGenerated;
        economics.taxPaid = taxPaid;
        economics.economicScore = _calculateEconomicScore(
            totalStaked,
            liquidityProvided,
            revenueGenerated,
            taxPaid
        );
        economics.lastScoreUpdate = block.timestamp;

        emit EconomicScoreUpdated(identityId, oldScore, economics.economicScore);
        return true;
    }

    /**
     * @dev Grant institutional or higher sovereignty (governance only)
     */
    function grantHighLevelSovereignty(
        bytes32 identityId,
        address sovereignAddress,
        SovereigntyLevel level,
        string memory jurisdictionCode,
        bytes32 credentialHash
    ) external onlyRole(GOVERNANCE_ROLE) nonReentrant returns (bool) {
        require(level >= SovereigntyLevel.Institutional, "SovereigntyProof: Use regular establishment");
        require(level <= SovereigntyLevel.Ultimate, "SovereigntyProof: Invalid level");
        require(sovereignIdentities[identityId].identityId == bytes32(0), "SovereigntyProof: Identity exists");

        uint256 requiredStake = stakeRequirements[uint256(level)];

        SovereignIdentity storage identity = sovereignIdentities[identityId];
        identity.identityId = identityId;
        identity.sovereignAddress = sovereignAddress;
        identity.level = level;
        identity.stakeAmount = requiredStake; // May be zero for governance-granted sovereignty
        identity.establishedAt = block.timestamp;
        identity.lastUpdate = block.timestamp;
        identity.jurisdictionCode = jurisdictionCode;
        identity.credentialHash = credentialHash;
        identity.isActive = true;
        identity.governanceWeight = _calculateGovernanceWeight(level, requiredStake);

        addressToIdentity[sovereignAddress] = identityId;
        totalSovereignCount++;

        _initializeGovernanceRights(identityId, level);
        _initializeEconomicSovereignty(identityId);

        emit SovereigntyEstablished(identityId, sovereignAddress, level, requiredStake);
        return true;
    }

    /**
     * @dev Check if address has required sovereignty level
     */
    function hasSovereigntyLevel(address user, SovereigntyLevel minLevel) external view returns (bool) {
        bytes32 identityId = addressToIdentity[user];
        if (identityId == bytes32(0)) return false;
        
        SovereignIdentity memory identity = sovereignIdentities[identityId];
        return identity.isActive && identity.level >= minLevel;
    }

    /**
     * @dev Get sovereignty information
     */
    function getSovereigntyInfo(bytes32 identityId) external view returns (
        address sovereignAddress,
        SovereigntyLevel level,
        uint256 stakeAmount,
        uint256 governanceWeight,
        bool isActive,
        string memory jurisdictionCode
    ) {
        SovereignIdentity memory identity = sovereignIdentities[identityId];
        return (
            identity.sovereignAddress,
            identity.level,
            identity.stakeAmount,
            identity.governanceWeight,
            identity.isActive,
            identity.jurisdictionCode
        );
    }

    /**
     * @dev Get cross-chain proof status
     */
    function getCrossChainProofStatus(bytes32 proofId) external view returns (
        bool isVerified,
        uint256 confirmations,
        uint256 sourceChain,
        uint256 targetChain
    ) {
        CrossChainProof memory proof = crossChainProofs[proofId];
        return (proof.isVerified, proof.confirmations, proof.sourceChain, proof.targetChain);
    }

    /**
     * @dev Administrative functions
     */
    function addChainValidator(uint256 chainId, address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        chainValidators[chainId].push(validator);
    }

    function setStakeRequirement(SovereigntyLevel level, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        stakeRequirements[uint256(level)] = amount;
    }

    function setCrossChainConfirmationThreshold(uint256 threshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        crossChainConfirmationThreshold = threshold;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Internal functions
     */
    function _createGenesisIdentity() internal {
        SovereignIdentity storage identity = sovereignIdentities[genesisIdentityId];
        identity.identityId = genesisIdentityId;
        identity.sovereignAddress = msg.sender;
        identity.level = SovereigntyLevel.Ultimate;
        identity.stakeAmount = 0;
        identity.establishedAt = block.timestamp;
        identity.lastUpdate = block.timestamp;
        identity.jurisdictionCode = "GLOBAL";
        identity.isActive = true;
        identity.governanceWeight = 10000; // Maximum governance weight

        addressToIdentity[msg.sender] = genesisIdentityId;
        totalSovereignCount++;

        _initializeGovernanceRights(genesisIdentityId, SovereigntyLevel.Ultimate);
        _initializeEconomicSovereignty(genesisIdentityId);
    }

    function _calculateGovernanceWeight(SovereigntyLevel level, uint256 stakeAmount) internal pure returns (uint256) {
        uint256 baseWeight = uint256(level) * 100;
        uint256 stakeWeight = stakeAmount / 1000e18; // 1 weight per 1000 tokens
        return baseWeight + stakeWeight;
    }

    function _calculateEconomicScore(
        uint256 totalStaked,
        uint256 liquidityProvided,
        uint256 revenueGenerated,
        uint256 taxPaid
    ) internal pure returns (uint256) {
        // Weighted economic activity score
        uint256 stakeScore = totalStaked / 1000e18;
        uint256 liquidityScore = (liquidityProvided / 1000e18) * 2;
        uint256 revenueScore = (revenueGenerated / 1000e18) * 3;
        uint256 taxScore = (taxPaid / 1000e18) * 2;
        
        return stakeScore + liquidityScore + revenueScore + taxScore;
    }

    function _initializeGovernanceRights(bytes32 identityId, SovereigntyLevel level) internal {
        GovernanceRights storage rights = governanceRights[identityId];
        rights.identityId = identityId;
        rights.votingPower = _calculateGovernanceWeight(level, stakeRequirements[uint256(level)]);
        rights.proposalThreshold = stakeRequirements[uint256(level)];
        rights.canCreateProposals = level >= SovereigntyLevel.Enhanced;
        rights.canVeto = level >= SovereigntyLevel.Governance;
        
        emit GovernanceRightsGranted(identityId, rights.votingPower);
    }

    function _updateGovernanceRights(bytes32 identityId, SovereigntyLevel newLevel) internal {
        GovernanceRights storage rights = governanceRights[identityId];
        rights.votingPower = _calculateGovernanceWeight(newLevel, stakeRequirements[uint256(newLevel)]);
        rights.proposalThreshold = stakeRequirements[uint256(newLevel)];
        rights.canCreateProposals = newLevel >= SovereigntyLevel.Enhanced;
        rights.canVeto = newLevel >= SovereigntyLevel.Governance;
    }

    function _initializeEconomicSovereignty(bytes32 identityId) internal {
        EconomicSovereignty storage economics = economicSovereignty[identityId];
        economics.identityId = identityId;
        economics.lastScoreUpdate = block.timestamp;
    }

    function _isValidValidator(uint256 chainId, address validator) internal view returns (bool) {
        address[] memory validators = chainValidators[chainId];
        for (uint i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                return true;
            }
        }
        return false;
    }
}