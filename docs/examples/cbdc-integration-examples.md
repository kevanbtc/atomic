# CBDC Integration Examples

## Overview

This document provides comprehensive examples for integrating Central Bank Digital Currencies (CBDCs) with the Unykorn ESG Platform. These examples cover various CBDC implementations, cross-border scenarios, and compliance requirements.

## Table of Contents

1. [Basic CBDC Integration](#basic-cbdc-integration)
2. [Cross-Border Bridge Examples](#cross-border-bridge-examples)
3. [Multi-CBDC Support](#multi-cbdc-support)
4. [Compliance Implementation](#compliance-implementation)
5. [Testing Scenarios](#testing-scenarios)
6. [Production Integration](#production-integration)
7. [Monitoring & Analytics](#monitoring--analytics)

## Basic CBDC Integration

### 1. CBDC Token Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICBDCToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function freeze(address account) external;
    function unfreeze(address account) external;
    function isFrozen(address account) external view returns (bool);
    
    // CBDC specific functions
    function getCentralBank() external view returns (address);
    function getJurisdiction() external view returns (bytes2);
    function isAuthorized(address spender) external view returns (bool);
    
    // Compliance functions
    function reportTransaction(address from, address to, uint256 amount) external;
    function checkCompliance(address user) external view returns (bool);
}
```

### 2. Digital Dollar (USDC-CBDC) Integration

```javascript
const { ethers } = require('ethers');

class DigitalDollarIntegration {
  constructor(provider, contractAddress, privateKey) {
    this.provider = provider;
    this.signer = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(contractAddress, DIGITAL_DOLLAR_ABI, this.signer);
  }

  async initializeWallet(userAddress) {
    try {
      // Register user with Federal Reserve
      const registrationTx = await this.contract.registerUser(userAddress, {
        gasLimit: 100000
      });
      
      console.log('User registration transaction:', registrationTx.hash);
      await registrationTx.wait();
      
      // Verify registration
      const isRegistered = await this.contract.isRegisteredUser(userAddress);
      console.log('User registered:', isRegistered);
      
      return { success: true, txHash: registrationTx.hash };
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  async transferCBDC(from, to, amount, purpose) {
    try {
      // Pre-transfer compliance check
      const complianceCheck = await this.performComplianceCheck(from, to, amount);
      if (!complianceCheck.passed) {
        throw new Error(`Compliance check failed: ${complianceCheck.reason}`);
      }

      // Execute transfer with reporting
      const tx = await this.contract.transferWithReporting(to, amount, purpose, {
        gasLimit: 150000
      });

      console.log('CBDC transfer initiated:', tx.hash);
      const receipt = await tx.wait();

      // Log transaction for audit trail
      await this.logTransaction({
        txHash: tx.hash,
        from,
        to,
        amount: ethers.formatUnits(amount, 18),
        purpose,
        timestamp: new Date().toISOString()
      });

      return { success: true, txHash: tx.hash, receipt };
    } catch (error) {
      console.error('Transfer failed:', error);
      throw error;
    }
  }

  async performComplianceCheck(from, to, amount) {
    // Check sanctions lists
    const sanctionsCheck = await this.checkSanctions([from, to]);
    if (!sanctionsCheck.passed) {
      return { passed: false, reason: 'Sanctions list hit' };
    }

    // Check transaction limits
    const limitsCheck = await this.checkTransactionLimits(from, amount);
    if (!limitsCheck.passed) {
      return { passed: false, reason: 'Transaction limits exceeded' };
    }

    // Check KYC status
    const kycCheck = await this.checkKYCStatus([from, to]);
    if (!kycCheck.passed) {
      return { passed: false, reason: 'KYC verification required' };
    }

    return { passed: true };
  }

  async logTransaction(transactionData) {
    // Log to internal audit system
    await fetch('https://audit.unykorn.io/cbdc-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactionData)
    });
  }
}

// Usage example
const digitalDollar = new DigitalDollarIntegration(
  provider,
  '0x...digital_dollar_contract_address',
  process.env.PRIVATE_KEY
);

// Initialize user
await digitalDollar.initializeWallet('0x...user_address');

// Transfer CBDC
await digitalDollar.transferCBDC(
  '0x...sender_address',
  '0x...recipient_address',
  ethers.parseUnits('1000', 18), // $1,000
  'ESG_INVESTMENT'
);
```

### 3. Digital Euro Integration

```javascript
class DigitalEuroIntegration {
  constructor(provider, contractAddress, privateKey) {
    this.provider = provider;
    this.signer = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(contractAddress, DIGITAL_EURO_ABI, this.signer);
    this.ecbEndpoint = 'https://api.ecb.europa.eu/cbdc';
  }

  async createAccount(userDetails) {
    try {
      // ECB account creation process
      const ecbRegistration = await fetch(`${this.ecbEndpoint}/accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ECB_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userDetails.id,
          countryCode: userDetails.countryCode,
          bankCode: userDetails.bankCode,
          kycLevel: userDetails.kycLevel
        })
      });

      const ecbAccount = await ecbRegistration.json();

      // Create on-chain account
      const tx = await this.contract.createAccount(
        userDetails.address,
        ecbAccount.accountId,
        userDetails.countryCode
      );

      console.log('Digital Euro account created:', tx.hash);
      return { success: true, accountId: ecbAccount.accountId, txHash: tx.hash };
    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    }
  }

  async processPayment(paymentDetails) {
    try {
      // Validate SEPA compliance
      const sepaValidation = await this.validateSEPA(paymentDetails);
      if (!sepaValidation.valid) {
        throw new Error(`SEPA validation failed: ${sepaValidation.errors.join(', ')}`);
      }

      // Process through ECB system
      const ecbPayment = await this.processECBPayment(paymentDetails);

      // Execute on-chain transaction
      const tx = await this.contract.processPayment(
        paymentDetails.from,
        paymentDetails.to,
        paymentDetails.amount,
        ecbPayment.referenceId
      );

      return { success: true, txHash: tx.hash, ecbReference: ecbPayment.referenceId };
    } catch (error) {
      console.error('Payment processing failed:', error);
      throw error;
    }
  }

  async validateSEPA(paymentDetails) {
    // SEPA validation logic
    const errors = [];

    // Check IBAN format
    if (!this.isValidIBAN(paymentDetails.toIBAN)) {
      errors.push('Invalid recipient IBAN');
    }

    // Check amount limits
    if (paymentDetails.amount > 999999.99) {
      errors.push('Amount exceeds SEPA instant limit');
    }

    // Check business hours for instant payments
    if (paymentDetails.instant && !this.isBusinessHours()) {
      errors.push('Instant payments only during business hours');
    }

    return { valid: errors.length === 0, errors };
  }

  isValidIBAN(iban) {
    // IBAN validation algorithm
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
    return ibanRegex.test(iban);
  }
}
```

## Cross-Border Bridge Examples

### 1. USD-EUR CBDC Bridge

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CBDCBridge.sol";

contract USDEURCBDCBridge is CBDCBridge {
    address public constant USD_CBDC = 0x...; // Digital Dollar address
    address public constant EUR_CBDC = 0x...; // Digital Euro address
    
    // Exchange rates (updates from oracles)
    uint256 public usdToEurRate = 920000000000000000; // 0.92 EUR per USD
    uint256 public eurToUsdRate = 1087000000000000000; // 1.087 USD per EUR
    
    struct CrossBorderTransaction {
        bytes32 txId;
        address sender;
        address recipient;
        uint256 sourceAmount;
        uint256 targetAmount;
        address sourceCBDC;
        address targetCBDC;
        uint256 exchangeRate;
        uint256 fees;
        BridgeStatus status;
        uint256 timestamp;
    }
    
    enum BridgeStatus { INITIATED, FED_APPROVED, ECB_APPROVED, COMPLETED, FAILED }
    
    mapping(bytes32 => CrossBorderTransaction) public crossBorderTxs;
    
    event CrossBorderInitiated(bytes32 indexed txId, address indexed sender, uint256 sourceAmount, address sourceCBDC);
    event ExchangeRateUpdated(address indexed sourceCBDC, address indexed targetCBDC, uint256 newRate);
    
    function initiateCrossBorderTransfer(
        address recipient,
        uint256 amount,
        address sourceCBDC,
        address targetCBDC,
        string memory purpose
    ) external payable {
        require(sourceCBDC == USD_CBDC || sourceCBDC == EUR_CBDC, "Unsupported source CBDC");
        require(targetCBDC == USD_CBDC || targetCBDC == EUR_CBDC, "Unsupported target CBDC");
        require(sourceCBDC != targetCBDC, "Same currency transfer");
        
        // Calculate target amount with current exchange rate
        uint256 exchangeRate = sourceCBDC == USD_CBDC ? usdToEurRate : eurToUsdRate;
        uint256 targetAmount = (amount * exchangeRate) / 1e18;
        
        // Calculate bridge fees (0.25%)
        uint256 fees = (amount * 25) / 10000;
        require(msg.value >= fees, "Insufficient bridge fee");
        
        bytes32 txId = keccak256(abi.encodePacked(
            msg.sender,
            recipient,
            amount,
            sourceCBDC,
            targetCBDC,
            block.timestamp
        ));
        
        // Lock source CBDC
        IERC20(sourceCBDC).transferFrom(msg.sender, address(this), amount);
        
        // Create cross-border transaction
        crossBorderTxs[txId] = CrossBorderTransaction({
            txId: txId,
            sender: msg.sender,
            recipient: recipient,
            sourceAmount: amount,
            targetAmount: targetAmount,
            sourceCBDC: sourceCBDC,
            targetCBDC: targetCBDC,
            exchangeRate: exchangeRate,
            fees: fees,
            status: BridgeStatus.INITIATED,
            timestamp: block.timestamp
        });
        
        emit CrossBorderInitiated(txId, msg.sender, amount, sourceCBDC);
        
        // Notify central banks for approval
        _notifyCentralBanks(txId, sourceCBDC, targetCBDC);
    }
    
    function approveFedReserve(bytes32 txId, bytes memory signature) external {
        require(hasRole(FED_APPROVER_ROLE, msg.sender), "Not authorized Fed approver");
        
        CrossBorderTransaction storage tx = crossBorderTxs[txId];
        require(tx.status == BridgeStatus.INITIATED, "Invalid status for Fed approval");
        
        // Verify Fed signature
        require(_verifyFedSignature(txId, signature), "Invalid Fed signature");
        
        tx.status = BridgeStatus.FED_APPROVED;
        
        // If both central banks approved, complete transfer
        if (tx.targetCBDC == EUR_CBDC) {
            _requestECBApproval(txId);
        } else {
            _completeTransfer(txId);
        }
    }
    
    function approveECB(bytes32 txId, bytes memory signature) external {
        require(hasRole(ECB_APPROVER_ROLE, msg.sender), "Not authorized ECB approver");
        
        CrossBorderTransaction storage tx = crossBorderTxs[txId];
        require(tx.status == BridgeStatus.FED_APPROVED, "Invalid status for ECB approval");
        
        // Verify ECB signature
        require(_verifyECBSignature(txId, signature), "Invalid ECB signature");
        
        tx.status = BridgeStatus.ECB_APPROVED;
        _completeTransfer(txId);
    }
    
    function _completeTransfer(bytes32 txId) internal {
        CrossBorderTransaction storage tx = crossBorderTxs[txId];
        
        // Mint target CBDC to recipient
        ICBDCToken(tx.targetCBDC).mint(tx.recipient, tx.targetAmount);
        
        // Burn source CBDC
        ICBDCToken(tx.sourceCBDC).burn(tx.sourceAmount);
        
        tx.status = BridgeStatus.COMPLETED;
        
        emit BridgeCompleted(txId, tx.recipient);
    }
    
    function updateExchangeRate(
        address sourceCBDC,
        address targetCBDC,
        uint256 newRate,
        bytes memory oracleSignature
    ) external {
        require(hasRole(ORACLE_ROLE, msg.sender), "Not authorized oracle");
        require(_verifyOracleSignature(sourceCBDC, targetCBDC, newRate, oracleSignature), "Invalid oracle signature");
        
        if (sourceCBDC == USD_CBDC && targetCBDC == EUR_CBDC) {
            usdToEurRate = newRate;
        } else if (sourceCBDC == EUR_CBDC && targetCBDC == USD_CBDC) {
            eurToUsdRate = newRate;
        }
        
        emit ExchangeRateUpdated(sourceCBDC, targetCBDC, newRate);
    }
}
```

### 2. JavaScript Integration for Cross-Border Transfers

```javascript
class CrossBorderCBDCService {
  constructor(bridgeContract, fedValidator, ecbValidator) {
    this.bridge = bridgeContract;
    this.fedValidator = fedValidator;
    this.ecbValidator = ecbValidator;
  }

  async initiateCrossBorderTransfer(transferData) {
    try {
      // Validate transfer data
      await this.validateTransferData(transferData);

      // Check regulatory compliance
      await this.checkCrossBorderCompliance(transferData);

      // Initiate bridge transaction
      const tx = await this.bridge.initiateCrossBorderTransfer(
        transferData.recipient,
        transferData.amount,
        transferData.sourceCBDC,
        transferData.targetCBDC,
        transferData.purpose,
        { value: transferData.bridgeFee }
      );

      console.log('Cross-border transfer initiated:', tx.hash);

      // Monitor approval process
      const result = await this.monitorApprovalProcess(tx.hash);
      return result;
    } catch (error) {
      console.error('Cross-border transfer failed:', error);
      throw error;
    }
  }

  async validateTransferData(data) {
    // Validate amount limits
    if (data.amount > ethers.parseUnits('50000', 18)) {
      throw new Error('Amount exceeds daily limit for cross-border transfers');
    }

    // Validate CBDCs
    const supportedCBDCs = [USD_CBDC_ADDRESS, EUR_CBDC_ADDRESS];
    if (!supportedCBDCs.includes(data.sourceCBDC) || !supportedCBDCs.includes(data.targetCBDC)) {
      throw new Error('Unsupported CBDC');
    }

    // Validate purpose codes
    const validPurposes = ['TRADE', 'INVESTMENT', 'REMITTANCE', 'ESG_INVESTMENT'];
    if (!validPurposes.includes(data.purpose)) {
      throw new Error('Invalid transfer purpose');
    }
  }

  async checkCrossBorderCompliance(data) {
    // FATF Travel Rule compliance
    if (data.amount >= ethers.parseUnits('1000', 18)) {
      await this.submitTravelRuleData(data);
    }

    // Sanctions screening
    const screeningResult = await this.screenAddresses([data.sender, data.recipient]);
    if (!screeningResult.passed) {
      throw new Error('Sanctions screening failed');
    }

    // Regulatory reporting
    await this.reportCrossBorderTransaction(data);
  }

  async monitorApprovalProcess(txHash) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Approval process timeout'));
      }, 30 * 60 * 1000); // 30 minutes

      // Listen for approval events
      this.bridge.on('FedApproved', (txId) => {
        if (txId === txHash) {
          console.log('Fed approval received');
        }
      });

      this.bridge.on('ECBApproved', (txId) => {
        if (txId === txHash) {
          console.log('ECB approval received');
        }
      });

      this.bridge.on('BridgeCompleted', (txId, recipient) => {
        if (txId === txHash) {
          clearTimeout(timeout);
          resolve({ success: true, txId, recipient });
        }
      });

      this.bridge.on('BridgeFailed', (txId, reason) => {
        if (txId === txHash) {
          clearTimeout(timeout);
          reject(new Error(`Bridge failed: ${reason}`));
        }
      });
    });
  }

  async submitTravelRuleData(transferData) {
    const travelRuleData = {
      originatorName: transferData.senderName,
      originatorAddress: transferData.senderAddress,
      originatorAccount: transferData.sender,
      beneficiaryName: transferData.recipientName,
      beneficiaryAddress: transferData.recipientAddress,
      beneficiaryAccount: transferData.recipient,
      amount: ethers.formatUnits(transferData.amount, 18),
      currency: transferData.sourceCBDC === USD_CBDC_ADDRESS ? 'USD' : 'EUR',
      purpose: transferData.purpose
    };

    // Submit to VASP (Virtual Asset Service Provider) network
    await fetch('https://travelrule.unykorn.io/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(travelRuleData)
    });
  }
}
```

## Multi-CBDC Support

### 1. CBDC Registry Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CBDCRegistry {
    struct CBDCInfo {
        address tokenAddress;
        bytes2 countryCode;
        address centralBank;
        string name;
        string symbol;
        uint8 decimals;
        bool isActive;
        bool crossBorderEnabled;
        uint256 dailyLimit;
        uint256 transactionLimit;
    }
    
    mapping(bytes2 => CBDCInfo) public cbdcsByCountry;
    mapping(address => CBDCInfo) public cbdcsByAddress;
    bytes2[] public supportedCountries;
    
    event CBDCRegistered(bytes2 indexed countryCode, address indexed tokenAddress, address centralBank);
    event CBDCStatusUpdated(bytes2 indexed countryCode, bool isActive);
    
    function registerCBDC(
        bytes2 countryCode,
        address tokenAddress,
        address centralBank,
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 dailyLimit,
        uint256 transactionLimit
    ) external onlyOwner {
        require(cbdcsByCountry[countryCode].tokenAddress == address(0), "CBDC already registered");
        
        CBDCInfo memory newCBDC = CBDCInfo({
            tokenAddress: tokenAddress,
            countryCode: countryCode,
            centralBank: centralBank,
            name: name,
            symbol: symbol,
            decimals: decimals,
            isActive: true,
            crossBorderEnabled: false,
            dailyLimit: dailyLimit,
            transactionLimit: transactionLimit
        });
        
        cbdcsByCountry[countryCode] = newCBDC;
        cbdcsByAddress[tokenAddress] = newCBDC;
        supportedCountries.push(countryCode);
        
        emit CBDCRegistered(countryCode, tokenAddress, centralBank);
    }
    
    function enableCrossBorder(bytes2 countryCode) external {
        require(msg.sender == cbdcsByCountry[countryCode].centralBank, "Only central bank can enable");
        cbdcsByCountry[countryCode].crossBorderEnabled = true;
        cbdcsByAddress[cbdcsByCountry[countryCode].tokenAddress].crossBorderEnabled = true;
    }
    
    function getSupportedCBDCs() external view returns (CBDCInfo[] memory) {
        CBDCInfo[] memory cbdcs = new CBDCInfo[](supportedCountries.length);
        for (uint i = 0; i < supportedCountries.length; i++) {
            cbdcs[i] = cbdcsByCountry[supportedCountries[i]];
        }
        return cbdcs;
    }
    
    function isCBDCSupported(address tokenAddress) external view returns (bool) {
        return cbdcsByAddress[tokenAddress].tokenAddress != address(0) && 
               cbdcsByAddress[tokenAddress].isActive;
    }
}
```

### 2. Multi-CBDC Wallet Implementation

```javascript
class MultiCBDCWallet {
  constructor(provider, registryAddress, privateKey) {
    this.provider = provider;
    this.signer = new ethers.Wallet(privateKey, provider);
    this.registry = new ethers.Contract(registryAddress, REGISTRY_ABI, this.signer);
    this.cbdcContracts = new Map();
  }

  async initialize() {
    // Load all supported CBDCs
    const supportedCBDCs = await this.registry.getSupportedCBDCs();
    
    for (const cbdc of supportedCBDCs) {
      const contract = new ethers.Contract(cbdc.tokenAddress, CBDC_ABI, this.signer);
      this.cbdcContracts.set(cbdc.countryCode, {
        contract,
        info: cbdc
      });
    }
    
    console.log(`Initialized wallet with ${supportedCBDCs.length} CBDCs`);
  }

  async getBalances(userAddress) {
    const balances = {};
    
    for (const [countryCode, cbdcData] of this.cbdcContracts) {
      try {
        const balance = await cbdcData.contract.balanceOf(userAddress);
        balances[countryCode] = {
          balance: ethers.formatUnits(balance, cbdcData.info.decimals),
          symbol: cbdcData.info.symbol,
          name: cbdcData.info.name
        };
      } catch (error) {
        console.error(`Error getting balance for ${countryCode}:`, error);
        balances[countryCode] = { balance: '0', error: error.message };
      }
    }
    
    return balances;
  }

  async transferCBDC(countryCode, to, amount, memo) {
    const cbdcData = this.cbdcContracts.get(countryCode);
    if (!cbdcData) {
      throw new Error(`CBDC not supported: ${countryCode}`);
    }

    try {
      // Check transaction limits
      const amountWei = ethers.parseUnits(amount.toString(), cbdcData.info.decimals);
      if (amountWei > cbdcData.info.transactionLimit) {
        throw new Error('Amount exceeds transaction limit');
      }

      // Perform compliance checks
      await this.performComplianceChecks(countryCode, to, amountWei);

      // Execute transfer
      const tx = await cbdcData.contract.transfer(to, amountWei);
      console.log(`${countryCode} CBDC transfer initiated:`, tx.hash);

      const receipt = await tx.wait();
      
      // Log transaction
      await this.logTransaction({
        countryCode,
        txHash: tx.hash,
        to,
        amount,
        memo,
        timestamp: new Date().toISOString()
      });

      return { success: true, txHash: tx.hash, receipt };
    } catch (error) {
      console.error(`${countryCode} transfer failed:`, error);
      throw error;
    }
  }

  async performComplianceChecks(countryCode, recipient, amount) {
    // Check recipient address compliance
    const complianceResult = await fetch('https://compliance.unykorn.io/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: recipient,
        amount: ethers.formatEther(amount),
        currency: countryCode
      })
    });

    const compliance = await complianceResult.json();
    if (!compliance.approved) {
      throw new Error(`Compliance check failed: ${compliance.reason}`);
    }
  }

  async swapCBDC(fromCountry, toCountry, amount) {
    // Use atomic swap for CBDC exchange
    const fromCBDC = this.cbdcContracts.get(fromCountry);
    const toCBDC = this.cbdcContracts.get(toCountry);

    if (!fromCBDC || !toCBDC) {
      throw new Error('Unsupported CBDC pair');
    }

    // Get exchange rate
    const rate = await this.getExchangeRate(fromCountry, toCountry);
    const fromAmount = ethers.parseUnits(amount.toString(), fromCBDC.info.decimals);
    const toAmount = fromAmount.mul(rate).div(ethers.parseUnits('1', 18));

    try {
      // Create atomic swap
      const swapContract = await this.getSwapContract(fromCountry, toCountry);
      const tx = await swapContract.createSwap(
        fromCBDC.info.tokenAddress,
        toCBDC.info.tokenAddress,
        fromAmount,
        toAmount,
        this.signer.address
      );

      console.log('CBDC swap initiated:', tx.hash);
      return { success: true, txHash: tx.hash };
    } catch (error) {
      console.error('CBDC swap failed:', error);
      throw error;
    }
  }

  async getExchangeRate(fromCountry, toCountry) {
    // Get exchange rate from oracle
    const response = await fetch(`https://oracle.unykorn.io/rates/${fromCountry}/${toCountry}`);
    const data = await response.json();
    return ethers.parseUnits(data.rate.toString(), 18);
  }
}

// Usage example
const wallet = new MultiCBDCWallet(
  provider,
  REGISTRY_CONTRACT_ADDRESS,
  process.env.PRIVATE_KEY
);

await wallet.initialize();

// Check balances
const balances = await wallet.getBalances('0x...user_address');
console.log('CBDC Balances:', balances);

// Transfer Digital Euros
await wallet.transferCBDC('EU', '0x...recipient', 100, 'ESG Investment');

// Swap USD to EUR CBDCs
await wallet.swapCBDC('US', 'EU', 1000);
```

## Testing Scenarios

### 1. Unit Tests for CBDC Integration

```javascript
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CBDC Integration Tests', function () {
  let cbdcBridge, usdCBDC, eurCBDC, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock CBDCs
    const CBDC = await ethers.getContractFactory('MockCBDC');
    usdCBDC = await CBDC.deploy('Digital Dollar', 'USDC', 18);
    eurCBDC = await CBDC.deploy('Digital Euro', 'EURDC', 18);

    // Deploy CBDC Bridge
    const CBDCBridge = await ethers.getContractFactory('CBDCBridge');
    cbdcBridge = await CBDCBridge.deploy();

    // Setup initial balances
    await usdCBDC.mint(user1.address, ethers.parseEther('10000'));
    await eurCBDC.mint(user2.address, ethers.parseEther('10000'));
  });

  describe('Cross-Border Transfers', function () {
    it('should initiate USD to EUR transfer', async function () {
      const amount = ethers.parseEther('1000');
      const bridgeFee = ethers.parseEther('0.1');

      // Approve bridge to spend CBDC
      await usdCBDC.connect(user1).approve(cbdcBridge.address, amount);

      // Initiate cross-border transfer
      const tx = await cbdcBridge.connect(user1).initiateCrossBorderTransfer(
        user2.address,
        amount,
        usdCBDC.address,
        eurCBDC.address,
        'TRADE',
        { value: bridgeFee }
      );

      // Verify transaction initiated
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'CrossBorderInitiated');
      expect(event).to.not.be.undefined;
      expect(event.args.sender).to.equal(user1.address);
      expect(event.args.sourceAmount).to.equal(amount);
    });

    it('should complete cross-border transfer with approvals', async function () {
      // ... test implementation for complete flow
    });

    it('should reject transfers exceeding limits', async function () {
      const excessiveAmount = ethers.parseEther('100000'); // Above limit

      await usdCBDC.connect(user1).approve(cbdcBridge.address, excessiveAmount);

      await expect(
        cbdcBridge.connect(user1).initiateCrossBorderTransfer(
          user2.address,
          excessiveAmount,
          usdCBDC.address,
          eurCBDC.address,
          'TRADE',
          { value: ethers.parseEther('0.1') }
        )
      ).to.be.revertedWith('Amount exceeds daily limit');
    });
  });

  describe('Compliance Checks', function () {
    it('should reject sanctioned addresses', async function () {
      // Add address to sanctions list
      await cbdcBridge.addSanctionedAddress(user2.address);

      const amount = ethers.parseEther('1000');
      await usdCBDC.connect(user1).approve(cbdcBridge.address, amount);

      await expect(
        cbdcBridge.connect(user1).initiateCrossBorderTransfer(
          user2.address,
          amount,
          usdCBDC.address,
          eurCBDC.address,
          'TRADE',
          { value: ethers.parseEther('0.1') }
        )
      ).to.be.revertedWith('Recipient is sanctioned');
    });
  });
});
```

### 2. Integration Tests

```javascript
describe('End-to-End CBDC Flow', function () {
  it('should complete full cross-border ESG investment', async function () {
    // 1. User deposits fiat and receives CBDC
    const depositAmount = ethers.parseEther('10000');
    await usdCBDC.mint(user1.address, depositAmount);

    // 2. User initiates cross-border transfer for ESG investment
    await usdCBDC.connect(user1).approve(cbdcBridge.address, depositAmount);
    const bridgeTx = await cbdcBridge.connect(user1).initiateCrossBorderTransfer(
      user2.address,
      depositAmount,
      usdCBDC.address,
      eurCBDC.address,
      'ESG_INVESTMENT',
      { value: ethers.parseEther('0.1') }
    );

    const bridgeReceipt = await bridgeTx.wait();
    const txId = bridgeReceipt.events[0].args.txId;

    // 3. Central bank approvals (mocked)
    await cbdcBridge.approveFedReserve(txId, '0x...signature');
    await cbdcBridge.approveECB(txId, '0x...signature');

    // 4. Verify EUR CBDC received
    const eurBalance = await eurCBDC.balanceOf(user2.address);
    expect(eurBalance).to.be.above(0);

    // 5. Use EUR CBDC for ESG investment
    await eurCBDC.connect(user2).approve(esgStablecoin.address, eurBalance);
    await esgStablecoin.connect(user2).depositCollateral(eurCBDC.address, eurBalance);

    // 6. Mint ESG stablecoin
    const maxMintable = await esgStablecoin.getMaxMintable(user2.address, eurCBDC.address);
    await esgStablecoin.connect(user2).mintStablecoin(eurCBDC.address, maxMintable);

    // Verify ESG stablecoin balance
    const stablecoinBalance = await esgStablecoin.balanceOf(user2.address);
    expect(stablecoinBalance).to.equal(maxMintable);
  });
});
```

## Production Integration

### 1. Production Configuration

```javascript
const productionConfig = {
  cbdcs: {
    USD: {
      contractAddress: '0x...production_usd_cbdc_address',
      centralBank: '0x...federal_reserve_address',
      dailyLimit: ethers.parseEther('50000'),
      transactionLimit: ethers.parseEther('10000'),
      complianceEndpoint: 'https://fedwire.gov/compliance',
      oracleEndpoint: 'https://oracle.federalreserve.gov'
    },
    EUR: {
      contractAddress: '0x...production_eur_cbdc_address',
      centralBank: '0x...ecb_address',
      dailyLimit: ethers.parseEther('45000'),
      transactionLimit: ethers.parseEther('9000'),
      complianceEndpoint: 'https://ecb.europa.eu/compliance',
      oracleEndpoint: 'https://oracle.ecb.europa.eu'
    },
    GBP: {
      contractAddress: '0x...production_gbp_cbdc_address',
      centralBank: '0x...boe_address',
      dailyLimit: ethers.parseEther('40000'),
      transactionLimit: ethers.parseEther('8000'),
      complianceEndpoint: 'https://bankofengland.co.uk/compliance',
      oracleEndpoint: 'https://oracle.bankofengland.co.uk'
    }
  },
  compliance: {
    kycRequired: true,
    amlScreening: true,
    sanctionsScreening: true,
    travelRuleThreshold: ethers.parseEther('1000'),
    reportingThreshold: ethers.parseEther('10000')
  },
  security: {
    multiSigRequired: true,
    timelock: 24 * 60 * 60, // 24 hours
    pauseAuthority: '0x...emergency_pause_address',
    upgradeAuthority: '0x...upgrade_governance_address'
  }
};
```

### 2. Production Deployment Script

```javascript
async function deployCBDCInfrastructure() {
  console.log('🚀 Deploying CBDC infrastructure to mainnet...');

  // Deploy CBDC Registry
  const Registry = await ethers.getContractFactory('CBDCRegistry');
  const registry = await Registry.deploy();
  await registry.deployed();
  console.log('✅ CBDC Registry deployed:', registry.address);

  // Deploy CBDC Bridge with timelock
  const Timelock = await ethers.getContractFactory('Timelock');
  const timelock = await Timelock.deploy(productionConfig.security.timelock);
  await timelock.deployed();

  const Bridge = await ethers.getContractFactory('CBDCBridge');
  const bridge = await Bridge.deploy(registry.address);
  await bridge.deployed();
  console.log('✅ CBDC Bridge deployed:', bridge.address);

  // Register production CBDCs
  for (const [currency, config] of Object.entries(productionConfig.cbdcs)) {
    await registry.registerCBDC(
      ethers.utils.formatBytes32String(currency),
      config.contractAddress,
      config.centralBank,
      `Digital ${currency}`,
      `${currency}DC`,
      18,
      config.dailyLimit,
      config.transactionLimit
    );
    console.log(`✅ ${currency} CBDC registered`);
  }

  // Setup access controls
  const adminRole = await bridge.DEFAULT_ADMIN_ROLE();
  const bridgeRole = await bridge.BRIDGE_ROLE();
  const pauseRole = await bridge.PAUSE_ROLE();

  await bridge.grantRole(bridgeRole, productionConfig.security.upgradeAuthority);
  await bridge.grantRole(pauseRole, productionConfig.security.pauseAuthority);
  
  // Transfer ownership to timelock
  await bridge.transferOwnership(timelock.address);
  
  console.log('🎉 CBDC infrastructure deployment completed!');
  
  return {
    registry: registry.address,
    bridge: bridge.address,
    timelock: timelock.address
  };
}
```

## Monitoring & Analytics

### 1. CBDC Transaction Monitoring

```javascript
class CBDCTransactionMonitor {
  constructor(bridgeContract, analyticsEndpoint) {
    this.bridge = bridgeContract;
    this.analyticsEndpoint = analyticsEndpoint;
    this.metrics = {
      totalTransactions: 0,
      totalVolume: '0',
      activeCurrencies: new Set(),
      failureRate: 0
    };
  }

