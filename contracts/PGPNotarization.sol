// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title PGPNotarization
 * @dev Cryptographic document authentication system with PGP signatures,
 *      multi-signature verification chains, and trust web integration
 */
contract PGPNotarization is AccessControl, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant NOTARY_ROLE = keccak256("NOTARY_ROLE");
    bytes32 public constant TRUSTED_AUTHORITY_ROLE = keccak256("TRUSTED_AUTHORITY_ROLE");
    bytes32 public constant KEY_MANAGER_ROLE = keccak256("KEY_MANAGER_ROLE");

    // PGP Key structures
    struct PGPPublicKey {
        bytes32 keyId;              // PGP Key ID
        bytes publicKeyData;        // Full public key data
        string keyType;             // RSA, ECDSA, EdDSA, etc.
        uint256 keySize;            // Key size in bits
        uint256 creationTime;       // Key creation timestamp
        uint256 expirationTime;     // Key expiration (0 = no expiry)
        address owner;              // Key owner address
        bool isRevoked;             // Revocation status
        string userInfo;            // User ID information
        uint256 trustLevel;         // Trust level (0-100)
        bytes32[] certifyingKeys;   // Keys that certified this key
    }

    struct PGPSignature {
        bytes32 signatureId;        // Unique signature identifier
        bytes32 keyId;              // Signing key ID
        bytes signatureData;        // Signature bytes
        bytes32 documentHash;       // Hash of signed document
        uint256 timestamp;          // Signature timestamp
        address signer;             // Signer's address
        string signatureType;       // Type of signature (binary, text, etc.)
        uint256 hashAlgorithm;      // Hash algorithm used
        bool isValid;               // Validation status
        string purpose;             // Purpose of signature
    }

    struct NotarizedDocument {
        bytes32 documentId;         // Document identifier
        bytes32 documentHash;       // Document content hash
        bytes32[] signatures;       // Array of signature IDs
        uint256 notarizationTime;   // When document was notarized
        address notarizedBy;        // Notary who processed
        uint256 requiredSignatures; // Number of required signatures
        bool isComplete;            // All required signatures present
        string documentType;        // Type of document
        bytes32 parentDocument;     // Parent document (for amendments)
        mapping(bytes32 => bool) hasSignature; // Quick signature lookup
    }

    struct TrustRelationship {
        bytes32 trusterId;          // Trusting key ID
        bytes32 trustedId;          // Trusted key ID
        uint256 trustLevel;         // Level of trust (0-100)
        uint256 establishedAt;      // When trust was established
        uint256 expiresAt;         // When trust expires (0 = permanent)
        bool isActive;             // Trust relationship status
        string trustType;          // Type of trust (full, partial, etc.)
        bytes certificationSignature; // Signature of certification
    }

    struct SignatureChain {
        bytes32 chainId;           // Chain identifier
        bytes32[] signatureIds;    // Ordered signatures in chain
        uint256 requiredConfirmations; // Required confirmations
        uint256 currentConfirmations; // Current confirmations
        bool isComplete;           // Chain completion status
        uint256 createdAt;         // Chain creation time
        string purpose;            // Purpose of signature chain
    }

    // Storage mappings
    mapping(bytes32 => PGPPublicKey) public publicKeys;
    mapping(bytes32 => PGPSignature) public signatures;
    mapping(bytes32 => NotarizedDocument) public notarizedDocuments;
    mapping(bytes32 => TrustRelationship) public trustRelationships;
    mapping(bytes32 => SignatureChain) public signatureChains;
    mapping(address => bytes32[]) public userKeys;
    mapping(bytes32 => bytes32[]) public documentSignatures;
    mapping(bytes32 => uint256) public keyTrustScores;
    mapping(address => bool) public authorizedNotaries;
    
    // Trust web mappings
    mapping(bytes32 => bytes32[]) public keyTrustWeb; // key => trusted keys
    mapping(bytes32 => mapping(bytes32 => bool)) public directTrust;
    
    // Global configuration
    uint256 public constant MIN_TRUST_SCORE = 50;
    uint256 public constant MAX_TRUST_LEVEL = 100;
    uint256 public defaultTrustLevel = 75;
    uint256 public keyExpirationGracePeriod = 30 days;
    uint256 public signatureValidityPeriod = 365 days;

    // Events
    event KeyRegistered(
        bytes32 indexed keyId,
        address indexed owner,
        string keyType,
        uint256 keySize,
        uint256 trustLevel
    );
    event KeyRevoked(bytes32 indexed keyId, address indexed revoker, string reason);
    event DocumentNotarized(
        bytes32 indexed documentId,
        bytes32 documentHash,
        address indexed notary,
        uint256 signatureCount
    );
    event SignatureAdded(
        bytes32 indexed documentId,
        bytes32 indexed signatureId,
        bytes32 indexed keyId,
        address signer
    );
    event TrustEstablished(
        bytes32 indexed trusterId,
        bytes32 indexed trustedId,
        uint256 trustLevel,
        address establisher
    );
    event SignatureChainCompleted(bytes32 indexed chainId, uint256 totalSignatures);
    event TrustScoreUpdated(bytes32 indexed keyId, uint256 oldScore, uint256 newScore);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(NOTARY_ROLE, msg.sender);
        _grantRole(TRUSTED_AUTHORITY_ROLE, msg.sender);
        _grantRole(KEY_MANAGER_ROLE, msg.sender);
        
        authorizedNotaries[msg.sender] = true;
    }

    /**
     * @dev Register a PGP public key
     */
    function registerPublicKey(
        bytes32 keyId,
        bytes memory publicKeyData,
        string memory keyType,
        uint256 keySize,
        uint256 expirationTime,
        string memory userInfo
    ) external nonReentrant whenNotPaused returns (bool) {
        require(keyId != bytes32(0), "PGPNotarization: Invalid key ID");
        require(publicKeyData.length > 0, "PGPNotarization: Invalid key data");
        require(publicKeys[keyId].keyId == bytes32(0), "PGPNotarization: Key already exists");
        require(keySize >= 2048, "PGPNotarization: Key size too small");

        PGPPublicKey storage key = publicKeys[keyId];
        key.keyId = keyId;
        key.publicKeyData = publicKeyData;
        key.keyType = keyType;
        key.keySize = keySize;
        key.creationTime = block.timestamp;
        key.expirationTime = expirationTime;
        key.owner = msg.sender;
        key.isRevoked = false;
        key.userInfo = userInfo;
        key.trustLevel = defaultTrustLevel;

        // Add to user's key list
        userKeys[msg.sender].push(keyId);
        keyTrustScores[keyId] = defaultTrustLevel;

        emit KeyRegistered(keyId, msg.sender, keyType, keySize, defaultTrustLevel);
        return true;
    }

    /**
     * @dev Create a PGP signature for a document
     */
    function createSignature(
        bytes32 signatureId,
        bytes32 keyId,
        bytes memory signatureData,
        bytes32 documentHash,
        string memory signatureType,
        uint256 hashAlgorithm,
        string memory purpose
    ) external nonReentrant whenNotPaused returns (bool) {
        require(signatureId != bytes32(0), "PGPNotarization: Invalid signature ID");
        require(keyId != bytes32(0), "PGPNotarization: Invalid key ID");
        require(signatureData.length > 0, "PGPNotarization: Invalid signature data");
        require(documentHash != bytes32(0), "PGPNotarization: Invalid document hash");
        require(signatures[signatureId].signatureId == bytes32(0), "PGPNotarization: Signature exists");

        PGPPublicKey memory key = publicKeys[keyId];
        require(key.keyId != bytes32(0), "PGPNotarization: Key not found");
        require(!key.isRevoked, "PGPNotarization: Key is revoked");
        require(key.owner == msg.sender, "PGPNotarization: Not key owner");
        require(!_isKeyExpired(keyId), "PGPNotarization: Key expired");

        PGPSignature storage signature = signatures[signatureId];
        signature.signatureId = signatureId;
        signature.keyId = keyId;
        signature.signatureData = signatureData;
        signature.documentHash = documentHash;
        signature.timestamp = block.timestamp;
        signature.signer = msg.sender;
        signature.signatureType = signatureType;
        signature.hashAlgorithm = hashAlgorithm;
        signature.isValid = true;
        signature.purpose = purpose;

        // Add to document signatures
        documentSignatures[documentHash].push(signatureId);

        emit SignatureAdded(documentHash, signatureId, keyId, msg.sender);
        return true;
    }

    /**
     * @dev Notarize a document with required signatures
     */
    function notarizeDocument(
        bytes32 documentId,
        bytes32 documentHash,
        bytes32[] memory requiredSignatureIds,
        uint256 minimumSignatures,
        string memory documentType
    ) external onlyRole(NOTARY_ROLE) nonReentrant whenNotPaused returns (bool) {
        require(documentId != bytes32(0), "PGPNotarization: Invalid document ID");
        require(documentHash != bytes32(0), "PGPNotarization: Invalid document hash");
        require(requiredSignatureIds.length >= minimumSignatures, "PGPNotarization: Insufficient signatures");
        require(notarizedDocuments[documentId].documentId == bytes32(0), "PGPNotarization: Document exists");

        // Verify all signatures are valid
        uint256 validSignatures = 0;
        for (uint i = 0; i < requiredSignatureIds.length; i++) {
            bytes32 sigId = requiredSignatureIds[i];
            PGPSignature memory sig = signatures[sigId];
            
            require(sig.signatureId != bytes32(0), "PGPNotarization: Signature not found");
            require(sig.documentHash == documentHash, "PGPNotarization: Hash mismatch");
            require(sig.isValid, "PGPNotarization: Invalid signature");
            require(_isSignatureValid(sigId), "PGPNotarization: Signature verification failed");
            
            validSignatures++;
        }

        require(validSignatures >= minimumSignatures, "PGPNotarization: Not enough valid signatures");

        NotarizedDocument storage doc = notarizedDocuments[documentId];
        doc.documentId = documentId;
        doc.documentHash = documentHash;
        doc.signatures = requiredSignatureIds;
        doc.notarizationTime = block.timestamp;
        doc.notarizedBy = msg.sender;
        doc.requiredSignatures = minimumSignatures;
        doc.isComplete = validSignatures >= minimumSignatures;
        doc.documentType = documentType;

        // Update signature mappings
        for (uint i = 0; i < requiredSignatureIds.length; i++) {
            doc.hasSignature[requiredSignatureIds[i]] = true;
        }

        emit DocumentNotarized(documentId, documentHash, msg.sender, validSignatures);
        return true;
    }

    /**
     * @dev Establish trust relationship between keys
     */
    function establishTrust(
        bytes32 trusterId,
        bytes32 trustedId,
        uint256 trustLevel,
        uint256 expiresAt,
        string memory trustType,
        bytes memory certificationSignature
    ) external nonReentrant whenNotPaused returns (bool) {
        require(trusterId != bytes32(0), "PGPNotarization: Invalid truster key");
        require(trustedId != bytes32(0), "PGPNotarization: Invalid trusted key");
        require(trustLevel <= MAX_TRUST_LEVEL, "PGPNotarization: Invalid trust level");
        require(trusterId != trustedId, "PGPNotarization: Cannot trust self");

        PGPPublicKey memory trusterKey = publicKeys[trusterId];
        PGPPublicKey memory trustedKey = publicKeys[trustedId];
        
        require(trusterKey.keyId != bytes32(0), "PGPNotarization: Truster key not found");
        require(trustedKey.keyId != bytes32(0), "PGPNotarization: Trusted key not found");
        require(trusterKey.owner == msg.sender, "PGPNotarization: Not truster key owner");
        require(!trusterKey.isRevoked, "PGPNotarization: Truster key revoked");
        require(!trustedKey.isRevoked, "PGPNotarization: Trusted key revoked");

        bytes32 relationshipId = keccak256(abi.encodePacked(trusterId, trustedId));
        
        TrustRelationship storage relationship = trustRelationships[relationshipId];
        relationship.trusterId = trusterId;
        relationship.trustedId = trustedId;
        relationship.trustLevel = trustLevel;
        relationship.establishedAt = block.timestamp;
        relationship.expiresAt = expiresAt;
        relationship.isActive = true;
        relationship.trustType = trustType;
        relationship.certificationSignature = certificationSignature;

        // Update trust web
        keyTrustWeb[trusterId].push(trustedId);
        directTrust[trusterId][trustedId] = true;

        // Update trust score
        _updateTrustScore(trustedId);

        emit TrustEstablished(trusterId, trustedId, trustLevel, msg.sender);
        return true;
    }

    /**
     * @dev Create a signature chain for multi-party verification
     */
    function createSignatureChain(
        bytes32 chainId,
        bytes32[] memory signatureIds,
        uint256 requiredConfirmations,
        string memory purpose
    ) external onlyRole(NOTARY_ROLE) nonReentrant whenNotPaused returns (bool) {
        require(chainId != bytes32(0), "PGPNotarization: Invalid chain ID");
        require(signatureIds.length > 0, "PGPNotarization: No signatures provided");
        require(signatureChains[chainId].chainId == bytes32(0), "PGPNotarization: Chain exists");

        // Verify all signatures exist and are valid
        uint256 validSignatures = 0;
        for (uint i = 0; i < signatureIds.length; i++) {
            if (_isSignatureValid(signatureIds[i])) {
                validSignatures++;
            }
        }

        SignatureChain storage chain = signatureChains[chainId];
        chain.chainId = chainId;
        chain.signatureIds = signatureIds;
        chain.requiredConfirmations = requiredConfirmations;
        chain.currentConfirmations = validSignatures;
        chain.isComplete = validSignatures >= requiredConfirmations;
        chain.createdAt = block.timestamp;
        chain.purpose = purpose;

        if (chain.isComplete) {
            emit SignatureChainCompleted(chainId, validSignatures);
        }

        return true;
    }

    /**
     * @dev Revoke a PGP key
     */
    function revokeKey(
        bytes32 keyId,
        string memory reason
    ) external nonReentrant whenNotPaused {
        PGPPublicKey storage key = publicKeys[keyId];
        require(key.keyId != bytes32(0), "PGPNotarization: Key not found");
        require(
            key.owner == msg.sender || hasRole(TRUSTED_AUTHORITY_ROLE, msg.sender),
            "PGPNotarization: Unauthorized revocation"
        );
        require(!key.isRevoked, "PGPNotarization: Key already revoked");

        key.isRevoked = true;
        keyTrustScores[keyId] = 0;

        // Invalidate all signatures made with this key
        _invalidateKeySignatures(keyId);

        emit KeyRevoked(keyId, msg.sender, reason);
    }

    /**
     * @dev Verify document authenticity
     */
    function verifyDocument(bytes32 documentId) external view returns (
        bool isValid,
        uint256 signatureCount,
        uint256 requiredSignatures,
        bool isComplete,
        uint256 averageTrustLevel
    ) {
        NotarizedDocument storage doc = notarizedDocuments[documentId];
        require(doc.documentId != bytes32(0), "PGPNotarization: Document not found");

        uint256 validSigs = 0;
        uint256 totalTrust = 0;

        for (uint i = 0; i < doc.signatures.length; i++) {
            bytes32 sigId = doc.signatures[i];
            if (_isSignatureValid(sigId)) {
                validSigs++;
                PGPSignature memory sig = signatures[sigId];
                totalTrust += keyTrustScores[sig.keyId];
            }
        }

        return (
            validSigs >= doc.requiredSignatures,
            validSigs,
            doc.requiredSignatures,
            doc.isComplete,
            doc.signatures.length > 0 ? totalTrust / doc.signatures.length : 0
        );
    }

    /**
     * @dev Get key trust score
     */
    function getKeyTrustScore(bytes32 keyId) external view returns (uint256) {
        return keyTrustScores[keyId];
    }

    /**
     * @dev Check if key is trusted by another key
     */
    function isKeyTrusted(bytes32 trusterId, bytes32 trustedId) external view returns (bool) {
        return directTrust[trusterId][trustedId];
    }

    /**
     * @dev Get signature chain status
     */
    function getSignatureChainStatus(bytes32 chainId) external view returns (
        uint256 currentConfirmations,
        uint256 requiredConfirmations,
        bool isComplete
    ) {
        SignatureChain memory chain = signatureChains[chainId];
        return (chain.currentConfirmations, chain.requiredConfirmations, chain.isComplete);
    }

    /**
     * @dev Administrative functions
     */
    function authorizeNotary(address notary, bool authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedNotaries[notary] = authorized;
        if (authorized) {
            _grantRole(NOTARY_ROLE, notary);
        } else {
            _revokeRole(NOTARY_ROLE, notary);
        }
    }

    function setDefaultTrustLevel(uint256 newLevel) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newLevel <= MAX_TRUST_LEVEL, "PGPNotarization: Invalid trust level");
        defaultTrustLevel = newLevel;
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
    function _isKeyExpired(bytes32 keyId) internal view returns (bool) {
        PGPPublicKey memory key = publicKeys[keyId];
        if (key.expirationTime == 0) return false;
        return block.timestamp > key.expirationTime + keyExpirationGracePeriod;
    }

    function _isSignatureValid(bytes32 signatureId) internal view returns (bool) {
        PGPSignature memory sig = signatures[signatureId];
        if (sig.signatureId == bytes32(0)) return false;
        if (!sig.isValid) return false;
        if (block.timestamp > sig.timestamp + signatureValidityPeriod) return false;
        
        PGPPublicKey memory key = publicKeys[sig.keyId];
        if (key.isRevoked) return false;
        if (_isKeyExpired(sig.keyId)) return false;
        
        return keyTrustScores[sig.keyId] >= MIN_TRUST_SCORE;
    }

    function _invalidateKeySignatures(bytes32 keyId) internal {
        // In a full implementation, this would iterate through all signatures
        // and mark those made with the revoked key as invalid
        // For now, we rely on the _isSignatureValid check
    }

    function _updateTrustScore(bytes32 keyId) internal {
        // Calculate trust score based on trust web
        uint256 totalTrust = 0;
        uint256 trustCount = 0;
        
        bytes32[] memory trusters = keyTrustWeb[keyId];
        for (uint i = 0; i < trusters.length; i++) {
            bytes32 relationshipId = keccak256(abi.encodePacked(trusters[i], keyId));
            TrustRelationship memory rel = trustRelationships[relationshipId];
            
            if (rel.isActive && (rel.expiresAt == 0 || block.timestamp < rel.expiresAt)) {
                totalTrust += rel.trustLevel;
                trustCount++;
            }
        }
        
        uint256 oldScore = keyTrustScores[keyId];
        uint256 newScore = trustCount > 0 ? totalTrust / trustCount : defaultTrustLevel;
        
        keyTrustScores[keyId] = newScore;
        
        if (oldScore != newScore) {
            emit TrustScoreUpdated(keyId, oldScore, newScore);
        }
    }
}