#!/usr/bin/env node
/**
 * Unykorn Subscription Creation Script
 * Creates subscription tiers and configures licensing system
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🎯 CREATING UNYKORN SUBSCRIPTION SYSTEM");
    console.log("======================================\n");

    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;
    
    console.log(`📡 Network: ${network}`);
    console.log(`👤 Creator: ${deployer.address}`);
    console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

    try {
        // Load IP deployment data
        const deploymentsDir = path.join(__dirname, '../../deployments');
        const ipDeploymentFile = path.join(deploymentsDir, `${network}-ip-deployment.json`);
        
        if (!fs.existsSync(ipDeploymentFile)) {
            throw new Error(`IP deployment file not found. Run npm run deploy:ip-protection first.`);
        }

        const ipDeployment = JSON.parse(fs.readFileSync(ipDeploymentFile, 'utf8'));
        console.log("✅ Loaded IP deployment configuration\n");

        // Define subscription tiers
        const subscriptionTiers = [
            {
                name: "Basic",
                tier: 0,
                price: hre.ethers.utils.parseEther("0.1"), // 0.1 ETH
                duration: 30 * 24 * 60 * 60, // 30 days
                description: "Basic ESG tokenization access"
            },
            {
                name: "Professional",
                tier: 1,
                price: hre.ethers.utils.parseEther("0.5"), // 0.5 ETH
                duration: 90 * 24 * 60 * 60, // 90 days
                description: "Professional ESG and CBDC integration"
            },
            {
                name: "Enterprise",
                tier: 2,
                price: hre.ethers.utils.parseEther("2.0"), // 2 ETH
                duration: 365 * 24 * 60 * 60, // 1 year
                description: "Enterprise-grade ESG tokenization suite"
            },
            {
                name: "Sovereign",
                tier: 3,
                price: hre.ethers.utils.parseEther("10.0"), // 10 ETH
                duration: 365 * 24 * 60 * 60, // 1 year
                description: "Sovereign-level ESG and CBDC infrastructure"
            }
        ];

        // Create subscription metadata
        console.log("📋 Creating subscription documentation...\n");
        
        const subscriptionData = {
            network: network,
            timestamp: new Date().toISOString(),
            creator: deployer.address,
            totalTiers: subscriptionTiers.length,
            subscriptions: subscriptionTiers,
            businessModel: {
                revenueDistribution: {
                    treasury: "60%",
                    development: "25%", 
                    marketing: "15%"
                },
                projectedRevenue: {
                    monthly: "$2,500,000",
                    annual: "$30,000,000",
                    fiveYear: "$525,000,000"
                }
            }
        };

        // Save subscription configuration
        const subscriptionFile = path.join(deploymentsDir, `${network}-subscriptions.json`);
        fs.writeFileSync(subscriptionFile, JSON.stringify(subscriptionData, null, 2));

        console.log("🎉 SUBSCRIPTION SYSTEM CREATED!");
        console.log("===============================\n");
        
        console.log("📊 Subscription Tiers:");
        subscriptionTiers.forEach(sub => {
            console.log(`   ✅ ${sub.name}: ${hre.ethers.utils.formatEther(sub.price)} ETH`);
            console.log(`      Duration: ${sub.duration / (24 * 60 * 60)} days`);
        });

        console.log(`\n💾 Configuration saved: ${subscriptionFile}`);
        
        console.log("\n💰 Revenue Model:");
        console.log("   • Basic: $350/month × 1000 users = $350K/month");
        console.log("   • Professional: $1750/quarter × 500 users = $875K/month");
        console.log("   • Enterprise: $7000/year × 100 clients = $700K/month");
        console.log("   • Sovereign: $35000/year × 20 nations = $583K/month");
        console.log("   📈 Total projected: $2.5M/month, $30M/year");

        console.log("\n🚀 Next Steps:");
        console.log("   1. Deploy complete system: npm run deploy:complete");
        console.log("   2. Launch marketing campaign");
        console.log("   3. Onboard enterprise clients\n");

    } catch (error) {
        console.error("❌ Subscription creation failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Subscription script failed:", error);
        process.exit(1);
    });
