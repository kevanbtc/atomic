const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ESG IP Protection System", function () {
    let deployer, creator, user1, user2, treasury;
    let esgIPProtection, vaultProofNFT, subscriptionKeyNFT, ipfsHashRegistry, pgpNotarization, sovereigntyProof;
    let mockPaymentToken, mockSovereigntyToken;

    const CONTENT_HASH_1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-content-1"));
    const CONTENT_HASH_2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-content-2"));
    const SOVEREIGNTY_PROOF = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("sovereignty-proof-1"));
    const PGP_SIGNATURE = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("pgp-signature-data"));
    
    beforeEach(async function () {
        [deployer, creator, user1, user2, treasury] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockPaymentToken = await MockERC20.deploy("Test Payment Token", "TPT", ethers.utils.parseEther("1000000"));
        mockSovereigntyToken = await MockERC20.deploy("Test Sovereignty Token", "TST", ethers.utils.parseEther("1000000"));
        
        // Distribute tokens for testing
        await mockPaymentToken.transfer(creator.address, ethers.utils.parseEther("10000"));
        await mockPaymentToken.transfer(user1.address, ethers.utils.parseEther("10000"));
        await mockPaymentToken.transfer(user2.address, ethers.utils.parseEther("10000"));
        
        await mockSovereigntyToken.transfer(creator.address, ethers.utils.parseEther("100000"));
        await mockSovereigntyToken.transfer(user1.address, ethers.utils.parseEther("50000"));

        // Deploy core contracts
        const SovereigntyProof = await ethers.getContractFactory("SovereigntyProof");
        sovereigntyProof = await SovereigntyProof.deploy(mockSovereigntyToken.address, treasury.address);

        const PGPNotarization = await ethers.getContractFactory("PGPNotarization");
        pgpNotarization = await PGPNotarization.deploy();

        const IPFSHashRegistry = await ethers.getContractFactory("IPFSHashRegistry");
        ipfsHashRegistry = await IPFSHashRegistry.deploy();

        const VaultProofNFT = await ethers.getContractFactory("VaultProofNFT");
        vaultProofNFT = await VaultProofNFT.deploy(
            "ESG Vault Proof",
            "ESGVP",
            treasury.address,
            sovereigntyProof.address
        );

        const SubscriptionKeyNFT = await ethers.getContractFactory("SubscriptionKeyNFT");
        subscriptionKeyNFT = await SubscriptionKeyNFT.deploy(
            "https://api.test.com/metadata/",
            mockPaymentToken.address,
            treasury.address
        );

        const ESGIPProtection = await ethers.getContractFactory("ESGIPProtection");
        esgIPProtection = await ESGIPProtection.deploy(
            vaultProofNFT.address,
            subscriptionKeyNFT.address,
            ipfsHashRegistry.address,
            pgpNotarization.address,
            sovereigntyProof.address,
            mockPaymentToken.address,
            treasury.address
        );

        // Grant necessary roles
        await vaultProofNFT.grantRole(await vaultProofNFT.MINTER_ROLE(), esgIPProtection.address);
        await subscriptionKeyNFT.grantRole(await subscriptionKeyNFT.MINTER_ROLE(), esgIPProtection.address);
        await ipfsHashRegistry.grantRole(await ipfsHashRegistry.REGISTRAR_ROLE(), esgIPProtection.address);
        await sovereigntyProof.grantRole(await sovereigntyProof.SOVEREIGNTY_VALIDATOR_ROLE(), esgIPProtection.address);

        // Approve tokens for contracts
        await mockPaymentToken.connect(creator).approve(subscriptionKeyNFT.address, ethers.utils.parseEther("10000"));
        await mockPaymentToken.connect(user1).approve(subscriptionKeyNFT.address, ethers.utils.parseEther("10000"));
        await mockSovereigntyToken.connect(creator).approve(sovereigntyProof.address, ethers.utils.parseEther("100000"));
        await mockSovereigntyToken.connect(user1).approve(sovereigntyProof.address, ethers.utils.parseEther("50000"));
    });

    describe("System Integration", function () {
        it("Should deploy all contracts successfully", async function () {
            expect(await esgIPProtection.vaultProofNFT()).to.equal(vaultProofNFT.address);
            expect(await esgIPProtection.subscriptionKeyNFT()).to.equal(subscriptionKeyNFT.address);
            expect(await esgIPProtection.ipfsHashRegistry()).to.equal(ipfsHashRegistry.address);
            expect(await esgIPProtection.pgpNotarization()).to.equal(pgpNotarization.address);
            expect(await esgIPProtection.sovereigntyProof()).to.equal(sovereigntyProof.address);
        });

        it("Should have correct role assignments", async function () {
            const MINTER_ROLE = await vaultProofNFT.MINTER_ROLE();
            expect(await vaultProofNFT.hasRole(MINTER_ROLE, esgIPProtection.address)).to.be.true;
            
            const SUBSCRIPTION_MINTER_ROLE = await subscriptionKeyNFT.MINTER_ROLE();
            expect(await subscriptionKeyNFT.hasRole(SUBSCRIPTION_MINTER_ROLE, esgIPProtection.address)).to.be.true;
        });
    });

    describe("Sovereignty System", function () {
        it("Should establish basic sovereignty", async function () {
            const identityId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("creator-identity"));
            
            await sovereigntyProof.connect(creator).establishSovereignty(
                identityId,
                1, // Basic level
                "US",
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentials"))
            );

            const [sovereignAddress, level, stakeAmount, , isActive] = await sovereigntyProof.getSovereigntyInfo(identityId);
            expect(sovereignAddress).to.equal(creator.address);
            expect(level).to.equal(1);
            expect(isActive).to.be.true;
        });

        it("Should upgrade sovereignty level", async function () {
            const identityId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("creator-identity"));
            
            // Establish basic sovereignty first
            await sovereigntyProof.connect(creator).establishSovereignty(
                identityId,
                1, // Basic level
                "US",
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentials"))
            );

            // Upgrade to enhanced level
            await sovereigntyProof.connect(creator).upgradeSovereignty(identityId, 3); // Enhanced level

            const [, level] = await sovereigntyProof.getSovereigntyInfo(identityId);
            expect(level).to.equal(3);
        });
    });

    describe("Subscription System", function () {
        it("Should purchase Bronze subscription", async function () {
            const balanceBefore = await mockPaymentToken.balanceOf(creator.address);
            
            await subscriptionKeyNFT.connect(creator).purchaseSubscription(1, ethers.constants.AddressZero);
            
            const subscription = await subscriptionKeyNFT.userSubscriptions(creator.address);
            expect(subscription.tier).to.equal(1);
            expect(subscription.isActive).to.be.true;
            
            const balanceAfter = await mockPaymentToken.balanceOf(creator.address);
            expect(balanceBefore.sub(balanceAfter)).to.equal(ethers.utils.parseEther("199"));
        });

        it("Should purchase Gold subscription with referral", async function () {
            // User1 purchases first (will be referrer)
            await subscriptionKeyNFT.connect(user1).purchaseSubscription(1, ethers.constants.AddressZero);
            
            const user2BalanceBefore = await mockPaymentToken.balanceOf(user2.address);
            const user1BalanceBefore = await mockPaymentToken.balanceOf(user1.address);
            
            // User2 purchases with user1 as referrer
            await subscriptionKeyNFT.connect(user2).purchaseSubscription(3, user1.address); // Gold tier
            
            const subscription = await subscriptionKeyNFT.userSubscriptions(user2.address);
            expect(subscription.tier).to.equal(3);
            expect(subscription.referrer).to.equal(user1.address);
            
            // Check referral reward (5% of 1999 = ~100 tokens)
            const user1BalanceAfter = await mockPaymentToken.balanceOf(user1.address);
            const referralReward = user1BalanceAfter.sub(user1BalanceBefore);
            expect(referralReward).to.be.gt(ethers.utils.parseEther("99")); // 5% of 1999
        });

        it("Should check subscription status", async function () {
            await subscriptionKeyNFT.connect(user1).purchaseSubscription(2, ethers.constants.AddressZero); // Silver
            
            expect(await subscriptionKeyNFT.hasActiveSubscription(user1.address)).to.be.true;
            expect(await subscriptionKeyNFT.getUserAccessLevel(user1.address)).to.equal(2);
        });
    });

    describe("Content Registration and Protection", function () {
        beforeEach(async function () {
            // Establish sovereignty for creator
            const identityId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("creator-identity"));
            await sovereigntyProof.connect(creator).establishSovereignty(
                identityId,
                2, // Verified level
                "US",
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentials"))
            );
        });

        it("Should create IP protection package", async function () {
            const proofMetadata = {
                contentHash: CONTENT_HASH_1,
                manifestHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("manifest")),
                pgpSignature: PGP_SIGNATURE,
                sovereigntyProof: SOVEREIGNTY_PROOF,
                creationTimestamp: 0, // Will be set by contract
                lastUpdate: 0,
                creator: creator.address,
                isTransferable: true,
                expiryTimestamp: 0,
                jurisdiction: "US",
                protectionLevel: 2
            };

            const manifest = {
                contentHashes: ["QmTest1", "QmTest2"],
                descriptions: ["Description 1", "Description 2"],
                versions: [1, 1],
                merkleRoot: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("merkle")),
                totalSize: 1024,
                encryptionMethod: "AES-256"
            };

            const license = {
                licenseType: 1, // Commercial
                duration: 0, // Perpetual
                price: ethers.utils.parseEther("10"),
                paymentToken: ethers.constants.AddressZero,
                restrictions: ["No redistribution"],
                isExclusive: false
            };

            const royalty = {
                recipient: creator.address,
                feeNumerator: 500, // 5%
                isActive: true
            };

            const revenueDistribution = [
                {
                    recipient: creator.address,
                    percentage: 8000, // 80%
                    role: "Creator",
                    isActive: true
                }
            ];

            const packageId = await esgIPProtection.connect(creator).callStatic.createIPProtectionPackage(
                "Test Package",
                0, // Individual type
                2, // Silver tier required
                [CONTENT_HASH_1, CONTENT_HASH_2],
                "https://metadata.test.com/1",
                proofMetadata,
                manifest,
                license,
                royalty,
                revenueDistribution
            );

            await esgIPProtection.connect(creator).createIPProtectionPackage(
                "Test Package",
                0, // Individual type
                2, // Silver tier required
                [CONTENT_HASH_1, CONTENT_HASH_2],
                "https://metadata.test.com/1",
                proofMetadata,
                manifest,
                license,
                royalty,
                revenueDistribution
            );

            const [packageInfo] = await esgIPProtection.getPackageInfo(packageId);
            expect(packageInfo.packageName).to.equal("Test Package");
            expect(packageInfo.creator).to.equal(creator.address);
            expect(packageInfo.subscriptionTier).to.equal(2);
            expect(packageInfo.isActive).to.be.true;
        });

        it("Should register content in IPFS registry", async function () {
            await ipfsHashRegistry.connect(deployer).registerContent(
                CONTENT_HASH_1,
                "application/json",
                1024,
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("metadata")),
                ["test", "content"],
                1 // Basic access level
            );

            const [contentRecord] = await ipfsHashRegistry.getContentInfo(CONTENT_HASH_1);
            expect(contentRecord.ipfsHash).to.equal(CONTENT_HASH_1);
            expect(contentRecord.contentType).to.equal("application/json");
            expect(contentRecord.isActive).to.be.true;
        });
    });

    describe("Access Control and Content Access", function () {
        let packageId;

        beforeEach(async function () {
            // Setup sovereignty
            const identityId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("creator-identity"));
            await sovereigntyProof.connect(creator).establishSovereignty(
                identityId,
                2,
                "US",
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentials"))
            );

            // Create protection package
            const proofMetadata = {
                contentHash: CONTENT_HASH_1,
                manifestHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("manifest")),
                pgpSignature: PGP_SIGNATURE,
                sovereigntyProof: SOVEREIGNTY_PROOF,
                creationTimestamp: 0,
                lastUpdate: 0,
                creator: creator.address,
                isTransferable: true,
                expiryTimestamp: 0,
                jurisdiction: "US",
                protectionLevel: 2
            };

            const manifest = {
                contentHashes: ["QmTest1"],
                descriptions: ["Description 1"],
                versions: [1],
                merkleRoot: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("merkle")),
                totalSize: 1024,
                encryptionMethod: "AES-256"
            };

            const license = {
                licenseType: 1,
                duration: 0,
                price: ethers.utils.parseEther("10"),
                paymentToken: ethers.constants.AddressZero,
                restrictions: ["No redistribution"],
                isExclusive: false
            };

            const royalty = {
                recipient: creator.address,
                feeNumerator: 500,
                isActive: true
            };

            packageId = await esgIPProtection.connect(creator).callStatic.createIPProtectionPackage(
                "Test Package",
                0,
                2,
                [CONTENT_HASH_1],
                "https://metadata.test.com/1",
                proofMetadata,
                manifest,
                license,
                royalty,
                []
            );

            await esgIPProtection.connect(creator).createIPProtectionPackage(
                "Test Package",
                0,
                2,
                [CONTENT_HASH_1],
                "https://metadata.test.com/1",
                proofMetadata,
                manifest,
                license,
                royalty,
                []
            );
        });

        it("Should allow content access with valid subscription", async function () {
            // User1 purchases Silver subscription (tier 2)
            await subscriptionKeyNFT.connect(user1).purchaseSubscription(2, ethers.constants.AddressZero);
            
            // Grant license to user1
            const [packageInfo] = await esgIPProtection.getPackageInfo(packageId);
            await vaultProofNFT.connect(creator).grantLicense(
                packageInfo.vaultProofTokenId,
                user1.address,
                0 // Use default price
            );

            // User1 should be able to access content
            await expect(
                esgIPProtection.connect(user1).accessProtectedContent(packageId, CONTENT_HASH_1)
            ).to.not.be.reverted;
        });

        it("Should deny content access without subscription", async function () {
            // User1 has no subscription, should be denied access
            await expect(
                esgIPProtection.connect(user1).accessProtectedContent(packageId, CONTENT_HASH_1)
            ).to.be.revertedWith("ESGIPProtection: No active subscription");
        });

        it("Should deny content access with insufficient subscription tier", async function () {
            // User1 purchases Bronze subscription (tier 1) but needs Silver (tier 2)
            await subscriptionKeyNFT.connect(user1).purchaseSubscription(1, ethers.constants.AddressZero);
            
            await expect(
                esgIPProtection.connect(user1).accessProtectedContent(packageId, CONTENT_HASH_1)
            ).to.be.revertedWith("ESGIPProtection: Insufficient subscription tier");
        });
    });

    describe("PGP Notarization", function () {
        const TEST_KEY_ID = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key-1"));
        const TEST_PUBLIC_KEY = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("-----BEGIN PGP PUBLIC KEY-----"));

        it("Should register PGP public key", async function () {
            await pgpNotarization.connect(creator).registerPublicKey(
                TEST_KEY_ID,
                TEST_PUBLIC_KEY,
                "RSA",
                2048,
                0, // No expiration
                "test@example.com"
            );

            const publicKey = await pgpNotarization.publicKeys(TEST_KEY_ID);
            expect(publicKey.keyId).to.equal(TEST_KEY_ID);
            expect(publicKey.owner).to.equal(creator.address);
            expect(publicKey.isRevoked).to.be.false;
        });

        it("Should create and verify PGP signature", async function () {
            // Register key first
            await pgpNotarization.connect(creator).registerPublicKey(
                TEST_KEY_ID,
                TEST_PUBLIC_KEY,
                "RSA",
                2048,
                0,
                "test@example.com"
            );

            const signatureId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("signature-1"));
            const documentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("document content"));
            const signatureData = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("signature-bytes"));

            await pgpNotarization.connect(creator).createSignature(
                signatureId,
                TEST_KEY_ID,
                signatureData,
                documentHash,
                "binary",
                1, // SHA-256
                "Document authentication"
            );

            const signature = await pgpNotarization.signatures(signatureId);
            expect(signature.keyId).to.equal(TEST_KEY_ID);
            expect(signature.signer).to.equal(creator.address);
            expect(signature.isValid).to.be.true;
        });
    });

    describe("Revenue Distribution", function () {
        it("Should distribute subscription revenue", async function () {
            // Add revenue recipients
            await subscriptionKeyNFT.addRevenueRecipient(creator.address, 6000, "Creator"); // 60%
            await subscriptionKeyNFT.addRevenueRecipient(treasury.address, 2500, "Platform"); // 25%

            const treasuryBalanceBefore = await mockPaymentToken.balanceOf(treasury.address);
            const creatorBalanceBefore = await mockPaymentToken.balanceOf(creator.address);

            // User purchases subscription
            await subscriptionKeyNFT.connect(user1).purchaseSubscription(2, ethers.constants.AddressZero); // Silver: 499 tokens

            // Distribute revenue
            await subscriptionKeyNFT.distributeRevenue();

            const treasuryBalanceAfter = await mockPaymentToken.balanceOf(treasury.address);
            const creatorBalanceAfter = await mockPaymentToken.balanceOf(creator.address);

            // Check revenue distribution (should receive portions of the 499 tokens)
            expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.be.gt(ethers.utils.parseEther("100"));
            expect(creatorBalanceAfter.sub(creatorBalanceBefore)).to.be.gt(ethers.utils.parseEther("200"));
        });
    });

    describe("Emergency Controls", function () {
        it("Should pause system in emergency", async function () {
            await esgIPProtection.pause();
            
            await expect(
                esgIPProtection.connect(creator).createIPProtectionPackage(
                    "Test",
                    0,
                    1,
                    [CONTENT_HASH_1],
                    "uri",
                    {
                        contentHash: CONTENT_HASH_1,
                        manifestHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("manifest")),
                        pgpSignature: PGP_SIGNATURE,
                        sovereigntyProof: SOVEREIGNTY_PROOF,
                        creationTimestamp: 0,
                        lastUpdate: 0,
                        creator: creator.address,
                        isTransferable: true,
                        expiryTimestamp: 0,
                        jurisdiction: "US",
                        protectionLevel: 1
                    },
                    {
                        contentHashes: ["QmTest"],
                        descriptions: ["Desc"],
                        versions: [1],
                        merkleRoot: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("merkle")),
                        totalSize: 1024,
                        encryptionMethod: "AES"
                    },
                    {
                        licenseType: 1,
                        duration: 0,
                        price: 0,
                        paymentToken: ethers.constants.AddressZero,
                        restrictions: [],
                        isExclusive: false
                    },
                    {
                        recipient: creator.address,
                        feeNumerator: 500,
                        isActive: true
                    },
                    []
                )
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should unpause system", async function () {
            await esgIPProtection.pause();
            await esgIPProtection.unpause();
            
            // System should be operational again
            expect(await esgIPProtection.paused()).to.be.false;
        });
    });

    describe("Content Protection Status", function () {
        it("Should check if content is protected", async function () {
            const [isProtected, packageId] = await esgIPProtection.isContentProtected(CONTENT_HASH_1);
            expect(isProtected).to.be.false;
            expect(packageId).to.equal(0);
        });

        it("Should return creator's packages", async function () {
            const packages = await esgIPProtection.getCreatorPackages(creator.address);
            expect(packages.length).to.equal(0);
        });
    });
});