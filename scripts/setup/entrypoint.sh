#!/bin/bash

# ESG System - Docker Entrypoint Script
# Prepares container environment and starts the application

set -e

echo "🚀 Starting ESG System container..."

# Default values
NODE_ENV=${NODE_ENV:-development}
NETWORK=${NETWORK:-devnet}
PORT=${PORT:-3000}

# Wait for dependencies
echo "⏳ Waiting for dependencies..."

# Wait for database
if [[ -n "$DATABASE_URL" ]]; then
    echo "   Waiting for database..."
    until pg_isready -d "$DATABASE_URL" -t 30; do
        echo "   Database is unavailable - sleeping"
        sleep 2
    done
    echo "   ✅ Database is ready"
fi

# Wait for Redis
if [[ -n "$REDIS_URL" ]]; then
    echo "   Waiting for Redis..."
    REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    REDIS_PORT=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
    
    if [[ -n "$REDIS_HOST" && -n "$REDIS_PORT" ]]; then
        until nc -z "$REDIS_HOST" "$REDIS_PORT"; do
            echo "   Redis is unavailable - sleeping"
            sleep 2
        done
        echo "   ✅ Redis is ready"
    fi
fi

# Wait for blockchain RPC (if not localhost)
if [[ -n "$BLOCKCHAIN_RPC" && "$BLOCKCHAIN_RPC" != "http://localhost:8545" ]]; then
    echo "   Waiting for blockchain RPC..."
    until curl -s --connect-timeout 5 -X POST \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        "$BLOCKCHAIN_RPC" >/dev/null 2>&1; do
        echo "   Blockchain RPC is unavailable - sleeping"
        sleep 5
    done
    echo "   ✅ Blockchain RPC is ready"
fi

# Run database migrations (if needed)
if [[ "$NODE_ENV" != "development" && -n "$DATABASE_URL" ]]; then
    echo "🗄️  Running database migrations..."
    npm run db:migrate || echo "⚠️  Database migration failed or not available"
fi

# Seed data (development only)
if [[ "$NODE_ENV" == "development" && -n "$DATABASE_URL" ]]; then
    echo "🌱 Seeding development data..."
    npm run db:seed || echo "⚠️  Database seeding failed or not available"
fi

# Health check before starting
echo "🩺 Running pre-start health check..."
if command -v curl >/dev/null 2>&1; then
    # Basic connectivity tests
    echo "   Testing database connectivity..."
    if [[ -n "$DATABASE_URL" ]]; then
        pg_isready -d "$DATABASE_URL" -t 10 || echo "   ⚠️  Database connectivity issue"
    fi
    
    echo "   Testing Redis connectivity..."
    if [[ -n "$REDIS_URL" ]]; then
        redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1 || echo "   ⚠️  Redis connectivity issue"
    fi
fi

# Set up logging
mkdir -p /app/logs
export LOG_FILE="/app/logs/app-$(date +%Y%m%d).log"

# Export environment info
echo "🔧 Environment Configuration:"
echo "   NODE_ENV: $NODE_ENV"
echo "   NETWORK: $NETWORK"
echo "   PORT: $PORT"
echo "   LOG_LEVEL: ${LOG_LEVEL:-info}"
echo "   Process ID: $$"

# Start the application
echo "✨ Starting ESG System API..."

# Execute the main command
exec "$@"