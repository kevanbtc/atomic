# ESG IP Protection System

## Overview

The ESG IP Protection System is a comprehensive, blockchain-based intellectual property protection framework designed specifically for the Environmental, Social, and Governance (ESG) ecosystem. This system provides immutable ownership verification, decentralized content storage, cryptographic authentication, and sovereign identity management.

## Key Features

### 🛡️ Comprehensive IP Protection
- **Immutable Ownership Certificates** via ERC-721 NFTs
- **Multi-level Protection** (Basic, Standard, Premium, Sovereign)
- **IPFS Content Storage** with integrity verification
- **PGP Signature Authentication** for document verification
- **Sovereignty-based Access Control** via Unykorn ecosystem integration

### 💰 Advanced Revenue Management
- **4-Tier Subscription System** (Bronze, Silver, Gold, Platinum)
- **Automated Revenue Distribution** to creators and stakeholders
- **Referral Rewards System** (5% referral bonuses)
- **Royalty Management** with ERC-2981 standard compliance
- **Cross-platform Revenue Sharing**

### 🔐 Multi-layered Security
- **Role-based Access Control** (RBAC)
- **Emergency Pause Mechanisms** for system-wide protection
- **Multi-signature Validation** for critical operations
- **Cryptographic Proof Verification** using multiple methods
- **Economic Security** through staking requirements

### 🌐 Decentralized Architecture
- **IPFS Integration** for distributed content storage
- **Cross-chain Compatibility** with sovereignty proofs
- **Trust Web Implementation** for PGP key validation
- **Decentralized Governance** with token-based voting

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ESG IP Protection System                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ VaultProofNFT   │◄──►│SubscriptionKey  │                │
│  │   (ERC-721)     │    │   (ERC-1155)    │                │
│  └─────────────────┘    └─────────────────┘                 │
│           │                       │                         │
│           │              ┌─────────────────┐                │
│           └─────────────►│ ESGIPProtection │◄───────────────┤
│                          │   (Controller)  │                │
│           ┌─────────────►└─────────────────┘◄──────────┐    │
│           │                       │                    │    │
│  ┌─────────────────┐    ┌─────────────────┐  ┌─────────────────┐
│  │ IPFSHashRegistry│    │ PGPNotarization │  │SovereigntyProof │
│  │                 │    │                 │  │                 │
│  └─────────────────┘    └─────────────────┘  └─────────────────┘
└─────────────────────────────────────────────────────────────┘
```

## Smart Contracts

### Core Contracts

| Contract | Purpose | Standard | Key Features |
|----------|---------|----------|--------------|
| **VaultProofNFT** | IP ownership certificates | ERC-721 | IPFS integration, PGP signatures, royalties |
| **SubscriptionKeyNFT** | Tiered access control | ERC-1155 | 4-tier system, revenue distribution |
| **IPFSHashRegistry** | Content integrity verification | Custom | Manifest generation, batch verification |
| **PGPNotarization** | Document authentication | Custom | Trust web, signature chains |
| **SovereigntyProof** | Identity verification | Custom | Multi-level sovereignty, cross-chain |
| **ESGIPProtection** | System coordinator | Custom | Package management, revenue control |

### Contract Addresses (Testnet)

```javascript
// Example deployment addresses
const contracts = {
  ESGIPProtection: "0x...",      // Main controller
  VaultProofNFT: "0x...",        // IP ownership NFTs
  SubscriptionKeyNFT: "0x...",   // Access control tokens
  IPFSHashRegistry: "0x...",     // Content registry
  PGPNotarization: "0x...",      // Document authentication
  SovereigntyProof: "0x..."      // Identity management
};
```

## Getting Started

### Prerequisites

```bash
# Required software
Node.js >= 16.0.0
npm >= 8.0.0
Hardhat >= 2.12.0

# Required tokens
ESG Stablecoin (for subscriptions)
VCHAN Token (for sovereignty staking)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/unykorn/esg-system
cd unykorn

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test tests/esg/ESG_IP_Protection.test.js
```

### Deployment

```bash
# Deploy to local network
npx hardhat run scripts/deploy/deploy-ip-protection.js --network localhost

# Deploy to testnet
npx hardhat run scripts/deploy/deploy-ip-protection.js --network goerli

# Deploy to mainnet (use with caution)
npx hardhat run scripts/deploy/deploy-ip-protection.js --network mainnet
```

### Environment Configuration

Create a `.env` file:

```bash
# Network configuration
INFURA_PROJECT_ID=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key

