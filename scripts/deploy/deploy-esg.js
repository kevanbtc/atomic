#!/usr/bin/env node
/**
 * Unykorn ESG System Deployment Script
 * Deploys the complete ESG tokenization and CBDC bridge system
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🌱 DEPLOYING UNYKORN ESG TOKENIZATION SYSTEM");
    console.log("=============================================\n");

    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;
    
    console.log(`📡 Network: ${network}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

    const deployments = {};
    
    try {
        // Deploy WaterVault
        console.log("💧 Deploying WaterVault...");
        const WaterVault = await hre.ethers.getContractFactory("WaterVault");
        const waterVault = await WaterVault.deploy();
        await waterVault.deployed();
        console.log(`✅ WaterVault deployed: ${waterVault.address}\n`);
        deployments.WaterVault = waterVault.address;

        // Deploy CarbonVault
        console.log("🌿 Deploying CarbonVault...");
        const CarbonVault = await hre.ethers.getContractFactory("CarbonVault");
        const carbonVault = await CarbonVault.deploy();
        await carbonVault.deployed();
        console.log(`✅ CarbonVault deployed: ${carbonVault.address}\n`);
        deployments.CarbonVault = carbonVault.address;

        // Deploy ESG Stablecoin
        console.log("🏛️ Deploying ESGStablecoin...");
        const ESGStablecoin = await hre.ethers.getContractFactory("ESGStablecoin");
        const esgStablecoin = await ESGStablecoin.deploy(
            "Unykorn ESG Stablecoin",
            "UESG",
            waterVault.address,
            carbonVault.address
        );
        await esgStablecoin.deployed();
        console.log(`✅ ESGStablecoin deployed: ${esgStablecoin.address}\n`);
        deployments.ESGStablecoin = esgStablecoin.address;

        // Deploy mock CBDC Validator for demonstration
        console.log("🔐 Deploying Mock CBDC Validator...");
        const MockCBDCValidator = await hre.ethers.getContractFactory("MockCBDCValidator");
        const cbdcValidator = await MockCBDCValidator.deploy();
        await cbdcValidator.deployed();
        console.log(`✅ MockCBDCValidator deployed: ${cbdcValidator.address}\n`);
        deployments.MockCBDCValidator = cbdcValidator.address;

        // Deploy CBDC Bridge
        console.log("🌉 Deploying CBDCBridge...");
        const CBDCBridge = await hre.ethers.getContractFactory("CBDCBridge");
        const cbdcBridge = await CBDCBridge.deploy(cbdcValidator.address);
        await cbdcBridge.deployed();
        console.log(`✅ CBDCBridge deployed: ${cbdcBridge.address}\n`);
        deployments.CBDCBridge = cbdcBridge.address;

        // Setup initial configuration
        console.log("⚙️ Setting up initial configuration...");
        
        // Add CBDC Bridge as authorized minter for stablecoin
        await esgStablecoin.grantRole(await esgStablecoin.MINTER_ROLE(), cbdcBridge.address);
        console.log("✅ CBDCBridge granted minter role");

        // Set token limits on bridge (10M daily limit)
        const dailyLimit = hre.ethers.utils.parseEther("10000000");
        await cbdcBridge.setTokenLimit(esgStablecoin.address, dailyLimit);
        console.log("✅ Daily limits set on bridge");

        // Authorize ESG stablecoin as valid CBDC
        await cbdcValidator.addAuthorizedCBDC(esgStablecoin.address);
        console.log("✅ ESG stablecoin authorized for bridging\n");

        // Save deployment info
        const deploymentData = {
            network: network,
            chainId: await hre.ethers.provider.getNetwork().then(n => n.chainId),
            timestamp: new Date().toISOString(),
            deployer: deployer.address,
            gasUsed: "Calculating...",
            contracts: deployments,
            configuration: {
                dailyBridgeLimit: dailyLimit.toString(),
                stablecoinMinters: [cbdcBridge.address],
                authorizedCBDCs: [esgStablecoin.address]
            }
        };

        // Ensure deployments directory exists
        const deploymentsDir = path.join(__dirname, '../../deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentFile = path.join(deploymentsDir, `${network}-esg-deployment.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("=====================\n");
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
        console.log("   2. Deploy IP protection system: npm run deploy:ip-protection");
        console.log("   3. Create subscription tiers: npm run create:subscriptions");
        console.log("   4. Upload audit reports: npm run ipfs:upload-audit-reports\n");

    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment script failed:", error);
        process.exit(1);
    });
