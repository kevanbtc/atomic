// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title IPFSHashRegistry
 * @dev Decentralized content integrity verification system with IPFS integration,
 *      manifest generation, and batch verification capabilities
 */
contract IPFSHashRegistry is AccessControl, ReentrancyGuard, Pausable {
    
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant MANIFEST_MANAGER_ROLE = keccak256("MANIFEST_MANAGER_ROLE");

    // Content registry structures
    struct ContentRecord {
        bytes32 ipfsHash;           // IPFS hash of content
        bytes32 parentHash;         // Parent content hash (for versioning)
        string contentType;         // MIME type or content category
        uint256 fileSize;          // File size in bytes
        uint256 timestamp;         // Registration timestamp
        address registrar;         // Who registered the content
        uint256 version;           // Version number
        bool isActive;             // Active status
        bytes32 metadataHash;      // Hash of metadata JSON
        string[] tags;             // Content tags for categorization
        uint256 accessLevel;       // Access level requirement
    }

    struct ManifestRecord {
        bytes32 manifestId;        // Unique manifest identifier
        bytes32[] contentHashes;   // Array of content hashes in manifest
        bytes32 merkleRoot;        // Merkle root for batch verification
        uint256 totalSize;         // Total size of all content
        uint256 contentCount;      // Number of content items
        string manifestType;       // Type of manifest (collection, dataset, etc.)
        address creator;           // Manifest creator
        uint256 createdAt;         // Creation timestamp
        uint256 lastUpdated;       // Last update timestamp
        bool isImmutable;          // Whether manifest can be updated
        string description;        // Human-readable description
        mapping(bytes32 => bool) includesContent; // Quick lookup for content inclusion
    }

    struct VerificationProof {
        bytes32 contentHash;       // Content being verified
        bytes32[] merkleProof;     // Merkle proof for verification
        uint256 leafIndex;         // Index in merkle tree
        bool isVerified;           // Verification status
        address verifier;          // Who performed verification
        uint256 verificationTime;  // When verification occurred
        string verificationMethod; // Method used for verification
    }

    struct ContentMetadata {
        string title;              // Content title
        string description;        // Content description
        string[] keywords;         // Search keywords
        string license;            // License information
        address creator;           // Original creator
        uint256 createdAt;        // Creation timestamp
        string checksum;          // Additional integrity checksum
        mapping(string => string) customFields; // Extensible metadata
    }

    // Storage mappings
    mapping(bytes32 => ContentRecord) public contentRegistry;
    mapping(bytes32 => ManifestRecord) public manifestRegistry;
    mapping(bytes32 => VerificationProof) public verificationProofs;
    mapping(bytes32 => ContentMetadata) public contentMetadata;
    mapping(address => bytes32[]) public userContent;
    mapping(string => bytes32[]) public contentByType;
    mapping(bytes32 => bytes32[]) public contentVersions; // parent => versions[]
    mapping(bytes32 => uint256) public downloadCounts;
    
    // Global state
    uint256 public totalContentCount;
    uint256 public totalManifestCount;
    uint256 public totalStorageUsed;
    mapping(string => bool) public supportedContentTypes;
    uint256 public maxFileSize = 1024 * 1024 * 1024; // 1GB default
    uint256 public manifestCreationFee = 0;

    // Events
    event ContentRegistered(
        bytes32 indexed contentHash,
        address indexed registrar,
        string contentType,
        uint256 fileSize,
        uint256 version
    );
    event ManifestCreated(
        bytes32 indexed manifestId,
        address indexed creator,
        uint256 contentCount,
        bytes32 merkleRoot
    );
    event ManifestUpdated(
        bytes32 indexed manifestId,
        uint256 newContentCount,
        bytes32 newMerkleRoot
    );
    event ContentVerified(
        bytes32 indexed contentHash,
        address indexed verifier,
        bool isValid,
        string method
    );
    event ContentVersioned(
        bytes32 indexed parentHash,
        bytes32 indexed newVersionHash,
        uint256 version
    );
    event MetadataUpdated(bytes32 indexed contentHash, address indexed updater);
    event BatchVerificationCompleted(bytes32 indexed manifestId, uint256 itemCount, bool allValid);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(MANIFEST_MANAGER_ROLE, msg.sender);
        
        // Initialize supported content types
        supportedContentTypes["application/json"] = true;
        supportedContentTypes["text/plain"] = true;
        supportedContentTypes["image/jpeg"] = true;
        supportedContentTypes["image/png"] = true;
        supportedContentTypes["application/pdf"] = true;
        supportedContentTypes["video/mp4"] = true;
        supportedContentTypes["audio/mpeg"] = true;
    }

    /**
     * @dev Register new content in IPFS registry
     */
    function registerContent(
        bytes32 ipfsHash,
        string memory contentType,
        uint256 fileSize,
        bytes32 metadataHash,
        string[] memory tags,
        uint256 accessLevel
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant whenNotPaused returns (bytes32) {
        require(ipfsHash != bytes32(0), "IPFSHashRegistry: Invalid IPFS hash");
        require(bytes(contentType).length > 0, "IPFSHashRegistry: Invalid content type");
        require(supportedContentTypes[contentType], "IPFSHashRegistry: Unsupported content type");
        require(fileSize > 0 && fileSize <= maxFileSize, "IPFSHashRegistry: Invalid file size");
        require(!contentRegistry[ipfsHash].isActive, "IPFSHashRegistry: Content already registered");

        ContentRecord storage record = contentRegistry[ipfsHash];
        record.ipfsHash = ipfsHash;
        record.contentType = contentType;
        record.fileSize = fileSize;
        record.timestamp = block.timestamp;
        record.registrar = msg.sender;
        record.version = 1;
        record.isActive = true;
        record.metadataHash = metadataHash;
        record.tags = tags;
        record.accessLevel = accessLevel;

        // Update global state
        userContent[msg.sender].push(ipfsHash);
        contentByType[contentType].push(ipfsHash);
        totalContentCount++;
        totalStorageUsed += fileSize;

        emit ContentRegistered(ipfsHash, msg.sender, contentType, fileSize, 1);
        return ipfsHash;
    }

    /**
     * @dev Register a new version of existing content
     */
    function registerContentVersion(
        bytes32 parentHash,
        bytes32 newVersionHash,
        string memory contentType,
        uint256 fileSize,
        bytes32 metadataHash,
        string[] memory tags,
        uint256 accessLevel
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant whenNotPaused returns (bytes32) {
        require(contentRegistry[parentHash].isActive, "IPFSHashRegistry: Parent content not found");
        require(!contentRegistry[newVersionHash].isActive, "IPFSHashRegistry: Version already exists");

        ContentRecord memory parentRecord = contentRegistry[parentHash];
        uint256 newVersion = parentRecord.version + 1;

        ContentRecord storage newRecord = contentRegistry[newVersionHash];
        newRecord.ipfsHash = newVersionHash;
        newRecord.parentHash = parentHash;
        newRecord.contentType = contentType;
        newRecord.fileSize = fileSize;
        newRecord.timestamp = block.timestamp;
        newRecord.registrar = msg.sender;
        newRecord.version = newVersion;
        newRecord.isActive = true;
        newRecord.metadataHash = metadataHash;
        newRecord.tags = tags;
        newRecord.accessLevel = accessLevel;

        // Update version tracking
        contentVersions[parentHash].push(newVersionHash);
        
        // Update global state
        userContent[msg.sender].push(newVersionHash);
        contentByType[contentType].push(newVersionHash);
        totalContentCount++;
        totalStorageUsed += fileSize;

        emit ContentVersioned(parentHash, newVersionHash, newVersion);
        emit ContentRegistered(newVersionHash, msg.sender, contentType, fileSize, newVersion);
        
        return newVersionHash;
    }

    /**
     * @dev Create a content manifest with merkle tree verification
     */
    function createManifest(
        bytes32 manifestId,
        bytes32[] memory contentHashes,
        bytes32 merkleRoot,
        string memory manifestType,
        string memory description,
        bool isImmutable
    ) external payable onlyRole(MANIFEST_MANAGER_ROLE) nonReentrant whenNotPaused {
        require(manifestId != bytes32(0), "IPFSHashRegistry: Invalid manifest ID");
        require(contentHashes.length > 0, "IPFSHashRegistry: No content provided");
        require(merkleRoot != bytes32(0), "IPFSHashRegistry: Invalid merkle root");
        require(msg.value >= manifestCreationFee, "IPFSHashRegistry: Insufficient fee");

        // Verify all content hashes exist and are accessible
        uint256 totalSize = 0;
        for (uint i = 0; i < contentHashes.length; i++) {
            require(contentRegistry[contentHashes[i]].isActive, "IPFSHashRegistry: Content not found");
            totalSize += contentRegistry[contentHashes[i]].fileSize;
        }

        ManifestRecord storage manifest = manifestRegistry[manifestId];
        require(manifest.creator == address(0), "IPFSHashRegistry: Manifest already exists");

        manifest.manifestId = manifestId;
        manifest.contentHashes = contentHashes;
        manifest.merkleRoot = merkleRoot;
        manifest.totalSize = totalSize;
        manifest.contentCount = contentHashes.length;
        manifest.manifestType = manifestType;
        manifest.creator = msg.sender;
        manifest.createdAt = block.timestamp;
        manifest.lastUpdated = block.timestamp;
        manifest.isImmutable = isImmutable;
        manifest.description = description;

        // Update content inclusion mapping
        for (uint i = 0; i < contentHashes.length; i++) {
            manifest.includesContent[contentHashes[i]] = true;
        }

        totalManifestCount++;

        emit ManifestCreated(manifestId, msg.sender, contentHashes.length, merkleRoot);
    }

    /**
     * @dev Update an existing manifest (if not immutable)
     */
    function updateManifest(
        bytes32 manifestId,
        bytes32[] memory newContentHashes,
        bytes32 newMerkleRoot,
        string memory newDescription
    ) external onlyRole(MANIFEST_MANAGER_ROLE) nonReentrant whenNotPaused {
        ManifestRecord storage manifest = manifestRegistry[manifestId];
        require(manifest.creator != address(0), "IPFSHashRegistry: Manifest not found");
        require(!manifest.isImmutable, "IPFSHashRegistry: Manifest is immutable");
        require(manifest.creator == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), 
                "IPFSHashRegistry: Unauthorized");

        // Clear old content mappings
        for (uint i = 0; i < manifest.contentHashes.length; i++) {
            manifest.includesContent[manifest.contentHashes[i]] = false;
        }

        // Verify new content and calculate total size
        uint256 totalSize = 0;
        for (uint i = 0; i < newContentHashes.length; i++) {
            require(contentRegistry[newContentHashes[i]].isActive, "IPFSHashRegistry: Content not found");
            totalSize += contentRegistry[newContentHashes[i]].fileSize;
            manifest.includesContent[newContentHashes[i]] = true;
        }

        // Update manifest
        manifest.contentHashes = newContentHashes;
        manifest.merkleRoot = newMerkleRoot;
        manifest.totalSize = totalSize;
        manifest.contentCount = newContentHashes.length;
        manifest.lastUpdated = block.timestamp;
        manifest.description = newDescription;

        emit ManifestUpdated(manifestId, newContentHashes.length, newMerkleRoot);
    }

    /**
     * @dev Verify content integrity using merkle proof
     */
    function verifyContent(
        bytes32 contentHash,
        bytes32[] memory merkleProof,
        bytes32 merkleRoot,
        uint256 leafIndex,
        string memory verificationMethod
    ) external onlyRole(VERIFIER_ROLE) nonReentrant whenNotPaused returns (bool) {
        require(contentRegistry[contentHash].isActive, "IPFSHashRegistry: Content not found");
        
        // Verify merkle proof
        bool isValid = MerkleProof.verify(merkleProof, merkleRoot, contentHash);
        
        // Store verification result
        VerificationProof storage proof = verificationProofs[contentHash];
        proof.contentHash = contentHash;
        proof.merkleProof = merkleProof;
        proof.leafIndex = leafIndex;
        proof.isVerified = isValid;
        proof.verifier = msg.sender;
        proof.verificationTime = block.timestamp;
        proof.verificationMethod = verificationMethod;

        emit ContentVerified(contentHash, msg.sender, isValid, verificationMethod);
        return isValid;
    }

    /**
     * @dev Batch verify all content in a manifest
     */
    function batchVerifyManifest(bytes32 manifestId) external onlyRole(VERIFIER_ROLE) nonReentrant whenNotPaused returns (bool) {
        ManifestRecord storage manifest = manifestRegistry[manifestId];
        require(manifest.creator != address(0), "IPFSHashRegistry: Manifest not found");

        bool allValid = true;
        bytes32[] memory contentHashes = manifest.contentHashes;
        
        for (uint i = 0; i < contentHashes.length; i++) {
            // Simple verification - in production would use actual merkle proofs
            if (!contentRegistry[contentHashes[i]].isActive) {
                allValid = false;
            }
        }

        emit BatchVerificationCompleted(manifestId, contentHashes.length, allValid);
        return allValid;
    }

    /**
     * @dev Update content metadata
     */
    function updateContentMetadata(
        bytes32 contentHash,
        string memory title,
        string memory description,
        string[] memory keywords,
        string memory license
    ) external nonReentrant whenNotPaused {
        require(contentRegistry[contentHash].isActive, "IPFSHashRegistry: Content not found");
        require(
            contentRegistry[contentHash].registrar == msg.sender || 
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "IPFSHashRegistry: Unauthorized"
        );

        ContentMetadata storage metadata = contentMetadata[contentHash];
        metadata.title = title;
        metadata.description = description;
        metadata.keywords = keywords;
        metadata.license = license;
        metadata.creator = contentRegistry[contentHash].registrar;
        metadata.createdAt = contentRegistry[contentHash].timestamp;

        emit MetadataUpdated(contentHash, msg.sender);
    }

    /**
     * @dev Get content information
     */
    function getContentInfo(bytes32 contentHash) external view returns (
        ContentRecord memory record,
        ContentMetadata memory metadata,
        bool hasVerification
    ) {
        require(contentRegistry[contentHash].isActive, "IPFSHashRegistry: Content not found");
        
        return (
            contentRegistry[contentHash],
            contentMetadata[contentHash],
            verificationProofs[contentHash].isVerified
        );
    }

    /**
     * @dev Get manifest information
     */
    function getManifestInfo(bytes32 manifestId) external view returns (
        bytes32[] memory contentHashes,
        bytes32 merkleRoot,
        uint256 totalSize,
        uint256 contentCount,
        string memory manifestType,
        address creator,
        bool isImmutable
    ) {
        ManifestRecord storage manifest = manifestRegistry[manifestId];
        require(manifest.creator != address(0), "IPFSHashRegistry: Manifest not found");

        return (
            manifest.contentHashes,
            manifest.merkleRoot,
            manifest.totalSize,
            manifest.contentCount,
            manifest.manifestType,
            manifest.creator,
            manifest.isImmutable
        );
    }

    /**
     * @dev Check if content is included in manifest
     */
    function isContentInManifest(bytes32 manifestId, bytes32 contentHash) external view returns (bool) {
        return manifestRegistry[manifestId].includesContent[contentHash];
    }

    /**
     * @dev Get content versions
     */
    function getContentVersions(bytes32 parentHash) external view returns (bytes32[] memory) {
        return contentVersions[parentHash];
    }

    /**
     * @dev Get user's content
     */
    function getUserContent(address user) external view returns (bytes32[] memory) {
        return userContent[user];
    }

    /**
     * @dev Administrative functions
     */
    function setSupportedContentType(string memory contentType, bool supported) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedContentTypes[contentType] = supported;
    }

    function setMaxFileSize(uint256 newMaxSize) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxFileSize = newMaxSize;
    }

    function setManifestCreationFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        manifestCreationFee = newFee;
    }

    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Increment download counter
     */
    function recordDownload(bytes32 contentHash) external {
        require(contentRegistry[contentHash].isActive, "IPFSHashRegistry: Content not found");
        downloadCounts[contentHash]++;
    }
}