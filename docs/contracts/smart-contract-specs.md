# Smart Contract Technical Specifications

## Overview

The Unykorn ESG Platform consists of a comprehensive suite of smart contracts designed for tokenizing and managing Environmental, Social, and Governance (ESG) assets. This document provides detailed technical specifications for all core contracts.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ESGStablecoin │◄───┤   CarbonVault   │    │   WaterVault    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│   CBDCBridge    │◄─────────────┘
                        │                 │
                        └─────────────────┘
                                │
         ┌─────────────────────────────────────────┐
         │           Core Platform                 │
         │  ┌─────────────────┐ ┌─────────────────┐│
         │  │ NFTMarketplace  │ │   NFTStaking    ││
         │  └─────────────────┘ └─────────────────┘│
         │  ┌─────────────────┐ ┌─────────────────┐│
         │  │      VCHAN      │ │     VPOINT      ││
         │  └─────────────────┘ └─────────────────┘│
         └─────────────────────────────────────────┘
```

## Contract Specifications

### 1. ESGStablecoin Contract

**File:** `contracts/ESGStablecoin.sol`  
**Purpose:** Multi-collateral ESG-backed stablecoin with dynamic pricing and ESG scoring

#### Key Features
- Multi-collateral backing with ESG assets
- Dynamic ESG scoring based on collateral types
- Liquidation protection with variable thresholds
- Stability fee mechanism
- Emergency pause functionality

#### Contract Interface

```solidity
interface IESGStablecoin {
    // Core Functions
    function addCollateral(address asset, CollateralType collateralType, uint256 collateralRatio, uint256 liquidationThreshold, address priceOracle) external;
    function depositCollateral(address collateralAsset, uint256 amount) external;
    function mintStablecoin(address collateralAsset, uint256 amount) external;
    function repayStablecoin(address collateralAsset, uint256 amount) external;
    function withdrawCollateral(address collateralAsset, uint256 amount) external;
    function liquidate(address user, address collateralAsset, uint256 debtAmount) external;
    
    // ESG Functions
    function updateESGScore(address user, uint256 newScore) external;
    function getUserESGScore(address user) external view returns (uint256);
    
    // View Functions
    function getCollateralInfo(address asset) external view returns (CollateralAsset memory);
    function getUserPosition(address user, address collateralAsset) external view returns (Position memory);
    function getMaxMintable(address user, address collateralAsset) external view returns (uint256);
    function isLiquidatable(address user, address collateralAsset) external view returns (bool);
}
```

#### Data Structures

```solidity
enum CollateralType {
    CarbonCredits,    // 30% ESG weight
    WaterCredits,     // 25% ESG weight
    RenewableEnergy,  // 20% ESG weight
    GreenBonds,       // 15% ESG weight
    ESGTokens         // 10% ESG weight
}

struct CollateralAsset {
    address tokenAddress;
    CollateralType collateralType;
    uint256 collateralRatio;      // Basis points (15000 = 150%)
    uint256 liquidationThreshold; // Basis points (12000 = 120%)
    uint256 totalDeposited;
    uint256 totalBorrowed;
    bool isActive;
    address priceOracle;
    uint256 lastPriceUpdate;
}

