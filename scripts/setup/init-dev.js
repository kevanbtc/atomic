#!/usr/bin/env node
/**
 * Development Environment Initialization Script
 * Sets up local development environment for Unykorn ESG system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Initializing ESG Development Environment...\n");

  // Start local blockchain
  console.log("1. Starting Hardhat node...");
  execSync('npx hardhat node --fork https://mainnet.infura.io/v3/$INFURA_PROJECT_ID', { 
    stdio: 'pipe',
    timeout: 10000 
  });

  // Deploy contracts
  console.log("2. Deploying ESG contracts...");
  execSync('npx hardhat run scripts/deploy/deploy-esg.js --network localhost', {
    stdio: 'inherit'
  });

  // Setup mock oracles
  console.log("3. Configuring mock oracles...");
  execSync('npx hardhat run scripts/setup/setup-oracles.js --network localhost', {
    stdio: 'inherit'
  });

  // Run initial tests
  console.log("4. Running smoke tests...");
  execSync('npm run test:smoke', { stdio: 'inherit' });

  console.log("\n✅ Development environment ready!");
  console.log("📍 Local node: http://localhost:8545");
  console.log("📍 Frontend: http://localhost:3000");
}

if (require.main === module) {
  main().catch(console.error);
}