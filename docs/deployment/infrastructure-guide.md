# Infrastructure Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Unykorn ESG Platform across different environments, from local development to production mainnet deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Testnet Deployment](#testnet-deployment)
5. [CBDC Sandbox](#cbdc-sandbox)
6. [Production Mainnet](#production-mainnet)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Security Hardening](#security-hardening)
9. [Disaster Recovery](#disaster-recovery)

## Prerequisites

### System Requirements

**Minimum Specifications:**
- CPU: 4 cores, 2.4GHz
- RAM: 8GB
- Storage: 100GB SSD
- Network: 100 Mbps

**Recommended Specifications:**
- CPU: 8 cores, 3.2GHz
- RAM: 16GB
- Storage: 500GB NVMe SSD
- Network: 1 Gbps

### Software Dependencies

```bash
# Node.js and npm
node >= 16.0.0
npm >= 8.0.0

# Docker and Docker Compose
docker >= 20.10.0
docker-compose >= 2.0.0

# Git
git >= 2.30.0

# Optional: Hardhat CLI
npm install -g hardhat
```

### External Services

1. **Alchemy/Infura API Keys** - Blockchain RPC endpoints
2. **Etherscan API Keys** - Contract verification
3. **MongoDB Atlas** - Database hosting
4. **Redis Cloud** - Caching layer
5. **AWS/GCP/Azure** - Cloud infrastructure

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/unykorn/esg-platform.git
cd esg-platform

# Install dependencies
npm install
```

### 2. Environment Configuration

Create environment-specific configuration files:

**.env.local** (Development)
```env
# Blockchain Configuration
NETWORK=localhost
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0x...
MNEMONIC="your twelve word mnemonic phrase here"

# API Keys
ALCHEMY_API_KEY=your_alchemy_key
ETHERSCAN_API_KEY=your_etherscan_key
COINMARKETCAP_API_KEY=your_cmc_key

# Database
MONGODB_URI=mongodb://localhost:27017/esg_platform
REDIS_URL=redis://localhost:6379

# Application
API_PORT=3000
API_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:3000

# Oracle Configuration
CARBON_ORACLE_URL=https://api.carbonregistry.org
WATER_ORACLE_URL=https://api.waterregistry.org
ESG_ORACLE_URL=https://api.esgdata.org

# Feature Flags
ENABLE_CBDC_BRIDGE=true
ENABLE_NFT_MARKETPLACE=true
ENABLE_STAKING=true
```

**.env.testnet** (Sepolia/Goerli)
```env
NETWORK=sepolia
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
PRIVATE_KEY=0x...
MNEMONIC="your testnet mnemonic phrase here"

# Contract Addresses (Updated after deployment)
ESG_STABLECOIN_ADDRESS=0x...
CBDC_BRIDGE_ADDRESS=0x...
CARBON_VAULT_ADDRESS=0x...
WATER_VAULT_ADDRESS=0x...

# Gas Configuration
GAS_PRICE=20000000000
GAS_LIMIT=6000000
```

**.env.production** (Mainnet)
```env
NETWORK=mainnet
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
PRIVATE_KEY=0x...

# Production Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/esg_prod
REDIS_URL=redis://your-redis-cluster:6379

# Production Configuration
API_PORT=443
SSL_CERT_PATH=/etc/ssl/certs/unykorn.crt
SSL_KEY_PATH=/etc/ssl/private/unykorn.key

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600000

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your_license_key
```

### 3. Docker Configuration

**docker-compose.yml** (Development)
```yaml
version: '3.8'
services:
  # Local Blockchain
  hardhat:
    build: 
      context: .
      dockerfile: docker/dev/Dockerfile
    ports:
      - "8545:8545"
    volumes:
      - ./contracts:/app/contracts
      - ./scripts:/app/scripts
    command: npx hardhat node

  # Database Services
  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  redis:
    image: redis:7.0-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # API Service
  api:
    build:
      context: .
      dockerfile: docker/dev/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - mongodb
      - redis
      - hardhat
    volumes:
      - ./src:/app/src
      - ./docs:/app/docs
    environment:
      - NODE_ENV=development

volumes:
  mongodb_data:
  redis_data:
```

## Local Development

### 1. Start Development Environment

```bash
# Start local blockchain and services
docker-compose up -d

# Compile contracts
npm run compile

# Deploy contracts locally
npm run deploy:dev

# Run tests
npm test
npm run test:esg
npm run coverage
```

### 2. Development Workflow

```bash
# Start development server with hot reload
npm run dev

# Watch for contract changes
npm run compile:watch

# Run linting
npm run lint

# Type checking
npm run typecheck
```

### 3. Local Testing

```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# Gas analysis
npm run analyze:gas

# Security analysis
npm run analyze:security
```

## Testnet Deployment

### 1. Sepolia Testnet Setup

```bash
# Set environment
export NODE_ENV=testnet
source .env.testnet

# Deploy to Sepolia
npm run deploy:testnet

# Verify contracts
npm run verify:sepolia

# Setup initial configuration
npm run setup:testnet
```

### 2. Testnet Infrastructure

**docker-compose.testnet.yml**
```yaml
version: '3.8'
services:
  api:
    image: unykorn/esg-platform:testnet
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=testnet
      - NETWORK=sepolia
    volumes:
      - ./config/testnet:/app/config
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx/testnet.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - api
    restart: unless-stopped

  monitoring:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus:/etc/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
```

### 3. Testnet Validation

```bash
# Health check
curl https://testnet.unykorn.io/health

# Contract interaction tests
npm run test:testnet

# Load testing
npm run load-test:testnet

# Monitor logs
docker-compose logs -f api
```

## CBDC Sandbox

The CBDC sandbox environment simulates central bank digital currency interactions.

### 1. Sandbox Configuration

```bash
# Deploy CBDC sandbox
docker-compose -f docker/cbdc-sandbox/docker-compose.yml up -d

# Initialize CBDC contracts
npm run setup:cbdc-sandbox

# Configure validators
npm run configure:validators
```

### 2. CBDC Bridge Testing

```javascript
// Test CBDC bridge functionality
const { deployments } = require('hardhat');

async function testCBDCBridge() {
  const bridge = await deployments.get('CBDCBridge');
  
  // Test bridge initiation
  const tx = await bridge.initiateBridge(
    sourceToken,
    targetToken,
    recipient,
    amount,
    targetChain,
    { value: bridgeFee }
  );
  
  console.log('Bridge initiated:', tx.hash);
  
  // Monitor transaction status
  const status = await bridge.getBridgeTransaction(tx.hash);
  console.log('Bridge status:', status);
}
```

### 3. Validator Network Setup

```bash
# Deploy validator nodes
./scripts/deploy/deploy-cbdc-validators.sh

# Configure validator signatures
npm run configure:validator-keys

# Test multi-sig validation
npm run test:validator-consensus
```

## Production Mainnet

### 1. Pre-deployment Checklist

- [ ] **Security Audit Completed**
- [ ] **Code Freeze Implemented**
- [ ] **Gas Optimization Verified**
- [ ] **Backup Procedures Tested**
- [ ] **Monitoring Systems Active**
- [ ] **Emergency Procedures Documented**
- [ ] **Insurance Coverage Confirmed**

### 2. Mainnet Deployment Process

```bash
#!/bin/bash
# Production deployment script

set -e  # Exit on any error

echo "🚀 Starting mainnet deployment..."

# Pre-deployment checks
npm run audit
npm run test:full
npm run analyze:security

# Deploy infrastructure
terraform init
terraform plan -var-file="production.tfvars"
terraform apply -auto-approve

# Deploy contracts
export NODE_ENV=production
npm run deploy:mainnet

# Verify contracts
npm run verify:mainnet

# Initialize system
npm run setup:mainnet

# Health check
npm run health-check:mainnet

echo "✅ Mainnet deployment completed successfully"
```

### 3. Production Infrastructure

**Terraform Configuration (main.tf)**
```hcl
# AWS Infrastructure for Unykorn ESG Platform
provider "aws" {
  region = "us-east-1"
}

# VPC and Networking
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "unykorn-esg-vpc"
    Environment = "production"
  }
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "unykorn-esg-cluster"
  role_arn = aws_iam_role.cluster.arn
  version  = "1.24"

  vpc_config {
    subnet_ids = aws_subnet.private[*].id
  }
}

# RDS Database
resource "aws_db_instance" "main" {
  identifier        = "unykorn-esg-db"
  engine            = "postgres"
  engine_version    = "14.9"
  instance_class    = "db.r6g.large"
  allocated_storage = 100
  storage_encrypted = true
  
  db_name  = "esg_platform"
  username = "admin"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "unykorn-esg-redis"
  engine               = "redis"
  node_type           = "cache.r6g.large"
  num_cache_nodes     = 1
  parameter_group_name = "default.redis7"
  port                = 6379
  
  security_group_ids = [aws_security_group.redis.id]
  subnet_group_name  = aws_elasticache_subnet_group.main.name
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "unykorn-esg-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = aws_subnet.public[*].id
  
  enable_deletion_protection = true
}
```

### 4. Kubernetes Deployment

**k8s/production/deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: esg-platform-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: esg-platform-api
  template:
    metadata:
      labels:
        app: esg-platform-api
    spec:
      containers:
      - name: api
        image: unykorn/esg-platform:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: esg-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: esg-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: esg-platform-service
  namespace: production
spec:
  selector:
    app: esg-platform-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 5. SSL/TLS Configuration

```bash
# Generate SSL certificates with Let's Encrypt
certbot --nginx -d api.unykorn.io -d unykorn.io

# Configure nginx for SSL termination
server {
    listen 443 ssl http2;
    server_name api.unykorn.io;
    
    ssl_certificate /etc/letsencrypt/live/api.unykorn.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.unykorn.io/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring & Maintenance

### 1. Monitoring Stack

**Prometheus Configuration**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'esg-platform'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'ethereum-node'
    static_configs:
      - targets: ['geth:8545']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

**Grafana Dashboards**
- Smart Contract Gas Usage
- Transaction Volume and Success Rates
- ESG Token Metrics
- Bridge Transaction Status
- System Health Metrics

### 2. Health Checks

```javascript
// Health check endpoint implementation
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  try {
    // Database connectivity
    await mongoose.connection.db.admin().ping();
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Blockchain connectivity
    const blockNumber = await provider.getBlockNumber();
    health.services.blockchain = 'healthy';
    health.services.latestBlock = blockNumber;
  } catch (error) {
    health.services.blockchain = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Redis connectivity
    await redis.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### 3. Automated Maintenance

```bash
#!/bin/bash
# Daily maintenance script

# Update system packages
apt update && apt upgrade -y

# Clean up logs older than 30 days
find /var/log -type f -name "*.log" -mtime +30 -delete

# Backup database
pg_dump esg_platform | gzip > /backups/esg_platform_$(date +%Y%m%d).sql.gz

# Rotate SSL certificates if needed
certbot renew --quiet

# Restart services if needed
systemctl reload nginx
docker-compose restart api

# Send status report
curl -X POST https://api.unykorn.io/admin/health-report
```

## Security Hardening

### 1. Network Security

```bash
# Firewall configuration
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Fail2ban configuration
systemctl enable fail2ban
systemctl start fail2ban
```

### 2. Application Security

```javascript
// Security middleware
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP"
});