struct Position {
    uint256 collateralAmount;
    uint256 borrowedAmount;
    uint256 lastUpdate;
    bool isActive;
}
```

#### Key Parameters
- **Target Price:** $1.00 (1e18 wei)
- **Stability Fee Rate:** 3% annually (300 basis points)
- **Liquidation Penalty:** 13% (1300 basis points)
- **Minimum Collateral Ratio:** 110% (11000 basis points)
- **ESG Score Range:** 0-10000

#### Security Features
- ReentrancyGuard protection on all state-changing functions
- Pausable functionality for emergency situations
- Owner-only administrative functions
- Collateral ratio validation before withdrawals
- Oracle price validation with timestamp checks

---

### 2. CBDCBridge Contract

**File:** `contracts/CBDCBridge.sol`  
**Purpose:** Cross-chain bridge for Central Bank Digital Currencies (CBDCs)

#### Key Features
- Cross-chain CBDC transfers
- Multi-signature validation
- Daily volume limits
- Validator authorization system
- Emergency cancellation

#### Contract Interface

```solidity
interface ICBDCBridge {
    function initiateBridge(address sourceToken, address targetToken, address recipient, uint256 amount, uint256 targetChain) external payable;
    function completeBridge(bytes32 txId, bytes memory validatorSignature) external;
    function cancelBridge(bytes32 txId, string memory reason) external;
    function addValidator(address validator) external;
    function removeValidator(address validator) external;
    function setTokenLimit(address token, uint256 limit) external;
}
```

#### Data Structures

```solidity
struct BridgeTransaction {
    bytes32 txId;
    address sourceToken;
    address targetToken;
    address sender;
    address recipient;
    uint256 amount;
    uint256 sourceChain;
    uint256 targetChain;
    uint256 timestamp;
    bool completed;
    bool cancelled;
}
```

#### Security Parameters
- **Minimum Confirmation Time:** 5 minutes (300 seconds)
- **Maximum Transaction Amount:** 1,000,000 tokens
- **Bridge Fee:** 0.1% (10 basis points)
- **Daily Volume Limits:** Configurable per token

---

### 3. CarbonVault Contract

**File:** `contracts/CarbonVault.sol`  
**Purpose:** Tokenization and management of carbon credits

#### Key Features
- Carbon credit issuance and verification
- Oracle-based verification system
- Credit retirement functionality
- Authorized issuer management
- Vintage year validation

#### Contract Interface

```solidity
interface ICarbonVault {
    function issueCarbonCredit(bytes32 creditId, address to, uint256 amount, uint256 vintage, string memory projectType) external;
    function retireCarbonCredit(bytes32 creditId) external;
    function tradeCarbonCredit(bytes32 creditId, address to, uint256 amount) external;
    function authorizeIssuer(address issuer) external;
    function revokeIssuer(address issuer) external;
}
```

#### Data Structures

```solidity
struct CarbonCredit {
    bytes32 creditId;
    address issuer;
    uint256 amount;      // tonnes of CO2
    uint256 vintage;     // year of credit generation
    string projectType;
    bool verified;
    bool retired;
}
```

#### Validation Rules
- **Minimum Vintage:** 2020
- **Maximum Supply:** 10,000,000 tonnes
- **Oracle Verification:** Required for all new credits
- **Project Types:** Reforestation, Renewable Energy, Carbon Capture, etc.

---

### 4. WaterVault Contract

**File:** `contracts/WaterVault.sol`  
**Purpose:** Water conservation project management and credit issuance

#### Key Features
- Water project registration
- Oracle-based project verification
- Water credit issuance and trading
- Credit retirement system
- Geographic location tracking

#### Contract Interface

```solidity
interface IWaterVault {
    function registerProject(string calldata projectName, string calldata location, uint256 waterSaved, uint256 creditRate) external returns (uint256);
    function verifyProject(uint256 projectId, bytes32 certificationHash) external;
    function issueCredits(uint256 projectId, uint256 amount, address recipient) external returns (uint256);
    function transferCredits(uint256 creditId, address to) external;
    function retireCredits(uint256 creditId) external;
}
```

#### Data Structures

```solidity
struct WaterProject {
    uint256 id;
    address projectOwner;
    string projectName;
    string location;
    uint256 waterSaved;        // Liters saved annually
    uint256 creditRate;        // Credits per liter saved
    uint256 totalCredits;
    uint256 availableCredits;
    bool isActive;
    uint256 verificationDate;
    bytes32 certificationHash;
}

