#!/bin/bash

# ESG System - Devnet Deployment Script
# Automated deployment to development network

set -e

echo "🚀 Starting ESG System Devnet Deployment..."

# Environment Configuration
export NETWORK="devnet"
export NODE_ENV="development"
export ESG_ENV="devnet"

# Load environment variables
source "$(dirname "$0")/../setup/load-env.sh" "$NETWORK"

# Pre-deployment hooks
npx claude-flow@alpha hooks pre-task --description "devnet deployment"

# Validate environment
echo "📋 Validating devnet environment..."
./scripts/setup/validate-env.sh "$NETWORK"

# Build and deploy contracts
echo "🔨 Building smart contracts..."
npm run compile

echo "📦 Deploying ESG contracts to devnet..."
npx hardhat deploy --network devnet --tags esg-core

# Deploy tokenization contracts
echo "🪙 Deploying tokenization contracts..."
npx hardhat deploy --network devnet --tags tokenization

# Deploy marketplace contracts
echo "🏪 Deploying marketplace contracts..."
npx hardhat deploy --network devnet --tags marketplace

# Deploy staking contracts
echo "💎 Deploying staking contracts..."
npx hardhat deploy --network devnet --tags staking

# Verify contracts
echo "✅ Verifying contracts..."
npm run verify:devnet

# Deploy infrastructure
echo "🏗️ Deploying infrastructure..."
docker-compose -f docker/devnet/docker-compose.yml up -d

# Run health checks
echo "🩺 Running health checks..."
./scripts/monitoring/health-check.sh devnet

# Update deployment status
echo "📊 Updating deployment status..."
npx claude-flow@alpha hooks post-task --task-id "devnet-deploy"

echo "✨ Devnet deployment completed successfully!"
echo "📍 Network: $NETWORK"
echo "🌐 RPC URL: $(cat config/environments/devnet.json | jq -r '.rpcUrl')"
echo "📝 Contract addresses saved to: deployments/devnet/"

# Store deployment info in memory
npx claude-flow@alpha hooks post-edit --file "deployments/devnet" --memory-key "esg/deployment/devnet/status"