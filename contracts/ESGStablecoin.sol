// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ESGStablecoin
 * @dev ESG-backed stablecoin with multi-collateral support
 * @notice Stablecoin backed by carbon credits, water credits, and other ESG assets
 */
contract ESGStablecoin is ERC20, ERC20Burnable, ReentrancyGuard, Pausable, Ownable {
    using Math for uint256;

    // Collateral types
    enum CollateralType {
        CarbonCredits,
        WaterCredits,
        RenewableEnergy,
        GreenBonds,
        ESGTokens
    }

    // Collateral asset structure
    struct CollateralAsset {
        address tokenAddress;
        CollateralType collateralType;
        uint256 collateralRatio; // Collateral ratio in basis points (e.g., 15000 = 150%)
        uint256 liquidationThreshold; // Liquidation threshold in basis points (e.g., 12000 = 120%)
        uint256 totalDeposited;
        uint256 totalBorrowed; // Amount of stablecoin borrowed against this collateral
        bool isActive;
        address priceOracle;
        uint256 lastPriceUpdate;
    }

    // User position structure
    struct Position {
        uint256 collateralAmount;
        uint256 borrowedAmount;
        uint256 lastUpdate;
        bool isActive;
    }

    // Liquidation data
    struct LiquidationData {
        address user;
        address collateralAsset;
        uint256 collateralAmount;
        uint256 debtAmount;
        uint256 liquidationPrice;
        uint256 timestamp;
    }

    // State variables
    uint256 public constant TARGET_PRICE = 1e18; // $1.00 target price
    uint256 public stabilityFeeRate = 300; // 3% annual stability fee
    uint256 public liquidationPenalty = 1300; // 13% liquidation penalty
    uint256 public minimumCollateralRatio = 11000; // 110% minimum collateral ratio
    
    // ESG scoring
    uint256 public constant ESG_SCORE_MULTIPLIER = 10000;
    mapping(address => uint256) public userESGScore; // ESG score out of 10000
    mapping(CollateralType => uint256) public typeESGWeight; // ESG weight by type
    
    // Treasury and fees
    address public treasury;
    address public emergencyOracle;
    uint256 public totalProtocolFees;
    uint256 public lastFeeCollection;
    
    // Collateral management
    address[] public collateralAssets;
    mapping(address => CollateralAsset) public collaterals;
    mapping(address => mapping(address => Position)) public positions; // user -> collateral -> position
    mapping(address => uint256) public totalUserDebt; // user -> total debt across all collaterals
    
    // Price stability
    uint256 public currentPrice = TARGET_PRICE;
    uint256 public lastPriceUpdate;
    uint256 public priceUpdateFrequency = 1 hours;
    
    // Liquidation tracking
    LiquidationData[] public liquidationHistory;
    mapping(address => uint256[]) public userLiquidations;

    // Events
    event CollateralDeposited(address indexed user, address indexed collateralAsset, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed collateralAsset, uint256 amount);
    event StablecoinMinted(address indexed user, address indexed collateralAsset, uint256 amount);
    event StablecoinBurned(address indexed user, address indexed collateralAsset, uint256 amount);
    event CollateralAdded(address indexed asset, CollateralType collateralType, uint256 collateralRatio);
    event CollateralUpdated(address indexed asset, uint256 newCollateralRatio, uint256 newLiquidationThreshold);
    event Liquidation(address indexed user, address indexed collateralAsset, uint256 collateralLiquidated, uint256 debtRepaid);
    event PriceUpdated(uint256 newPrice, uint256 timestamp);
    event ESGScoreUpdated(address indexed user, uint256 newScore);
    event StabilityFeeCollected(address indexed user, uint256 feeAmount);

    // Modifiers
    modifier validCollateral(address asset) {
        require(collaterals[asset].isActive, "ESGStablecoin: Invalid or inactive collateral");
        _;
    }

    modifier onlyEmergencyOracle() {
        require(msg.sender == emergencyOracle, "ESGStablecoin: Only emergency oracle");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _treasury,
        address _emergencyOracle
    ) ERC20(name, symbol) {
        require(_treasury != address(0), "ESGStablecoin: Invalid treasury");
        require(_emergencyOracle != address(0), "ESGStablecoin: Invalid emergency oracle");
        
        treasury = _treasury;
        emergencyOracle = _emergencyOracle;
        lastFeeCollection = block.timestamp;
        lastPriceUpdate = block.timestamp;

        // Initialize ESG weights for different collateral types
        typeESGWeight[CollateralType.CarbonCredits] = 3000; // 30%
        typeESGWeight[CollateralType.WaterCredits] = 2500;  // 25%
        typeESGWeight[CollateralType.RenewableEnergy] = 2000; // 20%
        typeESGWeight[CollateralType.GreenBonds] = 1500;   // 15%
        typeESGWeight[CollateralType.ESGTokens] = 1000;    // 10%
    }

    /**
     * @dev Add a new collateral asset
     * @param asset Address of the collateral token
     * @param collateralType Type of collateral
     * @param collateralRatio Required collateral ratio in basis points
     * @param liquidationThreshold Liquidation threshold in basis points
     * @param priceOracle Oracle address for price feeds
     */
    function addCollateral(
        address asset,
        CollateralType collateralType,
        uint256 collateralRatio,
        uint256 liquidationThreshold,
        address priceOracle
    ) external onlyOwner {
        require(asset != address(0), "ESGStablecoin: Invalid asset address");
        require(priceOracle != address(0), "ESGStablecoin: Invalid oracle address");
        require(collateralRatio >= minimumCollateralRatio, "ESGStablecoin: Ratio too low");
        require(liquidationThreshold < collateralRatio, "ESGStablecoin: Invalid liquidation threshold");
        require(!collaterals[asset].isActive, "ESGStablecoin: Collateral already exists");

        collaterals[asset] = CollateralAsset({
            tokenAddress: asset,
            collateralType: collateralType,
            collateralRatio: collateralRatio,
            liquidationThreshold: liquidationThreshold,
            totalDeposited: 0,
            totalBorrowed: 0,
            isActive: true,
            priceOracle: priceOracle,
            lastPriceUpdate: block.timestamp
        });

        collateralAssets.push(asset);
        emit CollateralAdded(asset, collateralType, collateralRatio);
    }

    /**
     * @dev Deposit collateral to back stablecoin minting
     * @param collateralAsset Address of the collateral asset
     * @param amount Amount of collateral to deposit
     */
    function depositCollateral(address collateralAsset, uint256 amount) 
        external 
        validCollateral(collateralAsset)
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "ESGStablecoin: Amount must be positive");
        
        IERC20(collateralAsset).transferFrom(msg.sender, address(this), amount);
        
        Position storage position = positions[msg.sender][collateralAsset];
        position.collateralAmount += amount;
        position.lastUpdate = block.timestamp;
        position.isActive = true;
        
        collaterals[collateralAsset].totalDeposited += amount;
        
        // Update user's ESG score based on collateral type
        _updateESGScore(msg.sender, collateralAsset, amount, true);
        
        emit CollateralDeposited(msg.sender, collateralAsset, amount);
    }

    /**
     * @dev Mint stablecoin against deposited collateral
     * @param collateralAsset Address of the collateral asset
     * @param amount Amount of stablecoin to mint
     */
    function mintStablecoin(address collateralAsset, uint256 amount) 
        external 
        validCollateral(collateralAsset)
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "ESGStablecoin: Amount must be positive");
        
        Position storage position = positions[msg.sender][collateralAsset];
        require(position.isActive && position.collateralAmount > 0, "ESGStablecoin: No collateral deposited");
        
        uint256 maxMintable = _getMaxMintable(msg.sender, collateralAsset);
        require(amount <= maxMintable, "ESGStablecoin: Exceeds collateral ratio");
        
        position.borrowedAmount += amount;
        position.lastUpdate = block.timestamp;
        
        totalUserDebt[msg.sender] += amount;
        collaterals[collateralAsset].totalBorrowed += amount;
        
        _mint(msg.sender, amount);
        
        emit StablecoinMinted(msg.sender, collateralAsset, amount);
    }

    /**
     * @dev Repay stablecoin debt and unlock collateral
     * @param collateralAsset Address of the collateral asset
     * @param amount Amount of stablecoin to repay
     */
    function repayStablecoin(address collateralAsset, uint256 amount) 
        external 
        validCollateral(collateralAsset)
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "ESGStablecoin: Amount must be positive");
        
        Position storage position = positions[msg.sender][collateralAsset];
        require(position.borrowedAmount >= amount, "ESGStablecoin: Exceeds debt amount");
        
        // Collect stability fee
        uint256 stabilityFee = _calculateStabilityFee(msg.sender, collateralAsset);
        if (stabilityFee > 0) {
            require(balanceOf(msg.sender) >= amount + stabilityFee, "ESGStablecoin: Insufficient balance for fee");
            _burn(msg.sender, stabilityFee);
            totalProtocolFees += stabilityFee;
            emit StabilityFeeCollected(msg.sender, stabilityFee);
        }
        
        _burn(msg.sender, amount);
        
        position.borrowedAmount -= amount;
        position.lastUpdate = block.timestamp;
        
        totalUserDebt[msg.sender] -= amount;
        collaterals[collateralAsset].totalBorrowed -= amount;
        
        emit StablecoinBurned(msg.sender, collateralAsset, amount);
    }

    /**
     * @dev Withdraw collateral after repaying debt
     * @param collateralAsset Address of the collateral asset
     * @param amount Amount of collateral to withdraw
     */
    function withdrawCollateral(address collateralAsset, uint256 amount) 
        external 
        validCollateral(collateralAsset)
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "ESGStablecoin: Amount must be positive");
        
        Position storage position = positions[msg.sender][collateralAsset];
        require(position.collateralAmount >= amount, "ESGStablecoin: Insufficient collateral");
        
        // Check if withdrawal maintains healthy collateral ratio
        uint256 remainingCollateral = position.collateralAmount - amount;
        if (position.borrowedAmount > 0) {
            uint256 collateralValue = _getCollateralValue(collateralAsset, remainingCollateral);
            uint256 requiredValue = (position.borrowedAmount * collaterals[collateralAsset].collateralRatio) / 10000;
            require(collateralValue >= requiredValue, "ESGStablecoin: Would breach collateral ratio");
        }
        
        position.collateralAmount -= amount;
        position.lastUpdate = block.timestamp;
        
        if (position.collateralAmount == 0 && position.borrowedAmount == 0) {
            position.isActive = false;
        }
        
        collaterals[collateralAsset].totalDeposited -= amount;
        
        // Update ESG score
        _updateESGScore(msg.sender, collateralAsset, amount, false);
        
        IERC20(collateralAsset).transfer(msg.sender, amount);
        
        emit CollateralWithdrawn(msg.sender, collateralAsset, amount);
    }

    /**
     * @dev Liquidate an undercollateralized position
     * @param user Address of the user to liquidate
     * @param collateralAsset Address of the collateral asset
     * @param debtAmount Amount of debt to repay
     */
    function liquidate(address user, address collateralAsset, uint256 debtAmount) 
        external 
        validCollateral(collateralAsset)
        nonReentrant 
        whenNotPaused 
    {
        require(user != address(0), "ESGStablecoin: Invalid user address");
        require(debtAmount > 0, "ESGStablecoin: Invalid debt amount");
        
        Position storage position = positions[user][collateralAsset];
        require(position.isActive, "ESGStablecoin: No active position");
        require(position.borrowedAmount >= debtAmount, "ESGStablecoin: Exceeds user debt");
        
        // Check if position is liquidatable
        require(_isLiquidatable(user, collateralAsset), "ESGStablecoin: Position is healthy");
        
        // Calculate collateral to seize
        uint256 collateralPrice = _getCollateralPrice(collateralAsset);
        uint256 collateralToSeize = (debtAmount * (10000 + liquidationPenalty) * 1e18) / (collateralPrice * 10000);
        
        require(position.collateralAmount >= collateralToSeize, "ESGStablecoin: Insufficient collateral");
        
        // Transfer debt token from liquidator
        _burn(msg.sender, debtAmount);
        
        // Transfer collateral to liquidator
        position.collateralAmount -= collateralToSeize;
        position.borrowedAmount -= debtAmount;
        position.lastUpdate = block.timestamp;
        
        totalUserDebt[user] -= debtAmount;
        collaterals[collateralAsset].totalBorrowed -= debtAmount;
        collaterals[collateralAsset].totalDeposited -= collateralToSeize;
        
        IERC20(collateralAsset).transfer(msg.sender, collateralToSeize);
        
        // Record liquidation
        LiquidationData memory liquidationData = LiquidationData({
            user: user,
            collateralAsset: collateralAsset,
            collateralAmount: collateralToSeize,
            debtAmount: debtAmount,
            liquidationPrice: collateralPrice,
            timestamp: block.timestamp
        });
        
        liquidationHistory.push(liquidationData);
        userLiquidations[user].push(liquidationHistory.length - 1);
        
        emit Liquidation(user, collateralAsset, collateralToSeize, debtAmount);
    }

    /**
     * @dev Update price from oracle (emergency oracle only)
     * @param newPrice New price for the stablecoin
     */
    function updatePrice(uint256 newPrice) external onlyEmergencyOracle {
        require(newPrice > 0, "ESGStablecoin: Invalid price");
        currentPrice = newPrice;
        lastPriceUpdate = block.timestamp;
        emit PriceUpdated(newPrice, block.timestamp);
    }

    /**
     * @dev Update user's ESG score
     * @param user User address
     * @param newScore New ESG score (0-10000)
     */
    function updateESGScore(address user, uint256 newScore) external onlyOwner {
        require(newScore <= ESG_SCORE_MULTIPLIER, "ESGStablecoin: Invalid ESG score");
        userESGScore[user] = newScore;
        emit ESGScoreUpdated(user, newScore);
    }

    /**
     * @dev Collect protocol fees to treasury
     */
    function collectFees() external nonReentrant {
        require(totalProtocolFees > 0, "ESGStablecoin: No fees to collect");
        uint256 fees = totalProtocolFees;
        totalProtocolFees = 0;
        lastFeeCollection = block.timestamp;
        
        _mint(treasury, fees);
    }

    /**
     * @dev Pause the contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // View functions
    function getCollateralInfo(address asset) external view returns (CollateralAsset memory) {
        return collaterals[asset];
    }

    function getUserPosition(address user, address collateralAsset) external view returns (Position memory) {
        return positions[user][collateralAsset];
    }

    function getMaxMintable(address user, address collateralAsset) external view returns (uint256) {
        return _getMaxMintable(user, collateralAsset);
    }

    function isLiquidatable(address user, address collateralAsset) external view returns (bool) {
        return _isLiquidatable(user, collateralAsset);
    }

    function getCollateralRatio(address user, address collateralAsset) external view returns (uint256) {
        return _getCollateralRatio(user, collateralAsset);
    }

    function getUserESGScore(address user) external view returns (uint256) {
        return userESGScore[user];
    }

    function getCollateralAssets() external view returns (address[] memory) {
        return collateralAssets;
    }

    function getLiquidationHistory(uint256 index) external view returns (LiquidationData memory) {
        require(index < liquidationHistory.length, "ESGStablecoin: Invalid index");
        return liquidationHistory[index];
    }

    // Internal functions
    function _getCollateralValue(address collateralAsset, uint256 amount) internal view returns (uint256) {
        uint256 price = _getCollateralPrice(collateralAsset);
        return (amount * price) / 1e18;
    }

    function _getCollateralPrice(address collateralAsset) internal view returns (uint256) {
        // In production, this would call the price oracle
        // For now, return a mock price
        return 1e18; // $1 per token
    }

    function _getMaxMintable(address user, address collateralAsset) internal view returns (uint256) {
        Position storage position = positions[user][collateralAsset];
        if (!position.isActive || position.collateralAmount == 0) {
            return 0;
        }

        uint256 collateralValue = _getCollateralValue(collateralAsset, position.collateralAmount);
        uint256 maxBorrow = (collateralValue * 10000) / collaterals[collateralAsset].collateralRatio;
        
        if (maxBorrow <= position.borrowedAmount) {
            return 0;
        }
        
        return maxBorrow - position.borrowedAmount;
    }

    function _isLiquidatable(address user, address collateralAsset) internal view returns (bool) {
        uint256 ratio = _getCollateralRatio(user, collateralAsset);
        return ratio > 0 && ratio < collaterals[collateralAsset].liquidationThreshold;
    }

    function _getCollateralRatio(address user, address collateralAsset) internal view returns (uint256) {
        Position storage position = positions[user][collateralAsset];
        if (position.borrowedAmount == 0) {
            return type(uint256).max; // Infinite ratio when no debt
        }
        
        uint256 collateralValue = _getCollateralValue(collateralAsset, position.collateralAmount);
        return (collateralValue * 10000) / position.borrowedAmount;
    }

    function _calculateStabilityFee(address user, address collateralAsset) internal view returns (uint256) {
        Position storage position = positions[user][collateralAsset];
        if (position.borrowedAmount == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - position.lastUpdate;
        uint256 annualFee = (position.borrowedAmount * stabilityFeeRate) / 10000;
        return (annualFee * timeElapsed) / 365 days;
    }

    function _updateESGScore(address user, address collateralAsset, uint256 amount, bool isDeposit) internal {
        CollateralType collateralType = collaterals[collateralAsset].collateralType;
        uint256 weight = typeESGWeight[collateralType];
        uint256 scoreImpact = (amount * weight) / 1e18;
        
        if (isDeposit) {
            userESGScore[user] = Math.min(userESGScore[user] + scoreImpact, ESG_SCORE_MULTIPLIER);
        } else {
            if (userESGScore[user] > scoreImpact) {
                userESGScore[user] -= scoreImpact;
            } else {
                userESGScore[user] = 0;
            }
        }
        
        emit ESGScoreUpdated(user, userESGScore[user]);
    }
}