struct WaterCredit {
    uint256 projectId;
    uint256 amount;
    uint256 mintDate;
    address owner;
    bool isRetired;
}
```

---

### 5. NFTMarketplace Contract

**File:** `contracts/NFTMarketplace.sol`  
**Purpose:** ESG-focused NFT marketplace with sustainability metrics

#### Key Features
- ESG-weighted NFT listings
- Royalty management
- Auction functionality
- Carbon offset integration
- Sustainability scoring

---

### 6. Token Contracts

#### VCHAN Token
**Purpose:** Governance and utility token for the platform

#### VPOINT Token  
**Purpose:** Reward token for ESG activities

#### VTV Token
**Purpose:** Value transfer token for cross-platform operations

---

## Integration Patterns

### Oracle Integration
```solidity
interface IESGOracle {
    function getCarbonPrice() external view returns (uint256);
    function getWaterCreditPrice() external view returns (uint256);
    function verifyESGCertification(bytes32 certHash) external view returns (bool);
    function getESGScore(address asset) external view returns (uint256);
}
```

### Price Feed Integration
```solidity
interface IPriceFeed {
    function getLatestPrice(address asset) external view returns (uint256 price, uint256 timestamp);
    function getPriceWithDecimals(address asset) external view returns (uint256 price, uint8 decimals);
}
```

### CBDC Validator Integration
```solidity
interface ICBDCValidator {
    function validateTransaction(bytes32 txHash, bytes memory signature) external view returns (bool);
    function isAuthorizedCBDC(address cbdcToken) external view returns (bool);
    function getValidatorSet() external view returns (address[] memory);
}
```

## Gas Optimization Features

1. **Batch Operations:** Multiple actions in single transaction
2. **Storage Packing:** Efficient struct packing to minimize storage slots
3. **Event Indexing:** Optimized event emission for off-chain indexing
4. **View Functions:** Gas-free data retrieval
5. **Proxy Upgrades:** Minimal proxy pattern for future updates

## Security Considerations

### Access Control
- **Owner:** Platform administrator with upgrade rights
- **Oracle:** Authorized price and verification provider  
- **Validators:** CBDC bridge transaction validators
- **Issuers:** Authorized carbon/water credit issuers

### Emergency Procedures
1. **Pause Functionality:** Immediate halt of critical operations
2. **Emergency Withdrawal:** Owner can recover stuck funds
3. **Oracle Fallback:** Backup price feed mechanisms
4. **Validator Rotation:** Quick validator replacement

### Audit Recommendations
- [ ] Formal verification of mathematical models
- [ ] Penetration testing of bridge mechanisms
- [ ] Oracle manipulation resistance testing
- [ ] Gas limit analysis for complex operations
- [ ] Upgrade mechanism security review

## Deployment Configuration

### Network Parameters
```javascript
const deploymentConfig = {
  mainnet: {
    stabilityFeeRate: 300,     // 3% annually
    liquidationPenalty: 1300,  // 13%
    minimumCollateralRatio: 11000, // 110%
    bridgeFee: 10,            // 0.1%
    oracleUpdateFrequency: 3600 // 1 hour
  },
  testnet: {
    stabilityFeeRate: 500,     // 5% annually
    liquidationPenalty: 1000,  // 10%
    minimumCollateralRatio: 12000, // 120%
    bridgeFee: 50,            // 0.5%
    oracleUpdateFrequency: 300 // 5 minutes
  }
};
```

### Initial Collateral Assets
1. **Carbon Credits** (CARBON) - 150% collateral ratio
2. **Water Credits** (WATER) - 140% collateral ratio  
3. **Green Bonds** (GBOND) - 130% collateral ratio
4. **Renewable Energy Tokens** (RENEW) - 160% collateral ratio

## Testing Framework

### Unit Tests
- Individual function testing
- Edge case validation
- Access control verification
- Gas usage optimization

### Integration Tests  
- Cross-contract interactions
- Oracle integration testing
- Bridge transaction flows
- Liquidation scenarios

### Security Tests
- Reentrancy attack prevention
- Integer overflow protection
- Access control bypass attempts
- Oracle manipulation resistance

## Upgrade Strategy

The platform uses OpenZeppelin's upgrade patterns with the following considerations:

1. **Storage Slots:** Maintain compatibility across upgrades
2. **Interface Stability:** Preserve public function signatures
3. **Migration Scripts:** Automated data migration procedures
4. **Rollback Plan:** Emergency downgrade capabilities

---

*This document is subject to updates as the platform evolves. Last updated: December 2024*