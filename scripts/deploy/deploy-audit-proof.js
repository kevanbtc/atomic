#!/usr/bin/env node
/**
 * Unykorn Audit Proof NFT Contract Deployment Script
 * Deploys a standalone contract specifically for audit proof NFTs
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("📜 DEPLOYING AUDIT PROOF NFT CONTRACT");
    console.log("====================================\n");

    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;
    
    console.log(`📡 Network: ${network}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

    const deployments = {};
    
    try {
        // Check if we have IPFS upload results
        const uploadsDir = path.join(__dirname, '../../uploads');
        const uploadResultsFile = path.join(uploadsDir, 'ipfs-audit-upload-results.json');
        
        let ipfsCID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        let documentHash = "0x" + "a".repeat(64);
        
        if (fs.existsSync(uploadResultsFile)) {
            const uploadResults = JSON.parse(fs.readFileSync(uploadResultsFile, 'utf8'));
            ipfsCID = uploadResults.mintingData.ipfsCID;
            documentHash = uploadResults.mintingData.documentHash;
            console.log("✅ Using IPFS upload results");
        } else {
            console.log("⚠️ Using placeholder IPFS data");
        }

        // Deploy AuditProofNFT contract (simplified version)
        console.log("🏆 Deploying simplified AuditProofNFT...");
        
        // For this demo, we'll use the ESGProof contract as the audit proof
        // In a real scenario, you might have a separate AuditProofNFT contract
        const ESGProof = await hre.ethers.getContractFactory("UnykornESGProof");
        
        // We need to deploy a sovereignty registry first for the ESGProof
        console.log("📜 Deploying UnykornSovereigntyRegistry...");
        const SovereigntyRegistry = await hre.ethers.getContractFactory("UnykornSovereigntyRegistry");
        const sovereigntyRegistry = await SovereigntyRegistry.deploy();
        await sovereigntyRegistry.deployed();
        deployments.UnykornSovereigntyRegistry = sovereigntyRegistry.address;
        
        const auditProofNFT = await ESGProof.deploy(sovereigntyRegistry.address);
        await auditProofNFT.deployed();
        console.log(`✅ AuditProofNFT deployed: ${auditProofNFT.address}\n`);
        deployments.AuditProofNFT = auditProofNFT.address;

        // Mint the initial audit proof NFT
        console.log("🎨 Minting initial audit proof NFT...");
        const mintTx = await auditProofNFT.mintAuditProof(
            deployer.address,
            "Unykorn System Comprehensive Audit",
            hre.ethers.utils.parseEther("685000000"), // $685M (scaled for demo)
            ipfsCID,
            documentHash,
            "Professional Technical Analysis"
        );
        
        const receipt = await mintTx.wait();
        const mintEvent = receipt.events?.find(e => e.event === 'Transfer');
        const tokenId = mintEvent?.args?.tokenId;

        console.log(`✅ Audit proof NFT minted!`);
        console.log(`   • Token ID: ${tokenId}`);
        console.log(`   • Transaction: ${mintTx.hash}\n`);

        // Save deployment info
        const deploymentData = {
            network: network,
            chainId: await hre.ethers.provider.getNetwork().then(n => n.chainId),
            timestamp: new Date().toISOString(),
            deployer: deployer.address,
            contracts: deployments,
            mintedNFT: {
                tokenId: tokenId.toString(),
                transactionHash: mintTx.hash,
                gasUsed: receipt.gasUsed.toString()
            }
        };

        // Ensure deployments directory exists
        const deploymentsDir = path.join(__dirname, '../../deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentFile = path.join(deploymentsDir, `${network}-audit-proof-deployment.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

        console.log("🎉 AUDIT PROOF DEPLOYMENT COMPLETE!");
        console.log("===================================\n");
        console.log("📋 Contract Address:");
        console.log(`   AuditProofNFT: ${auditProofNFT.address}`);
        console.log(`\n🎨 Minted NFT:`);
        console.log(`   Token ID: ${tokenId}`);
        console.log(`   Value: $685,000,000`);
        console.log(`\n💾 Deployment data saved: ${deploymentFile}`);

    } catch (error) {
        console.error("❌ Audit proof deployment failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Audit proof deployment script failed:", error);
        process.exit(1);
    });
