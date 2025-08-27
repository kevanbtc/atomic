#!/bin/bash

# ESG System - Environment Loader Script
# Loads environment-specific configuration and secrets

set -e

NETWORK=${1:-devnet}
ENV_DIR="$(dirname "$0")/../../config/environments"
ENV_FILE="$ENV_DIR/$NETWORK.json"

echo "🔧 Loading environment configuration for: $NETWORK"

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

# Load basic configuration from JSON
export ESG_NETWORK="$NETWORK"
export ESG_RPC_URL=$(cat "$ENV_FILE" | jq -r '.rpcUrl')
export ESG_CHAIN_ID=$(cat "$ENV_FILE" | jq -r '.chainId')
export ESG_GAS_PRICE=$(cat "$ENV_FILE" | jq -r '.gasPrice')
export ESG_GAS_LIMIT=$(cat "$ENV_FILE" | jq -r '.gasLimit')

# Set Node.js environment
export NODE_ENV=$(cat "$ENV_FILE" | jq -r '.environment')

# Load database configuration
export DATABASE_HOST=$(cat "$ENV_FILE" | jq -r '.database.host // .database.primary.host // "localhost"')
export DATABASE_PORT=$(cat "$ENV_FILE" | jq -r '.database.port // .database.primary.port // 5432')
export DATABASE_NAME=$(cat "$ENV_FILE" | jq -r '.database.database // .database.primary.database')
export DATABASE_USER=$(cat "$ENV_FILE" | jq -r '.database.user // .database.primary.user')

# Load Redis configuration
export REDIS_HOST=$(cat "$ENV_FILE" | jq -r '.redis.host // .redis.cluster.nodes[0] | split(":")[0] // "localhost"')
export REDIS_PORT=$(cat "$ENV_FILE" | jq -r '.redis.port // 6379')

# Load IPFS configuration
export IPFS_HOST=$(cat "$ENV_FILE" | jq -r '.ipfs.host // .ipfs.gateway | split("://")[1] | split("/")[0] // "localhost"')
export IPFS_PORT=$(cat "$ENV_FILE" | jq -r '.ipfs.port // 5001')

# Load environment-specific secrets
case "$NETWORK" in
    devnet)
        # Development secrets (hardcoded for convenience)
        export DATABASE_PASSWORD="dev_password"
        export REDIS_PASSWORD=""
        export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        ;;
    testnet)
        # Testnet secrets from environment variables or Vault
        export DATABASE_PASSWORD="${TESTNET_DATABASE_PASSWORD:-$(vault kv get -field=password secret/testnet/database 2>/dev/null || echo '')}"
        export REDIS_PASSWORD="${TESTNET_REDIS_PASSWORD:-$(vault kv get -field=password secret/testnet/redis 2>/dev/null || echo '')}"
        export PRIVATE_KEY="${TESTNET_PRIVATE_KEY:-$(vault kv get -field=key secret/testnet/deployer 2>/dev/null || echo '')}"
        ;;
    cbdc-sandbox)
        # Production secrets from Vault (required)
        if command -v vault >/dev/null 2>&1; then
            export DATABASE_PASSWORD="${CBDC_DATABASE_PASSWORD:-$(vault kv get -field=password secret/cbdc/database)}"
            export REDIS_PASSWORD="${CBDC_REDIS_PASSWORD:-$(vault kv get -field=password secret/cbdc/redis)}"
            export PRIVATE_KEY="${CBDC_PRIVATE_KEY:-$(vault kv get -field=key secret/cbdc/deployer)}"
            export CBDC_API_KEY="${CBDC_API_KEY:-$(vault kv get -field=api_key secret/cbdc/integration)}"
        else
            echo "❌ Vault CLI required for CBDC sandbox deployment"
            exit 1
        fi
        ;;
esac

# Validate required environment variables
if [[ -z "$ESG_RPC_URL" || -z "$DATABASE_PASSWORD" || -z "$PRIVATE_KEY" ]]; then
    echo "❌ Missing required environment variables"
    echo "   ESG_RPC_URL: ${ESG_RPC_URL:-'MISSING'}"
    echo "   DATABASE_PASSWORD: ${DATABASE_PASSWORD:+'SET':-'MISSING'}"
    echo "   PRIVATE_KEY: ${PRIVATE_KEY:+'SET':-'MISSING'}"
    exit 1
fi

# Construct full database URL
export DATABASE_URL="postgresql://$DATABASE_USER:$DATABASE_PASSWORD@$DATABASE_HOST:$DATABASE_PORT/$DATABASE_NAME"

# Construct Redis URL
if [[ -n "$REDIS_PASSWORD" ]]; then
    export REDIS_URL="redis://default:$REDIS_PASSWORD@$REDIS_HOST:$REDIS_PORT"
else
    export REDIS_URL="redis://$REDIS_HOST:$REDIS_PORT"
fi

echo "✅ Environment loaded successfully"
echo "   Network: $ESG_NETWORK"
echo "   Chain ID: $ESG_CHAIN_ID"
echo "   RPC URL: $ESG_RPC_URL"
echo "   Database: $DATABASE_HOST:$DATABASE_PORT/$DATABASE_NAME"
echo "   Redis: $REDIS_HOST:$REDIS_PORT"