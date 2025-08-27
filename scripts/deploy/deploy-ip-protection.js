#!/usr/bin/env node
/**
 * Unykorn IP Protection System Deployment Script
 * Deploys the complete intellectual property protection and licensing system
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🛡️ DEPLOYING UNYKORN IP PROTECTION SYSTEM");
    console.log("=========================================\n");

    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;
    
    console.log(`📡 Network: ${network}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

    const deployments = {};
    
    try {
        // Deploy Sovereignty Registry first
        console.log("📜 Deploying UnykornSovereigntyRegistry...");
        const SovereigntyRegistry = await hre.ethers.getContractFactory("UnykornSovereigntyRegistry");
        const sovereigntyRegistry = await SovereigntyRegistry.deploy();
        await sovereigntyRegistry.deployed();
        console.log(`✅ UnykornSovereigntyRegistry deployed: ${sovereigntyRegistry.address}\n`);
        deployments.UnykornSovereigntyRegistry = sovereigntyRegistry.address;

        // Deploy ESG Proof NFT
        console.log("🏆 Deploying UnykornESGProof...");
        const ESGProof = await hre.ethers.getContractFactory("UnykornESGProof");
        const esgProof = await ESGProof.deploy(sovereigntyRegistry.address);
        await esgProof.deployed();
        console.log(`✅ UnykornESGProof deployed: ${esgProof.address}\n`);
        deployments.UnykornESGProof = esgProof.address;

        // Deploy License NFT System
        console.log("📄 Deploying UnykornLicenseNFT...");
        const LicenseNFT = await hre.ethers.getContractFactory("UnykornLicenseNFT");
        const licenseNFT = await LicenseNFT.deploy(
            esgProof.address,
            deployer.address, // treasury
            deployer.address, // development fund
            deployer.address  // marketing fund
        );
        await licenseNFT.deployed();
        console.log(`✅ UnykornLicenseNFT deployed: ${licenseNFT.address}\n`);
        deployments.UnykornLicenseNFT = licenseNFT.address;

        // Setup initial configuration
        console.log("⚙️ Setting up IP protection configuration...");

        // Grant minter role to deployer for initial setup
        await esgProof.grantRole(await esgProof.MINTER_ROLE(), deployer.address);
        console.log("✅ Minter role granted to deployer");

        // Set up license NFT as authorized in ESG Proof
        await esgProof.grantRole(await esgProof.MINTER_ROLE(), licenseNFT.address);
        console.log("✅ License NFT authorized as minter");

        // Register the Unykorn system in sovereignty registry
        const systemHash = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("Unykorn ESG Tokenization System"));
        await sovereigntyRegistry.registerIP(
            systemHash,
            "Unykorn ESG System",
            "Complete ESG tokenization and IP protection platform",
            "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku", // Placeholder IPFS hash
            ["US", "EU", "UK", "CA", "AU"] // Major jurisdictions
        );
        console.log("✅ Unykorn system registered in sovereignty registry");

        // Set subscription pricing (in wei)
        const subscriptionPrices = {
            basic: hre.ethers.utils.parseEther("0.1"),    // 0.1 ETH
            pro: hre.ethers.utils.parseEther("0.5"),      // 0.5 ETH
            enterprise: hre.ethers.utils.parseEther("2"), // 2 ETH
            sovereign: hre.ethers.utils.parseEther("10")  // 10 ETH
        };

        await licenseNFT.setSubscriptionPrice(0, subscriptionPrices.basic);
        await licenseNFT.setSubscriptionPrice(1, subscriptionPrices.pro);
        await licenseNFT.setSubscriptionPrice(2, subscriptionPrices.enterprise);
        await licenseNFT.setSubscriptionPrice(3, subscriptionPrices.sovereign);
        console.log("✅ Subscription pricing configured\n");

        // Save deployment info
        const deploymentData = {
            network: network,
            chainId: await hre.ethers.provider.getNetwork().then(n => n.chainId),
            timestamp: new Date().toISOString(),
            deployer: deployer.address,
            gasUsed: "Calculating...",
            contracts: deployments,
            configuration: {
                subscriptionPrices: {
                    basic: subscriptionPrices.basic.toString(),
                    pro: subscriptionPrices.pro.toString(),
                    enterprise: subscriptionPrices.enterprise.toString(),
                    sovereign: subscriptionPrices.sovereign.toString()
                },
                revenueSplit: {
                    treasury: "60%",
                    development: "25%",
                    marketing: "15%"
                },
                registeredIP: {
                    systemHash: systemHash,
                    name: "Unykorn ESG System",
                    jurisdictions: ["US", "EU", "UK", "CA", "AU"]
                }
            }
        };

        // Ensure deployments directory exists
        const deploymentsDir = path.join(__dirname, '../../deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentFile = path.join(deploymentsDir, `${network}-ip-deployment.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

        console.log("🎉 IP PROTECTION DEPLOYMENT COMPLETE!");
        console.log("====================================\n");
        console.log("📋 Contract Addresses:");
        Object.entries(deployments).forEach(([name, address]) => {
            console.log(`   ${name}: ${address}`);
        });
        console.log(`\n💾 Deployment data saved: ${deploymentFile}`);
        
        if (network !== "hardhat" && network !== "localhost") {
            console.log("\n🔍 Verification Commands:");
            Object.entries(deployments).forEach(([name, address]) => {
                console.log(`   npx hardhat verify --network ${network} ${address}`);
            });
        }

        console.log("\n🚀 Next Steps:");
        console.log("   1. Verify contracts on block explorer");
        console.log("   2. Upload system documentation: npm run ipfs:upload-audit-reports");
        console.log("   3. Mint IP proof NFT: npm run mint:ip-proof");
        console.log("   4. Create subscription offerings: npm run create:subscriptions\n");

    } catch (error) {
        console.error("❌ IP Protection deployment failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("IP Protection deployment script failed:", error);
        process.exit(1);
    });
