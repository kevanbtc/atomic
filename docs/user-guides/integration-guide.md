# Integration Guide - Unykorn ESG Platform

## Overview

This comprehensive guide helps developers integrate with the Unykorn ESG Platform APIs and smart contracts. Whether you're building a DeFi application, ESG portfolio tracker, or sustainability-focused dApp, this guide provides everything you need to get started.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [SDK Installation](#sdk-installation)
4. [Core Integrations](#core-integrations)
5. [Smart Contract Integration](#smart-contract-integration)
6. [API Examples](#api-examples)
7. [Webhooks](#webhooks)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Get API Credentials

1. Visit [Unykorn Developer Portal](https://developer.unykorn.io)
2. Create an account and verify your email
3. Generate API keys for your environment:
   - **Development:** Testnet access with higher rate limits
   - **Production:** Mainnet access with standard limits

### 2. Environment Setup

```bash
# Clone the integration examples
git clone https://github.com/unykorn/integration-examples.git
cd integration-examples

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### 3. First API Call

```javascript
const { UnykornSDK } = require('@unykorn/sdk');

const unykorn = new UnykornSDK({
  apiKey: process.env.UNYKORN_API_KEY,
  environment: 'testnet' // or 'mainnet'
});

async function getESGScore() {
  try {
    const score = await unykorn.esg.getScore('0x742d35Cc6634C0532925a3b8e0F8E6C4b0c5b59B');
    console.log('ESG Score:', score);
  } catch (error) {
    console.error('Error:', error);
  }
}

getESGScore();
```

## Authentication

The Unykorn platform supports multiple authentication methods:

### API Key Authentication

```javascript
// Header-based authentication
const headers = {
  'X-API-Key': 'your_api_key_here',
  'Content-Type': 'application/json'
};

// Or query parameter (less secure)
const url = 'https://api.unykorn.io/v1/esg/scores?api_key=your_api_key_here';
```

### JWT Bearer Token

```javascript
// Get JWT token
const auth = await unykorn.auth.login({
  apiKey: 'your_api_key',
  secret: 'your_secret'
});

// Use in subsequent requests
const headers = {
  'Authorization': `Bearer ${auth.token}`,
  'Content-Type': 'application/json'
};
```

### Webhook Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## SDK Installation

### Node.js SDK

```bash
npm install @unykorn/sdk
```

```javascript
const { UnykornSDK } = require('@unykorn/sdk');

const unykorn = new UnykornSDK({
  apiKey: process.env.UNYKORN_API_KEY,
  apiSecret: process.env.UNYKORN_API_SECRET,
  environment: 'mainnet', // 'testnet' or 'mainnet'
  timeout: 30000,
  retries: 3
});
```

### Python SDK

```bash
pip install unykorn-sdk
```

```python
from unykorn import UnykornClient

client = UnykornClient(
    api_key=os.environ['UNYKORN_API_KEY'],
    api_secret=os.environ['UNYKORN_API_SECRET'],
    environment='mainnet'
)

# Get ESG score
score = client.esg.get_score('0x742d35Cc6634C0532925a3b8e0F8E6C4b0c5b59B')
```

### Web3.js Integration

```javascript
const Web3 = require('web3');
const { UnykornContracts } = require('@unykorn/contracts');

// Initialize Web3
const web3 = new Web3('https://mainnet.infura.io/v3/your-infura-key');

// Load Unykorn contracts
const contracts = new UnykornContracts(web3, {
  network: 'mainnet'
});

// Get ESG Stablecoin contract
const stablecoin = contracts.getESGStablecoin();
```

## Core Integrations

### 1. ESG Stablecoin Integration

#### Minting Stablecoin

```javascript
async function mintStablecoin(collateralAsset, amount) {
  try {
    // Check user's collateral position
    const position = await unykorn.stablecoin.getPosition(
      userAddress,
      collateralAsset
    );
    
    // Calculate maximum mintable amount
    const maxMintable = await unykorn.stablecoin.getMaxMintable(
      userAddress,
      collateralAsset
    );
    
    if (amount > maxMintable) {
      throw new Error('Amount exceeds maximum mintable');
    }
    
    // Mint stablecoin
    const result = await unykorn.stablecoin.mint({
      collateralAsset: collateralAsset,
      amount: amount,
      userAddress: userAddress
    });
    
    console.log('Mint successful:', result.transactionHash);
    return result;
    
  } catch (error) {
    console.error('Mint failed:', error);
    throw error;
  }
}

// Usage
await mintStablecoin('0x...carbon_token_address', '1000000000000000000'); // 1 token
```

#### Repaying Debt

```javascript
async function repayDebt(collateralAsset, amount) {
  try {
    // Get current position
    const position = await unykorn.stablecoin.getPosition(
      userAddress,
      collateralAsset
    );
    
    // Calculate stability fee
    const fee = await unykorn.stablecoin.calculateStabilityFee(
      userAddress,
      collateralAsset
    );
    
    // Repay with fee
    const result = await unykorn.stablecoin.repay({
      collateralAsset: collateralAsset,
      amount: amount,
      userAddress: userAddress,
      includeFee: true
    });
    
    console.log('Repayment successful:', result);
    return result;
    
  } catch (error) {
    console.error('Repayment failed:', error);
    throw error;
  }
}
```

### 2. Carbon Credits Integration

#### Issuing Carbon Credits

```javascript
async function issueCarbonCredits(creditData) {
  try {
    // Validate credit data
    const validation = await unykorn.carbon.validateCredit(creditData);
    if (!validation.valid) {
      throw new Error(`Invalid credit: ${validation.errors.join(', ')}`);
    }
    
    // Issue credit
    const result = await unykorn.carbon.issueCredit({
      creditId: creditData.creditId,
      recipient: creditData.recipient,
      amount: creditData.amount,
      vintage: creditData.vintage,
      projectType: creditData.projectType
    });
    
    console.log('Carbon credit issued:', result.creditId);
    return result;
    
  } catch (error) {
    console.error('Credit issuance failed:', error);
    throw error;
  }
}

// Usage
await issueCarbonCredits({
  creditId: '0x1234...credit_id',
  recipient: '0x742d35Cc...recipient_address',
  amount: '1000000000000000000', // 1 tonne CO2
  vintage: 2024,
  projectType: 'Reforestation'
});
```

#### Trading Carbon Credits

```javascript
async function tradeCarbonCredits(creditId, buyer, seller, amount, price) {
  try {
    // Create trade order
    const order = await unykorn.carbon.createTradeOrder({
      creditId: creditId,
      seller: seller,
      amount: amount,
      price: price,
      expiration: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });
    
    // Execute trade
    const result = await unykorn.carbon.executeTrade({
      orderId: order.orderId,
      buyer: buyer
    });
    
    console.log('Trade executed:', result.transactionHash);
    return result;
    
  } catch (error) {
    console.error('Trade failed:', error);
    throw error;
  }
}
```

### 3. CBDC Bridge Integration

#### Initiating Bridge Transaction

```javascript
async function bridgeCBDC(bridgeData) {
  try {
    // Check daily limits
    const limits = await unykorn.bridge.getDailyLimits(bridgeData.sourceToken);
    if (bridgeData.amount > limits.remaining) {
      throw new Error('Amount exceeds daily limit');
    }
    
    // Calculate bridge fee
    const fee = await unykorn.bridge.calculateFee(
      bridgeData.sourceToken,
      bridgeData.amount
    );
    
    // Initiate bridge
    const result = await unykorn.bridge.initiate({
      sourceToken: bridgeData.sourceToken,
      targetToken: bridgeData.targetToken,
      recipient: bridgeData.recipient,
      amount: bridgeData.amount,
      targetChain: bridgeData.targetChain
    }, {
      value: fee // Bridge fee in ETH
    });
    
    console.log('Bridge initiated:', result.transactionId);
    
    // Monitor transaction status
    const status = await monitorBridgeTransaction(result.transactionId);
    return status;
    
  } catch (error) {
    console.error('Bridge initiation failed:', error);
    throw error;
  }
}

async function monitorBridgeTransaction(transactionId) {
  const pollInterval = 30000; // 30 seconds
  const maxAttempts = 120; // 1 hour timeout
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const status = await unykorn.bridge.getStatus(transactionId);
      
      console.log(`Bridge status: ${status.status}`);
      
      if (status.status === 'completed') {
        return status;
      } else if (status.status === 'failed' || status.status === 'cancelled') {
        throw new Error(`Bridge transaction ${status.status}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      console.error(`Status check attempt ${attempt + 1} failed:`, error);
    }
  }
  
  throw new Error('Bridge transaction timeout');
}
```

### 4. Water Credits Integration

#### Registering Water Projects

```javascript
async function registerWaterProject(projectData) {
  try {
    const result = await unykorn.water.registerProject({
      projectName: projectData.name,
      location: projectData.location,
      waterSaved: projectData.annualWaterSaving, // liters
      creditRate: projectData.creditRate // credits per liter
    });
    
    console.log('Project registered:', result.projectId);
    
    // Wait for oracle verification
    const verified = await waitForVerification(result.projectId);
    return { ...result, verified };
    
  } catch (error) {
    console.error('Project registration failed:', error);
    throw error;
  }
}

async function waitForVerification(projectId) {
  const maxWait = 24 * 60 * 60 * 1000; // 24 hours
  const pollInterval = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const project = await unykorn.water.getProject(projectId);
    
    if (project.isActive) {
      console.log('Project verified successfully');
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return false; // Verification timeout
}
```

## Smart Contract Integration

### Direct Contract Interaction

```javascript
const { ethers } = require('ethers');
const ESGStablecoinABI = require('@unykorn/contracts/abi/ESGStablecoin.json');

// Connect to provider
const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/your-key');
const signer = new ethers.Wallet(privateKey, provider);

// Connect to contract
const esgStablecoin = new ethers.Contract(
  '0x...esg_stablecoin_address',
  ESGStablecoinABI,
  signer
);

// Deposit collateral
async function depositCollateral(asset, amount) {
  try {
    const tx = await esgStablecoin.depositCollateral(asset, amount, {
      gasLimit: 300000
    });
    
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    
    return receipt;
  } catch (error) {
    console.error('Deposit failed:', error);
    throw error;
  }
}

// Listen for events
esgStablecoin.on('CollateralDeposited', (user, asset, amount, event) => {
  console.log('Collateral deposited:', {
    user,
    asset,
    amount: ethers.formatEther(amount),
    blockNumber: event.blockNumber
  });
});
```

### Batch Operations

```javascript
async function performBatchOperations(operations) {
  try {
    // Use multicall for batch operations
    const calls = operations.map(op => {
      switch (op.type) {
        case 'deposit':
          return esgStablecoin.interface.encodeFunctionData('depositCollateral', [
            op.asset,
            op.amount
          ]);
        case 'mint':
          return esgStablecoin.interface.encodeFunctionData('mintStablecoin', [
            op.asset,
            op.amount
          ]);
        default:
          throw new Error(`Unknown operation: ${op.type}`);
      }
    });
    
    // Execute batch via multicall
    const multicall = new ethers.Contract(multicallAddress, multicallABI, signer);
    const tx = await multicall.aggregate(calls);
    
    console.log('Batch transaction sent:', tx.hash);
    const receipt = await tx.wait();
    
    return receipt;
  } catch (error) {
    console.error('Batch operation failed:', error);
    throw error;
  }
}
```

## API Examples

### REST API Integration

```javascript
// Configure HTTP client
const axios = require('axios');

const apiClient = axios.create({
  baseURL: 'https://api.unykorn.io/v1',
  headers: {
    'X-API-Key': process.env.UNYKORN_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Add request interceptor for rate limiting
apiClient.interceptors.request.use(async (config) => {
  // Implement rate limiting logic
  await rateLimiter.acquire();
  return config;
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Example API calls
async function getPortfolioAnalytics(userAddress) {
  try {
    const response = await apiClient.get(`/analytics/portfolio/${userAddress}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get portfolio analytics: ${error.message}`);
  }
}

async function getDashboardData() {
  try {
    const [
      totalSupply,
      carbonCredits,
      waterCredits,
      bridgeStatus
    ] = await Promise.all([
      apiClient.get('/stablecoin/supply'),
      apiClient.get('/carbon/total'),
      apiClient.get('/water/total'),
      apiClient.get('/bridge/status')
    ]);
    
    return {
      stablecoin: totalSupply.data,
      carbon: carbonCredits.data,
      water: waterCredits.data,
      bridge: bridgeStatus.data
    };
  } catch (error) {
    throw new Error(`Failed to get dashboard data: ${error.message}`);
  }
}
```

### GraphQL Integration

```javascript
const { ApolloClient, InMemoryCache, gql } = require('@apollo/client/core');

// Configure GraphQL client
const client = new ApolloClient({
  uri: 'https://api.unykorn.io/graphql',
  cache: new InMemoryCache(),
  headers: {
    'X-API-Key': process.env.UNYKORN_API_KEY
  }
});

// GraphQL queries
const GET_USER_PORTFOLIO = gql`
  query GetUserPortfolio($address: String!) {
    user(address: $address) {
      esgScore
      stablecoinPositions {
        collateralAsset
        collateralAmount
        borrowedAmount
        collateralRatio
      }
      carbonCredits {
        creditId
        amount
        vintage
        projectType
      }
      waterCredits {
        creditId
        projectId
        amount
        isRetired
      }
    }
  }
`;

async function getUserPortfolio(address) {
  try {
    const { data } = await client.query({
      query: GET_USER_PORTFOLIO,
      variables: { address }
    });
    
    return data.user;
  } catch (error) {
    throw new Error(`GraphQL query failed: ${error.message}`);
  }
}
```

## Webhooks

### Setting Up Webhooks

```javascript
// Webhook endpoint setup (Express.js)
const express = require('express');
const crypto = require('crypto');

const app = express();

// Middleware to verify webhook signature
function verifyWebhook(req, res, next) {
  const signature = req.headers['x-unykorn-signature'];
  const payload = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).send('Invalid signature');
  }
  
  next();
}

// Webhook handlers
app.post('/webhooks/stablecoin', verifyWebhook, (req, res) => {
  const { event, data } = req.body;
  
  switch (event) {
    case 'stablecoin.minted':
      handleStablecoinMinted(data);
      break;
    case 'stablecoin.liquidation':
      handleLiquidation(data);
      break;
    case 'stablecoin.repaid':
      handleRepayment(data);
      break;
    default:
      console.log('Unknown event:', event);
  }
  
  res.status(200).send('OK');
});

app.post('/webhooks/carbon', verifyWebhook, (req, res) => {
  const { event, data } = req.body;
  
  switch (event) {
    case 'carbon.credit.issued':
      handleCarbonCreditIssued(data);
      break;
    case 'carbon.credit.retired':
      handleCarbonCreditRetired(data);
      break;
    case 'carbon.credit.traded':
      handleCarbonCreditTraded(data);
      break;
    default:
      console.log('Unknown carbon event:', event);
  }
  
  res.status(200).send('OK');
});

// Event handlers
function handleStablecoinMinted(data) {
  console.log('Stablecoin minted:', {
    user: data.user,
    amount: data.amount,
    collateral: data.collateralAsset
  });
  
  // Update user balance in your database
  // Send notification to user
  // Update analytics
}

function handleLiquidation(data) {
  console.log('Liquidation occurred:', {
    user: data.user,
    collateral: data.collateralAmount,
    debt: data.debtAmount
  });
  
  // Alert user about liquidation
  // Update risk metrics
  // Log for analysis
}
```

### Webhook Configuration

```javascript
// Register webhooks via API
async function registerWebhooks() {
  const webhooks = [
    {
      url: 'https://yourdomain.com/webhooks/stablecoin',
      events: ['stablecoin.minted', 'stablecoin.repaid', 'stablecoin.liquidation'],
      secret: process.env.WEBHOOK_SECRET
    },
    {
      url: 'https://yourdomain.com/webhooks/carbon',
      events: ['carbon.credit.issued', 'carbon.credit.retired'],
      secret: process.env.WEBHOOK_SECRET
    }
  ];
  
  for (const webhook of webhooks) {
    await unykorn.webhooks.register(webhook);
  }
}
```

## Testing

### Unit Testing

```javascript
const { expect } = require('chai');
const { UnykornSDK } = require('@unykorn/sdk');

describe('ESG Stablecoin Integration', () => {
  let unykorn;
  
  before(() => {
    unykorn = new UnykornSDK({
      apiKey: process.env.TEST_API_KEY,
      environment: 'testnet'
    });
  });
  
  it('should mint stablecoin with valid collateral', async () => {
    const result = await unykorn.stablecoin.mint({
      collateralAsset: '0x...test_token',
      amount: '1000000000000000000', // 1 token
      userAddress: '0x...test_user'
    });
    
    expect(result.success).to.be.true;
    expect(result.transactionHash).to.match(/^0x[a-fA-F0-9]{64}$/);
  });
  
  it('should reject minting with insufficient collateral', async () => {
    try {
      await unykorn.stablecoin.mint({
        collateralAsset: '0x...test_token',
        amount: '10000000000000000000', // 10 tokens (too much)
        userAddress: '0x...test_user'
      });
      
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error.message).to.include('Exceeds collateral ratio');
    }
  });
});
```

### Integration Testing

```javascript
describe('Full Integration Flow', () => {
  it('should complete end-to-end carbon credit flow', async () => {
    // 1. Issue carbon credit
    const credit = await unykorn.carbon.issueCredit({
      creditId: 'test-credit-' + Date.now(),
      recipient: testAddress,
      amount: '1000000000000000000',
      vintage: 2024,
      projectType: 'Test Project'
    });
    
    // 2. Use as collateral
    await unykorn.stablecoin.depositCollateral(
      credit.tokenAddress,
      credit.amount
    );
    
    // 3. Mint stablecoin
    const mintResult = await unykorn.stablecoin.mint({
      collateralAsset: credit.tokenAddress,
      amount: '800000000000000000', // 80% of collateral value
      userAddress: testAddress
    });
    
    expect(mintResult.success).to.be.true;
  });
});
```

### Load Testing

```javascript
const { performance } = require('perf_hooks');

async function loadTest() {
  const concurrency = 10;
  const requestsPerWorker = 100;
  
  console.log(`Starting load test: ${concurrency} workers, ${requestsPerWorker} requests each`);
  
  const startTime = performance.now();
  
  const workers = Array.from({ length: concurrency }, async (_, i) => {
    const results = [];
    
    for (let j = 0; j < requestsPerWorker; j++) {
      const requestStart = performance.now();
      
      try {
        const score = await unykorn.esg.getScore('0x...test_address');
        const requestTime = performance.now() - requestStart;
        
        results.push({ success: true, time: requestTime });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  });
  
  const allResults = await Promise.all(workers);
  const flatResults = allResults.flat();
  
  const totalTime = performance.now() - startTime;
  const successful = flatResults.filter(r => r.success).length;
  const avgResponseTime = flatResults
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.time, 0) / successful;
  
  console.log(`Load test completed in ${totalTime.toFixed(2)}ms`);
  console.log(`Successful requests: ${successful}/${flatResults.length}`);
  console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
}
```

## Production Deployment

### Environment Configuration

```javascript
// Production configuration
const productionConfig = {
  api: {
    baseURL: 'https://api.unykorn.io/v1',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  },
  rateLimit: {
    requestsPerMinute: 100,
    burstSize: 10
  },
  cache: {
    ttl: 300000, // 5 minutes
    maxSize: 1000
  },
  monitoring: {
    enabled: true,
    endpoint: 'https://monitoring.unykorn.io',
    interval: 60000 // 1 minute
  }
};
```

### Error Handling & Retry Logic

```javascript
class UnykornAPIError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'UnykornAPIError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

async function apiCallWithRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
    }
  }
}
```

### Monitoring Integration

```javascript
const { createPrometheusMetrics } = require('@prometheus-io/client');

// Create metrics
const metrics = createPrometheusMetrics({
  apiCallsTotal: 'counter',
  apiCallDuration: 'histogram',
  apiErrors: 'counter'
});

// Instrument API calls
function instrumentedAPICall(operation, fn) {
  return async (...args) => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      
      metrics.apiCallsTotal.inc({ operation, status: 'success' });
      metrics.apiCallDuration.observe(Date.now() - startTime);
      
      return result;
    } catch (error) {
      metrics.apiCallsTotal.inc({ operation, status: 'error' });
      metrics.apiErrors.inc({ operation, error: error.code || 'unknown' });
      
      throw error;
    }
  };
}
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

```javascript
// Debug authentication
async function debugAuth() {
  console.log('API Key:', process.env.UNYKORN_API_KEY?.slice(0, 8) + '...');
  
  try {
    const response = await apiClient.get('/health');
    console.log('Auth successful');
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Authentication failed - check API key');
    } else if (error.response?.status === 403) {
      console.error('Forbidden - check API permissions');
    }
  }
}
```

#### 2. Rate Limiting

```javascript
// Implement exponential backoff for rate limits
async function handleRateLimit(apiCall) {
  let delay = 1000; // Start with 1 second
  
  while (true) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`Rate limited, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 60000); // Max 1 minute
      } else {
        throw error;
      }
    }
  }
}
```

#### 3. Network Issues

```javascript
// Network connectivity check
async function checkConnectivity() {
  const endpoints = [
    'https://api.unykorn.io/health',
    'https://ethereum.org',
    'https://google.com'
  ];
  
  for (const endpoint of endpoints) {
    try {
      await axios.get(endpoint, { timeout: 5000 });
      console.log(`✓ ${endpoint} accessible`);
    } catch (error) {
      console.log(`✗ ${endpoint} not accessible:`, error.message);
    }
  }
}
```

### Debug Mode

```javascript
// Enable debug logging
const debug = require('debug')('unykorn:integration');

const unykorn = new UnykornSDK({
  apiKey: process.env.UNYKORN_API_KEY,
  environment: 'testnet',
  debug: true,
  logger: {
    info: debug,
    warn: console.warn,
    error: console.error
  }
});
```

### Support Channels

- **Documentation:** [https://docs.unykorn.io](https://docs.unykorn.io)
- **Discord Community:** [https://discord.gg/unykorn](https://discord.gg/unykorn)
- **GitHub Issues:** [https://github.com/unykorn/sdk/issues](https://github.com/unykorn/sdk/issues)
- **Email Support:** [developers@unykorn.io](mailto:developers@unykorn.io)

---

## Next Steps

1. **Explore Advanced Features:**
   - Custom ESG scoring algorithms
   - Multi-chain deployments
   - Advanced analytics integration

2. **Join the Community:**
   - Follow [@UnykornESG](https://twitter.com/UnykornESG) on Twitter
   - Join our Discord for real-time support
   - Contribute to open-source components

3. **Stay Updated:**
   - Subscribe to developer newsletter
   - Watch GitHub repository for updates
   - Check changelog for new features

---

*This integration guide is continuously updated. For the latest version and additional resources, visit our [developer portal](https://developer.unykorn.io).*