app.use('/api/', limiter);
```

### 3. Smart Contract Security

```solidity
// Security patterns implemented
contract ESGStablecoin is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;
    
    modifier onlyAuthorized() {
        require(authorizedUsers[msg.sender], "Unauthorized");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount > 0 && amount <= MAX_AMOUNT, "Invalid amount");
        _;
    }
    
    function emergencyPause() external onlyOwner {
        _pause();
        emit EmergencyPause(msg.sender, block.timestamp);
    }
}
```

## Disaster Recovery

### 1. Backup Strategy

```bash
#!/bin/bash
# Comprehensive backup script

# Database backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > /backups/db/esg_platform_$(date +%Y%m%d_%H%M%S).sql.gz

# Configuration backup
tar -czf /backups/config/config_$(date +%Y%m%d).tar.gz /etc/nginx /app/config

# Smart contract artifacts
tar -czf /backups/contracts/artifacts_$(date +%Y%m%d).tar.gz /app/artifacts /app/deployments

# Upload to S3
aws s3 sync /backups s3://unykorn-backups/$(date +%Y/%m/%d)/ --delete
```

### 2. Recovery Procedures

```bash
#!/bin/bash
# Disaster recovery script

echo "🚨 Starting disaster recovery process..."

# Deploy new infrastructure
terraform init
terraform apply -var-file="disaster-recovery.tfvars"

