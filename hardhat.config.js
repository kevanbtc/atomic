require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("solidity-coverage");

// Load environment variables
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID || "";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable via IR for better optimization
    },
  },
  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 120000,
    },
    
    // Ethereum networks
    mainnet: {
      url: ALCHEMY_API_KEY 
        ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
        : `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 1,
      gasPrice: 20000000000, // 20 gwei
      timeout: 120000,
    },
    sepolia: {
      url: ALCHEMY_API_KEY
        ? `https://eth-sepolia.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
        : `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 10000000000, // 10 gwei
      timeout: 120000,
    },
    goerli: {
      url: ALCHEMY_API_KEY
        ? `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
        : `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 5,
      gasPrice: 10000000000, // 10 gwei
      timeout: 120000,
    },
    
    // Layer 2 networks
    polygon: {
      url: ALCHEMY_API_KEY
        ? `https://polygon-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
        : "https://polygon-rpc.com/",
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 137,
      gasPrice: 30000000000, // 30 gwei
      timeout: 120000,
    },
    mumbai: {
      url: ALCHEMY_API_KEY
        ? `https://polygon-mumbai.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
        : "https://rpc-mumbai.maticvigil.com",
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 80001,
      gasPrice: 10000000000, // 10 gwei
      timeout: 120000,
    },
    arbitrum: {
      url: ALCHEMY_API_KEY
        ? `https://arb-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
        : "https://arb1.arbitrum.io/rpc",
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 42161,
      gasPrice: 100000000, // 0.1 gwei
      timeout: 120000,
    },
    arbitrumGoerli: {
      url: "https://goerli-rollup.arbitrum.io/rpc",
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 421613,
      gasPrice: 100000000, // 0.1 gwei
      timeout: 120000,
    },
    optimism: {
      url: ALCHEMY_API_KEY
        ? `https://opt-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
        : "https://mainnet.optimism.io",
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 10,
      gasPrice: 15000000, // 0.015 gwei
      timeout: 120000,
    },
    optimismGoerli: {
      url: "https://goerli.optimism.io",
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      chainId: 420,
      gasPrice: 15000000, // 0.015 gwei
      timeout: 120000,
    },
  },
  
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20,
    showTimeSpent: true,
    showMethodSig: true,
  },
  
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
      arbitrumGoerli: ARBISCAN_API_KEY,
      optimisticEthereum: ETHERSCAN_API_KEY,
      optimisticGoerli: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "arbitrumOne",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io"
        }
      },
      {
        network: "optimisticEthereum", 
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io"
        }
      }
    ]
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  
  mocha: {
    timeout: 120000, // 2 minutes
  },
};