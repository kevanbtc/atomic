#!/bin/bash

# ESG System - Environment Validation Script
# Validates deployment environment prerequisites

set -e

NETWORK=${1:-devnet}
ENV_DIR="$(dirname "$0")/../../config/environments"
ENV_FILE="$ENV_DIR/$NETWORK.json"

echo "🔍 Validating $NETWORK environment..."

# Check environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

# Check required tools
echo "🔧 Checking required tools..."
REQUIRED_TOOLS=("node" "npm" "jq" "curl" "docker" "docker-compose")

for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "❌ Required tool missing: $tool"
        exit 1
    fi
done

# Additional tool checks by environment
case "$NETWORK" in
    testnet|cbdc-sandbox)
        if ! command -v "vault" >/dev/null 2>&1; then
            echo "❌ Vault CLI required for $NETWORK"
            exit 1
        fi
        ;;
esac

# Validate network connectivity
echo "🌐 Checking network connectivity..."
RPC_URL=$(cat "$ENV_FILE" | jq -r '.rpcUrl')

if [[ "$RPC_URL" != "http://localhost:8545" ]]; then
    if ! curl -s --connect-timeout 10 "$RPC_URL" >/dev/null; then
        echo "❌ Cannot reach RPC endpoint: $RPC_URL"
        exit 1
    fi
fi

# Validate database connectivity
echo "🗄️  Checking database connectivity..."
DB_HOST=$(cat "$ENV_FILE" | jq -r '.database.host // .database.primary.host // "localhost"')
DB_PORT=$(cat "$ENV_FILE" | jq -r '.database.port // .database.primary.port // 5432')

if [[ "$DB_HOST" != "localhost" ]]; then
    if ! timeout 10 nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
        echo "❌ Cannot reach database: $DB_HOST:$DB_PORT"
        exit 1
    fi
fi

# Validate Redis connectivity
echo "📦 Checking Redis connectivity..."
REDIS_HOST=$(cat "$ENV_FILE" | jq -r '.redis.host // .redis.cluster.nodes[0] | split(":")[0] // "localhost"')
REDIS_PORT=$(cat "$ENV_FILE" | jq -r '.redis.port // 6379')

if [[ "$REDIS_HOST" != "localhost" ]]; then
    if ! timeout 10 nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
        echo "❌ Cannot reach Redis: $REDIS_HOST:$REDIS_PORT"
        exit 1
    fi
fi

# Check disk space
echo "💾 Checking disk space..."
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
REQUIRED_SPACE=1048576  # 1GB in KB

if [[ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]]; then
    echo "❌ Insufficient disk space. Available: ${AVAILABLE_SPACE}KB, Required: ${REQUIRED_SPACE}KB"
    exit 1
fi

# Check memory
echo "🧠 Checking available memory..."
if command -v free >/dev/null 2>&1; then
    AVAILABLE_MEM=$(free -m | awk 'NR==2{print $7}')
    REQUIRED_MEM=2048  # 2GB in MB
    
    if [[ "$AVAILABLE_MEM" -lt "$REQUIRED_MEM" ]]; then
        echo "⚠️  Low memory warning. Available: ${AVAILABLE_MEM}MB, Recommended: ${REQUIRED_MEM}MB"
    fi
fi

# Validate Docker
echo "🐳 Checking Docker..."
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running or not accessible"
    exit 1
fi

# Check Docker Compose version
COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
REQUIRED_COMPOSE_VERSION="2.0.0"

if [[ "$(printf '%s\n' "$REQUIRED_COMPOSE_VERSION" "$COMPOSE_VERSION" | sort -V | head -n1)" != "$REQUIRED_COMPOSE_VERSION" ]]; then
    echo "❌ Docker Compose version $REQUIRED_COMPOSE_VERSION or higher required. Found: $COMPOSE_VERSION"
    exit 1
fi

# Validate environment-specific requirements
case "$NETWORK" in
    devnet)
        echo "🏗️  Validating devnet requirements..."
        # Check if local blockchain is needed
        if [[ "$RPC_URL" == "http://localhost:8545" ]]; then
            echo "   Local blockchain will be started"
        fi
        ;;
    testnet)
        echo "🧪 Validating testnet requirements..."
        # Check Vault connectivity
        if ! vault status >/dev/null 2>&1; then
            echo "❌ Cannot reach Vault server"
            exit 1
        fi
        ;;
    cbdc-sandbox)
        echo "🏦 Validating CBDC sandbox requirements..."
        # Check Vault connectivity
        if ! vault status >/dev/null 2>&1; then
            echo "❌ Cannot reach Vault server"
            exit 1
        fi
        
        # Check CBDC API connectivity
        CBDC_API=$(cat "$ENV_FILE" | jq -r '.cbdc.integration.apiEndpoint // empty')
        if [[ -n "$CBDC_API" ]]; then
            if ! curl -s --connect-timeout 10 "$CBDC_API/health" >/dev/null; then
                echo "⚠️  Cannot reach CBDC API: $CBDC_API (may be expected in some setups)"
            fi
        fi
        ;;
esac

# Validate smart contract compilation
echo "📜 Validating smart contract setup..."
if [[ -f "hardhat.config.ts" || -f "hardhat.config.js" ]]; then
    if ! npm list hardhat >/dev/null 2>&1; then
        echo "❌ Hardhat not installed. Run: npm install"
        exit 1
    fi
else
    echo "❌ Hardhat configuration file not found"
    exit 1
fi

# Check if contracts can compile
echo "🔨 Testing contract compilation..."
if ! npm run compile >/dev/null 2>&1; then
    echo "❌ Contract compilation failed"
    exit 1
fi

echo "✅ Environment validation completed successfully"
echo "   Network: $NETWORK"
echo "   Environment file: $ENV_FILE"
echo "   All prerequisites met"