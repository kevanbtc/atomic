const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ESGStablecoin", function () {
    let ESGStablecoin, esgStablecoin;
    let MockPriceOracle, mockOracle;
    let MockERC20, collateralToken1, collateralToken2;
    let owner, user1, user2, liquidator;

    beforeEach(async function () {
        [owner, user1, user2, liquidator] = await ethers.getSigners();

        // Deploy mock oracle
        MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
        mockOracle = await MockPriceOracle.deploy();
        await mockOracle.waitForDeployment();

        // Deploy ESGStablecoin
        ESGStablecoin = await ethers.getContractFactory("ESGStablecoin");
        esgStablecoin = await ESGStablecoin.deploy(await mockOracle.getAddress());
        await esgStablecoin.waitForDeployment();

        // Deploy mock collateral tokens
        MockERC20 = await ethers.getContractFactory("MockERC20");
        collateralToken1 = await MockERC20.deploy("Collateral Token 1", "COL1", ethers.parseEther("1000000"));
        await collateralToken1.waitForDeployment();
        
        collateralToken2 = await MockERC20.deploy("Collateral Token 2", "COL2", ethers.parseEther("1000000"));
        await collateralToken2.waitForDeployment();

        // Setup oracle prices and ESG scores
        await mockOracle.setPrice(await collateralToken1.getAddress(), ethers.parseEther("100")); // $100
        await mockOracle.setESGScore(await collateralToken1.getAddress(), 85);
        
        await mockOracle.setPrice(await collateralToken2.getAddress(), ethers.parseEther("50")); // $50
        await mockOracle.setESGScore(await collateralToken2.getAddress(), 75);

        // Transfer tokens to users
        await collateralToken1.transfer(user1.address, ethers.parseEther("10000"));
        await collateralToken2.transfer(user1.address, ethers.parseEther("10000"));
        await collateralToken1.transfer(user2.address, ethers.parseEther("10000"));
        await collateralToken2.transfer(user2.address, ethers.parseEther("10000"));
    });

    describe("Deployment", function () {
        it("Should set the correct oracle address", async function () {
            expect(await esgStablecoin.priceOracle()).to.equal(await mockOracle.getAddress());
        });

        it("Should set the correct owner", async function () {
            expect(await esgStablecoin.owner()).to.equal(owner.address);
        });

        it("Should have correct token details", async function () {
            expect(await esgStablecoin.name()).to.equal("ESG Stablecoin");
            expect(await esgStablecoin.symbol()).to.equal("ESGUSD");
        });

        it("Should have correct constants", async function () {
            expect(await esgStablecoin.TARGET_PRICE()).to.equal(ethers.parseEther("1"));
            expect(await esgStablecoin.LIQUIDATION_THRESHOLD()).to.equal(12000); // 120%
            expect(await esgStablecoin.ESG_SCORE_THRESHOLD()).to.equal(70);
        });
    });

    describe("Collateral Asset Management", function () {
        it("Should add collateral asset successfully", async function () {
            const collateralRatio = 15000; // 150%
            const minESGScore = 80;

            await expect(
                esgStablecoin.addCollateralAsset(
                    await collateralToken1.getAddress(),
                    collateralRatio,
                    minESGScore
                )
            ).to.emit(esgStablecoin, "CollateralAdded")
                .withArgs(await collateralToken1.getAddress(), collateralRatio, minESGScore);

            const asset = await esgStablecoin.collateralAssets(await collateralToken1.getAddress());
            expect(asset.tokenAddress).to.equal(await collateralToken1.getAddress());
            expect(asset.collateralRatio).to.equal(collateralRatio);
            expect(asset.minESGScore).to.equal(minESGScore);
            expect(asset.active).to.be.true;
        });

        it("Should reject invalid token address", async function () {
            await expect(
                esgStablecoin.addCollateralAsset(ethers.ZeroAddress, 15000, 80)
            ).to.be.revertedWith("Invalid token address");
        });

        it("Should reject collateral ratio too low", async function () {
            await expect(
                esgStablecoin.addCollateralAsset(
                    await collateralToken1.getAddress(),
                    9000, // Below 100%
                    80
                )
            ).to.be.revertedWith("Collateral ratio too low");
        });

        it("Should reject ESG score too low", async function () {
            await expect(
                esgStablecoin.addCollateralAsset(
                    await collateralToken1.getAddress(),
                    15000,
                    60 // Below threshold
                )
            ).to.be.revertedWith("ESG score too low");
        });

        it("Should reject duplicate asset", async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000,
                80
            );

            await expect(
                esgStablecoin.addCollateralAsset(
                    await collateralToken1.getAddress(),
                    16000,
                    85
                )
            ).to.be.revertedWith("Asset already added");
        });

        it("Should only allow owner to add collateral assets", async function () {
            await expect(
                esgStablecoin.connect(user1).addCollateralAsset(
                    await collateralToken1.getAddress(),
                    15000,
                    80
                )
            ).to.be.revertedWithCustomError(esgStablecoin, "OwnableUnauthorizedAccount");
        });

        it("Should toggle collateral active status", async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000,
                80
            );

            await esgStablecoin.toggleCollateralActive(await collateralToken1.getAddress());
            let asset = await esgStablecoin.collateralAssets(await collateralToken1.getAddress());
            expect(asset.active).to.be.false;

            await esgStablecoin.toggleCollateralActive(await collateralToken1.getAddress());
            asset = await esgStablecoin.collateralAssets(await collateralToken1.getAddress());
            expect(asset.active).to.be.true;
        });
    });

    describe("Collateral Deposit", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000, // 150%
                80
            );
        });

        it("Should deposit collateral successfully", async function () {
            const depositAmount = ethers.parseEther("100");
            
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            
            await expect(
                esgStablecoin.connect(user1).depositCollateral(
                    await collateralToken1.getAddress(),
                    depositAmount
                )
            ).to.emit(esgStablecoin, "CollateralDeposited")
                .withArgs(user1.address, await collateralToken1.getAddress(), depositAmount);

            expect(
                await esgStablecoin.userCollateral(user1.address, await collateralToken1.getAddress())
            ).to.equal(depositAmount);
            
            expect(await collateralToken1.balanceOf(await esgStablecoin.getAddress())).to.equal(depositAmount);
        });

        it("Should reject deposit of inactive collateral", async function () {
            await esgStablecoin.toggleCollateralActive(await collateralToken1.getAddress());
            
            const depositAmount = ethers.parseEther("100");
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            
            await expect(
                esgStablecoin.connect(user1).depositCollateral(
                    await collateralToken1.getAddress(),
                    depositAmount
                )
            ).to.be.revertedWith("Collateral not active");
        });

        it("Should reject deposit with low ESG score", async function () {
            await mockOracle.setESGScore(await collateralToken1.getAddress(), 60); // Below minimum
            
            const depositAmount = ethers.parseEther("100");
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            
            await expect(
                esgStablecoin.connect(user1).depositCollateral(
                    await collateralToken1.getAddress(),
                    depositAmount
                )
            ).to.be.revertedWith("ESG score too low");
        });
    });

    describe("Collateral Withdrawal", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000, // 150%
                80
            );

            const depositAmount = ethers.parseEther("100");
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken1.getAddress(),
                depositAmount
            );
        });

        it("Should withdraw collateral successfully", async function () {
            const withdrawAmount = ethers.parseEther("50");
            
            await expect(
                esgStablecoin.connect(user1).withdrawCollateral(
                    await collateralToken1.getAddress(),
                    withdrawAmount
                )
            ).to.emit(esgStablecoin, "CollateralWithdrawn")
                .withArgs(user1.address, await collateralToken1.getAddress(), withdrawAmount);

            expect(
                await esgStablecoin.userCollateral(user1.address, await collateralToken1.getAddress())
            ).to.equal(ethers.parseEther("50"));
        });

        it("Should reject withdrawal of insufficient collateral", async function () {
            const withdrawAmount = ethers.parseEther("150");
            
            await expect(
                esgStablecoin.connect(user1).withdrawCollateral(
                    await collateralToken1.getAddress(),
                    withdrawAmount
                )
            ).to.be.revertedWith("Insufficient collateral");
        });

        it("Should reject withdrawal that would cause undercollateralization", async function () {
            // Mint some stablecoin first
            const mintAmount = ethers.parseEther("5000"); // $5000 worth
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);
            
            // Try to withdraw too much collateral
            const withdrawAmount = ethers.parseEther("80"); // Would leave only $2000 collateral
            
            await expect(
                esgStablecoin.connect(user1).withdrawCollateral(
                    await collateralToken1.getAddress(),
                    withdrawAmount
                )
            ).to.be.revertedWith("Would become undercollateralized");
        });
    });

    describe("Stablecoin Minting", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000, // 150%
                80
            );

            const depositAmount = ethers.parseEther("100");
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken1.getAddress(),
                depositAmount
            );
        });

        it("Should mint stablecoin successfully", async function () {
            const mintAmount = ethers.parseEther("5000"); // $5000 worth
            
            await expect(esgStablecoin.connect(user1).mintStablecoin(mintAmount))
                .to.emit(esgStablecoin, "StablecoinMinted")
                .withArgs(user1.address, mintAmount);

            expect(await esgStablecoin.balanceOf(user1.address)).to.equal(mintAmount);
            expect(await esgStablecoin.userDebt(user1.address)).to.equal(mintAmount);
        });

        it("Should reject minting with insufficient collateralization", async function () {
            const mintAmount = ethers.parseEther("8000"); // More than 150% of $10,000 collateral
            
            await expect(
                esgStablecoin.connect(user1).mintStablecoin(mintAmount)
            ).to.be.revertedWith("Insufficient collateralization");
        });

        it("Should reject minting exceeding max supply", async function () {
            const maxSupply = await esgStablecoin.MAX_SUPPLY();
            const excessAmount = maxSupply + ethers.parseEther("1");
            
            await expect(
                esgStablecoin.connect(user1).mintStablecoin(excessAmount)
            ).to.be.revertedWith("Max supply exceeded");
        });
    });

    describe("Stablecoin Burning", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000, // 150%
                80
            );

            const depositAmount = ethers.parseEther("100");
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken1.getAddress(),
                depositAmount
            );

            const mintAmount = ethers.parseEther("5000");
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);
        });

        it("Should burn stablecoin successfully", async function () {
            const burnAmount = ethers.parseEther("2000");
            
            await expect(esgStablecoin.connect(user1).burnStablecoin(burnAmount))
                .to.emit(esgStablecoin, "StablecoinBurned")
                .withArgs(user1.address, burnAmount);

            expect(await esgStablecoin.balanceOf(user1.address)).to.equal(ethers.parseEther("3000"));
            expect(await esgStablecoin.userDebt(user1.address)).to.equal(ethers.parseEther("3000"));
        });

        it("Should reject burning with insufficient balance", async function () {
            const burnAmount = ethers.parseEther("6000");
            
            await expect(
                esgStablecoin.connect(user1).burnStablecoin(burnAmount)
            ).to.be.revertedWith("Insufficient balance");
        });

        it("Should reject burning exceeding debt", async function () {
            // Transfer some tokens to another user but keep debt
            await esgStablecoin.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
            const burnAmount = ethers.parseEther("5000");
            
            await expect(
                esgStablecoin.connect(user1).burnStablecoin(burnAmount)
            ).to.be.revertedWith("Amount exceeds debt");
        });
    });

    describe("Liquidation", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000, // 150%
                80
            );

            const depositAmount = ethers.parseEther("100");
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken1.getAddress(),
                depositAmount
            );

            const mintAmount = ethers.parseEther("5000");
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);

            // Provide liquidator with tokens
            await esgStablecoin.mint(liquidator.address, ethers.parseEther("10000"));
        });

        it("Should liquidate undercollateralized position", async function () {
            // Make user undercollateralized by dropping collateral price
            await mockOracle.setPrice(await collateralToken1.getAddress(), ethers.parseEther("60")); // $60

            const liquidateAmount = ethers.parseEther("1000");
            
            await expect(
                esgStablecoin.connect(liquidator).liquidate(
                    user1.address,
                    await collateralToken1.getAddress(),
                    liquidateAmount
                )
            ).to.emit(esgStablecoin, "Liquidation")
                .withArgs(user1.address, liquidator.address, liquidateAmount);

            expect(await esgStablecoin.userDebt(user1.address)).to.equal(ethers.parseEther("4000"));
        });

        it("Should reject liquidating sufficiently collateralized position", async function () {
            const liquidateAmount = ethers.parseEther("1000");
            
            await expect(
                esgStablecoin.connect(liquidator).liquidate(
                    user1.address,
                    await collateralToken1.getAddress(),
                    liquidateAmount
                )
            ).to.be.revertedWith("User is sufficiently collateralized");
        });

        it("Should reject liquidating with debt amount too high", async function () {
            // Make user undercollateralized
            await mockOracle.setPrice(await collateralToken1.getAddress(), ethers.parseEther("60"));
            
            const excessAmount = ethers.parseEther("6000");
            
            await expect(
                esgStablecoin.connect(liquidator).liquidate(
                    user1.address,
                    await collateralToken1.getAddress(),
                    excessAmount
                )
            ).to.be.revertedWith("Debt amount too high");
        });
    });

    describe("Collateralization Calculations", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000, // 150%
                80
            );
            await esgStablecoin.addCollateralAsset(
                await collateralToken2.getAddress(),
                18000, // 180%
                75
            );

            // Deposit different collateral types
            const depositAmount1 = ethers.parseEther("50"); // $5000 worth
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount1);
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken1.getAddress(),
                depositAmount1
            );

            const depositAmount2 = ethers.parseEther("100"); // $5000 worth
            await collateralToken2.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount2);
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken2.getAddress(),
                depositAmount2
            );
        });

        it("Should calculate collateralization ratio correctly", async function () {
            const mintAmount = ethers.parseEther("5000"); // $5000 debt
            await esgStablecoin.connect(user1).mintStablecoin(mintAmount);

            const ratio = await esgStablecoin.getCollateralizationRatio(user1.address);
            expect(ratio).to.equal(20000); // 200% (10000/5000 * 100)
        });

        it("Should return max value for zero debt", async function () {
            const ratio = await esgStablecoin.getCollateralizationRatio(user1.address);
            expect(ratio).to.equal(ethers.MaxUint256);
        });
    });

    describe("Oracle Management", function () {
        it("Should update oracle address", async function () {
            const newOracle = await MockPriceOracle.deploy();
            await newOracle.waitForDeployment();

            await esgStablecoin.setPriceOracle(await newOracle.getAddress());
            expect(await esgStablecoin.priceOracle()).to.equal(await newOracle.getAddress());
        });

        it("Should reject zero address for oracle", async function () {
            await expect(esgStablecoin.setPriceOracle(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid oracle address");
        });

        it("Should only allow owner to update oracle", async function () {
            const newOracle = await MockPriceOracle.deploy();
            await newOracle.waitForDeployment();

            await expect(
                esgStablecoin.connect(user1).setPriceOracle(await newOracle.getAddress())
            ).to.be.revertedWithCustomError(esgStablecoin, "OwnableUnauthorizedAccount");
        });
    });

    describe("Pausability", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000,
                80
            );
        });

        it("Should pause and unpause contract", async function () {
            await esgStablecoin.pause();
            
            const depositAmount = ethers.parseEther("100");
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            
            await expect(
                esgStablecoin.connect(user1).depositCollateral(
                    await collateralToken1.getAddress(),
                    depositAmount
                )
            ).to.be.revertedWithCustomError(esgStablecoin, "EnforcedPause");

            await esgStablecoin.unpause();
            await expect(
                esgStablecoin.connect(user1).depositCollateral(
                    await collateralToken1.getAddress(),
                    depositAmount
                )
            ).to.not.be.reverted;
        });
    });

    describe("Edge Cases", function () {
        beforeEach(async function () {
            await esgStablecoin.addCollateralAsset(
                await collateralToken1.getAddress(),
                15000,
                80
            );
        });

        it("Should handle exact liquidation threshold", async function () {
            const depositAmount = ethers.parseEther("120"); // $12,000 worth
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), depositAmount);
            await esgStablecoin.connect(user1).depositCollateral(
                await collateralToken1.getAddress(),
                depositAmount
            );

            // Mint exactly at liquidation threshold (120%)
            const mintAmount = ethers.parseEther("10000");
            await expect(esgStablecoin.connect(user1).mintStablecoin(mintAmount))
                .to.not.be.reverted;
        });

        it("Should handle zero collateral deposit", async function () {
            await collateralToken1.connect(user1).approve(await esgStablecoin.getAddress(), 0);
            
            await expect(
                esgStablecoin.connect(user1).depositCollateral(
                    await collateralToken1.getAddress(),
                    0
                )
            ).to.not.be.reverted;
        });

        it("Should handle minimum collateral ratio", async function () {
            await expect(
                esgStablecoin.addCollateralAsset(
                    await collateralToken2.getAddress(),
                    10000, // Exactly 100%
                    80
                )
            ).to.not.be.reverted;
        });
    });
});