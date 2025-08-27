#!/bin/bash

# ESG System - Testnet Deployment Script
# Automated deployment to test network with validation

set -e

echo "🧪 Starting ESG System Testnet Deployment..."

# Environment Configuration
export NETWORK="testnet"
export NODE_ENV="testing"
export ESG_ENV="testnet"

# Load environment variables
source "$(dirname "$0")/../setup/load-env.sh" "$NETWORK"

# Pre-deployment hooks
npx claude-flow@alpha hooks pre-task --description "testnet deployment"

# Validate devnet deployment first
echo "🔍 Validating devnet deployment status..."
if ! ./scripts/utils/check-deployment-status.sh devnet; then
    echo "❌ Devnet deployment required before testnet deployment"
    exit 1
fi

# Validate environment
echo "📋 Validating testnet environment..."
./scripts/setup/validate-env.sh "$NETWORK"

# Run pre-deployment tests
echo "🧪 Running pre-deployment tests..."
npm run test:contracts
npm run test:integration

# Build and deploy contracts with verification
echo "🔨 Building smart contracts..."
npm run compile

echo "📦 Deploying ESG contracts to testnet..."
npx hardhat deploy --network testnet --tags esg-core --verify

# Deploy with increased gas limits for testnet
echo "🪙 Deploying tokenization contracts..."
npx hardhat deploy --network testnet --tags tokenization --verify --gas-multiplier 1.2

echo "🏪 Deploying marketplace contracts..."
npx hardhat deploy --network testnet --tags marketplace --verify --gas-multiplier 1.2

echo "💎 Deploying staking contracts..."
npx hardhat deploy --network testnet --tags staking --verify --gas-multiplier 1.2

# Run comprehensive contract tests
echo "🧪 Running contract tests on testnet..."
npm run test:testnet

# Deploy infrastructure with monitoring
echo "🏗️ Deploying testnet infrastructure..."
docker-compose -f docker/testnet/docker-compose.yml up -d

# Configure monitoring and alerts
echo "📊 Setting up monitoring..."
./scripts/monitoring/setup-monitoring.sh testnet

# Run extended health checks
echo "🩺 Running extended health checks..."
./scripts/monitoring/health-check.sh testnet --extended

# Perform security audit
echo "🛡️ Running security checks..."
./scripts/monitoring/security-audit.sh testnet

# Update deployment status
echo "📊 Updating deployment status..."
npx claude-flow@alpha hooks post-task --task-id "testnet-deploy"

echo "✨ Testnet deployment completed successfully!"
echo "📍 Network: $NETWORK"
echo "🌐 RPC URL: $(cat config/environments/testnet.json | jq -r '.rpcUrl')"
echo "📝 Contract addresses saved to: deployments/testnet/"
echo "📊 Monitoring dashboard: https://monitor.esg-testnet.com"

# Store deployment info in memory
npx claude-flow@alpha hooks post-edit --file "deployments/testnet" --memory-key "esg/deployment/testnet/status"

# Notify about CBDC sandbox readiness
echo "🏦 Ready for CBDC sandbox deployment. Run: ./scripts/deploy/deploy-cbdc-sandbox.sh"