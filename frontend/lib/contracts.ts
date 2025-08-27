// Contract addresses and ABIs for Unykorn ESG System
export const CONTRACT_ADDRESSES = {
  // Core ESG Contracts
  WaterVault: "0x0000000000000000000000000000000000000000", // To be filled after deployment
  CarbonVault: "0x0000000000000000000000000000000000000000",
  ESGStablecoin: "0x0000000000000000000000000000000000000000",
  CBDCBridge: "0x0000000000000000000000000000000000000000",
  
  // IP Protection Contracts
  UnykornSovereigntyRegistry: "0x0000000000000000000000000000000000000000",
  UnykornESGProof: "0x0000000000000000000000000000000000000000", 
  UnykornLicenseNFT: "0x0000000000000000000000000000000000000000",
  AuditProofNFT: "0x0000000000000000000000000000000000000000",
} as const;

// Simplified ABIs for frontend integration
export const CONTRACT_ABIS = {
  WaterVault: [
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function getProjectInfo(bytes32) view returns (tuple(string name, string location, uint256 qualityScore, uint256 sustainabilityRating))",
    "function totalProjects() view returns (uint256)",
    "event WaterDeposit(address indexed user, uint256 amount, bytes32 projectId)"
  ],
  
  CarbonVault: [
    "function totalCredits() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function getProjectMultiplier(string) view returns (uint256)",
    "function retiredCredits() view returns (uint256)",
    "event CarbonDeposit(address indexed user, uint256 credits, string projectType)"
  ],
  
  ESGStablecoin: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function getCollateralizationRatio() view returns (uint256)",
    "function esgScore() view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ],
  
  CBDCBridge: [
    "function bridgeTransactions(bytes32) view returns (tuple(bytes32 txId, address sourceToken, address targetToken, address sender, address recipient, uint256 amount, uint256 sourceChain, uint256 targetChain, uint256 timestamp, bool completed, bool cancelled))",
    "function getDailyVolume(address, uint256) view returns (uint256)",
    "function getTodayVolume(address) view returns (uint256)",
    "event BridgeInitiated(bytes32 indexed txId, address indexed sourceToken, address indexed sender, uint256 amount, uint256 targetChain)"
  ],
  
  UnykornESGProof: [
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function getAuditData(uint256) view returns (tuple(string reportTitle, uint256 appraisedValue, string ipfsCID, bytes32 documentHash, string auditFirm, uint256 timestamp))",
    "function tokenURI(uint256) view returns (string)",
    "event AuditProofMinted(uint256 indexed tokenId, address indexed recipient, string reportTitle, uint256 appraisedValue)"
  ],
  
  UnykornLicenseNFT: [
    "function subscriptionPrices(uint256) view returns (uint256)",
    "function getSubscription(uint256) view returns (tuple(address subscriber, uint256 tier, uint256 expiryDate, bool active))",
    "function isSubscriptionActive(uint256) view returns (bool)",
    "event SubscriptionMinted(uint256 indexed tokenId, address indexed subscriber, uint256 tier, uint256 expiryDate)"
  ],
  
  AuditProofNFT: [
    "function totalSupply() view returns (uint256)",
    "function getAuditData(uint256) view returns (tuple(string reportTitle, uint256 appraisedValue, string ipfsCID, bytes32 documentHash, string auditFirm, uint256 timestamp))",
    "function getTotalAppraisedValue(address) view returns (uint256)",
    "event AuditProofMinted(uint256 indexed tokenId, address indexed recipient, string reportTitle, uint256 appraisedValue)"
  ]
} as const;

// Network configurations
export const SUPPORTED_NETWORKS = {
  mainnet: {
    id: 1,
    name: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/your-api-key'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-mainnet.g.alchemy.com/v2/your-api-key'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  localhost: {
    id: 31337,
    name: 'Localhost',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['http://127.0.0.1:8545'],
    blockExplorerUrls: ['http://localhost:3000'],
  }
} as const;

// Utility functions
export const formatCurrency = (value: bigint | string | number, decimals = 18) => {
  const num = typeof value === 'bigint' ? Number(value) / Math.pow(10, decimals) : Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatTokenAmount = (value: bigint | string | number, decimals = 18) => {
  const num = typeof value === 'bigint' ? Number(value) / Math.pow(10, decimals) : Number(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(num);
};

export const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};