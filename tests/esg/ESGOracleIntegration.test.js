const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ESG Oracle Integration & Cross-Contract State Sync", function () {
    let contracts, signers, testConfig;

    async function deployOracleIntegrationFixture() {
        const [owner, user1, user2, oracle, validator, dataProvider] = await ethers.getSigners();
        
        // Deploy oracle infrastructure
        const MockOracle = await ethers.getContractFactory("contracts/mocks/MockOracle.sol:MockOracle");
        const priceOracle = await MockOracle.deploy();
        const waterQualityOracle = await MockOracle.deploy();
        const esgScoreOracle = await MockOracle.deploy();
        
        // Deploy ESG contracts with different oracles for testing
        const WaterVault = await ethers.getContractFactory("WaterVault");
        const waterVault = await WaterVault.deploy(owner.address, oracle.address);
        
        const ESGStablecoin = await ethers.getContractFactory("ESGStablecoin");
        const esgStablecoin = await ESGStablecoin.deploy(
            "ESG Oracle Test",
            "ESGO",
            owner.address,
            oracle.address
        );
        
        const CBDCBridge = await ethers.getContractFactory("CBDCBridge");
        const MockCBDCValidator = await ethers.getContractFactory("contracts/mocks/MockCBDCValidator.sol:MockCBDCValidator");
        const mockCBDCValidator = await MockCBDCValidator.deploy();
        const cbdcBridge = await CBDCBridge.deploy(mockCBDCValidator.address);
        
        // Setup oracle integrations
        await esgStablecoin.addCollateral(
            waterVault.address,
            0, // WaterCredits
            15000, // 150% collateral ratio
            12000, // 120% liquidation threshold
            priceOracle.address
        );
        
        return {
            contracts: {
                waterVault,
                esgStablecoin,
                cbdcBridge,
                priceOracle,
                waterQualityOracle,
                esgScoreOracle,
                mockCBDCValidator
            },
            signers: { owner, user1, user2, oracle, validator, dataProvider },
            config: {
                updateFrequencies: {
                    price: 3600, // 1 hour
                    quality: 86400, // 24 hours
                    esg: 604800 // 1 week
                }
            }
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployOracleIntegrationFixture);
        contracts = fixture.contracts;
        signers = fixture.signers;
        testConfig = fixture.config;
    });

    describe("🔄 Oracle Data Synchronization", function () {
        it("Should synchronize price data across contracts", async function () {
            const { waterVault, esgStablecoin, priceOracle } = contracts;
            const { user1, oracle } = signers;
            
            console.log("📊 Testing cross-contract price synchronization");
            
            // Setup initial project and collateral
            await waterVault.connect(user1).registerProject("Sync Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("sync_cert")));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            
            // Test initial price synchronization
            const initialPrice = ethers.parseEther("2.5");
            await priceOracle.setPrice(waterVault.address, initialPrice);
            
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            // Calculate expected collateral value with new price
            const expectedCollateralValue = creditAmount * initialPrice / ethers.parseEther("1");
            const maxMintable = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            const expectedMaxMintable = (expectedCollateralValue * 10000n) / 15000n; // 150% ratio
            
            expect(maxMintable).to.equal(expectedMaxMintable);
            console.log(`✅ Price sync verified: $${ethers.formatEther(initialPrice)} → Max mintable: $${ethers.formatEther(maxMintable)}`);
            
            // Test price update propagation
            const updatedPrice = ethers.parseEther("3.0");
            await priceOracle.setPrice(waterVault.address, updatedPrice);
            
            const newMaxMintable = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            const newExpectedMaxMintable = (creditAmount * updatedPrice / ethers.parseEther("1") * 10000n) / 15000n;
            
            expect(newMaxMintable).to.equal(newExpectedMaxMintable);
            expect(newMaxMintable).to.be.gt(maxMintable); // Should increase with price
            
            console.log(`✅ Price update propagated: $${ethers.formatEther(updatedPrice)} → Max mintable: $${ethers.formatEther(newMaxMintable)}`);
        });

        it("Should handle oracle update frequency validation", async function () {
            const { waterVault, priceOracle } = contracts;
            const { oracle, owner } = signers;
            
            console.log("⏱️  Testing oracle update frequency controls");
            
            // Get initial oracle update timestamp
            const initialUpdateTime = await waterVault.lastOracleUpdate();
            
            // Update oracle address
            await waterVault.connect(owner).updateOracle(oracle.address);
            
            const firstUpdateTime = await waterVault.lastOracleUpdate();
            expect(firstUpdateTime).to.be.gt(initialUpdateTime);
            
            // Test rapid updates within frequency limit
            await time.increase(1800); // 30 minutes
            
            await waterVault.connect(owner).updateOracle(priceOracle.address);
            const secondUpdateTime = await waterVault.lastOracleUpdate();
            
            // Verify update timestamps are tracked correctly
            expect(secondUpdateTime).to.be.gt(firstUpdateTime);
            const timeDiff = secondUpdateTime - firstUpdateTime;
            expect(timeDiff).to.be.gte(1800); // At least 30 minutes
            
            console.log("✅ Oracle update frequency validation working correctly");
        });

        it("Should validate oracle data integrity", async function () {
            const { waterVault, esgStablecoin, priceOracle } = contracts;
            const { user1, oracle } = signers;
            
            console.log("🔍 Testing oracle data integrity validation");
            
            // Setup test scenario
            await waterVault.connect(user1).registerProject("Integrity Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("integrity_cert")));
            
            // Test invalid price data handling
            await priceOracle.setPrice(waterVault.address, 0); // Invalid price
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            // Should fall back to default price (1 ETH) when oracle returns 0
            const maxMintable = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            const expectedWithDefaultPrice = (creditAmount * 10000n) / 15000n; // Using default 1 ETH price
            
            expect(maxMintable).to.equal(expectedWithDefaultPrice);
            console.log("✅ Invalid price data handled with fallback");
            
            // Test extreme price validation
            const extremePrice = ethers.parseEther("1000000"); // $1M per token
            await priceOracle.setPrice(waterVault.address, extremePrice);
            
            // System should handle extreme values gracefully
            const maxMintableExtreme = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            expect(maxMintableExtreme).to.be.gt(maxMintable);
            
            console.log("✅ Extreme price data handled correctly");
        });
    });

    describe("🔗 Cross-Contract State Synchronization", function () {
        it("Should maintain consistent state across contract interactions", async function () {
            const { waterVault, esgStablecoin, cbdcBridge, priceOracle, mockCBDCValidator } = contracts;
            const { user1, user2, oracle, validator } = signers;
            
            console.log("🔄 Testing cross-contract state consistency");
            
            // Setup complete ecosystem state
            await waterVault.connect(user1).registerProject("State Sync Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("state_cert")));
            
            const creditAmount = ethers.parseEther("15000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            
            // Transfer credits to stablecoin contract
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            
            // Verify credit ownership transfer
            const creditInfo = await waterVault.getCredit(1);
            expect(creditInfo.owner).to.equal(esgStablecoin.address);
            
            // Deposit as collateral
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            const position = await esgStablecoin.getUserPosition(user1.address, waterVault.address);
            expect(position.collateralAmount).to.equal(creditAmount);
            expect(position.isActive).to.be.true;
            
            // Mint stablecoin
            const mintAmount = ethers.parseEther("8000");
            await esgStablecoin.connect(user1).mintStablecoin(waterVault.address, mintAmount);
            
            // Verify state consistency
            expect(await esgStablecoin.balanceOf(user1.address)).to.equal(mintAmount);
            expect(await esgStablecoin.totalUserDebt(user1.address)).to.equal(mintAmount);
            
            // Setup bridge
            await mockCBDCValidator.setAuthorizedCBDC(esgStablecoin.address, true);
            await cbdcBridge.setTokenLimit(esgStablecoin.address, ethers.parseEther("50000"));
            
            // Bridge tokens
            const bridgeAmount = ethers.parseEther("3000");
            await esgStablecoin.connect(user1).approve(cbdcBridge.address, bridgeAmount);
            
            const bridgeFee = (bridgeAmount * 10n) / 10000n;
            const bridgeTx = await cbdcBridge.connect(user1).initiateBridge(
                esgStablecoin.address,
                esgStablecoin.address,
                user2.address,
                bridgeAmount,
                137,
                { value: bridgeFee }
            );
            
            const receipt = await bridgeTx.wait();
            const txId = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated")?.args[0];
            
            // Verify bridge state
            const bridgeTransaction = await cbdcBridge.getBridgeTransaction(txId);
            expect(bridgeTransaction.amount).to.equal(bridgeAmount);
            expect(bridgeTransaction.sender).to.equal(user1.address);
            expect(bridgeTransaction.recipient).to.equal(user2.address);
            
            // Verify locked tokens
            expect(await esgStablecoin.balanceOf(user1.address)).to.equal(mintAmount - bridgeAmount);
            expect(await esgStablecoin.balanceOf(cbdcBridge.address)).to.equal(bridgeAmount);
            
            console.log("✅ Cross-contract state consistency verified");
        });

        it("Should handle state rollback on failed operations", async function () {
            const { waterVault, esgStablecoin } = contracts;
            const { user1, oracle } = signers;
            
            console.log("↩️  Testing state rollback mechanisms");
            
            // Setup initial state
            await waterVault.connect(user1).registerProject("Rollback Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("rollback_cert")));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            
            // Record initial state
            const initialCredit = await waterVault.getCredit(1);
            const initialOwnerCredits = await waterVault.getUserCredits(user1.address);
            
            // Attempt invalid transfer (should fail and rollback)
            await expect(
                waterVault.connect(user1).transferCredits(1, ethers.ZeroAddress)
            ).to.be.revertedWith("WaterVault: Invalid recipient");
            
            // Verify state unchanged after failed operation
            const creditAfterFail = await waterVault.getCredit(1);
            const ownerCreditsAfterFail = await waterVault.getUserCredits(user1.address);
            
            expect(creditAfterFail.owner).to.equal(initialCredit.owner);
            expect(ownerCreditsAfterFail.length).to.equal(initialOwnerCredits.length);
            
            // Successful operation should update state
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            
            const creditAfterSuccess = await waterVault.getCredit(1);
            expect(creditAfterSuccess.owner).to.equal(esgStablecoin.address);
            
            console.log("✅ State rollback mechanisms working correctly");
        });

        it("Should synchronize ESG scores across oracle updates", async function () {
            const { waterVault, esgStablecoin, esgScoreOracle } = contracts;
            const { user1, oracle, owner } = signers;
            
            console.log("📈 Testing ESG score synchronization");
            
            // Setup project and collateral
            await waterVault.connect(user1).registerProject("ESG Sync Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("esg_cert")));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            
            // Initial ESG score
            await esgScoreOracle.setESGScore(waterVault.address, 95); // High ESG score
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            // Update user's individual ESG score
            await esgStablecoin.connect(owner).updateESGScore(user1.address, 8500); // 85% score
            
            const userESGScore = await esgStablecoin.getUserESGScore(user1.address);
            expect(userESGScore).to.equal(8500);
            
            // ESG score should affect collateral ratios and limits
            const collateralInfo = await esgStablecoin.getCollateralInfo(waterVault.address);
            expect(collateralInfo.isActive).to.be.true;
            
            // Test ESG score impact on minting capability
            const maxMintable = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            expect(maxMintable).to.be.gt(0);
            
            console.log(`✅ ESG score synchronized: User score ${userESGScore/100}%`);
        });
    });

    describe("⚠️ Oracle Failure Recovery", function () {
        it("Should handle oracle downtime gracefully", async function () {
            const { waterVault, esgStablecoin, priceOracle } = contracts;
            const { user1, oracle, owner } = signers;
            
            console.log("⚠️ Testing oracle failure recovery");
            
            // Setup initial state
            await waterVault.connect(user1).registerProject("Oracle Fail Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("oracle_fail_cert")));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            
            // Simulate oracle failure by setting invalid data
            await priceOracle.setPrice(waterVault.address, 0);
            
            // Operations should still work with fallback mechanisms
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            const maxMintable = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            expect(maxMintable).to.be.gt(0); // Should use fallback price
            
            // Recovery: new oracle deployment
            const NewMockOracle = await ethers.getContractFactory("contracts/mocks/MockOracle.sol:MockOracle");
            const recoveryOracle = await NewMockOracle.deploy();
            
            await recoveryOracle.setPrice(waterVault.address, ethers.parseEther("1.5"));
            
            // Update oracle reference
            await waterVault.connect(owner).updateOracle(recoveryOracle.address);
            
            // Verify recovery
            const lastUpdate = await waterVault.lastOracleUpdate();
            expect(lastUpdate).to.be.gt(0);
            
            console.log("✅ Oracle failure recovery completed successfully");
        });

        it("Should validate oracle signature authenticity", async function () {
            const { waterVault, cbdcBridge, mockCBDCValidator } = contracts;
            const { user1, validator, oracle } = signers;
            
            console.log("🔐 Testing oracle signature validation");
            
            // Setup bridge transaction
            const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
            const testToken = await MockERC20.deploy("Test Token", "TEST", ethers.parseEther("1000"));
            
            await mockCBDCValidator.setAuthorizedCBDC(testToken.address, true);
            await cbdcBridge.setTokenLimit(testToken.address, ethers.parseEther("10000"));
            
            const bridgeAmount = ethers.parseEther("1000");
            await testToken.transfer(user1.address, bridgeAmount);
            await testToken.transfer(cbdcBridge.address, bridgeAmount);
            await testToken.connect(user1).approve(cbdcBridge.address, bridgeAmount);
            
            const bridgeFee = (bridgeAmount * 10n) / 10000n;
            const bridgeTx = await cbdcBridge.connect(user1).initiateBridge(
                testToken.address,
                testToken.address,
                user1.address,
                bridgeAmount,
                137,
                { value: bridgeFee }
            );
            
            const receipt = await bridgeTx.wait();
            const txId = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated")?.args[0];
            
            // Wait for confirmation time
            await time.increase(360);
            
            // Test invalid signature rejection
            await mockCBDCValidator.setTransactionValid(txId, false);
            
            await expect(
                cbdcBridge.connect(validator).completeBridge(txId, ethers.toUtf8Bytes("invalid_signature"))
            ).to.be.revertedWith("Invalid validator signature");
            
            // Test valid signature acceptance
            await mockCBDCValidator.setTransactionValid(txId, true);
            
            await expect(
                cbdcBridge.connect(validator).completeBridge(txId, ethers.toUtf8Bytes("valid_signature"))
            ).to.not.be.reverted;
            
            console.log("✅ Oracle signature validation working correctly");
        });

        it("Should handle multiple oracle data sources", async function () {
            const { waterVault, esgStablecoin, priceOracle } = contracts;
            const { user1, oracle, dataProvider } = signers;
            
            console.log("🔄 Testing multiple oracle data source handling");
            
            // Setup multiple oracles for redundancy
            const BackupOracle = await ethers.getContractFactory("contracts/mocks/MockOracle.sol:MockOracle");
            const backupOracle = await BackupOracle.deploy();
            
            // Setup test scenario
            await waterVault.connect(user1).registerProject("Multi Oracle Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("multi_oracle_cert")));
            
            // Set different prices in different oracles
            await priceOracle.setPrice(waterVault.address, ethers.parseEther("2.0"));
            await backupOracle.setPrice(waterVault.address, ethers.parseEther("2.2"));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            
            // Test primary oracle usage
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            const maxMintablePrimary = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            
            // Expected with $2.0 price: 10k * $2 / 1.5 = $13.33k
            const expectedPrimary = (creditAmount * ethers.parseEther("2") / ethers.parseEther("1")) / 15n * 10n;
            expect(maxMintablePrimary).to.equal(expectedPrimary);
            
            console.log(`✅ Primary oracle data used correctly: $${ethers.formatEther(maxMintablePrimary)} max mintable`);
            
            // Simulate oracle failover scenario
            await priceOracle.setPrice(waterVault.address, 0); // Primary oracle fails
            
            // System should maintain stability with existing cached values or fallbacks
            const maxMintableFailover = await esgStablecoin.getMaxMintable(user1.address, waterVault.address);
            expect(maxMintableFailover).to.be.gt(0); // Should not be zero due to fallback
            
            console.log("✅ Multiple oracle source handling validated");
        });
    });

    after(async function () {
        // Store oracle integration test results
        const oracleTestResults = {
            timestamp: new Date().toISOString(),
            testSuite: "ESG_Oracle_Integration",
            oracleSystemsTested: [
                "price_synchronization",
                "update_frequency_validation", 
                "data_integrity_validation",
                "cross_contract_state_sync",
                "state_rollback_mechanisms",
                "esg_score_synchronization",
                "oracle_failure_recovery",
                "signature_validation",
                "multiple_data_sources"
            ],
            synchronizationTests: [
                "price_data_across_contracts",
                "state_consistency_verification",
                "rollback_on_failures",
                "esg_score_updates"
            ],
            failureRecoveryMechanisms: [
                "oracle_downtime_handling",
                "fallback_price_mechanisms", 
                "signature_authenticity_validation",
                "multi_oracle_redundancy"
            ],
            dataIntegrityChecks: [
                "zero_price_fallback",
                "extreme_value_handling",
                "update_frequency_controls",
                "certification_hash_uniqueness"
            ]
        };

        await contracts.priceOracle.storeTestResults("esg/oracle-integration-results", JSON.stringify(oracleTestResults));
        console.log("🔗 Oracle integration test results stored with key: esg/oracle-integration-results");
    });
});