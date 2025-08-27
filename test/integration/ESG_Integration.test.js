const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ESG System Integration Tests", function() {
  let waterVault, carbonVault, esgStablecoin, cbdcBridge;
  let mockWaterOracle, mockCarbonOracle, mockPriceOracle, mockCBDCValidator;
  let owner, user1, user2;

  beforeEach(async function() {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock oracles
    const MockWaterOracle = await ethers.getContractFactory("MockWaterOracle");
    mockWaterOracle = await MockWaterOracle.deploy();

    const MockCarbonOracle = await ethers.getContractFactory("MockCarbonOracle");
    mockCarbonOracle = await MockCarbonOracle.deploy();

    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();

    const MockCBDCValidator = await ethers.getContractFactory("MockCBDCValidator");
    mockCBDCValidator = await MockCBDCValidator.deploy();

    // Deploy core contracts
    const WaterVault = await ethers.getContractFactory("WaterVault");
    waterVault = await WaterVault.deploy();

    const CarbonVault = await ethers.getContractFactory("CarbonVault");
    carbonVault = await CarbonVault.deploy(mockCarbonOracle.address);

    const ESGStablecoin = await ethers.getContractFactory("ESGStablecoin");
    esgStablecoin = await ESGStablecoin.deploy(
      "ESG Stablecoin", 
      "ESGUSD",
      mockPriceOracle.address
    );

    const CBDCBridge = await ethers.getContractFactory("CBDCBridge");
    cbdcBridge = await CBDCBridge.deploy(mockCBDCValidator.address);

    // Setup integrations
    await waterVault.setWaterOracle(mockWaterOracle.address);
    await esgStablecoin.addCollateralAsset(waterVault.address, 8000); // 80% LTV
    await esgStablecoin.addCollateralAsset(carbonVault.address, 7000); // 70% LTV
  });

  describe("End-to-End ESG Flow", function() {
    it("Should complete water credit → stablecoin → CBDC flow", async function() {
      // Step 1: Register water source and mint credits
      const sourceId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("source1"));
      await waterVault.registerWaterSource(sourceId, "Test Water Source", "California, USA");
      await waterVault.mint(user1.address, ethers.utils.parseEther("1000"));

      expect(await waterVault.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("1000"));

      // Step 2: Use water credits as collateral for stablecoin
      await waterVault.connect(user1).approve(esgStablecoin.address, ethers.utils.parseEther("1000"));
      await esgStablecoin.connect(user1).depositCollateral(
        waterVault.address,
        ethers.utils.parseEther("1000")
      );

      // Mint stablecoin (80% of collateral value)
      await esgStablecoin.connect(user1).mintStablecoin(ethers.utils.parseEther("800"));
      expect(await esgStablecoin.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("800"));

      // Step 3: Bridge stablecoin to CBDC
      await esgStablecoin.connect(user1).approve(cbdcBridge.address, ethers.utils.parseEther("500"));
      
      const txHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("tx1"));
      await mockCBDCValidator.setTransactionValidation(txHash, true);

      await cbdcBridge.connect(user1).initiateBridge(
        ethers.utils.parseEther("500"),
        "USD",
        "destination_address",
        txHash
      );

      // Verify bridge transaction recorded
      const bridgeTx = await cbdcBridge.transactions(txHash);
      expect(bridgeTx.amount).to.equal(ethers.utils.parseEther("500"));
      expect(bridgeTx.status).to.equal(0); // Initiated
    });

    it("Should handle carbon credit retirement and offset tracking", async function() {
      // Issue carbon credits
      const projectId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("project1"));
      await carbonVault.issueCredits(user1.address, projectId, 1000, 2024, 0); // Forestry type

      expect(await carbonVault.balanceOf(user1.address)).to.equal(1000);

      // Retire credits for permanent offset
      await carbonVault.connect(user1).retireCredits(500, "Voluntary offset");

      expect(await carbonVault.balanceOf(user1.address)).to.equal(500);
      expect(await carbonVault.totalRetiredCredits()).to.equal(500);
    });

    it("Should maintain collateralization ratios during price changes", async function() {
      // Setup initial position
      await waterVault.mint(user1.address, ethers.utils.parseEther("1000"));
      await waterVault.connect(user1).approve(esgStablecoin.address, ethers.utils.parseEther("1000"));
      await esgStablecoin.connect(user1).depositCollateral(
        waterVault.address,
        ethers.utils.parseEther("1000")
      );
      await esgStablecoin.connect(user1).mintStablecoin(ethers.utils.parseEther("600"));

      // Simulate price drop that triggers liquidation threshold
      await mockPriceOracle.setPrice(waterVault.address, ethers.utils.parseEther("0.7")); // 30% price drop

      // Check if position becomes liquidatable
      const position = await esgStablecoin.positions(user1.address, waterVault.address);
      const collateralRatio = await esgStablecoin.getCollateralizationRatio(user1.address, waterVault.address);
      
      expect(collateralRatio).to.be.below(12000); // Below 120% threshold
    });
  });

  describe("Oracle Integration", function() {
    it("Should handle oracle failures gracefully", async function() {
      // Test with invalid oracle responses
      await mockWaterOracle.setWaterPrice(0); // Invalid price
      
      await expect(
        waterVault.mint(user1.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Invalid oracle price");
    });
  });

  describe("Compliance and Security", function() {
    it("Should enforce transaction limits and KYC requirements", async function() {
      // Test daily limits
      await cbdcBridge.setDailyLimit(ethers.utils.parseEther("1000"));
      
      await expect(
        cbdcBridge.connect(user1).initiateBridge(
          ethers.utils.parseEther("1500"),
          "USD",
          "destination",
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("tx1"))
        )
      ).to.be.revertedWith("Exceeds daily limit");
    });

    it("Should handle emergency pause scenarios", async function() {
      // Pause all contracts
      await waterVault.pause();
      await carbonVault.pause();
      await esgStablecoin.pause();
      await cbdcBridge.pause();

      // Verify all operations are paused
      await expect(waterVault.mint(user1.address, 100)).to.be.revertedWith("Pausable: paused");
      await expect(carbonVault.issueCredits(user1.address, ethers.constants.HashZero, 100, 2024, 0)).to.be.revertedWith("Pausable: paused");
    });
  });
});