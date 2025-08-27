#!/bin/bash

# ESG System - Deployment Status Checker
# Checks if a deployment is successful and healthy

set -e

NETWORK=${1:-devnet}
DEPLOYMENT_DIR="./deployments/$NETWORK"
TIMEOUT=${2:-60}

echo "🔍 Checking deployment status for: $NETWORK"

# Check if deployment directory exists
if [[ ! -d "$DEPLOYMENT_DIR" ]]; then
    echo "❌ Deployment directory not found: $DEPLOYMENT_DIR"
    exit 1
fi

# Check if deployment files exist
REQUIRED_FILES=(".chainId" "ESGToken.json" "ESGMarketplace.json")
for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$DEPLOYMENT_DIR/$file" ]]; then
        echo "❌ Required deployment file missing: $file"
        exit 1
    fi
done

# Load environment configuration
ENV_FILE="./config/environments/$NETWORK.json"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

RPC_URL=$(cat "$ENV_FILE" | jq -r '.rpcUrl')
CHAIN_ID=$(cat "$ENV_FILE" | jq -r '.chainId')

# Verify chain ID matches
DEPLOYED_CHAIN_ID=$(cat "$DEPLOYMENT_DIR/.chainId" 2>/dev/null || echo "0")
if [[ "$DEPLOYED_CHAIN_ID" != "$CHAIN_ID" ]]; then
    echo "❌ Chain ID mismatch. Expected: $CHAIN_ID, Found: $DEPLOYED_CHAIN_ID"
    exit 1
fi

# Check RPC connectivity
echo "🌐 Checking RPC connectivity..."
if [[ "$RPC_URL" != "http://localhost:8545" ]]; then
    RPC_RESPONSE=$(curl -s --connect-timeout 10 -X POST \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        "$RPC_URL" || echo '{}')
    
    RPC_CHAIN_ID=$(echo "$RPC_RESPONSE" | jq -r '.result // "0x0"')
    RPC_CHAIN_ID_DECIMAL=$((RPC_CHAIN_ID))
    
    if [[ "$RPC_CHAIN_ID_DECIMAL" != "$CHAIN_ID" ]]; then
        echo "❌ RPC chain ID mismatch. Expected: $CHAIN_ID, Found: $RPC_CHAIN_ID_DECIMAL"
        exit 1
    fi
fi

# Verify contract deployments
echo "📜 Verifying contract deployments..."

# Check ESG Token contract
ESG_TOKEN_ADDRESS=$(cat "$DEPLOYMENT_DIR/ESGToken.json" | jq -r '.address')
if [[ -z "$ESG_TOKEN_ADDRESS" || "$ESG_TOKEN_ADDRESS" == "null" ]]; then
    echo "❌ ESG Token address not found"
    exit 1
fi

# Verify contract is deployed (has code)
if [[ "$RPC_URL" != "http://localhost:8545" ]]; then
    CODE_RESPONSE=$(curl -s --connect-timeout 10 -X POST \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$ESG_TOKEN_ADDRESS\",\"latest\"],\"id\":1}" \
        "$RPC_URL" || echo '{}')
    
    CONTRACT_CODE=$(echo "$CODE_RESPONSE" | jq -r '.result // "0x"')
    if [[ "$CONTRACT_CODE" == "0x" || "$CONTRACT_CODE" == "0x0" ]]; then
        echo "❌ ESG Token contract not deployed or has no code"
        exit 1
    fi
fi

# Check infrastructure health (if applicable)
case "$NETWORK" in
    devnet)
        echo "🏗️  Checking devnet infrastructure..."
        # Check if Docker containers are running
        if docker-compose -f docker/devnet/docker-compose.yml ps | grep -q "Up"; then
            echo "   ✅ Docker containers running"
        else
            echo "   ⚠️  Docker containers not running (may be expected)"
        fi
        ;;
    testnet)
        echo "🧪 Checking testnet infrastructure..."
        # Check health endpoints if available
        HEALTH_URL="https://testnet-api.esg-system.org/health"
        if curl -s --connect-timeout 10 "$HEALTH_URL" | grep -q "healthy"; then
            echo "   ✅ API health check passed"
        else
            echo "   ⚠️  API health check failed or unavailable"
        fi
        ;;
    cbdc-sandbox)
        echo "🏦 Checking CBDC sandbox infrastructure..."
        # Check production health endpoints
        HEALTH_URL="https://api.esg-cbdc.com/health"
        if curl -s --connect-timeout 10 "$HEALTH_URL" | grep -q "healthy"; then
            echo "   ✅ Production API health check passed"
        else
            echo "   ❌ Production API health check failed"
            exit 1
        fi
        ;;
esac

# Check deployment timestamp
DEPLOYMENT_TIME=$(stat -f %m "$DEPLOYMENT_DIR/.chainId" 2>/dev/null || stat -c %Y "$DEPLOYMENT_DIR/.chainId" 2>/dev/null || echo "0")
CURRENT_TIME=$(date +%s)
DEPLOYMENT_AGE=$((CURRENT_TIME - DEPLOYMENT_TIME))

if [[ "$DEPLOYMENT_AGE" -gt 86400 ]]; then  # 24 hours
    AGE_HOURS=$((DEPLOYMENT_AGE / 3600))
    echo "⚠️  Deployment is $AGE_HOURS hours old"
fi

# Store deployment status in memory
npx claude-flow@alpha hooks post-edit --file "deployment-status-$NETWORK" --memory-key "esg/deployment/$NETWORK/status-check"

echo "✅ Deployment status check passed"
echo "   Network: $NETWORK"
echo "   Chain ID: $CHAIN_ID"
echo "   ESG Token: $ESG_TOKEN_ADDRESS"
echo "   Deployment age: $((DEPLOYMENT_AGE / 3600)) hours"

exit 0