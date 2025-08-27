#!/usr/bin/env node
/**
 * IPFS Upload Script for Audit Reports
 * Uploads audit reports to IPFS and prepares for NFT minting
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const axios = require('axios');

// Load environment variables
require('dotenv').config();

class AuditReportIPFSUploader {
    constructor() {
        this.uploadedFiles = {};
        this.pinataJWT = process.env.PINATA_JWT;
        this.usePinata = true; // Always use Pinata for simplicity
    }

    async initialize() {
        console.log("🌐 INITIALIZING IPFS AUDIT REPORT UPLOADER");
        console.log("==========================================\n");

        if (!this.pinataJWT) {
            console.log("❌ No Pinata JWT found. Please set PINATA_JWT in .env");
            throw new Error("PINATA_JWT environment variable required");
        }

        console.log("✅ Using Pinata IPFS service");
        console.log("   Pinata JWT configured\n");
        return true;
    }

    /**
     * Generate SHA-256 hash of file content
     */
    generateFileHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }


    /**
     * Upload file to IPFS using Pinata service
     */
    async uploadToPinata(filePath, content) {
        try {
            const formData = new FormData();
            formData.append('file', content, {
                filename: path.basename(filePath),
                contentType: 'text/markdown'
            });

            const pinataMetadata = JSON.stringify({
                name: path.basename(filePath),
                description: 'Unykorn Audit Report',
                tags: ['audit', 'unykorn', 'esg', 'appraisal']
            });
            formData.append('pinataMetadata', pinataMetadata);

            const pinataOptions = JSON.stringify({
                cidVersion: 1
            });
            formData.append('pinataOptions', pinataOptions);

            const response = await axios.post(
                'https://api.pinata.cloud/pinning/pinFileToIPFS',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${this.pinataJWT}`
                    }
                }
            );

            return response.data.IpfsHash;
        } catch (error) {
            throw new Error(`Pinata upload failed: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Upload audit reports to IPFS
     */
    async uploadAuditReports() {
        console.log("📄 UPLOADING AUDIT REPORTS TO IPFS\n");

        const reportsToUpload = [
            {
                name: 'Complete Audit Report',
                path: 'docs/UNYKORN_SYSTEM_AUDIT_REPORT.md',
                description: 'Comprehensive technical and financial audit'
            },
            {
                name: 'Appraisal Report Template',
                path: 'docs/UNYKORN_APPRAISAL_REPORT_TEMPLATE.md',
                description: 'Professional appraisal report framework'
            },
            {
                name: 'System Overview',
                path: 'UNYKORN_ESG_COMPLETE_SUMMARY.md',
                description: 'Complete system capabilities overview'
            },
            {
                name: 'Audit Summary',
                path: 'docs/README_AUDIT_SUMMARY.md',
                description: 'Executive summary of audit findings'
            }
        ];

        const uploadResults = {};

        for (const report of reportsToUpload) {
            const fullPath = path.join(process.cwd(), report.path);
            
            if (!fs.existsSync(fullPath)) {
                console.log(`⚠️ File not found: ${report.path}`);
                continue;
            }

            console.log(`📤 Uploading: ${report.name}`);
            
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const fileHash = this.generateFileHash(content);
                
                const cid = await this.uploadToPinata(fullPath, content);

                uploadResults[report.name] = {
                    path: report.path,
                    description: report.description,
                    cid: cid,
                    ipfsUrl: `https://ipfs.io/ipfs/${cid}`,
                    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
                    fileHash: fileHash,
                    size: Buffer.byteLength(content, 'utf8'),
                    uploadTime: new Date().toISOString()
                };

                console.log(`   ✅ CID: ${cid}`);
                console.log(`   🔐 Hash: ${fileHash.substring(0, 16)}...`);
                console.log(`   📏 Size: ${uploadResults[report.name].size} bytes`);
                console.log(`   🌐 URL: https://ipfs.io/ipfs/${cid}\n`);

            } catch (error) {
                console.error(`   ❌ Upload failed: ${error.message}\n`);
                uploadResults[report.name] = {
                    error: error.message,
                    path: report.path
                };
            }
        }

        return uploadResults;
    }

    /**
     * Create metadata JSON for NFT minting
     */
    async createNFTMetadata(uploadResults) {
        console.log("🎨 CREATING NFT METADATA\n");

        const mainAuditReport = uploadResults['Complete Audit Report'];
        if (!mainAuditReport || mainAuditReport.error) {
            throw new Error("Main audit report upload failed - cannot create NFT metadata");
        }

        const metadata = {
            name: "Unykorn System Audit Proof #1",
            description: "Professional audit and appraisal of the Unykorn ESG tokenization and IP protection platform. Valued at $685M through comprehensive technical, regulatory, and financial analysis.",
            image: `ipfs://${mainAuditReport.cid}`,
            external_url: `https://ipfs.io/ipfs/${mainAuditReport.cid}`,
            attributes: [
                {
                    trait_type: "Report Type",
                    value: "Comprehensive System Audit"
                },
                {
                    trait_type: "Appraised Value",
                    value: "$685,000,000"
                },
                {
                    trait_type: "Audit Date",
                    value: "2025-08-26"
                },
                {
                    trait_type: "Technical Grade",
                    value: "A+ (9.2/10)"
                },
                {
                    trait_type: "Compliance Score",
                    value: "85% - Investment Grade"
                },
                {
                    trait_type: "Security Rating",
                    value: "A (8.8/10)"
                },
                {
                    trait_type: "Business Model",
                    value: "SaaS - High Margin"
                },
                {
                    trait_type: "Market Opportunity",
                    value: "$52T+ TAM"
                }
            ],
            properties: {
                category: "Professional Audit",
                valuation_method: "Three-Method Approach",
                report_cid: mainAuditReport.cid,
                document_hash: mainAuditReport.fileHash,
                audit_firm: "Professional Technical Analysis",
                compliance_frameworks: ["ISO 20022", "Basel III/IV", "SEC", "FATF", "GDPR"],
                supporting_documents: Object.keys(uploadResults).filter(key => 
                    uploadResults[key].cid && key !== 'Complete Audit Report'
                ).map(key => ({
                    name: key,
                    cid: uploadResults[key].cid,
                    hash: uploadResults[key].fileHash
                }))
            }
        };

        // Upload metadata to IPFS
        const metadataContent = JSON.stringify(metadata, null, 2);
        let metadataCID;

        try {
            metadataCID = await this.uploadToPinata('nft-metadata.json', metadataContent);

            console.log("✅ NFT Metadata uploaded to IPFS");
            console.log(`   CID: ${metadataCID}`);
            console.log(`   URL: https://ipfs.io/ipfs/${metadataCID}\n`);

            return {
                metadata,
                cid: metadataCID,
                url: `https://ipfs.io/ipfs/${metadataCID}`
            };

        } catch (error) {
            console.error(`❌ Metadata upload failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save upload results for deployment scripts
     */
    async saveUploadResults(uploadResults, nftMetadata) {
        console.log("💾 SAVING UPLOAD RESULTS\n");

        const resultsData = {
            uploadTime: new Date().toISOString(),
            ipfsProvider: this.usePinata ? 'Pinata' : 'Direct IPFS',
            totalFiles: Object.keys(uploadResults).length,
            successfulUploads: Object.keys(uploadResults).filter(key => uploadResults[key].cid).length,
            reports: uploadResults,
            nftMetadata: nftMetadata,
            mintingData: {
                reportTitle: "Unykorn System Comprehensive Audit",
                appraisedValue: "685000000000000000000000000", // $685M in wei (scaled by 1e18)
                ipfsCID: nftMetadata.cid,
                documentHash: "0x" + uploadResults['Complete Audit Report']?.fileHash,
                auditFirm: "Professional Technical Analysis"
            }
        };

        // Ensure directories exist
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const resultsPath = path.join(uploadsDir, 'ipfs-audit-upload-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));

        console.log(`✅ Upload results saved: ${resultsPath}`);
        return resultsData;
    }

    /**
     * Generate deployment summary
     */
    generateDeploymentSummary(resultsData) {
        console.log("\n📋 IPFS UPLOAD SUMMARY");
        console.log("=====================\n");

        console.log("🎯 Upload Statistics:");
        console.log(`   • Total files: ${resultsData.totalFiles}`);
        console.log(`   • Successful: ${resultsData.successfulUploads}`);
        console.log(`   • Provider: ${resultsData.ipfsProvider}`);
        console.log(`   • Upload time: ${resultsData.uploadTime}\n`);

        console.log("📄 Uploaded Reports:");
        Object.entries(resultsData.reports).forEach(([name, data]) => {
            if (data.cid) {
                console.log(`   ✅ ${name}`);
                console.log(`      CID: ${data.cid}`);
                console.log(`      URL: ${data.ipfsUrl}`);
            } else {
                console.log(`   ❌ ${name}: ${data.error}`);
            }
        });

        console.log("\n🎨 NFT Metadata:");
        console.log(`   • CID: ${resultsData.nftMetadata.cid}`);
        console.log(`   • URL: ${resultsData.nftMetadata.url}`);

        console.log("\n🔨 Ready for NFT Minting:");
        console.log(`   • Report Title: ${resultsData.mintingData.reportTitle}`);
        console.log(`   • Appraised Value: $685,000,000`);
        console.log(`   • Document Hash: ${resultsData.mintingData.documentHash}`);

        console.log("\n🚀 Next Steps:");
        console.log("   1. Deploy AuditProofNFT contract: npm run deploy:audit-proof");
        console.log("   2. Mint audit proof NFT: npm run mint:audit-proof");
        console.log("   3. Create ERC-6551 vault: npm run create:audit-vault");
        console.log("   4. Add EAS attestation: npm run create:attestation\n");

        return true;
    }

    /**
     * Complete upload process
     */
    async uploadComplete() {
        try {
            // Initialize IPFS connection
            await this.initialize();

            // Upload all audit reports
            const uploadResults = await this.uploadAuditReports();

            // Create NFT metadata
            const nftMetadata = await this.createNFTMetadata(uploadResults);

            // Save results for deployment
            const resultsData = await this.saveUploadResults(uploadResults, nftMetadata);

            // Generate summary
            this.generateDeploymentSummary(resultsData);

            return resultsData;

        } catch (error) {
            console.error("\n❌ IPFS UPLOAD FAILED:", error.message);
            throw error;
        }
    }
}

// Execute upload
async function main() {
    const uploader = new AuditReportIPFSUploader();
    await uploader.uploadComplete();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("Upload failed:", error);
            process.exit(1);
        });
}

module.exports = AuditReportIPFSUploader;