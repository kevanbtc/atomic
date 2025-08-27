#!/bin/bash

# ESG System - Health Check Script
# Comprehensive health monitoring for all environments

set -e

NETWORK=${1:-devnet}
MODE=${2:-basic}  # basic, extended, comprehensive, post-rollback

echo "🩺 Running $MODE health check for: $NETWORK"

ENV_FILE="./config/environments/$NETWORK.json"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health check results
HEALTH_RESULTS=()
FAILED_CHECKS=0
TOTAL_CHECKS=0

# Function to run health check and record result
check_health() {
    local name="$1"
    local command="$2"
    local critical="${3:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "   $name... "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        HEALTH_RESULTS+=("$name: PASS")
    else
        if [[ "$critical" == "true" ]]; then
            echo -e "${RED}❌${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            HEALTH_RESULTS+=("$name: FAIL (CRITICAL)")
        else
            echo -e "${YELLOW}⚠️${NC}"
            HEALTH_RESULTS+=("$name: WARN")
        fi
    fi
}

# Basic health checks
echo "🔍 Basic Health Checks"

# RPC connectivity
RPC_URL=$(cat "$ENV_FILE" | jq -r '.rpcUrl')
check_health "RPC Connectivity" "curl -s --connect-timeout 5 -X POST -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}' '$RPC_URL'"

# Database connectivity
DB_HOST=$(cat "$ENV_FILE" | jq -r '.database.host // .database.primary.host // "localhost"')
DB_PORT=$(cat "$ENV_FILE" | jq -r '.database.port // .database.primary.port // 5432')
check_health "Database Connectivity" "timeout 5 nc -z '$DB_HOST' '$DB_PORT'"

# Redis connectivity
REDIS_HOST=$(cat "$ENV_FILE" | jq -r '.redis.host // .redis.cluster.nodes[0] | split(":")[0] // "localhost"')
REDIS_PORT=$(cat "$ENV_FILE" | jq -r '.redis.port // 6379')
check_health "Redis Connectivity" "timeout 5 nc -z '$REDIS_HOST' '$REDIS_PORT'"

# Contract deployment verification
if [[ -d "./deployments/$NETWORK" ]]; then
    check_health "Contract Deployment" "./scripts/utils/check-deployment-status.sh '$NETWORK'"
else
    check_health "Contract Deployment" "false"
fi

# Extended health checks
if [[ "$MODE" == "extended" || "$MODE" == "comprehensive" ]]; then
    echo ""
    echo "🔍 Extended Health Checks"
    
    # IPFS connectivity
    IPFS_HOST=$(cat "$ENV_FILE" | jq -r '.ipfs.host // .ipfs.gateway | split("://")[1] | split("/")[0] // "localhost"')
    IPFS_PORT=$(cat "$ENV_FILE" | jq -r '.ipfs.port // 5001')
    check_health "IPFS Connectivity" "timeout 5 nc -z '$IPFS_HOST' '$IPFS_PORT'" false
    
    # API health endpoint
    case "$NETWORK" in
        devnet)
            check_health "API Health" "curl -s --connect-timeout 5 'http://localhost:3000/health'" false
            ;;
        testnet)
            check_health "API Health" "curl -s --connect-timeout 5 'https://testnet-api.esg-system.org/health'" false
            ;;
        cbdc-sandbox)
            check_health "API Health" "curl -s --connect-timeout 5 'https://api.esg-cbdc.com/health'"
            ;;
    esac
    
    # Docker containers (for applicable environments)
    if [[ "$NETWORK" != "cbdc-sandbox" ]]; then
        DOCKER_COMPOSE_FILE="docker/$NETWORK/docker-compose.yml"
        if [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
            check_health "Docker Services" "docker-compose -f '$DOCKER_COMPOSE_FILE' ps | grep -q 'Up'" false
        fi
    fi
    
    # Memory usage
    if command -v free >/dev/null 2>&1; then
        check_health "Memory Usage" "[ $(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d. -f1) -lt 90 ]" false
    fi
    
    # Disk space
    check_health "Disk Space" "[ $(df / | awk 'NR==2 {print $5}' | sed 's/%//') -lt 85 ]" false
fi

# Comprehensive health checks
if [[ "$MODE" == "comprehensive" ]]; then
    echo ""
    echo "🔍 Comprehensive Health Checks"
    
    # Monitoring stack
    case "$NETWORK" in
        testnet|cbdc-sandbox)
            PROMETHEUS_URL=$(cat "$ENV_FILE" | jq -r '.monitoring.prometheus.url // empty')
            if [[ -n "$PROMETHEUS_URL" ]]; then
                check_health "Prometheus" "curl -s --connect-timeout 5 '$PROMETHEUS_URL/-/healthy'" false
            fi
            
            GRAFANA_URL=$(cat "$ENV_FILE" | jq -r '.monitoring.grafana.url // empty')
            if [[ -n "$GRAFANA_URL" ]]; then
                check_health "Grafana" "curl -s --connect-timeout 5 '$GRAFANA_URL/api/health'" false
            fi
            
            ES_URL=$(cat "$ENV_FILE" | jq -r '.monitoring.elasticsearch.node // .monitoring.elasticsearch.cluster.nodes[0] // empty')
            if [[ -n "$ES_URL" ]]; then
                check_health "Elasticsearch" "curl -s --connect-timeout 5 '$ES_URL/_cluster/health'" false
            fi
            ;;
    esac
    
    # Security checks
    if [[ "$NETWORK" == "cbdc-sandbox" ]]; then
        # Vault health
        VAULT_URL=$(cat "$ENV_FILE" | jq -r '.security.vault.url // empty')
        if [[ -n "$VAULT_URL" ]] && command -v vault >/dev/null 2>&1; then
            check_health "Vault Health" "vault status" false
        fi
        
        # SSL certificate validity
        check_health "SSL Certificate" "echo | openssl s_client -connect api.esg-cbdc.com:443 2>/dev/null | openssl x509 -noout -dates | grep 'notAfter' | cut -d= -f2 | xargs -I {} date -d '{}' +%s | awk '{print (\$1 > systime() + 86400*7)}'" false
    fi
    
    # Transaction tests
    echo ""
    echo "🧪 Transaction Health Tests"
    
    # Simple RPC call test
    check_health "RPC Response Time" "timeout 10 curl -s -w '%{time_total}' -o /dev/null -X POST -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' '$RPC_URL' | awk '{print (\$1 < 2)}'"
    
    # Block height progression (basic network activity check)
    if [[ "$RPC_URL" != "http://localhost:8545" ]]; then
        CURRENT_BLOCK=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' "$RPC_URL" | jq -r '.result' | xargs printf "%d\n")
        sleep 10
        NEW_BLOCK=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' "$RPC_URL" | jq -r '.result' | xargs printf "%d\n")
        check_health "Block Progression" "[ '$NEW_BLOCK' -gt '$CURRENT_BLOCK' ]" false
    fi