# Restore database
gunzip -c /backups/db/latest.sql.gz | psql -h $NEW_DB_HOST -U $DB_USER $DB_NAME

# Redeploy contracts if needed
npm run deploy:recovery

# Update DNS records
aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file://recovery-dns.json

# Verify recovery
npm run test:recovery

echo "✅ Disaster recovery completed"
```

### 3. Emergency Contacts

**24/7 Emergency Response Team:**
- Technical Lead: +1-xxx-xxx-xxxx
- DevOps Lead: +1-xxx-xxx-xxxx  
- Security Lead: +1-xxx-xxx-xxxx
- Project Manager: +1-xxx-xxx-xxxx

**Escalation Matrix:**
1. Level 1: System degradation (< 30 minutes)
2. Level 2: Service outage (< 15 minutes)
3. Level 3: Security incident (< 5 minutes)
4. Level 4: Data breach (Immediate)

---

## Deployment Timeline

### Phase 1: Development (2 weeks)
- [ ] Local environment setup
- [ ] Contract development and testing
- [ ] API development
- [ ] Unit test implementation

### Phase 2: Testnet (1 week)
- [ ] Testnet deployment
- [ ] Integration testing
- [ ] Security audit preparation
- [ ] Documentation finalization

### Phase 3: Security Audit (2 weeks)
- [ ] External security audit
- [ ] Penetration testing
- [ ] Code review and fixes
- [ ] Re-audit if needed

### Phase 4: Mainnet Preparation (1 week)
- [ ] Production infrastructure setup
- [ ] Monitoring system deployment
- [ ] Backup procedures testing
- [ ] Team training

### Phase 5: Mainnet Launch (1 day)
- [ ] Final deployment
- [ ] System verification
- [ ] Performance monitoring
- [ ] Launch announcement

---

*This deployment guide is regularly updated. For the latest version and support, contact the Unykorn technical team.*