# Contract configuration
PAYMENT_TOKEN=0x...  # ESG Stablecoin address
SOVEREIGNTY_TOKEN=0x...  # VCHAN token address
PLATFORM_TREASURY=0x...
ECONOMIC_TREASURY=0x...

# IPFS configuration
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_GATEWAY_URL=https://ipfs.infura.io/ipfs/
```

## Usage Guide

### 1. Establishing Sovereignty

Before creating IP protection, users must establish sovereignty:

```javascript
const identityId = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("unique-identity")
);

await sovereigntyProof.establishSovereignty(
  identityId,
  2, // Verified level
  "US", // Jurisdiction
  credentialHash
);
```

**Sovereignty Levels:**
- **Level 1 (Basic)**: 1,000 tokens stake
- **Level 2 (Verified)**: 5,000 tokens stake  
- **Level 3 (Enhanced)**: 25,000 tokens stake
- **Level 4 (Institutional)**: 100,000 tokens stake
- **Level 5 (Governance)**: 500,000 tokens stake
- **Level 6 (Ultimate)**: 1,000,000 tokens stake

### 2. Purchasing Subscriptions

Users need active subscriptions to access protected content:

```javascript
// Purchase Bronze subscription (30 days, 199 tokens)
await subscriptionKeyNFT.purchaseSubscription(1, referrerAddress);

// Purchase Silver subscription (90 days, 499 tokens)
await subscriptionKeyNFT.purchaseSubscription(2, referrerAddress);

// Purchase Gold subscription (365 days, 1999 tokens)
await subscriptionKeyNFT.purchribeSubscription(3, referrerAddress);

// Purchase Platinum subscription (lifetime, 9999 tokens)
await subscriptionKeyNFT.purchaseSubscription(4, referrerAddress);
```

**Subscription Benefits:**

| Tier | Duration | Price | Features |
|------|----------|-------|----------|
| Bronze | 30 days | 199 tokens | Basic content access |
| Silver | 90 days | 499 tokens | Premium content, priority support |
| Gold | 365 days | 1999 tokens | Advanced analytics, API access |
| Platinum | Lifetime | 9999 tokens | All features, white-label options |

### 3. Creating IP Protection Packages

Creators can protect their intellectual property:

```javascript
// Define content metadata
const proofMetadata = {
  contentHash: ipfsContentHash,
  manifestHash: manifestHash,
  pgpSignature: pgpSignatureData,
  sovereigntyProof: sovereigntyProofId,
  creationTimestamp: 0, // Set by contract
  lastUpdate: 0,
  creator: creatorAddress,
  isTransferable: true,
  expiryTimestamp: 0, // Permanent protection
  jurisdiction: "US",
  protectionLevel: 2 // Standard protection
};

// Create protection package
const packageId = await esgIPProtection.createIPProtectionPackage(
  "My IP Package",
  0, // Individual package type
  2, // Silver subscription required
  [contentHash1, contentHash2],
  tokenURI,
  proofMetadata,
  manifest,
  license,
  royalty,
  revenueDistribution
);
```

### 4. Accessing Protected Content

Users with valid subscriptions can access protected content:

```javascript
// Check access permissions
const hasSubscription = await subscriptionKeyNFT.hasActiveSubscription(userAddress);
const accessLevel = await subscriptionKeyNFT.getUserAccessLevel(userAddress);
const hasLicense = await vaultProofNFT.hasLicense(tokenId, userAddress);

// Access content (if authorized)
if (hasSubscription && hasLicense) {
  await esgIPProtection.accessProtectedContent(packageId, contentHash);
}
```

### 5. PGP Notarization

Documents can be authenticated using PGP signatures:

```javascript
// Register PGP public key
const keyId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pgp-key-id"));
await pgpNotarization.registerPublicKey(
  keyId,
  publicKeyData,
  "RSA",
  2048,
  0, // No expiration
  "user@example.com"
);

// Create document signature
await pgpNotarization.createSignature(
  signatureId,
  keyId,
  signatureData,
  documentHash,
  "binary",
  1, // SHA-256
  "Document authentication"
);

