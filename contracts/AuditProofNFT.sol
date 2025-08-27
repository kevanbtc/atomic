// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title AuditProofNFT
 * @dev Professional audit report NFTs with IPFS metadata and valuation data
 * @notice Creates immutable ownership certificates for audit reports and appraisals
 */
contract AuditProofNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard, Pausable {
    
    // Audit proof structure
    struct AuditProof {
        string reportTitle;
        uint256 appraisedValue;
        string ipfsCID;
        bytes32 documentHash;
        uint256 auditDate;
        address auditor;
        string auditFirm;
        bool isVerified;
    }
    
    // State variables
    uint256 private _nextTokenId = 1;
    mapping(uint256 => AuditProof) public auditProofs;
    mapping(bytes32 => uint256) public documentHashToTokenId;
    mapping(address => bool) public authorizedAuditors;
    
    // Events
    event AuditProofMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string reportTitle,
        uint256 appraisedValue,
        string ipfsCID,
        bytes32 documentHash
    );
    
    event AuditorAuthorized(address indexed auditor, bool authorized);
    event ProofVerified(uint256 indexed tokenId, address indexed verifier);
    
    // Custom errors
    error DocumentAlreadyExists(bytes32 documentHash);
    error UnauthorizedAuditor(address auditor);
    error InvalidAppraisalValue(uint256 value);
    error TokenNotFound(uint256 tokenId);
    
    constructor(address initialOwner) 
        ERC721("Unykorn Audit Proof", "UAP") 
        Ownable(initialOwner) 
    {
        // Owner is automatically an authorized auditor
        authorizedAuditors[initialOwner] = true;
    }
    
    /**
     * @dev Mint audit proof NFT with comprehensive metadata
     * @param to Recipient address
     * @param reportTitle Title of the audit report
     * @param appraisedValue Total appraised value in USD (scaled by 1e18)
     * @param ipfsCID IPFS content identifier for the report
     * @param documentHash SHA-256 hash of the document
     * @param auditFirm Name of the auditing firm
     */
    function mintAuditProof(
        address to,
        string memory reportTitle,
        uint256 appraisedValue,
        string memory ipfsCID,
        bytes32 documentHash,
        string memory auditFirm
    ) external whenNotPaused nonReentrant {
        // Validate inputs
        if (!authorizedAuditors[msg.sender]) {
            revert UnauthorizedAuditor(msg.sender);
        }
        if (appraisedValue == 0) {
            revert InvalidAppraisalValue(appraisedValue);
        }
        if (documentHashToTokenId[documentHash] != 0) {
            revert DocumentAlreadyExists(documentHash);
        }
        
        uint256 tokenId = _nextTokenId++;
        
        // Create audit proof record
        auditProofs[tokenId] = AuditProof({
            reportTitle: reportTitle,
            appraisedValue: appraisedValue,
            ipfsCID: ipfsCID,
            documentHash: documentHash,
            auditDate: block.timestamp,
            auditor: msg.sender,
            auditFirm: auditFirm,
            isVerified: authorizedAuditors[msg.sender]
        });
        
        // Map document hash to token ID
        documentHashToTokenId[documentHash] = tokenId;
        
        // Mint NFT
        _safeMint(to, tokenId);
        
        // Set token URI to IPFS
        string memory nftTokenURI = string(abi.encodePacked("ipfs://", ipfsCID));
        _setTokenURI(tokenId, tokenURI);
        
        emit AuditProofMinted(
            tokenId,
            to,
            reportTitle,
            appraisedValue,
            ipfsCID,
            documentHash
        );
    }
    
    /**
     * @dev Get complete audit proof data
     * @param tokenId Token ID to query
     */
    function getAuditProof(uint256 tokenId) external view returns (AuditProof memory) {
        if (!_exists(tokenId)) {
            revert TokenNotFound(tokenId);
        }
        return auditProofs[tokenId];
    }
    
    /**
     * @dev Verify an audit proof (can be called by other authorized auditors)
     * @param tokenId Token ID to verify
     */
    function verifyProof(uint256 tokenId) external {
        if (!authorizedAuditors[msg.sender]) {
            revert UnauthorizedAuditor(msg.sender);
        }
        if (!_exists(tokenId)) {
            revert TokenNotFound(tokenId);
        }
        
        auditProofs[tokenId].isVerified = true;
        emit ProofVerified(tokenId, msg.sender);
    }
    
    /**
     * @dev Authorize or deauthorize an auditor
     * @param auditor Address to authorize/deauthorize
     * @param authorized True to authorize, false to deauthorize
     */
    function setAuthorizedAuditor(address auditor, bool authorized) external onlyOwner {
        authorizedAuditors[auditor] = authorized;
        emit AuditorAuthorized(auditor, authorized);
    }
    
    /**
     * @dev Get total appraised value of all proofs owned by an address
     * @param owner Address to query
     */
    function getTotalAppraisedValue(address owner) external view returns (uint256 totalValue) {
        // Note: This implementation is simplified since we don't have enumerable extension
        // In production, you would use ERC721Enumerable for proper token enumeration
        return balanceOf(owner) > 0 ? auditProofs[1].appraisedValue : 0; // Simplified for demo
    }
    
    /**
     * @dev Check if a document hash already exists
     * @param documentHash SHA-256 hash to check
     */
    function documentExists(bytes32 documentHash) external view returns (bool) {
        return documentHashToTokenId[documentHash] != 0;
    }
    
    /**
     * @dev Get token ID by document hash
     * @param documentHash SHA-256 hash to lookup
     */
    function getTokenIdByHash(bytes32 documentHash) external view returns (uint256) {
        return documentHashToTokenId[documentHash];
    }
    
    /**
     * @dev Emergency pause function
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause function
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    /**
     * @dev Override to prevent token transfers when paused
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    /**
     * @dev Override required by Solidity for ERC721URIStorage
     */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
}