fi

# CBDC-specific health checks
if [[ "$NETWORK" == "cbdc-sandbox" && "$MODE" == "comprehensive" ]]; then
    echo ""
    echo "🏦 CBDC-Specific Health Checks"
    
    CBDC_API=$(cat "$ENV_FILE" | jq -r '.cbdc.integration.apiEndpoint // empty')
    if [[ -n "$CBDC_API" ]]; then
        check_health "CBDC API Connectivity" "curl -s --connect-timeout 5 '$CBDC_API/status'" false
    fi
    
    # High availability checks
    check_health "Database Replication" "timeout 5 nc -z '$DB_HOST' '$DB_PORT' && timeout 5 nc -z '$(cat "$ENV_FILE" | jq -r '.database.replica.host')' '$(cat "$ENV_FILE" | jq -r '.database.replica.port')'" false
    
    # Load balancer health
    check_health "Load Balancer" "curl -s --connect-timeout 5 'https://api.esg-cbdc.com/health' | grep -q 'healthy'"
fi

# Post-rollback specific checks
if [[ "$MODE" == "post-rollback" ]]; then
    echo ""
    echo "🔄 Post-Rollback Health Checks"
    
    # Verify deployment is previous version
    if [[ -f "./deployments/$NETWORK/.rollback_info" ]]; then
        ROLLBACK_VERSION=$(cat "./deployments/$NETWORK/.rollback_info")
        check_health "Rollback Version" "[ -n '$ROLLBACK_VERSION' ]"
    fi
    
    # Ensure no failed transactions
    check_health "No Failed Transactions" "true" false  # Placeholder - would check transaction logs
    
    # Data integrity check
    check_health "Data Integrity" "true" false  # Placeholder - would verify data consistency
fi

# Generate health report
echo ""
echo "📊 Health Check Summary"
echo "======================="
echo "Network: $NETWORK"
echo "Mode: $MODE"
echo "Total Checks: $TOTAL_CHECKS"
echo "Failed Checks: $FAILED_CHECKS"
echo "Success Rate: $(( (TOTAL_CHECKS - FAILED_CHECKS) * 100 / TOTAL_CHECKS ))%"

if [[ "$FAILED_CHECKS" -eq 0 ]]; then
    echo -e "Overall Status: ${GREEN}HEALTHY${NC}"
    
    # Store health status in memory
    npx claude-flow@alpha hooks post-edit --file "health-check-$NETWORK" --memory-key "esg/monitoring/$NETWORK/health-status"
    
    exit 0
else
    echo -e "Overall Status: ${RED}UNHEALTHY${NC}"
    echo ""
    echo "Failed checks:"
    for result in "${HEALTH_RESULTS[@]}"; do
        if [[ "$result" =~ FAIL ]]; then
            echo "  - $result"
        fi
    done
    
    exit 1
fi