// Notarize document with multiple signatures
await pgpNotarization.notarizeDocument(
  documentId,
  documentHash,
  [signatureId1, signatureId2],
  2, // Minimum 2 signatures required
  "legal-contract"
);
```

## API Reference

### ESGIPProtection Contract

#### Main Functions

```solidity
function createIPProtectionPackage(
    string memory packageName,
    PackageType packageType,
    uint256 requiredSubscriptionTier,
    bytes32[] memory contentHashes,
    string memory tokenURI,
    VaultProofNFT.ProofMetadata memory proofMetadata,
    VaultProofNFT.IPFSManifest memory manifest,
    VaultProofNFT.LicenseTerms memory license,
    VaultProofNFT.RoyaltyInfo memory royalty,
    RevenueDistribution[] memory revenueDistribution
) external returns (uint256 packageId);

function accessProtectedContent(
    uint256 packageId,
    bytes32 contentHash
) external returns (bool);

function addCollaborator(
    uint256 packageId,
    address collaborator,
    uint256 revenuePercentage,
    string memory role
) external;
```

#### View Functions

```solidity
function getPackageInfo(uint256 packageId) 
    external view returns (
        IPProtectionPackage memory package,
        AccessMetrics memory metrics,
        uint256 collaboratorCount
    );

function getUserPackageAccess(uint256 packageId, address user) 
    external view returns (
        uint256 accessCount,
        uint256 lastAccessTime,
        bool hasAccess
    );

function isContentProtected(bytes32 contentHash) 
    external view returns (bool, uint256);
```

### SubscriptionKeyNFT Contract

```solidity
function purchaseSubscription(uint256 tier, address referrer) external;
function renewSubscription() external;
function hasActiveSubscription(address user) external view returns (bool);
function getUserAccessLevel(address user) external view returns (uint256);
function distributeRevenue() external;
```

### VaultProofNFT Contract

```solidity
function createProof(
    address to,
    string memory tokenURI,
    ProofMetadata memory metadata,
    IPFSManifest memory manifest,
    LicenseTerms memory license,
    RoyaltyInfo memory royalty
) external returns (uint256);

function grantLicense(uint256 tokenId, address licensee, uint256 customPrice) external payable;
function hasLicense(uint256 tokenId, address user) external view returns (bool);
function verifyContentIntegrity(uint256 tokenId, bytes32 providedHash) external view returns (bool);
```

## Revenue Model

### Revenue Streams

1. **Subscription Revenue**: Recurring subscription payments
2. **License Fees**: Content licensing and usage fees
3. **Transaction Fees**: Platform transaction processing
4. **Staking Rewards**: Sovereignty staking returns
5. **Referral Bonuses**: User acquisition rewards

### Revenue Distribution

```
Default Revenue Split:
├── 60% → Content Creators
├── 25% → Platform Operations  
├── 15% → Governance Treasury
└── 5% → Referral Rewards
```

### Fee Structure

| Service | Fee | Description |
|---------|-----|-------------|
| Package Creation | 0.1% of value | IP protection setup |
| Content Access | Pay-per-use | Usage-based pricing |
| Subscription Sales | 2.5% | Platform commission |
| License Transfers | 0.05% | Secondary market |
| Cross-chain Proofs | Fixed fee | Multi-chain verification |

## Security Considerations

### Access Control

The system implements multi-layered access control:

1. **Role-Based Access Control (RBAC)**
   - Admin roles for system management
   - Operator roles for day-to-day operations
   - Specialized roles for specific functions

2. **Sovereignty-Based Restrictions**
   - Different features require different sovereignty levels
   - Staking requirements align economic incentives
   - Cross-chain proof validation

3. **Subscription-Based Access**
   - Tiered access to different content levels
   - Time-based access expiration
   - Feature-specific permissions

### Emergency Procedures

```solidity
// Emergency pause (admin only)
function pause() external onlyRole(DEFAULT_ADMIN_ROLE);

// Emergency unpause
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);

// Emergency fund recovery
function emergencyWithdraw(address token, uint256 amount) 
    external onlyRole(DEFAULT_ADMIN_ROLE);
```

### Security Best Practices

1. **Smart Contract Security**
   - ReentrancyGuard on all state-changing functions
   - SafeERC20 for token transfers
   - Access control on administrative functions
   - Pause mechanisms for emergency stops

2. **Cryptographic Security**
   - ECDSA signature verification
   - PGP signature authentication  
   - Merkle tree proof validation
   - Hash-based content integrity

3. **Economic Security**
   - Staking requirements for advanced features
   - Economic penalties for malicious behavior
   - Revenue sharing for honest participation
   - Token-based governance alignment

## Testing

### Running Tests

```bash
# Run all IP protection tests
npx hardhat test tests/esg/ESG_IP_Protection.test.js

