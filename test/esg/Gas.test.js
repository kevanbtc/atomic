const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ESG Contracts Gas Analysis", function () {
    let WaterVault, CarbonVault, ESGStablecoin, CBDCBridge;
    let waterVault, carbonVault, esgStablecoin, cbdcBridge;
    let MockWaterOracle, MockCarbonOracle, MockPriceOracle, MockCBDCValidator, MockERC20;
    let mockWaterOracle, mockCarbonOracle, mockPriceOracle, mockCBDCValidator, collateralToken;
    let owner, user1, user2, issuer, validator;

    beforeEach(async function () {
        [owner, user1, user2, issuer, validator] = await ethers.getSigners();

        // Deploy oracles
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

        // Deploy ESG contracts
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

        // Deploy mock tokens
        MockERC20 = await ethers.getContractFactory("MockERC20");
        collateralToken = await MockERC20.deploy("Collateral", "COL", ethers.parseEther("1000000"));
        await collateralToken.waitForDeployment();

        // Setup configurations
        await mockPriceOracle.setPrice(await collateralToken.getAddress(), ethers.parseEther("100"));
        await mockPriceOracle.setESGScore(await collateralToken.getAddress(), 85);
        await mockCBDCValidator.setAuthorizedCBDC(await collateralToken.getAddress(), true);
        
        const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
        await waterVault.addWaterSource(sourceId, 85, ethers.parseEther("0.1"));
        await mockWaterOracle.setWaterQuality(sourceId, 85);
        
        await carbonVault.authorizeIssuer(issuer.address);
        const creditId = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
        await mockCarbonOracle.setCreditVerification(creditId, true);
        
        await esgStablecoin.addCollateralAsset(await collateralToken.getAddress(), 15000, 80);
        await cbdcBridge.addValidator(validator.address);
        await cbdcBridge.setTokenLimit(await collateralToken.getAddress(), ethers.parseEther("100000"));

        // Transfer tokens to users
        await collateralToken.transfer(user1.address, ethers.parseEther("50000"));
        await collateralToken.transfer(user2.address, ethers.parseEther("50000"));
    });

    describe("WaterVault Gas Usage", function () {
        let sourceId;

        beforeEach(async function () {
            sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
        });

        it("Should benchmark water source addition", async function () {
            const sourceId2 = ethers.keccak256(ethers.toUtf8Bytes("source2"));
            
            const tx = await waterVault.addWaterSource(sourceId2, 90, ethers.parseEther("0.2"));
            const receipt = await tx.wait();
            
            console.log(`Add Water Source Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(100000); // Should be under 100k gas
        });

        it("Should benchmark water token minting", async function () {
            const amount = ethers.parseEther("1000");
            const payment = ethers.parseEther("100");
            
            const tx = await waterVault.connect(user1).mintWaterTokens(sourceId, amount, { value: payment });
            const receipt = await tx.wait();
            
            console.log(`Mint Water Tokens Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(200000); // Should be under 200k gas
        });

        it("Should benchmark water token burning", async function () {
            // First mint
            const amount = ethers.parseEther("1000");
            const payment = ethers.parseEther("100");
            await waterVault.connect(user1).mintWaterTokens(sourceId, amount, { value: payment });
            
            // Then burn
            const burnAmount = ethers.parseEther("500");
            const tx = await waterVault.connect(user1).burnWaterTokens(sourceId, burnAmount);
            const receipt = await tx.wait();
            
            console.log(`Burn Water Tokens Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(150000); // Should be under 150k gas
        });

        it("Should test gas efficiency with multiple sources", async function () {
            const amounts = [100, 500, 1000, 2000].map(n => ethers.parseEther(n.toString()));
            const payments = [10, 50, 100, 200].map(n => ethers.parseEther(n.toString()));
            const gasUsages = [];

            for (let i = 0; i < amounts.length; i++) {
                const tx = await waterVault.connect(user1).mintWaterTokens(sourceId, amounts[i], { value: payments[i] });
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed);
                console.log(`Mint ${amounts[i]} tokens - Gas Used: ${receipt.gasUsed.toString()}`);
            }

            // Gas should scale reasonably with amount
            expect(gasUsages[3]).to.be.lt(gasUsages[0] * 3); // 20x amount shouldn't use 3x gas
        });
    });

    describe("CarbonVault Gas Usage", function () {
        let creditId;

        beforeEach(async function () {
            creditId = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
        });

        it("Should benchmark carbon credit issuance", async function () {
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";
            
            const tx = await carbonVault.connect(issuer).issueCarbonCredit(
                creditId, user1.address, amount, vintage, projectType
            );
            const receipt = await tx.wait();
            
            console.log(`Issue Carbon Credit Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(250000); // Should be under 250k gas
        });

        it("Should benchmark carbon credit retirement", async function () {
            // First issue
            const amount = ethers.parseEther("1000");
            await carbonVault.connect(issuer).issueCarbonCredit(
                creditId, user1.address, amount, 2023, "Reforestation"
            );
            
            // Then retire
            const tx = await carbonVault.connect(user1).retireCarbonCredit(creditId);
            const receipt = await tx.wait();
            
            console.log(`Retire Carbon Credit Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(150000); // Should be under 150k gas
        });

        it("Should benchmark carbon credit trading", async function () {
            // Setup credit
            const amount = ethers.parseEther("1000");
            await carbonVault.connect(issuer).issueCarbonCredit(
                creditId, user1.address, amount, 2023, "Reforestation"
            );
            
            // Trade
            const tradeAmount = ethers.parseEther("500");
            const tx = await carbonVault.connect(user1).tradeCarbonCredit(creditId, user2.address, tradeAmount);
            const receipt = await tx.wait();
            
            console.log(`Trade Carbon Credit Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(120000); // Should be under 120k gas
        });

        it("Should compare gas usage across different credit sizes", async function () {
            const amounts = [100, 1000, 5000, 10000].map(n => ethers.parseEther(n.toString()));
            const gasUsages = [];

            for (let i = 0; i < amounts.length; i++) {
                const creditId = ethers.keccak256(ethers.toUtf8Bytes(`credit${i}`));
                await mockCarbonOracle.setCreditVerification(creditId, true);
                
                const tx = await carbonVault.connect(issuer).issueCarbonCredit(
                    creditId, user1.address, amounts[i], 2023, "Reforestation"
                );
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed);
                console.log(`Issue ${amounts[i]} tonne credit - Gas Used: ${receipt.gasUsed.toString()}`);
            }

            // Gas should remain fairly constant regardless of amount
            const maxGas = Math.max(...gasUsages.map(g => Number(g)));
            const minGas = Math.min(...gasUsages.map(g => Number(g)));
            expect(maxGas - minGas).to.be.lt(50000); // Variation should be less than 50k gas
        });
    });

    describe("ESGStablecoin Gas Usage", function () {
        beforeEach(async function () {
            await collateralToken.connect(user1).approve(await esgStablecoin.getAddress(), ethers.parseEther("10000"));
        });

        it("Should benchmark collateral deposit", async function () {
            const depositAmount = ethers.parseEther("1000");
            
            const tx = await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken.getAddress(),
                depositAmount
            );
            const receipt = await tx.wait();
            
            console.log(`Deposit Collateral Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(150000); // Should be under 150k gas
        });

        it("Should benchmark stablecoin minting", async function () {
            // Setup collateral first
            const depositAmount = ethers.parseEther("1000");
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken.getAddress(),
                depositAmount
            );
            
            // Mint stablecoin
            const mintAmount = ethers.parseEther("5000");
            const tx = await esgStablecoin.connect(user1).mintStablecoin(mintAmount);
            const receipt = await tx.wait();
            
            console.log(`Mint Stablecoin Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(200000); // Should be under 200k gas
        });

        it("Should benchmark liquidation", async function () {
            // Setup position
            const depositAmount = ethers.parseEther("1000");
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken.getAddress(),
                depositAmount
            );
            
            const mintAmount = ethers.parseEther("6000");
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);
            
            // Make position liquidatable
            await mockPriceOracle.setPrice(await collateralToken.getAddress(), ethers.parseEther("80"));
            
            // Setup liquidator
            await esgStablecoin.mint(user2.address, ethers.parseEther("10000"));
            
            // Liquidate
            const liquidateAmount = ethers.parseEther("2000");
            const tx = await esgStablecoin.connect(user2).liquidate(
                user1.address,
                await collateralToken.getAddress(),
                liquidateAmount
            );
            const receipt = await tx.wait();
            
            console.log(`Liquidation Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(300000); // Should be under 300k gas
        });

        it("Should test gas scaling with multiple collateral types", async function () {
            // Add more collateral assets
            const tokens = [];
            for (let i = 0; i < 3; i++) {
                const token = await MockERC20.deploy(`Token${i}`, `TOK${i}`, ethers.parseEther("1000000"));
                await token.waitForDeployment();
                tokens.push(token);
                
                await mockPriceOracle.setPrice(await token.getAddress(), ethers.parseEther("50"));
                await mockPriceOracle.setESGScore(await token.getAddress(), 85);
                await esgStablecoin.addCollateralAsset(await token.getAddress(), 15000, 80);
                
                await token.transfer(user1.address, ethers.parseEther("10000"));
                await token.connect(user1).approve(await esgStablecoin.getAddress(), ethers.parseEther("10000"));
            }

            const gasUsages = [];
            
            // Test minting with increasing number of collateral types
            for (let i = 1; i <= tokens.length; i++) {
                const user = await ethers.getSigner(i); // Use different user for each test
                
                // Deposit collateral from multiple tokens
                for (let j = 0; j < i; j++) {
                    await tokens[j].transfer(user.address, ethers.parseEther("1000"));
                    await tokens[j].connect(user).approve(await esgStablecoin.getAddress(), ethers.parseEther("1000"));
                    await esgStablecoin.connect(user).depositCollateral(await tokens[j].getAddress(), ethers.parseEther("1000"));
                }
                
                // Mint stablecoin
                const mintAmount = ethers.parseEther("2000");
                const tx = await esgStablecoin.connect(user).mintStablecoin(mintAmount);
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed);
                
                console.log(`Mint with ${i} collateral types - Gas Used: ${receipt.gasUsed.toString()}`);
            }

            // Gas should scale sub-linearly
            expect(gasUsages[2]).to.be.lt(gasUsages[0] * 2); // 3x collaterals shouldn't use 2x gas
        });
    });

    describe("CBDCBridge Gas Usage", function () {
        beforeEach(async function () {
            await collateralToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("10000"));
        });

        it("Should benchmark bridge initiation", async function () {
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            
            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await collateralToken.getAddress(),
                await collateralToken.getAddress(),
                user2.address,
                amount,
                137,
                { value: fee }
            );
            const receipt = await tx.wait();
            
            console.log(`Bridge Initiation Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(200000); // Should be under 200k gas
        });

        it("Should benchmark bridge completion", async function () {
            // Setup bridge transaction
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            
            const initTx = await cbdcBridge.connect(user1).initiateBridge(
                await collateralToken.getAddress(),
                await collateralToken.getAddress(),
                user2.address,
                amount,
                137,
                { value: fee }
            );
            
            const initReceipt = await initTx.wait();
            const event = initReceipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            const txId = event.args[0];
            
            // Setup for completion
            await mockCBDCValidator.setTransactionValidation(txId, true);
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");
            
            // Complete bridge
            const signature = ethers.toUtf8Bytes("mock_signature");
            const tx = await cbdcBridge.connect(validator).completeBridge(txId, signature);
            const receipt = await tx.wait();
            
            console.log(`Bridge Completion Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(150000); // Should be under 150k gas
        });

        it("Should benchmark bridge cancellation", async function () {
            // Setup bridge transaction
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            
            const initTx = await cbdcBridge.connect(user1).initiateBridge(
                await collateralToken.getAddress(),
                await collateralToken.getAddress(),
                user2.address,
                amount,
                137,
                { value: fee }
            );
            
            const initReceipt = await initTx.wait();
            const event = initReceipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            const txId = event.args[0];
            
            // Cancel bridge
            const tx = await cbdcBridge.connect(user1).cancelBridge(txId, "User cancellation");
            const receipt = await tx.wait();
            
            console.log(`Bridge Cancellation Gas Used: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(100000); // Should be under 100k gas
        });

        it("Should test gas efficiency with different bridge amounts", async function () {
            const amounts = [100, 1000, 10000, 50000].map(n => ethers.parseEther(n.toString()));
            const gasUsages = [];

            for (let i = 0; i < amounts.length; i++) {
                const amount = amounts[i];
                const fee = amount * 10n / 10000n;
                
                await collateralToken.connect(user1).approve(await cbdcBridge.getAddress(), amount);
                
                const tx = await cbdcBridge.connect(user1).initiateBridge(
                    await collateralToken.getAddress(),
                    await collateralToken.getAddress(),
                    user2.address,
                    amount,
                    137,
                    { value: fee }
                );
                const receipt = await tx.wait();
                gasUsages.push(receipt.gasUsed);
                console.log(`Bridge ${amount} tokens - Gas Used: ${receipt.gasUsed.toString()}`);
            }

            // Gas should remain fairly constant regardless of amount
            const maxGas = Math.max(...gasUsages.map(g => Number(g)));
            const minGas = Math.min(...gasUsages.map(g => Number(g)));
            expect(maxGas - minGas).to.be.lt(30000); // Variation should be less than 30k gas
        });
    });

    describe("Overall System Gas Benchmarks", function () {
        it("Should benchmark complete ESG workflow gas usage", async function () {
            console.log("\n=== Complete ESG Workflow Gas Analysis ===");
            
            // Step 1: Water token minting
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const waterAmount = ethers.parseEther("1000");
            const waterPayment = ethers.parseEther("100");
            
            let tx = await waterVault.connect(user1).mintWaterTokens(sourceId, waterAmount, { value: waterPayment });
            let receipt = await tx.wait();
            const waterMintGas = receipt.gasUsed;
            console.log(`1. Water Token Mint: ${waterMintGas.toString()} gas`);
            
            // Step 2: Carbon credit issuance
            const creditId = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
            tx = await carbonVault.connect(issuer).issueCarbonCredit(
                creditId, user1.address, ethers.parseEther("500"), 2023, "Reforestation"
            );
            receipt = await tx.wait();
            const carbonIssueGas = receipt.gasUsed;
            console.log(`2. Carbon Credit Issue: ${carbonIssueGas.toString()} gas`);
            
            // Step 3: Collateral deposit
            await collateralToken.connect(user1).approve(await esgStablecoin.getAddress(), ethers.parseEther("1000"));
            tx = await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken.getAddress(),
                ethers.parseEther("1000")
            );
            receipt = await tx.wait();
            const collateralDepositGas = receipt.gasUsed;
            console.log(`3. Collateral Deposit: ${collateralDepositGas.toString()} gas`);
            
            // Step 4: Stablecoin mint
            tx = await esgStablecoin.connect(user1).mintStablecoin(ethers.parseEther("5000"));
            receipt = await tx.wait();
            const stablecoinMintGas = receipt.gasUsed;
            console.log(`4. Stablecoin Mint: ${stablecoinMintGas.toString()} gas`);
            
            // Step 5: Bridge initiation
            await collateralToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("2000"));
            const bridgeAmount = ethers.parseEther("2000");
            const bridgeFee = bridgeAmount * 10n / 10000n;
            
            tx = await cbdcBridge.connect(user1).initiateBridge(
                await collateralToken.getAddress(),
                await collateralToken.getAddress(),
                user2.address,
                bridgeAmount,
                137,
                { value: bridgeFee }
            );
            receipt = await tx.wait();
            const bridgeInitGas = receipt.gasUsed;
            console.log(`5. Bridge Initiate: ${bridgeInitGas.toString()} gas`);
            
            const totalGas = waterMintGas + carbonIssueGas + collateralDepositGas + stablecoinMintGas + bridgeInitGas;
            console.log(`\nTotal Workflow Gas: ${totalGas.toString()}`);
            console.log(`Average per operation: ${(totalGas / 5n).toString()}`);
            
            // Workflow should be reasonably efficient
            expect(totalGas).to.be.lt(1000000); // Under 1M gas total
        });

        it("Should analyze gas costs for batch operations", async function () {
            console.log("\n=== Batch Operations Gas Analysis ===");
            
            // Test batch water token minting
            const sourceId = ethers.keccak256(ethers.toUtf8Bytes("source1"));
            const batchSizes = [1, 5, 10];
            
            for (let batchSize of batchSizes) {
                let totalGas = 0n;
                
                for (let i = 0; i < batchSize; i++) {
                    const amount = ethers.parseEther("100");
                    const payment = ethers.parseEther("10");
                    
                    const tx = await waterVault.connect(user1).mintWaterTokens(sourceId, amount, { value: payment });
                    const receipt = await tx.wait();
                    totalGas += receipt.gasUsed;
                }
                
                console.log(`Batch size ${batchSize}: ${totalGas.toString()} total gas, ${(totalGas / BigInt(batchSize)).toString()} per operation`);
            }
        });
    });
});