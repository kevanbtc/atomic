const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ESG Integration Tests", function () {
    let WaterVault, CarbonVault, ESGStablecoin, CBDCBridge;
    let waterVault, carbonVault, esgStablecoin, cbdcBridge;
    let MockWaterOracle, MockCarbonOracle, MockPriceOracle, MockCBDCValidator;
    let mockWaterOracle, mockCarbonOracle, mockPriceOracle, mockCBDCValidator;
    let MockERC20, waterToken, carbonToken, stablecoin, cbdcToken;
    let owner, user1, user2, issuer, validator;

    beforeEach(async function () {
        [owner, user1, user2, issuer, validator] = await ethers.getSigners();

        // Deploy all oracles
        MockWaterOracle = await ethers.getContractFactory("MockWaterOracle");
        mockWaterOracle = await MockWaterOracle.deploy();
        await mockWaterOracle.waitForDeployment();

        MockCarbonOracle = await ethers.getContractFactory("MockCarbonOracle");
        mockCarbonOracle = await MockCarbonOracle.deploy();
        await mockCarbonOracle.waitForDeployment();

        MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
        mockPriceOracle = await MockPriceOracle.deploy();
        await mockPriceOracle.waitForDeployment();

        MockCBDCValidator = await ethers.getContractFactory("MockCBDCValidator");
        mockCBDCValidator = await MockCBDCValidator.deploy();
        await mockCBDCValidator.waitForDeployment();

        // Deploy all ESG contracts
        WaterVault = await ethers.getContractFactory("WaterVault");
        waterVault = await WaterVault.deploy(await mockWaterOracle.getAddress());
        await waterVault.waitForDeployment();

        CarbonVault = await ethers.getContractFactory("CarbonVault");
        carbonVault = await CarbonVault.deploy(await mockCarbonOracle.getAddress());
        await carbonVault.waitForDeployment();

        ESGStablecoin = await ethers.getContractFactory("ESGStablecoin");
        esgStablecoin = await ESGStablecoin.deploy(await mockPriceOracle.getAddress());
        await esgStablecoin.waitForDeployment();

        CBDCBridge = await ethers.getContractFactory("CBDCBridge");
        cbdcBridge = await CBDCBridge.deploy(await mockCBDCValidator.getAddress());
        await cbdcBridge.waitForDeployment();

        // Deploy mock ERC20 for CBDC
        MockERC20 = await ethers.getContractFactory("MockERC20");
        cbdcToken = await MockERC20.deploy("CBDC Token", "CBDC", ethers.parseEther("10000000"));
        await cbdcToken.waitForDeployment();

        // Setup oracle prices and configurations
        await mockPriceOracle.setPrice(await waterVault.getAddress(), ethers.parseEther("2"));
        await mockPriceOracle.setESGScore(await waterVault.getAddress(), 95);
        
        await mockPriceOracle.setPrice(await carbonVault.getAddress(), ethers.parseEther("50"));
        await mockPriceOracle.setESGScore(await carbonVault.getAddress(), 90);

        await mockCBDCValidator.setAuthorizedCBDC(await cbdcToken.getAddress(), true);
        await mockCBDCValidator.setAuthorizedCBDC(await esgStablecoin.getAddress(), true);

        // Setup water and carbon sources
        const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
        const creditId = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
        
        await waterVault.addWaterSource(sourceId, 85, ethers.parseEther("0.1"));
        await mockWaterOracle.setWaterQuality(sourceId, 85);
        
        await carbonVault.authorizeIssuer(issuer.address);
        await mockCarbonOracle.setCreditVerification(creditId, true);
        
        // Add ESG tokens as collateral for stablecoin
        await esgStablecoin.addCollateralAsset(await waterVault.getAddress(), 15000, 80);
        await esgStablecoin.addCollateralAsset(await carbonVault.getAddress(), 16000, 85);

        // Transfer tokens for testing
        await cbdcToken.transfer(user1.address, ethers.parseEther("100000"));
        await cbdcToken.transfer(await cbdcBridge.getAddress(), ethers.parseEther("100000"));
        
        await cbdcBridge.setTokenLimit(await cbdcToken.getAddress(), ethers.parseEther("50000"));
        await cbdcBridge.setTokenLimit(await esgStablecoin.getAddress(), ethers.parseEther("50000"));
        await cbdcBridge.addValidator(validator.address);
    });

    describe("Full ESG Ecosystem Integration", function () {
        it("Should create complete ESG-backed stablecoin workflow", async function () {
            // Step 1: User mints water tokens
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100"); // 0.1 * 1000

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            expect(await waterVault.balanceOf(user1.address)).to.equal(waterAmount);

            // Step 2: Issuer creates carbon credits for user
            const creditId = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
            const carbonAmount = ethers.parseEther("500"); // 500 tonnes
            const vintage = 2023;
            const projectType = "Reforestation";

            await carbonVault.connect(issuer).issueCarbonCredit(
                creditId, user1.address, carbonAmount, vintage, projectType
            );
            expect(await carbonVault.balanceOf(user1.address)).to.equal(carbonAmount);

            // Step 3: User deposits ESG tokens as collateral
            await waterVault.connect(user1).approve(await esgStablecoin.getAddress(), waterAmount);
            await carbonVault.connect(user1).approve(await esgStablecoin.getAddress(), carbonAmount);

            await esgStablecoin.connect(user1).depositCollateral(await waterVault.getAddress(), waterAmount);
            await esgStablecoin.connect(user1).depositCollateral(await carbonVault.getAddress(), carbonAmount);

            // Step 4: User mints ESG stablecoin
            // Total collateral value: (1000 * $2) + (500 * $50) = $27,000
            // Can mint up to $27,000 / 1.5 = $18,000 (150% collateral ratio)
            const mintAmount = ethers.parseEther("15000"); // $15,000 worth

            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);
            expect(await esgStablecoin.balanceOf(user1.address)).to.equal(mintAmount);

            // Step 5: User bridges stablecoin to another chain
            await esgStablecoin.connect(user1).approve(await cbdcBridge.getAddress(), mintAmount);
            
            const bridgeAmount = ethers.parseEther("5000");
            const bridgeFee = bridgeAmount * 10n / 10000n; // 0.1% fee
            const targetChain = 137;

            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await esgStablecoin.getAddress(),
                await cbdcToken.getAddress(),
                user2.address,
                bridgeAmount,
                targetChain,
                { value: bridgeFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            const txId = event.args[0];

            // Step 6: Complete bridge transaction
            await mockCBDCValidator.setTransactionValidation(txId, true);
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");

            const signature = ethers.toUtf8Bytes("mock_signature");
            await cbdcBridge.connect(validator).completeBridge(txId, signature);

            // Verify final state
            expect(await esgStablecoin.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
            expect(await cbdcToken.balanceOf(user2.address)).to.equal(bridgeAmount);
        });

        it("Should handle liquidation scenario", async function () {
            // Setup position
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100");

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            await waterVault.connect(user1).approve(await esgStablecoin.getAddress(), waterAmount);
            await esgStablecoin.connect(user1).depositCollateral(await waterVault.getAddress(), waterAmount);

            const mintAmount = ethers.parseEther("1200"); // Close to limit
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);

            // Price drop causes undercollateralization
            await mockPriceOracle.setPrice(await waterVault.getAddress(), ethers.parseEther("1.4")); // $1.4

            // Liquidator can now liquidate
            await esgStablecoin.mint(user2.address, ethers.parseEther("5000")); // Give liquidator tokens
            
            const liquidateAmount = ethers.parseEther("500");
            await esgStablecoin.connect(user2).liquidate(
                user1.address,
                await waterVault.getAddress(),
                liquidateAmount
            );

            expect(await esgStablecoin.userDebt(user1.address)).to.equal(ethers.parseEther("700"));
        });

        it("Should handle cross-chain ESG token transfer", async function () {
            // Create water tokens
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100");

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            
            // Bridge water tokens to another chain
            await mockCBDCValidator.setAuthorizedCBDC(await waterVault.getAddress(), true);
            await waterVault.connect(user1).approve(await cbdcBridge.getAddress(), waterAmount);
            
            const bridgeFee = waterAmount * 10n / 10000n;
            const targetChain = 137;

            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await waterVault.getAddress(),
                await waterVault.getAddress(),
                user2.address,
                waterAmount,
                targetChain,
                { value: bridgeFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            const txId = event.args[0];

            // Complete bridge
            await mockCBDCValidator.setTransactionValidation(txId, true);
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");

            await cbdcBridge.connect(validator).completeBridge(txId, ethers.toUtf8Bytes("signature"));

            const bridgeTx = await cbdcBridge.getBridgeTransaction(txId);
            expect(bridgeTx.completed).to.be.true;
        });
    });

    describe("ESG Score Validation", function () {
        it("Should reject low ESG score tokens as collateral", async function () {
            // Set water vault ESG score too low
            await mockPriceOracle.setESGScore(await waterVault.getAddress(), 60); // Below threshold

            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100");

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            await waterVault.connect(user1).approve(await esgStablecoin.getAddress(), waterAmount);

            await expect(
                esgStablecoin.connect(user1).depositCollateral(await waterVault.getAddress(), waterAmount)
            ).to.be.revertedWith("ESG score too low");
        });

        it("Should dynamically update ESG requirements", async function () {
            // Initial deposit should work
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100");

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            await waterVault.connect(user1).approve(await esgStablecoin.getAddress(), waterAmount);

            await esgStablecoin.connect(user1).depositCollateral(await waterVault.getAddress(), waterAmount);
            expect(await esgStablecoin.userCollateral(user1.address, await waterVault.getAddress()))
                .to.equal(waterAmount);

            // Update ESG score and new deposits should fail
            await mockPriceOracle.setESGScore(await waterVault.getAddress(), 60);
            
            const additionalAmount = ethers.parseEther("500");
            await waterVault.connect(user1).mintWaterTokens(sourceId, additionalAmount, { value: ethers.parseEther("50") });
            await waterVault.connect(user1).approve(await esgStablecoin.getAddress(), additionalAmount);

            await expect(
                esgStablecoin.connect(user1).depositCollateral(await waterVault.getAddress(), additionalAmount)
            ).to.be.revertedWith("ESG score too low");
        });
    });

    describe("Multi-Token Collateral Scenarios", function () {
        it("Should handle mixed collateral liquidation", async function () {
            // Setup both water and carbon tokens
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const creditId = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
            
            const waterAmount = ethers.parseEther("500");
            const carbonAmount = ethers.parseEther("100");
            const waterPayment = ethers.parseEther("50");

            // Mint tokens
            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            await carbonVault.connect(issuer).issueCarbonCredit(
                creditId, user1.address, carbonAmount, 2023, "Reforestation"
            );

            // Deposit as collateral
            await waterVault.connect(user1).approve(await esgStablecoin.getAddress(), waterAmount);
            await carbonVault.connect(user1).approve(await esgStablecoin.getAddress(), carbonAmount);
            
            await esgStablecoin.connect(user1).depositCollateral(await waterVault.getAddress(), waterAmount);
            await esgStablecoin.connect(user1).depositCollateral(await carbonVault.getAddress(), carbonAmount);

            // Mint stablecoin
            const mintAmount = ethers.parseEther("4000"); // Total collateral ~$6000, mint $4000
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);

            // Price drops causing undercollateralization
            await mockPriceOracle.setPrice(await waterVault.getAddress(), ethers.parseEther("1"));
            await mockPriceOracle.setPrice(await carbonVault.getAddress(), ethers.parseEther("30"));

            // Liquidate water collateral
            await esgStablecoin.mint(user2.address, ethers.parseEther("10000"));
            
            const liquidateAmount = ethers.parseEther("1000");
            await esgStablecoin.connect(user2).liquidate(
                user1.address,
                await waterVault.getAddress(),
                liquidateAmount
            );

            expect(await esgStablecoin.userDebt(user1.address)).to.equal(ethers.parseEther("3000"));
        });

        it("Should calculate correct collateralization with multiple assets", async function () {
            // Setup mixed collateral
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const creditId = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
            
            const waterAmount = ethers.parseEther("1000"); // $2000 value
            const carbonAmount = ethers.parseEther("100"); // $5000 value
            const waterPayment = ethers.parseEther("100");

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            await carbonVault.connect(issuer).issueCarbonCredit(
                creditId, user1.address, carbonAmount, 2023, "Reforestation"
            );

            await waterVault.connect(user1).approve(await esgStablecoin.getAddress(), waterAmount);
            await carbonVault.connect(user1).approve(await esgStablecoin.getAddress(), carbonAmount);
            
            await esgStablecoin.connect(user1).depositCollateral(await waterVault.getAddress(), waterAmount);
            await esgStablecoin.connect(user1).depositCollateral(await carbonVault.getAddress(), carbonAmount);

            // Mint $4000 worth (total collateral $7000, ratio 175%)
            const mintAmount = ethers.parseEther("4000");
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);

            const ratio = await esgStablecoin.getCollateralizationRatio(user1.address);
            expect(ratio).to.equal(17500); // 175%
        });
    });

    describe("Emergency Scenarios", function () {
        it("Should handle oracle failure gracefully", async function () {
            // Setup normal operation first
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100");

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });

            // Simulate oracle failure by setting quality to 0
            await mockWaterOracle.setWaterQuality(sourceId, 0); // Falls back to default 85

            // Should still work with default value
            const additionalAmount = ethers.parseEther("500");
            await expect(
                waterVault.connect(user1).mintWaterTokens(sourceId, additionalAmount, 
                    { value: ethers.parseEther("50") })
            ).to.not.be.reverted;
        });

        it("Should handle contract pausing in emergency", async function () {
            // Setup tokens first
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100");

            await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });

            // Pause all contracts
            await waterVault.pause();
            await carbonVault.pause();
            await esgStablecoin.pause();
            await cbdcBridge.pause();

            // All operations should be paused
            await expect(
                waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment })
            ).to.be.revertedWithCustomError(waterVault, "EnforcedPause");

            // Bridge should also be paused
            await cbdcToken.connect(user1).approve(await cbdcBridge.getAddress(), waterAmount);
            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await cbdcToken.getAddress(),
                    await cbdcToken.getAddress(),
                    user2.address,
                    waterAmount,
                    137,
                    { value: ethers.parseEther("1") }
                )
            ).to.be.revertedWithCustomError(cbdcBridge, "EnforcedPause");
        });

        it("Should handle mass liquidations during market crash", async function () {
            // Setup multiple users with positions
            const users = [user1, user2];
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            
            for (let user of users) {
                const waterAmount = ethers.parseEther("1000");
                const waterPayment = ethers.parseEther("100");
                
                await waterVault.connect(user).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
                await waterVault.connect(user).approve(await esgStablecoin.getAddress(), waterAmount);
                await esgStablecoin.connect(user).depositCollateral(await waterVault.getAddress(), waterAmount);
                
                const mintAmount = ethers.parseEther("1300");
                await esgStablecoin.connect(user).mintStablecoin(mintAmount);
            }

            // Market crash - price drops significantly
            await mockPriceOracle.setPrice(await waterVault.getAddress(), ethers.parseEther("1.4"));

            // Liquidator with enough funds
            const liquidator = owner;
            await esgStablecoin.mint(liquidator.address, ethers.parseEther("50000"));

            // Liquidate multiple positions
            for (let user of users) {
                const liquidateAmount = ethers.parseEther("500");
                
                await expect(
                    esgStablecoin.connect(liquidator).liquidate(
                        user.address,
                        await waterVault.getAddress(),
                        liquidateAmount
                    )
                ).to.not.be.reverted;
                
                expect(await esgStablecoin.userDebt(user.address)).to.equal(ethers.parseEther("800"));
            }
        });
    });
});