# Run specific test categories
npx hardhat test tests/esg/ESG_IP_Protection.test.js --grep "Sovereignty System"
npx hardhat test tests/esg/ESG_IP_Protection.test.js --grep "Subscription System"
npx hardhat test tests/esg/ESG_IP_Protection.test.js --grep "Access Control"

# Generate coverage report
npx hardhat coverage --testfiles tests/esg/ESG_IP_Protection.test.js
```

### Test Coverage

The test suite covers:

- ✅ System integration and deployment
- ✅ Sovereignty establishment and upgrades  
- ✅ Subscription purchasing and management
- ✅ Content registration and protection
- ✅ Access control and permissions
- ✅ PGP notarization workflow
- ✅ Revenue distribution mechanisms
- ✅ Emergency controls and pausing
- ✅ Error handling and edge cases

### Gas Usage Analysis

| Operation | Estimated Gas | Cost (20 gwei) |
|-----------|--------------|-----------------|
| Create IP Package | ~500,000 | $0.20 |
| Purchase Subscription | ~200,000 | $0.08 |
| Access Content | ~50,000 | $0.02 |
| Grant License | ~80,000 | $0.03 |
| Establish Sovereignty | ~300,000 | $0.12 |

## Troubleshooting

### Common Issues

1. **"No active subscription" Error**
   ```javascript
   // Check subscription status
   const hasSubscription = await subscriptionKeyNFT.hasActiveSubscription(userAddress);
   if (!hasSubscription) {
     // Purchase subscription first
     await subscriptionKeyNFT.purchaseSubscription(1, ethers.constants.AddressZero);
   }
   ```

2. **"Insufficient sovereignty level" Error**
   ```javascript
   // Check and upgrade sovereignty
   const identityId = await sovereigntyProof.addressToIdentity(userAddress);
   const [, level] = await sovereigntyProof.getSovereigntyInfo(identityId);
   if (level < requiredLevel) {
     // Upgrade sovereignty
     await sovereigntyProof.upgradeSovereignty(identityId, requiredLevel);
   }
   ```

3. **"No content license" Error**
   ```javascript
   // Grant license for content access
   await vaultProofNFT.grantLicense(tokenId, userAddress, 0);
   ```

### Debug Mode

Enable detailed logging:

```javascript
// In hardhat.config.js
module.exports = {
  // ... other config
  mocha: {
    timeout: 100000,
    reporter: 'spec'
  },
  networks: {
    hardhat: {
      loggingEnabled: true,
      mining: {
        auto: true,
        interval: 1000
      }
    }
  }
};
```

## Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Deploy core smart contracts
- [x] Implement basic IP protection
- [x] Launch subscription system
- [x] Basic PGP integration

### Phase 2: Advanced Features 🚧
- [ ] Cross-chain sovereignty proofs
- [ ] Advanced trust web system
- [ ] AI-powered content analysis
- [ ] Enhanced collaboration tools

### Phase 3: Enterprise Integration 📋
- [ ] Enterprise APIs
- [ ] Legal compliance automation
- [ ] Institutional sovereignty features
- [ ] Third-party integrations

### Phase 4: Ecosystem Expansion 🌐
- [ ] Multi-chain deployment
- [ ] Global marketplace
- [ ] Advanced governance
- [ ] Community-driven features

## Contributing

We welcome contributions to the ESG IP Protection System!

### Development Setup

```bash
# Fork the repository
git clone https://github.com/yourusername/esg-system
cd unykorn

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
npx hardhat test

# Submit pull request
```

### Contribution Guidelines

1. **Code Quality**
   - Follow Solidity style guide
   - Write comprehensive tests
   - Document all public functions
   - Use meaningful variable names

2. **Security**
   - Run security analysis tools
   - Follow best practices for smart contracts
   - Test edge cases thoroughly
   - Consider economic attack vectors

3. **Documentation**
   - Update README for new features
   - Add inline code comments
   - Create usage examples
   - Update API documentation

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

## Support

### Documentation
- [Architecture Documentation](docs/ESG_IP_Protection_Architecture.md)
- [Smart Contract Specs](docs/contracts/smart-contract-specs.md)
- [API Reference](docs/api/)

### Community
- Discord: [Join our community](https://discord.gg/unykorn)
- Telegram: [@unykorn_official](https://t.me/unykorn_official)
- Twitter: [@UnykornESG](https://twitter.com/UnykornESG)

### Professional Support
- Email: support@unykorn.com
- Documentation: https://docs.unykorn.com
- Status Page: https://status.unykorn.com

---

**Built with ❤️ by the Unykorn Team**