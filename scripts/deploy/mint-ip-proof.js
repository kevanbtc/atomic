#!/usr/bin/env node
/**
 * Unykorn IP Proof NFT Minting Script
 * Mints the official IP ownership proof NFT with audit data
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🎨 MINTING UNYKORN IP PROOF NFT");
    console.log("===============================\n");

    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;
    
    console.log(`📡 Network: ${network}`);
    console.log(`👤 Minter: ${deployer.address}`);
    console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

    try {
        // Load deployment data
        const deploymentsDir = path.join(__dirname, '../../deployments');
        const ipDeploymentFile = path.join(deploymentsDir, `${network}-ip-deployment.json`);
        
        if (!fs.existsSync(ipDeploymentFile)) {
            throw new Error(`IP deployment file not found: ${ipDeploymentFile}. Run npm run deploy:ip-protection first.`);
        }

        const ipDeployment = JSON.parse(fs.readFileSync(ipDeploymentFile, 'utf8'));
        console.log("✅ Loaded IP deployment configuration\n");

        // Load IPFS upload results if available
        const uploadsDir = path.join(__dirname, '../../uploads');
        const uploadResultsFile = path.join(uploadsDir, 'ipfs-audit-upload-results.json');
        
        let mintingData = {
            reportTitle: "Unykorn System Comprehensive Audit",
            appraisedValue: "685000000000000000000000000", // $685M in wei
            ipfsCID: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            documentHash: "0x" + "a".repeat(64), // Placeholder
            auditFirm: "Professional Technical Analysis"
        };

        if (fs.existsExists(uploadResultsFile)) {
            const uploadResults = JSON.parse(fs.readFileSync(uploadResultsFile, 'utf8'));
            mintingData = uploadResults.mintingData;
            console.log("✅ Using IPFS upload results for minting data");
        } else {
            console.log("⚠️ IPFS results not found, using placeholder data");
        }

        console.log("📋 Minting Data:");
        console.log(`   • Report: ${mintingData.reportTitle}`);
        console.log(`   • Value: $685,000,000`);
        console.log(`   • IPFS: ${mintingData.ipfsCID}`);
        console.log(`   • Hash: ${mintingData.documentHash}`);
        console.log(`   • Firm: ${mintingData.auditFirm}\n`);

        // Get contract instance
        const ESGProof = await hre.ethers.getContractFactory("UnykornESGProof");
        const esgProof = ESGProof.attach(ipDeployment.contracts.UnykornESGProof);
        
        console.log(`📄 Connected to UnykornESGProof: ${esgProof.address}`);

        // Check if we have minter role
        const minterRole = await esgProof.MINTER_ROLE();
        const hasMinterRole = await esgProof.hasRole(minterRole, deployer.address);
        
        if (!hasMinterRole) {
            console.log("❌ Deployer does not have minter role. Attempting to grant...");
            // If we're the owner, we can grant ourselves the role
            try {
                await esgProof.grantRole(minterRole, deployer.address);
                console.log("✅ Minter role granted");
            } catch (error) {
                throw new Error("Cannot grant minter role. Check contract ownership.");
            }
        } else {
            console.log("✅ Minter role verified");
        }

        // Mint the IP proof NFT
        console.log("\n🎯 Minting IP Proof NFT...");
        
        const mintTx = await esgProof.mintAuditProof(
            deployer.address, // recipient
            mintingData.reportTitle,
            mintingData.appraisedValue,
            mintingData.ipfsCID,
            mintingData.documentHash,
            mintingData.auditFirm
        );

        console.log(`🔄 Transaction submitted: ${mintTx.hash}`);
        const receipt = await mintTx.wait();
        
        // Find the minted token ID from events
        const mintEvent = receipt.events?.find(e => e.event === 'Transfer');
        const tokenId = mintEvent?.args?.tokenId;

        console.log(`✅ NFT minted successfully!`);
        console.log(`   • Token ID: ${tokenId}`);
        console.log(`   • Transaction: ${mintTx.hash}`);
        console.log(`   • Gas Used: ${receipt.gasUsed.toString()}\n`);

        // Save minting results
        const mintingResults = {
            network: network,
            timestamp: new Date().toISOString(),
            minter: deployer.address,
            contractAddress: esgProof.address,
            tokenId: tokenId.toString(),
            transactionHash: mintTx.hash,
            gasUsed: receipt.gasUsed.toString(),
            mintingData: mintingData
        };

        const mintingFile = path.join(deploymentsDir, `${network}-ip-minting.json`);
        fs.writeFileSync(mintingFile, JSON.stringify(mintingResults, null, 2));

        console.log(`\n💾 Minting results saved: ${mintingFile}`);
        
        console.log("\n🎉 IP PROOF NFT MINTED SUCCESSFULLY!");
        console.log("==================================");

    } catch (error) {
        console.error("❌ NFT minting failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Minting script failed:", error);
        process.exit(1);
    });