  async startMonitoring() {
    console.log('📊 Starting CBDC transaction monitoring...');

    // Monitor bridge events
    this.bridge.on('CrossBorderInitiated', this.handleTransactionInitiated.bind(this));
    this.bridge.on('BridgeCompleted', this.handleTransactionCompleted.bind(this));
    this.bridge.on('BridgeFailed', this.handleTransactionFailed.bind(this));

    // Periodic metrics reporting
    setInterval(() => this.reportMetrics(), 60000); // Every minute
  }

  async handleTransactionInitiated(txId, sender, amount, sourceCBDC) {
    this.metrics.totalTransactions++;
    this.metrics.totalVolume = ethers.utils.formatEther(
      ethers.utils.parseEther(this.metrics.totalVolume).add(amount)
    );

    // Determine currency from CBDC address
    const currency = await this.getCurrencyFromAddress(sourceCBDC);
    this.metrics.activeCurrencies.add(currency);

    // Log for analytics
    await this.logTransactionEvent({
      type: 'INITIATED',
      txId,
      sender,
      amount: ethers.utils.formatEther(amount),
      currency,
      timestamp: new Date().toISOString()
    });
  }

  async handleTransactionCompleted(txId, recipient) {
    await this.logTransactionEvent({
      type: 'COMPLETED',
      txId,
      recipient,
      timestamp: new Date().toISOString()
    });
  }

