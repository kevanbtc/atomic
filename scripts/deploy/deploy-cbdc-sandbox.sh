#!/bin/bash

# ESG System - CBDC Sandbox Deployment Script
# Production-grade deployment to CBDC sandbox environment

set -e

echo "🏦 Starting ESG System CBDC Sandbox Deployment..."

# Environment Configuration
export NETWORK="cbdc-sandbox"
export NODE_ENV="production"
export ESG_ENV="cbdc-sandbox"

# Load environment variables
source "$(dirname "$0")/../setup/load-env.sh" "$NETWORK"

# Pre-deployment hooks
npx claude-flow@alpha hooks pre-task --description "cbdc-sandbox deployment"

# Validate previous deployments
echo "🔍 Validating prerequisite deployments..."
if ! ./scripts/utils/check-deployment-status.sh devnet; then
    echo "❌ Devnet deployment required"
    exit 1
fi

if ! ./scripts/utils/check-deployment-status.sh testnet; then
    echo "❌ Testnet deployment required"
    exit 1
fi

# Validate CBDC sandbox environment
echo "📋 Validating CBDC sandbox environment..."
./scripts/setup/validate-env.sh "$NETWORK"

# Run comprehensive pre-deployment audit
echo "🔒 Running comprehensive security audit..."
./scripts/monitoring/security-audit.sh cbdc-sandbox --comprehensive

echo "🧪 Running full test suite..."
npm run test:full
npm run test:security
npm run test:performance

# Backup current state
echo "💾 Creating deployment backup..."
./scripts/utils/backup-deployment.sh

# Build with production optimizations
echo "🔨 Building smart contracts with optimizations..."
npm run compile:production

echo "📦 Deploying ESG contracts to CBDC sandbox..."
npx hardhat deploy --network cbdc-sandbox --tags esg-core --verify --optimize

# Deploy with production configurations
echo "🪙 Deploying tokenization contracts..."
npx hardhat deploy --network cbdc-sandbox --tags tokenization --verify --optimize --gas-multiplier 1.1

echo "🏪 Deploying marketplace contracts..."
npx hardhat deploy --network cbdc-sandbox --tags marketplace --verify --optimize --gas-multiplier 1.1

echo "💎 Deploying staking contracts..."
npx hardhat deploy --network cbdc-sandbox --tags staking --verify --optimize --gas-multiplier 1.1

# Verify all contracts are properly deployed
echo "✅ Verifying all contracts..."
npm run verify:cbdc-sandbox

# Run production tests on deployed contracts
echo "🧪 Running production tests..."
npm run test:cbdc-sandbox
npm run test:load

# Deploy production infrastructure
echo "🏗️ Deploying production infrastructure..."
docker-compose -f docker/cbdc-sandbox/docker-compose.yml up -d

# Setup production monitoring and alerting
echo "📊 Setting up production monitoring..."
./scripts/monitoring/setup-monitoring.sh cbdc-sandbox --production

# Configure CBDC-specific integrations
echo "🏦 Configuring CBDC integrations..."
./scripts/setup/configure-cbdc-integration.sh

# Run comprehensive health checks
echo "🩺 Running comprehensive health checks..."
./scripts/monitoring/health-check.sh cbdc-sandbox --comprehensive

# Performance benchmarking
echo "⚡ Running performance benchmarks..."
./scripts/monitoring/performance-benchmark.sh cbdc-sandbox

# Final security scan
echo "🛡️ Final security validation..."
./scripts/monitoring/security-audit.sh cbdc-sandbox --final

# Update deployment status
echo "📊 Updating deployment status..."
npx claude-flow@alpha hooks post-task --task-id "cbdc-sandbox-deploy"

echo "✨ CBDC Sandbox deployment completed successfully!"
echo "📍 Network: $NETWORK"
echo "🌐 RPC URL: $(cat config/environments/cbdc-sandbox.json | jq -r '.rpcUrl')"
echo "📝 Contract addresses saved to: deployments/cbdc-sandbox/"
echo "📊 Production dashboard: https://dashboard.esg-cbdc.com"
echo "🔔 Alerts configured for: operations@esg-system.com"

# Store deployment info in memory
npx claude-flow@alpha hooks post-edit --file "deployments/cbdc-sandbox" --memory-key "esg/deployment/cbdc-sandbox/status"

# Generate deployment report
echo "📊 Generating deployment report..."
./scripts/utils/generate-deployment-report.sh cbdc-sandbox

echo "🎉 ESG System is now live in CBDC Sandbox!"