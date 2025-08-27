// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title UnykornSovereigntyRegistry
 * @dev Global registry for intellectual property sovereignty and ownership proofs
 * @notice Provides tamper-proof registration and verification of IP assets
 */
contract UnykornSovereigntyRegistry is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    // Sovereignty Record Structure
    struct SovereigntyRecord {
        string projectId;           // Unique project identifier
        address owner;              // IP owner address
        bytes32 manifestHash;       // Hash of complete IP manifest
        bytes32 auditHash;          // Hash of audit report
        string ipfsCID;            // IPFS content identifier
        bytes32 pgpSignatureHash;   // PGP signature hash for verification
        uint256 appraisalValue;     // Current appraised value
        uint256 registrationTime;   // Registration timestamp
        bool isActive;             // Record status
        mapping(address => bool) authorizedAccess; // Authorized access list
    }

    // Financial Wrapper Structure
    struct FinancialWrapper {
        uint256 sovereigntyId;      // Associated sovereignty record
        address collateralToken;    // ERC20 token representing collateral value
        uint256 bondValue;          // Bond value if securitized
        uint256 yieldRate;          // Annual yield rate (basis points)
        bool isSecuritized;         // Whether wrapped as financial instrument
    }

    // State Variables
    mapping(uint256 => SovereigntyRecord) public sovereigntyRecords;
    mapping(string => uint256) public projectToId;
    mapping(address => uint256[]) public ownerRecords;
    mapping(uint256 => FinancialWrapper) public financialWrappers;
    
    uint256 public nextSovereigntyId = 1;
    uint256 public registrationFee = 0.1 ether;
    address public registryVault;

    // Events
    event SovereigntyRegistered(uint256 indexed sovereigntyId, string projectId, address indexed owner);
    event AppraisalUpdated(uint256 indexed sovereigntyId, uint256 newValue);
    event AccessGranted(uint256 indexed sovereigntyId, address indexed grantee);
    event AccessRevoked(uint256 indexed sovereigntyId, address indexed revokee);
    event FinancialWrapperCreated(uint256 indexed sovereigntyId, address collateralToken);

    constructor(address _registryVault) Ownable(msg.sender) {
        registryVault = _registryVault;
    }

    /**
     * @dev Register intellectual property sovereignty
     */
    function registerSovereignty(
        string memory _projectId,
        bytes32 _manifestHash,
        bytes32 _auditHash,
        string memory _ipfsCID,
        bytes32 _pgpSignatureHash,
        uint256 _appraisalValue
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(msg.value >= registrationFee, "Insufficient registration fee");
        require(projectToId[_projectId] == 0, "Project already registered");
        require(bytes(_projectId).length > 0, "Project ID required");

        uint256 sovereigntyId = nextSovereigntyId++;

        SovereigntyRecord storage record = sovereigntyRecords[sovereigntyId];
        record.projectId = _projectId;
        record.owner = msg.sender;
        record.manifestHash = _manifestHash;
        record.auditHash = _auditHash;
        record.ipfsCID = _ipfsCID;
        record.pgpSignatureHash = _pgpSignatureHash;
        record.appraisalValue = _appraisalValue;
        record.registrationTime = block.timestamp;
        record.isActive = true;

        projectToId[_projectId] = sovereigntyId;
        ownerRecords[msg.sender].push(sovereigntyId);

        // Distribute registration fee
        _distributeRegistrationFee(msg.value);

        emit SovereigntyRegistered(sovereigntyId, _projectId, msg.sender);
        return sovereigntyId;
    }

    /**
     * @dev Verify IP ownership and integrity
     */
    function verifySovereignty(
        uint256 _sovereigntyId,
        bytes32 _providedHash
    ) external view returns (bool isValid, address owner) {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        
        bool hashMatches = record.manifestHash == _providedHash;
        return (hashMatches && record.isActive, record.owner);
    }

    /**
     * @dev Update IP appraisal value (owner only)
     */
    function updateAppraisal(
        uint256 _sovereigntyId,
        uint256 _newValue
    ) external {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        require(record.owner == msg.sender, "Not owner");

        record.appraisalValue = _newValue;
        emit AppraisalUpdated(_sovereigntyId, _newValue);
    }

    /**
     * @dev Grant access to sovereignty record
     */
    function grantAccess(
        uint256 _sovereigntyId,
        address _grantee
    ) external {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        require(record.owner == msg.sender, "Not owner");

        record.authorizedAccess[_grantee] = true;
        emit AccessGranted(_sovereigntyId, _grantee);
    }

    /**
     * @dev Revoke access to sovereignty record
     */
    function revokeAccess(
        uint256 _sovereigntyId,
        address _revokee
    ) external {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        require(record.owner == msg.sender, "Not owner");

        record.authorizedAccess[_revokee] = false;
        emit AccessRevoked(_sovereigntyId, _revokee);
    }

    /**
     * @dev Check if address has access to sovereignty record
     */
    function hasAccess(
        uint256 _sovereigntyId,
        address _accessor
    ) external view returns (bool) {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        
        return record.owner == _accessor || record.authorizedAccess[_accessor];
    }

    /**
     * @dev Create financial wrapper for IP asset
     */
    function createFinancialWrapper(
        uint256 _sovereigntyId,
        address _collateralToken,
        uint256 _bondValue,
        uint256 _yieldRate
    ) external {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        require(record.owner == msg.sender, "Not owner");

        financialWrappers[_sovereigntyId] = FinancialWrapper({
            sovereigntyId: _sovereigntyId,
            collateralToken: _collateralToken,
            bondValue: _bondValue,
            yieldRate: _yieldRate,
            isSecuritized: true
        });

        emit FinancialWrapperCreated(_sovereigntyId, _collateralToken);
    }

    /**
     * @dev Get sovereignty record details
     */
    function getSovereigntyRecord(
        uint256 _sovereigntyId
    ) external view returns (
        string memory projectId,
        address owner,
        bytes32 manifestHash,
        bytes32 auditHash,
        string memory ipfsCID,
        uint256 appraisalValue,
        uint256 registrationTime,
        bool isActive
    ) {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        
        return (
            record.projectId,
            record.owner,
            record.manifestHash,
            record.auditHash,
            record.ipfsCID,
            record.appraisalValue,
            record.registrationTime,
            record.isActive
        );
    }

    /**
     * @dev Get owner's sovereignty records
     */
    function getOwnerRecords(address _owner) external view returns (uint256[] memory) {
        return ownerRecords[_owner];
    }

    /**
     * @dev Generate verification hash
     */
    function generateVerificationHash(
        bytes32 _manifestHash,
        bytes32 _auditHash,
        string memory _ipfsCID,
        bytes32 _pgpSignatureHash
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_manifestHash, _auditHash, _ipfsCID, _pgpSignatureHash));
    }

    /**
     * @dev Internal function to distribute registration fees
     */
    function _distributeRegistrationFee(uint256 _amount) internal {
        // 90% to registry vault, 10% stays for operations
        uint256 vaultAmount = (_amount * 90) / 100;
        
        (bool success, ) = payable(registryVault).call{value: vaultAmount}("");
        require(success, "Fee distribution failed");
    }

    /**
     * @dev Transfer ownership of sovereignty record
     */
    function transferSovereignty(
        uint256 _sovereigntyId,
        address _newOwner
    ) external {
        require(_sovereigntyId < nextSovereigntyId, "Invalid sovereignty ID");
        SovereigntyRecord storage record = sovereigntyRecords[_sovereigntyId];
        require(record.owner == msg.sender, "Not owner");
        require(_newOwner != address(0), "Invalid new owner");

        // Remove from current owner's records
        uint256[] storage currentOwnerRecords = ownerRecords[msg.sender];
        for (uint i = 0; i < currentOwnerRecords.length; i++) {
            if (currentOwnerRecords[i] == _sovereigntyId) {
                currentOwnerRecords[i] = currentOwnerRecords[currentOwnerRecords.length - 1];
                currentOwnerRecords.pop();
                break;
            }
        }

        // Add to new owner's records
        ownerRecords[_newOwner].push(_sovereigntyId);
        record.owner = _newOwner;
    }

    /**
     * @dev Set registration fee (owner only)
     */
    function setRegistrationFee(uint256 _newFee) external onlyOwner {
        registrationFee = _newFee;
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
     * @dev Withdraw operational funds
     */
    function withdrawOperationalFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}