  async handleTransactionFailed(txId, reason) {
    await this.logTransactionEvent({
      type: 'FAILED',
      txId,
      reason,
      timestamp: new Date().toISOString()
    });

    // Update failure rate
    // Implementation details...
  }

  async reportMetrics() {
    const report = {
      ...this.metrics,
      activeCurrencies: Array.from(this.metrics.activeCurrencies),
      timestamp: new Date().toISOString()
    };

    // Send to analytics service
    await fetch(this.analyticsEndpoint + '/cbdc/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });

    console.log('📈 Metrics reported:', report);
  }

  async getCurrencyFromAddress(cbdcAddress) {
    // Mapping logic to determine currency from CBDC address
    const addressToCurrency = {
      [productionConfig.cbdcs.USD.contractAddress]: 'USD',
      [productionConfig.cbdcs.EUR.contractAddress]: 'EUR',
      [productionConfig.cbdcs.GBP.contractAddress]: 'GBP'
    };
    return addressToCurrency[cbdcAddress] || 'UNKNOWN';
  }

  async logTransactionEvent(event) {
    await fetch(this.analyticsEndpoint + '/cbdc/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  }
}

// Start monitoring
const monitor = new CBDCTransactionMonitor(
  cbdcBridge,
  'https://analytics.unykorn.io'
);
await monitor.startMonitoring();
```

### 2. Compliance Reporting Dashboard

```javascript
class CBDCComplianceDashboard {
  constructor(bridgeContract, complianceEndpoint) {
    this.bridge = bridgeContract;
    this.complianceEndpoint = complianceEndpoint;
  }

  async generateDailyReport() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const report = {
      period: { startDate, endDate },
      transactions: await this.getTransactions(startDate, endDate),
      complianceMetrics: await this.getComplianceMetrics(startDate, endDate),
      regulatoryFlags: await this.getRegulatoryFlags(startDate, endDate),
      volumeAnalysis: await this.getVolumeAnalysis(startDate, endDate)
    };

    // Submit to regulators
    await this.submitRegulatoryReport(report);

    return report;
  }

  async getComplianceMetrics(startDate, endDate) {
    return {
      kycVerificationRate: 0.98,
      amlScreeningRate: 1.0,
      sanctionsHits: 0,
      travelRuleCompliance: 0.95,
      reportingThresholdBreaches: 3
    };
  }

  async getRegulatoryFlags() {
    // Check for transactions requiring special attention
    return [];
  }

  async submitRegulatoryReport(report) {
    // Submit to relevant regulatory bodies
    const regulators = ['FED', 'ECB', 'BOE'];
    
    for (const regulator of regulators) {
      await fetch(`${this.complianceEndpoint}/${regulator.toLowerCase()}/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env[`${regulator}_API_KEY`]}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });
    }
  }
}
```

---

## Support and Resources

### Documentation
- [CBDC Integration Guide](https://docs.unykorn.io/cbdc)
- [API Reference](https://api.unykorn.io/docs)
- [Smart Contract Documentation](https://contracts.unykorn.io)

### Support Channels
- **Technical Support:** [cbdc-support@unykorn.io](mailto:cbdc-support@unykorn.io)
- **Compliance Questions:** [compliance@unykorn.io](mailto:compliance@unykorn.io)
- **Developer Discord:** [https://discord.gg/unykorn-dev](https://discord.gg/unykorn-dev)

### Regulatory Contacts
- **US Compliance:** [us-compliance@unykorn.io](mailto:us-compliance@unykorn.io)
- **EU Compliance:** [eu-compliance@unykorn.io](mailto:eu-compliance@unykorn.io)
- **APAC Compliance:** [apac-compliance@unykorn.io](mailto:apac-compliance@unykorn.io)

---

*This document contains examples for educational and development purposes. Production implementations must comply with all applicable regulations and undergo thorough security audits.*