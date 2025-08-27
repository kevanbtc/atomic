#!/bin/bash

# ESG System - Complete Deployment Pipeline
# Automated deployment: devnet → testnet → CBDC sandbox

set -e

echo "🚀 Starting Complete ESG Deployment Pipeline..."

# Configuration
SKIP_CONFIRMATION=${1:-false}
DRY_RUN=${2:-false}

# Pre-deployment hooks
npx claude-flow@alpha hooks pre-task --description "complete deployment pipeline"

# Validate prerequisites
echo "📋 Validating deployment prerequisites..."
./scripts/setup/validate-prerequisites.sh

if [ "$DRY_RUN" = "true" ]; then
    echo "🧪 Running in DRY RUN mode - no actual deployments will occur"
    export DRY_RUN=true
fi

# Display deployment plan
echo "📋 Deployment Pipeline Plan:"
echo "  1. 🏗️  Devnet Deployment"
echo "  2. 🧪 Testnet Deployment"
echo "  3. 🏦 CBDC Sandbox Deployment"
echo "  4. ✅ Final Validation"

if [ "$SKIP_CONFIRMATION" != "true" ]; then
    read -p "Proceed with deployment pipeline? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Stage 1: Devnet Deployment
echo "🏗️ Stage 1: Devnet Deployment"
echo "================================"
if [ "$DRY_RUN" = "true" ]; then
    echo "🧪 DRY RUN: Would deploy to devnet"
else
    ./scripts/deploy/deploy-devnet.sh
    echo "✅ Devnet deployment completed"
fi

# Wait and validate devnet
sleep 10
if ! ./scripts/monitoring/health-check.sh devnet; then
    echo "❌ Devnet health check failed"
    exit 1
fi

# Stage 2: Testnet Deployment
echo ""
echo "🧪 Stage 2: Testnet Deployment"
echo "==============================="
if [ "$DRY_RUN" = "true" ]; then
    echo "🧪 DRY RUN: Would deploy to testnet"
else
    ./scripts/deploy/deploy-testnet.sh
    echo "✅ Testnet deployment completed"
fi

# Wait and validate testnet
sleep 15
if ! ./scripts/monitoring/health-check.sh testnet; then
    echo "❌ Testnet health check failed"
    exit 1
fi

# Stage 3: CBDC Sandbox Deployment
echo ""
echo "🏦 Stage 3: CBDC Sandbox Deployment"
echo "===================================="
if [ "$SKIP_CONFIRMATION" != "true" ]; then
    read -p "Proceed with CBDC sandbox deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏹️ Pipeline stopped before CBDC deployment"
        exit 0
    fi
fi

if [ "$DRY_RUN" = "true" ]; then
    echo "🧪 DRY RUN: Would deploy to CBDC sandbox"
else
    ./scripts/deploy/deploy-cbdc-sandbox.sh
    echo "✅ CBDC sandbox deployment completed"
fi

# Stage 4: Final Validation
echo ""
echo "✅ Stage 4: Final Pipeline Validation"
echo "====================================="
./scripts/monitoring/validate-pipeline.sh

# Generate pipeline report
echo "📊 Generating pipeline deployment report..."
./scripts/utils/generate-pipeline-report.sh

# Update deployment status
npx claude-flow@alpha hooks post-task --task-id "complete-pipeline"

# Store pipeline status in memory
npx claude-flow@alpha hooks post-edit --file "pipeline-status" --memory-key "esg/deployment/pipeline/complete"

echo ""
echo "🎉 Complete ESG Deployment Pipeline Successfully Executed!"
echo "=========================================================="
echo "📍 Devnet:        $(cat config/environments/devnet.json | jq -r '.rpcUrl')"
echo "📍 Testnet:       $(cat config/environments/testnet.json | jq -r '.rpcUrl')"
echo "📍 CBDC Sandbox:  $(cat config/environments/cbdc-sandbox.json | jq -r '.rpcUrl')"
echo ""
echo "📊 Monitoring Dashboards:"
echo "  • Devnet:       https://monitor.esg-devnet.com"
echo "  • Testnet:      https://monitor.esg-testnet.com"
echo "  • CBDC:         https://dashboard.esg-cbdc.com"
echo ""
echo "📧 Alerts configured for: operations@esg-system.com"