const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CarbonVault", function () {
    let CarbonVault, carbonVault;
    let MockCarbonOracle, mockOracle;
    let owner, issuer1, issuer2, user1, user2;
    let creditId1, creditId2;

    beforeEach(async function () {
        [owner, issuer1, issuer2, user1, user2] = await ethers.getSigners();

        // Deploy mock oracle
        MockCarbonOracle = await ethers.getContractFactory("MockCarbonOracle");
        mockOracle = await MockCarbonOracle.deploy();
        await mockOracle.waitForDeployment();

        // Deploy CarbonVault
        CarbonVault = await ethers.getContractFactory("CarbonVault");
        carbonVault = await CarbonVault.deploy(await mockOracle.getAddress());
        await carbonVault.waitForDeployment();

        // Setup test data
        creditId1 = ethers.keccak256(ethers.toUtf8Bytes("credit1"));
        creditId2 = ethers.keccak256(ethers.toUtf8Bytes("credit2"));
    });

    describe("Deployment", function () {
        it("Should set the correct oracle address", async function () {
            expect(await carbonVault.carbonOracle()).to.equal(await mockOracle.getAddress());
        });

        it("Should set the correct owner", async function () {
            expect(await carbonVault.owner()).to.equal(owner.address);
        });

        it("Should authorize owner as issuer by default", async function () {
            expect(await carbonVault.authorizedIssuers(owner.address)).to.be.true;
        });

        it("Should have correct token details", async function () {
            expect(await carbonVault.name()).to.equal("Carbon Credit Token");
            expect(await carbonVault.symbol()).to.equal("CARBON");
        });
    });

    describe("Issuer Management", function () {
        it("Should authorize new issuer", async function () {
            await expect(carbonVault.authorizeIssuer(issuer1.address))
                .to.emit(carbonVault, "IssuerAuthorized")
                .withArgs(issuer1.address);

            expect(await carbonVault.authorizedIssuers(issuer1.address)).to.be.true;
        });

        it("Should revoke issuer authorization", async function () {
            await carbonVault.authorizeIssuer(issuer1.address);
            
            await expect(carbonVault.revokeIssuer(issuer1.address))
                .to.emit(carbonVault, "IssuerRevoked")
                .withArgs(issuer1.address);

            expect(await carbonVault.authorizedIssuers(issuer1.address)).to.be.false;
        });

        it("Should only allow owner to manage issuers", async function () {
            await expect(
                carbonVault.connect(user1).authorizeIssuer(issuer1.address)
            ).to.be.revertedWithCustomError(carbonVault, "OwnableUnauthorizedAccount");

            await expect(
                carbonVault.connect(user1).revokeIssuer(owner.address)
            ).to.be.revertedWithCustomError(carbonVault, "OwnableUnauthorizedAccount");
        });
    });

    describe("Carbon Credit Issuance", function () {
        beforeEach(async function () {
            await carbonVault.authorizeIssuer(issuer1.address);
            await mockOracle.setCreditVerification(creditId1, true);
        });

        it("Should issue carbon credit successfully", async function () {
            const amount = ethers.parseEther("1000"); // 1000 tonnes
            const vintage = 2023;
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.emit(carbonVault, "CarbonCreditIssued")
                .withArgs(creditId1, issuer1.address, amount);

            const credit = await carbonVault.carbonCredits(creditId1);
            expect(credit.creditId).to.equal(creditId1);
            expect(credit.issuer).to.equal(issuer1.address);
            expect(credit.amount).to.equal(amount);
            expect(credit.vintage).to.equal(vintage);
            expect(credit.projectType).to.equal(projectType);
            expect(credit.verified).to.be.true;
            expect(credit.retired).to.be.false;

            expect(await carbonVault.balanceOf(user1.address)).to.equal(amount);
        });

        it("Should reject duplicate credit ID", async function () {
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";

            await carbonVault.connect(issuer1).issueCarbonCredit(
                creditId1, user1.address, amount, vintage, projectType
            );

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.be.revertedWith("Credit already exists");
        });

        it("Should reject vintage too old", async function () {
            const amount = ethers.parseEther("1000");
            const vintage = 2019; // Before MIN_VINTAGE (2020)
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.be.revertedWith("Vintage too old");
        });

        it("Should reject future vintage", async function () {
            const amount = ethers.parseEther("1000");
            const vintage = 2030; // Future year
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.be.revertedWith("Future vintage not allowed");
        });

        it("Should reject unverified credit from oracle", async function () {
            await mockOracle.setCreditVerification(creditId1, false);
            
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.be.revertedWith("Oracle verification failed");
        });

        it("Should reject issuance from unauthorized issuer", async function () {
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(user1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.be.revertedWith("Not authorized issuer");
        });

        it("Should reject issuance exceeding max supply", async function () {
            const maxSupply = await carbonVault.MAX_SUPPLY();
            const excessAmount = maxSupply + ethers.parseEther("1");
            const vintage = 2023;
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, excessAmount, vintage, projectType
                )
            ).to.be.revertedWith("Max supply exceeded");
        });
    });

    describe("Carbon Credit Retirement", function () {
        beforeEach(async function () {
            await carbonVault.authorizeIssuer(issuer1.address);
            await mockOracle.setCreditVerification(creditId1, true);
            
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";
            
            await carbonVault.connect(issuer1).issueCarbonCredit(
                creditId1, user1.address, amount, vintage, projectType
            );
        });

        it("Should retire carbon credit successfully", async function () {
            await expect(carbonVault.connect(user1).retireCarbonCredit(creditId1))
                .to.emit(carbonVault, "CarbonCreditRetired")
                .withArgs(creditId1, user1.address);

            const credit = await carbonVault.carbonCredits(creditId1);
            expect(credit.retired).to.be.true;
            expect(await carbonVault.balanceOf(user1.address)).to.equal(0);
        });

        it("Should reject retiring non-existent credit", async function () {
            await expect(carbonVault.connect(user1).retireCarbonCredit(creditId2))
                .to.be.revertedWith("Credit does not exist");
        });

        it("Should reject retiring already retired credit", async function () {
            await carbonVault.connect(user1).retireCarbonCredit(creditId1);
            
            await expect(carbonVault.connect(user1).retireCarbonCredit(creditId1))
                .to.be.revertedWith("Credit already retired");
        });

        it("Should reject retiring with insufficient balance", async function () {
            // Transfer away some tokens
            await carbonVault.connect(user1).transfer(user2.address, ethers.parseEther("500"));
            
            await expect(carbonVault.connect(user1).retireCarbonCredit(creditId1))
                .to.be.revertedWith("Insufficient balance");
        });
    });

    describe("Carbon Credit Trading", function () {
        beforeEach(async function () {
            await carbonVault.authorizeIssuer(issuer1.address);
            await mockOracle.setCreditVerification(creditId1, true);
            
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";
            
            await carbonVault.connect(issuer1).issueCarbonCredit(
                creditId1, user1.address, amount, vintage, projectType
            );
        });

        it("Should trade carbon credit successfully", async function () {
            const tradeAmount = ethers.parseEther("500");
            
            await carbonVault.connect(user1).tradeCarbonCredit(creditId1, user2.address, tradeAmount);
            
            expect(await carbonVault.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));
            expect(await carbonVault.balanceOf(user2.address)).to.equal(ethers.parseEther("500"));
        });

        it("Should reject trading non-existent credit", async function () {
            const tradeAmount = ethers.parseEther("500");
            
            await expect(
                carbonVault.connect(user1).tradeCarbonCredit(creditId2, user2.address, tradeAmount)
            ).to.be.revertedWith("Credit does not exist");
        });

        it("Should reject trading retired credit", async function () {
            await carbonVault.connect(user1).retireCarbonCredit(creditId1);
            const tradeAmount = ethers.parseEther("500");
            
            await expect(
                carbonVault.connect(user1).tradeCarbonCredit(creditId1, user2.address, tradeAmount)
            ).to.be.revertedWith("Credit is retired");
        });

        it("Should reject trading amount exceeding credit", async function () {
            const excessAmount = ethers.parseEther("2000");
            
            await expect(
                carbonVault.connect(user1).tradeCarbonCredit(creditId1, user2.address, excessAmount)
            ).to.be.revertedWith("Amount exceeds credit");
        });

        it("Should reject trading with insufficient balance", async function () {
            // Transfer away most tokens
            await carbonVault.connect(user1).transfer(user2.address, ethers.parseEther("900"));
            const tradeAmount = ethers.parseEther("500");
            
            await expect(
                carbonVault.connect(user1).tradeCarbonCredit(creditId1, user2.address, tradeAmount)
            ).to.be.revertedWith("Insufficient balance");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await carbonVault.authorizeIssuer(issuer1.address);
            await mockOracle.setCreditVerification(creditId1, true);
            
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";
            
            await carbonVault.connect(issuer1).issueCarbonCredit(
                creditId1, user1.address, amount, vintage, projectType
            );
        });

        it("Should return carbon credit details", async function () {
            const credit = await carbonVault.getCarbonCredit(creditId1);
            
            expect(credit.creditId).to.equal(creditId1);
            expect(credit.issuer).to.equal(issuer1.address);
            expect(credit.amount).to.equal(ethers.parseEther("1000"));
            expect(credit.vintage).to.equal(2023);
            expect(credit.projectType).to.equal("Reforestation");
            expect(credit.verified).to.be.true;
            expect(credit.retired).to.be.false;
        });

        it("Should return user credits", async function () {
            const userCredits = await carbonVault.getUserCredits(user1.address);
            expect(userCredits.length).to.equal(1);
            expect(userCredits[0]).to.equal(creditId1);
        });
    });

    describe("Oracle Management", function () {
        it("Should update oracle address", async function () {
            const newOracle = await MockCarbonOracle.deploy();
            await newOracle.waitForDeployment();

            await carbonVault.setCarbonOracle(await newOracle.getAddress());
            expect(await carbonVault.carbonOracle()).to.equal(await newOracle.getAddress());
        });

        it("Should reject zero address for oracle", async function () {
            await expect(carbonVault.setCarbonOracle(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid oracle address");
        });

        it("Should only allow owner to update oracle", async function () {
            const newOracle = await MockCarbonOracle.deploy();
            await newOracle.waitForDeployment();

            await expect(
                carbonVault.connect(user1).setCarbonOracle(await newOracle.getAddress())
            ).to.be.revertedWithCustomError(carbonVault, "OwnableUnauthorizedAccount");
        });
    });

    describe("Pausability", function () {
        beforeEach(async function () {
            await carbonVault.authorizeIssuer(issuer1.address);
        });

        it("Should pause and unpause contract", async function () {
            await carbonVault.pause();
            
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";
            
            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.be.revertedWithCustomError(carbonVault, "EnforcedPause");

            await carbonVault.unpause();
            await mockOracle.setCreditVerification(creditId1, true);
            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.not.be.reverted;
        });
    });

    describe("Edge Cases", function () {
        beforeEach(async function () {
            await carbonVault.authorizeIssuer(issuer1.address);
        });

        it("Should handle minimum vintage (2020)", async function () {
            await mockOracle.setCreditVerification(creditId1, true);
            const amount = ethers.parseEther("1000");
            const vintage = 2020;
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.not.be.reverted;
        });

        it("Should handle zero amount credits", async function () {
            await mockOracle.setCreditVerification(creditId1, true);
            const amount = 0;
            const vintage = 2023;
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    creditId1, user1.address, amount, vintage, projectType
                )
            ).to.not.be.reverted;
        });

        it("Should handle maximum credit ID", async function () {
            const maxCreditId = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
            await mockOracle.setCreditVerification(maxCreditId, true);
            const amount = ethers.parseEther("1000");
            const vintage = 2023;
            const projectType = "Reforestation";

            await expect(
                carbonVault.connect(issuer1).issueCarbonCredit(
                    maxCreditId, user1.address, amount, vintage, projectType
                )
            ).to.not.be.reverted;
        });
    });
});