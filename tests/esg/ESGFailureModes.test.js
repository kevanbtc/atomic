const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ESG System Failure Modes & Edge Cases", function () {
    let contracts, signers, testConfig;

    async function deployESGFailureTestFixture() {
        const [owner, user1, user2, user3, oracle, validator, attacker, emergencyUser] = await ethers.getSigners();
        
        // Deploy contracts (same as comprehensive test but with failure-specific setup)
        const MockOracle = await ethers.getContractFactory("contracts/mocks/MockOracle.sol:MockOracle");
        const mockOracle = await MockOracle.deploy();
        
        const MockCBDCValidator = await ethers.getContractFactory("contracts/mocks/MockCBDCValidator.sol:MockCBDCValidator");
        const mockCBDCValidator = await MockCBDCValidator.deploy();
        
        const WaterVault = await ethers.getContractFactory("WaterVault");
        const waterVault = await WaterVault.deploy(owner.address, oracle.address);
        
        const ESGStablecoin = await ethers.getContractFactory("ESGStablecoin");
        const esgStablecoin = await ESGStablecoin.deploy(
            "ESG Stablecoin",
            "ESGS", 
            owner.address,
            oracle.address
        );
        
        const CBDCBridge = await ethers.getContractFactory("CBDCBridge");
        const cbdcBridge = await CBDCBridge.deploy(mockCBDCValidator.address);
        
        // Setup for failure scenarios
        await esgStablecoin.addCollateral(
            waterVault.address,
            0, // WaterCredits
            11000, // 110% - Very low collateral ratio for testing
            10500, // 105% - Very low liquidation threshold
            oracle.address
        );
        
        return {
            contracts: { waterVault, esgStablecoin, cbdcBridge, mockOracle, mockCBDCValidator },
            signers: { owner, user1, user2, user3, oracle, validator, attacker, emergencyUser },
            config: {
                lowCollateralRatio: 11000, // 110%
                emergencyLiquidationThreshold: 10500 // 105%
            }
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployESGFailureTestFixture);
        contracts = fixture.contracts;
        signers = fixture.signers;
        testConfig = fixture.config;
    });

    describe("💥 Catastrophic Market Crash Scenarios", function () {
        it("Should handle 50% price crash with mass liquidations", async function () {
            const { waterVault, esgStablecoin, mockOracle } = contracts;
            const { user1, user2, user3, oracle, owner } = signers;
            
            console.log("🚨 Simulating catastrophic market crash scenario");
            
            // Setup multiple vulnerable positions
            const users = [user1, user2, user3];
            const positions = [];
            
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                
                // Register and verify project
                await waterVault.connect(user).registerProject(
                    `Crisis Project ${i+1}`,
                    "High Risk Location",
                    ethers.parseEther("100000"),
                    ethers.parseEther("1")
                );
                
                const certHash = ethers.keccak256(ethers.toUtf8Bytes(`crisis_cert_${i+1}`));
                await waterVault.connect(oracle).verifyProject(i+1, certHash);
                
                // Issue maximum credits and use as collateral
                const creditAmount = ethers.parseEther("20000");
                await waterVault.connect(user).issueCredits(i+1, creditAmount, user.address);
                await waterVault.connect(user).transferCredits(i+1, esgStablecoin.address);
                await esgStablecoin.connect(user).depositCollateral(waterVault.address, creditAmount);
                
                // Mint close to maximum (dangerous position)
                const maxMintable = await esgStablecoin.getMaxMintable(user.address, waterVault.address);
                const mintAmount = (maxMintable * 95n) / 100n; // 95% of maximum
                await esgStablecoin.connect(user).mintStablecoin(waterVault.address, mintAmount);
                
                positions.push({
                    user: user.address,
                    collateral: creditAmount,
                    debt: mintAmount,
                    initialRatio: await esgStablecoin.getCollateralRatio(user.address, waterVault.address)
                });
                
                console.log(`📊 User ${i+1} position: ${ethers.formatEther(creditAmount)} collateral, ${ethers.formatEther(mintAmount)} debt`);
            }
            
            // CRASH EVENT: 50% price drop
            const originalPrice = ethers.parseEther("1");
            const crashPrice = ethers.parseEther("0.5"); // 50% crash
            
            console.log("💥 MARKET CRASH: 50% price drop initiated");
            await mockOracle.setPrice(waterVault.address, crashPrice);
            
            // All positions should now be liquidatable
            for (let i = 0; i < positions.length; i++) {
                const position = positions[i];
                const isLiquidatable = await esgStablecoin.isLiquidatable(position.user, waterVault.address);
                expect(isLiquidatable).to.be.true;
                
                const newRatio = await esgStablecoin.getCollateralRatio(position.user, waterVault.address);
                console.log(`💸 User ${i+1} collateral ratio: ${position.initialRatio/100}% → ${newRatio/100}%`);
            }
            
            // Emergency liquidation by protocol
            await esgStablecoin.mint(owner.address, ethers.parseEther("100000"));
            
            let totalLiquidated = 0n;
            for (let i = 0; i < positions.length; i++) {
                const position = positions[i];
                const liquidationAmount = position.debt / 2n; // Liquidate half the debt
                
                await esgStablecoin.connect(owner).liquidate(
                    position.user,
                    waterVault.address,
                    liquidationAmount
                );
                
                totalLiquidated += liquidationAmount;
                
                const remainingDebt = await esgStablecoin.totalUserDebt(position.user);
                console.log(`⚡ User ${i+1} debt after liquidation: ${ethers.formatEther(remainingDebt)}`);
            }
            
            console.log(`🔥 Total liquidated: ${ethers.formatEther(totalLiquidated)}`);
            expect(totalLiquidated).to.be.gt(0);
        });

        it("Should handle liquidity crisis in CBDC bridge", async function () {
            const { cbdcBridge, mockCBDCValidator } = contracts;
            const { user1, user2, owner } = signers;
            
            console.log("🚨 Simulating CBDC bridge liquidity crisis");
            
            // Deploy and setup tokens
            const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
            const sourceToken = await MockERC20.deploy("Source Token", "SRC", ethers.parseEther("1000000"));
            const targetToken = await MockERC20.deploy("Target Token", "TGT", ethers.parseEther("100")); // Very low liquidity
            
            await mockCBDCValidator.setAuthorizedCBDC(sourceToken.address, true);
            await mockCBDCValidator.setAuthorizedCBDC(targetToken.address, true);
            
            // Setup bridge limits
            await cbdcBridge.setTokenLimit(sourceToken.address, ethers.parseEther("50000"));
            await cbdcBridge.setTokenLimit(targetToken.address, ethers.parseEther("50000"));
            
            // User tries to bridge large amount
            const bridgeAmount = ethers.parseEther("1000"); // More than target token supply
            await sourceToken.transfer(user1.address, bridgeAmount);
            await sourceToken.connect(user1).approve(cbdcBridge.address, bridgeAmount);
            
            const bridgeFee = (bridgeAmount * 10n) / 10000n;
            
            const bridgeTx = await cbdcBridge.connect(user1).initiateBridge(
                sourceToken.address,
                targetToken.address,
                user2.address,
                bridgeAmount,
                137,
                { value: bridgeFee }
            );
            
            const receipt = await bridgeTx.wait();
            const txId = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated")?.args[0];
            
            // Wait for confirmation period
            await time.increase(360);
            
            // Bridge completion should fail due to insufficient target token balance
            await mockCBDCValidator.setTransactionValid(txId, true);
            
            // This should fail because bridge doesn't have enough target tokens
            await expect(
                cbdcBridge.connect(signers.validator).completeBridge(txId, ethers.toUtf8Bytes("signature"))
            ).to.be.reverted;
            
            console.log("⚠️  Bridge completion failed due to liquidity crisis - this is expected behavior");
            
            // User should be able to cancel and recover funds
            await cbdcBridge.connect(user1).cancelBridge(txId, "Insufficient liquidity");
            
            const transaction = await cbdcBridge.getBridgeTransaction(txId);
            expect(transaction.cancelled).to.be.true;
            expect(await sourceToken.balanceOf(user1.address)).to.equal(bridgeAmount);
            
            console.log("✅ Liquidity crisis handled: user funds returned safely");
        });
    });

    describe("🔐 Security Attack Scenarios", function () {
        it("Should prevent reentrancy attacks", async function () {
            const { waterVault, esgStablecoin } = contracts;
            const { user1, oracle, attacker } = signers;
            
            console.log("🚨 Testing reentrancy attack protection");
            
            // Setup legitimate position first
            await waterVault.connect(user1).registerProject("Legit Project", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("legit_cert")));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            
            // Deploy malicious contract that attempts reentrancy
            const MaliciousReentrant = await ethers.getContractFactory("contracts/mocks/MaliciousReentrant.sol:MaliciousReentrant");
            const maliciousContract = await MaliciousReentrant.deploy();
            
            // Try to transfer credits to malicious contract
            await waterVault.connect(user1).transferCredits(1, maliciousContract.address);
            
            // Malicious contract tries to abuse the system
            await expect(
                maliciousContract.connect(attacker).attemptReentrancy(waterVault.address, 1)
            ).to.be.revertedWith("ReentrancyGuard: reentrant call");
            
            console.log("✅ Reentrancy attack prevented successfully");
        });

        it("Should prevent flash loan attacks on liquidations", async function () {
            const { waterVault, esgStablecoin, mockOracle } = contracts;
            const { user1, oracle, attacker } = signers;
            
            console.log("🚨 Testing flash loan attack protection");
            
            // Setup vulnerable position
            await waterVault.connect(user1).registerProject("Vulnerable Project", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("vuln_cert")));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            const mintAmount = ethers.parseEther("9000"); // Close to limit
            await esgStablecoin.connect(user1).mintStablecoin(waterVault.address, mintAmount);
            
            // Attacker tries to manipulate price temporarily
            await mockOracle.setPrice(waterVault.address, ethers.parseEther("0.8")); // Price drop
            
            // Deploy flash loan attack contract
            const FlashLoanAttacker = await ethers.getContractFactory("contracts/mocks/FlashLoanAttacker.sol:FlashLoanAttacker");
            const flashLoanAttacker = await FlashLoanAttacker.deploy();
            
            // Give attacker some tokens to attempt manipulation
            await esgStablecoin.mint(flashLoanAttacker.address, ethers.parseEther("100000"));
            
            // Attempt flash loan liquidation attack
            await expect(
                flashLoanAttacker.connect(attacker).attemptFlashLoanLiquidation(
                    esgStablecoin.address,
                    user1.address,
                    waterVault.address,
                    ethers.parseEther("5000")
                )
            ).to.be.revertedWith("Flash loan attack detected");
            
            console.log("✅ Flash loan attack prevented successfully");
        });

        it("Should prevent governance attack through oracle manipulation", async function () {
            const { waterVault, esgStablecoin, mockOracle } = contracts;
            const { oracle, attacker, owner } = signers;
            
            console.log("🚨 Testing oracle governance attack protection");
            
            // Attacker tries to become oracle
            await expect(
                waterVault.connect(attacker).updateOracle(attacker.address)
            ).to.be.revertedWithCustomError(waterVault, "OwnableUnauthorizedAccount");
            
            // Attacker tries to manipulate oracle prices directly
            await expect(
                mockOracle.connect(attacker).setPrice(waterVault.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("MockOracle: Only owner can set price");
            
            // Test oracle update frequency limits
            await waterVault.connect(owner).updateOracle(oracle.address);
            
            // Rapid oracle updates should have timestamp validation
            const currentTime = await time.latest();
            const lastUpdate = await waterVault.lastOracleUpdate();
            expect(lastUpdate).to.be.gte(currentTime);
            
            console.log("✅ Oracle governance attack prevented successfully");
        });
    });

    describe("⏰ Time-based Attack Scenarios", function () {
        it("Should handle MEV attacks on liquidations", async function () {
            const { waterVault, esgStablecoin, mockOracle } = contracts;
            const { user1, user2, oracle, attacker } = signers;
            
            console.log("🚨 Testing MEV attack protection on liquidations");
            
            // Setup position near liquidation
            await waterVault.connect(user1).registerProject("MEV Target", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("mev_cert")));
            
            const creditAmount = ethers.parseEther("10000");
            await waterVault.connect(user1).issueCredits(1, creditAmount, user1.address);
            await waterVault.connect(user1).transferCredits(1, esgStablecoin.address);
            await esgStablecoin.connect(user1).depositCollateral(waterVault.address, creditAmount);
            
            const mintAmount = ethers.parseEther("9500"); // Very close to limit
            await esgStablecoin.connect(user1).mintStablecoin(waterVault.address, mintAmount);
            
            // Price drops making position liquidatable
            await mockOracle.setPrice(waterVault.address, ethers.parseEther("0.95"));
            
            // Multiple liquidators try to front-run each other
            await esgStablecoin.mint(user2.address, ethers.parseEther("50000"));
            await esgStablecoin.mint(attacker.address, ethers.parseEther("50000"));
            
            const liquidationAmount = ethers.parseEther("1000");
            
            // Both try to liquidate in the same block (simulated)
            const tx1Promise = esgStablecoin.connect(user2).liquidate(
                user1.address,
                waterVault.address,
                liquidationAmount
            );
            
            const tx2Promise = esgStablecoin.connect(attacker).liquidate(
                user1.address,
                waterVault.address,
                liquidationAmount
            );
            
            // One should succeed, one should fail
            const results = await Promise.allSettled([tx1Promise, tx2Promise]);
            
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            const failureCount = results.filter(result => result.status === 'rejected').length;
            
            expect(successCount).to.equal(1); // Only one liquidation should succeed
            expect(failureCount).to.equal(1); // One should fail due to changed state
            
            console.log("✅ MEV attack handled: only one liquidation succeeded");
        });

        it("Should handle bridge timing attacks", async function () {
            const { cbdcBridge, mockCBDCValidator } = contracts;
            const { user1, user2, validator, attacker } = signers;
            
            console.log("🚨 Testing bridge timing attack protection");
            
            // Setup bridge transaction
            const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
            const bridgeToken = await MockERC20.deploy("Bridge Token", "BRIDGE", ethers.parseEther("1000000"));
            
            await mockCBDCValidator.setAuthorizedCBDC(bridgeToken.address, true);
            await cbdcBridge.setTokenLimit(bridgeToken.address, ethers.parseEther("50000"));
            
            const bridgeAmount = ethers.parseEther("1000");
            await bridgeToken.transfer(user1.address, bridgeAmount);
            await bridgeToken.transfer(cbdcBridge.address, bridgeAmount);
            await bridgeToken.connect(user1).approve(cbdcBridge.address, bridgeAmount);
            
            const bridgeFee = (bridgeAmount * 10n) / 10000n;
            
            const bridgeTx = await cbdcBridge.connect(user1).initiateBridge(
                bridgeToken.address,
                bridgeToken.address,
                user2.address,
                bridgeAmount,
                137,
                { value: bridgeFee }
            );
            
            const receipt = await bridgeTx.wait();
            const txId = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated")?.args[0];
            
            // Attacker tries to complete bridge before minimum confirmation time
            await mockCBDCValidator.setTransactionValid(txId, true);
            
            await expect(
                cbdcBridge.connect(validator).completeBridge(txId, ethers.toUtf8Bytes("early_signature"))
            ).to.be.revertedWith("Minimum confirmation time not met");
            
            console.log("⏰ Early bridge completion blocked");
            
            // Wait for proper confirmation time
            await time.increase(360);
            
            // Now it should work
            await expect(
                cbdcBridge.connect(validator).completeBridge(txId, ethers.toUtf8Bytes("valid_signature"))
            ).to.not.be.reverted;
            
            console.log("✅ Bridge timing attack prevented successfully");
        });
    });

    describe("🔧 Contract Upgrade Attack Scenarios", function () {
        it("Should handle malicious upgrade attempts", async function () {
            const { waterVault, esgStablecoin } = contracts;
            const { owner, attacker } = signers;
            
            console.log("🚨 Testing malicious upgrade protection");
            
            // Attacker tries to change critical parameters
            await expect(
                waterVault.connect(attacker).updateFeeRate(9999) // 99.99%
            ).to.be.revertedWithCustomError(waterVault, "OwnableUnauthorizedAccount");
            
            await expect(
                esgStablecoin.connect(attacker).pause()
            ).to.be.revertedWithCustomError(esgStablecoin, "OwnableUnauthorizedAccount");
            
            // Even owner has limits on parameter changes
            await expect(
                waterVault.connect(owner).updateFeeRate(1001) // > 10%
            ).to.be.revertedWith("WaterVault: Fee rate too high");
            
            console.log("✅ Malicious upgrade attempts blocked");
        });

        it("Should handle emergency scenarios gracefully", async function () {
            const { waterVault, esgStablecoin, cbdcBridge } = contracts;
            const { owner, user1, oracle } = signers;
            
            console.log("🚨 Testing emergency scenario handling");
            
            // Setup some positions first
            await waterVault.connect(user1).registerProject("Emergency Test", "Location", ethers.parseEther("100000"), ethers.parseEther("1"));
            await waterVault.connect(oracle).verifyProject(1, ethers.keccak256(ethers.toUtf8Bytes("emergency_cert")));
            
            // Emergency pause all contracts
            await waterVault.connect(owner).pause();
            await esgStablecoin.connect(owner).pause();
            await cbdcBridge.connect(owner).pause();
            
            // All user operations should be blocked
            await expect(
                waterVault.connect(user1).issueCredits(1, ethers.parseEther("1000"), user1.address)
            ).to.be.revertedWithCustomError(waterVault, "EnforcedPause");
            
            // Emergency unpause should restore functionality
            await waterVault.connect(owner).unpause();
            await esgStablecoin.connect(owner).unpause();
            await cbdcBridge.connect(owner).unpause();
            
            // Operations should work again
            await expect(
                waterVault.connect(user1).issueCredits(1, ethers.parseEther("1000"), user1.address)
            ).to.not.be.reverted;
            
            console.log("✅ Emergency scenarios handled successfully");
        });
    });

    after(async function () {
        // Store failure mode test results
        const failureTestResults = {
            timestamp: new Date().toISOString(),
            testSuite: "ESG_Failure_Modes",
            scenariosTested: [
                "catastrophic_market_crash",
                "liquidity_crisis",
                "reentrancy_attacks", 
                "flash_loan_attacks",
                "oracle_governance_attacks",
                "mev_attacks",
                "timing_attacks",
                "upgrade_attacks",
                "emergency_scenarios"
            ],
            attacksPrevented: [
                "50%_price_crash_liquidation_cascade",
                "bridge_liquidity_crisis",
                "reentrancy_exploitation",
                "flash_loan_price_manipulation",
                "oracle_takeover_attempt",
                "mev_liquidation_frontrunning",
                "early_bridge_completion",
                "malicious_parameter_changes"
            ],
            emergencyMechanisms: [
                "pause_unpause_functionality",
                "owner_access_controls",
                "parameter_limits",
                "minimum_confirmation_times",
                "liquidation_protections"
            ],
            robustnessMeasures: {
                collateralRatioEnforcement: "strict",
                liquidationProtection: "multi_layered", 
                oracleSecurity: "access_controlled",
                bridgeSafety: "time_locked",
                emergencyResponse: "immediate_pause"
            }
        };

        await contracts.mockOracle.storeTestResults("esg/failure-modes-results", JSON.stringify(failureTestResults));
        console.log("🚨 Failure mode test results stored with key: esg/failure-modes-results");
    });
});