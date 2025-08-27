const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WaterVault", function () {
    let WaterVault, waterVault;
    let MockWaterOracle, mockOracle;
    let owner, addr1, addr2;
    let sourceId1, sourceId2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy mock oracle
        MockWaterOracle = await ethers.getContractFactory("MockWaterOracle");
        mockOracle = await MockWaterOracle.deploy();
        await mockOracle.waitForDeployment();

        // Deploy WaterVault
        WaterVault = await ethers.getContractFactory("WaterVault");
        waterVault = await WaterVault.deploy(await mockOracle.getAddress());
        await waterVault.waitForDeployment();

        // Setup test data
        sourceId1 = ethers.keccak256(ethers.toUtf8Bytes("source1"));
        sourceId2 = ethers.keccak256(ethers.toUtf8Bytes("source2"));
    });

    describe("Deployment", function () {
        it("Should set the correct oracle address", async function () {
            expect(await waterVault.waterOracle()).to.equal(await mockOracle.getAddress());
        });

        it("Should set the correct owner", async function () {
            expect(await waterVault.owner()).to.equal(owner.address);
        });

        it("Should have correct token details", async function () {
            expect(await waterVault.name()).to.equal("WaterVault Token");
            expect(await waterVault.symbol()).to.equal("WATER");
        });
    });

    describe("Water Source Management", function () {
        it("Should add a water source successfully", async function () {
            await expect(waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1")))
                .to.emit(waterVault, "WaterSourceAdded")
                .withArgs(sourceId1, 85);

            const source = await waterVault.waterSources(sourceId1);
            expect(source.sourceId).to.equal(sourceId1);
            expect(source.qualityRating).to.equal(85);
            expect(source.pricePerUnit).to.equal(ethers.parseEther("0.1"));
            expect(source.active).to.be.true;
        });

        it("Should reject water source with low quality", async function () {
            await expect(waterVault.addWaterSource(sourceId1, 70, ethers.parseEther("0.1")))
                .to.be.revertedWith("Quality below threshold");
        });

        it("Should reject duplicate water source", async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
            await expect(waterVault.addWaterSource(sourceId1, 90, ethers.parseEther("0.2")))
                .to.be.revertedWith("Source already exists");
        });

        it("Should only allow owner to add water sources", async function () {
            await expect(
                waterVault.connect(addr1).addWaterSource(sourceId1, 85, ethers.parseEther("0.1"))
            ).to.be.revertedWithCustomError(waterVault, "OwnableUnauthorizedAccount");
        });

        it("Should toggle source active status", async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
            
            await waterVault.toggleSourceActive(sourceId1);
            let source = await waterVault.waterSources(sourceId1);
            expect(source.active).to.be.false;

            await waterVault.toggleSourceActive(sourceId1);
            source = await waterVault.waterSources(sourceId1);
            expect(source.active).to.be.true;
        });
    });

    describe("Token Minting", function () {
        beforeEach(async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
            await mockOracle.setWaterQuality(sourceId1, 85);
        });

        it("Should mint water tokens successfully", async function () {
            const amount = ethers.parseEther("100");
            const payment = ethers.parseEther("10"); // 0.1 * 100

            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment })
            ).to.emit(waterVault, "WaterTokenMinted")
                .withArgs(addr1.address, sourceId1, amount);

            expect(await waterVault.balanceOf(addr1.address)).to.equal(amount);
            expect(await waterVault.userSourceBalances(addr1.address, sourceId1)).to.equal(amount);
        });

        it("Should reject minting with insufficient payment", async function () {
            const amount = ethers.parseEther("100");
            const insufficientPayment = ethers.parseEther("5");

            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: insufficientPayment })
            ).to.be.revertedWith("Insufficient payment");
        });

        it("Should reject minting from inactive source", async function () {
            await waterVault.toggleSourceActive(sourceId1);
            const amount = ethers.parseEther("100");
            const payment = ethers.parseEther("10");

            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment })
            ).to.be.revertedWith("Source not active");
        });

        it("Should reject minting if oracle quality check fails", async function () {
            await mockOracle.setWaterQuality(sourceId1, 70); // Below threshold
            const amount = ethers.parseEther("100");
            const payment = ethers.parseEther("10");

            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment })
            ).to.be.revertedWith("Oracle quality check failed");
        });

        it("Should reject minting if max supply exceeded", async function () {
            const maxSupply = await waterVault.MAX_SUPPLY();
            const amount = maxSupply + ethers.parseEther("1");
            const payment = ethers.parseEther("100000"); // Very high payment

            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment })
            ).to.be.revertedWith("Max supply exceeded");
        });
    });

    describe("Token Burning", function () {
        beforeEach(async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
            await mockOracle.setWaterQuality(sourceId1, 85);
            
            const amount = ethers.parseEther("100");
            const payment = ethers.parseEther("10");
            await waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment });
        });

        it("Should burn water tokens successfully", async function () {
            const burnAmount = ethers.parseEther("50");

            await expect(
                waterVault.connect(addr1).burnWaterTokens(sourceId1, burnAmount)
            ).to.emit(waterVault, "WaterTokenBurned")
                .withArgs(addr1.address, sourceId1, burnAmount);

            expect(await waterVault.balanceOf(addr1.address)).to.equal(ethers.parseEther("50"));
            expect(await waterVault.userSourceBalances(addr1.address, sourceId1)).to.equal(ethers.parseEther("50"));
        });

        it("Should reject burning with insufficient source balance", async function () {
            const burnAmount = ethers.parseEther("150");

            await expect(
                waterVault.connect(addr1).burnWaterTokens(sourceId1, burnAmount)
            ).to.be.revertedWith("Insufficient source balance");
        });

        it("Should reject burning with insufficient token balance", async function () {
            // Transfer some tokens to reduce balance but keep source balance
            await waterVault.connect(addr1).transfer(addr2.address, ethers.parseEther("50"));
            const burnAmount = ethers.parseEther("100");

            await expect(
                waterVault.connect(addr1).burnWaterTokens(sourceId1, burnAmount)
            ).to.be.revertedWith("Insufficient token balance");
        });
    });

    describe("Oracle Management", function () {
        it("Should update oracle address", async function () {
            const newOracle = await MockWaterOracle.deploy();
            await newOracle.waitForDeployment();

            await expect(waterVault.setWaterOracle(await newOracle.getAddress()))
                .to.emit(waterVault, "OracleUpdated")
                .withArgs(await newOracle.getAddress());

            expect(await waterVault.waterOracle()).to.equal(await newOracle.getAddress());
        });

        it("Should reject zero address for oracle", async function () {
            await expect(waterVault.setWaterOracle(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid oracle address");
        });

        it("Should only allow owner to update oracle", async function () {
            const newOracle = await MockWaterOracle.deploy();
            await newOracle.waitForDeployment();

            await expect(
                waterVault.connect(addr1).setWaterOracle(await newOracle.getAddress())
            ).to.be.revertedWithCustomError(waterVault, "OwnableUnauthorizedAccount");
        });
    });

    describe("Pausability", function () {
        beforeEach(async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
        });

        it("Should pause and unpause contract", async function () {
            await waterVault.pause();
            
            const amount = ethers.parseEther("100");
            const payment = ethers.parseEther("10");
            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment })
            ).to.be.revertedWithCustomError(waterVault, "EnforcedPause");

            await waterVault.unpause();
            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment })
            ).to.not.be.reverted;
        });

        it("Should only allow owner to pause/unpause", async function () {
            await expect(
                waterVault.connect(addr1).pause()
            ).to.be.revertedWithCustomError(waterVault, "OwnableUnauthorizedAccount");

            await expect(
                waterVault.connect(addr1).unpause()
            ).to.be.revertedWithCustomError(waterVault, "OwnableUnauthorizedAccount");
        });
    });

    describe("Withdrawal", function () {
        it("Should allow owner to withdraw contract balance", async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
            
            const amount = ethers.parseEther("100");
            const payment = ethers.parseEther("10");
            await waterVault.connect(addr1).mintWaterTokens(sourceId1, amount, { value: payment });

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
            const tx = await waterVault.withdraw();
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;

            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
            expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + payment - gasCost);
        });

        it("Should only allow owner to withdraw", async function () {
            await expect(
                waterVault.connect(addr1).withdraw()
            ).to.be.revertedWithCustomError(waterVault, "OwnableUnauthorizedAccount");
        });
    });

    describe("View Functions", function () {
        it("Should return water source info", async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
            const info = await waterVault.getWaterSourceInfo(sourceId1);
            
            expect(info.sourceId).to.equal(sourceId1);
            expect(info.qualityRating).to.equal(85);
            expect(info.pricePerUnit).to.equal(ethers.parseEther("0.1"));
            expect(info.active).to.be.true;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum source ID", async function () {
            const maxSourceId = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
            await expect(waterVault.addWaterSource(maxSourceId, 85, ethers.parseEther("0.1")))
                .to.not.be.reverted;
        });

        it("Should handle zero amount minting", async function () {
            await waterVault.addWaterSource(sourceId1, 85, ethers.parseEther("0.1"));
            await expect(
                waterVault.connect(addr1).mintWaterTokens(sourceId1, 0, { value: 0 })
            ).to.not.be.reverted;
        });

        it("Should handle quality threshold boundary", async function () {
            // Exactly at threshold
            await expect(waterVault.addWaterSource(sourceId1, 80, ethers.parseEther("0.1")))
                .to.not.be.reverted;
            
            // Just below threshold
            await expect(waterVault.addWaterSource(sourceId2, 79, ethers.parseEther("0.1")))
                .to.be.revertedWith("Quality below threshold");
        });
    });
});