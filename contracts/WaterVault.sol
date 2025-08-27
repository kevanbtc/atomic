// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title WaterVault
 * @dev Vault for water sustainability credits and ESG investments
 * @notice Manages water conservation projects and tokenizes water credits
 */
contract WaterVault is ReentrancyGuard, Pausable, Ownable {
    using Math for uint256;

    // Water project structure
    struct WaterProject {
        uint256 id;
        address projectOwner;
        string projectName;
        string location;
        uint256 waterSaved; // Liters saved annually
        uint256 creditRate; // Credits per liter saved
        uint256 totalCredits;
        uint256 availableCredits;
        bool isActive;
        uint256 verificationDate;
        bytes32 certificationHash;
    }

    // Water credit token
    struct WaterCredit {
        uint256 projectId;
        uint256 amount;
        uint256 mintDate;
        address owner;
        bool isRetired;
    }

    // State variables
    uint256 public nextProjectId = 1;
    uint256 public nextCreditId = 1;
    uint256 public totalWaterSaved;
    uint256 public totalCreditsIssued;
    
    // Oracle settings
    address public waterOracle;
    uint256 public oracleUpdateFrequency = 24 hours;
    uint256 public lastOracleUpdate;
    
    // Fee settings
    uint256 public platformFeeRate = 250; // 2.5% in basis points
    address public feeRecipient;
    
    // Mappings
    mapping(uint256 => WaterProject) public projects;
    mapping(uint256 => WaterCredit) public credits;
    mapping(address => uint256[]) public userProjects;
    mapping(address => uint256[]) public userCredits;
    mapping(bytes32 => bool) public usedCertifications;

    // Events
    event ProjectRegistered(uint256 indexed projectId, address indexed owner, string projectName, uint256 waterSaved);
    event ProjectVerified(uint256 indexed projectId, uint256 waterSaved, bytes32 certificationHash);
    event CreditsIssued(uint256 indexed projectId, uint256 indexed creditId, uint256 amount, address indexed recipient);
    event CreditsRetired(uint256 indexed creditId, address indexed retiree, uint256 amount);
    event CreditsTransferred(uint256 indexed creditId, address indexed from, address indexed to);
    event OracleUpdated(address indexed newOracle, uint256 timestamp);
    event ProjectStatusChanged(uint256 indexed projectId, bool isActive);

    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == waterOracle, "WaterVault: Only oracle can call");
        _;
    }

    modifier validProject(uint256 projectId) {
        require(projectId > 0 && projectId < nextProjectId, "WaterVault: Invalid project ID");
        require(projects[projectId].isActive, "WaterVault: Project not active");
        _;
    }

    modifier validCredit(uint256 creditId) {
        require(creditId > 0 && creditId < nextCreditId, "WaterVault: Invalid credit ID");
        require(!credits[creditId].isRetired, "WaterVault: Credit already retired");
        _;
    }

    constructor(address _feeRecipient, address _waterOracle) {
        require(_feeRecipient != address(0), "WaterVault: Invalid fee recipient");
        feeRecipient = _feeRecipient;
        waterOracle = _waterOracle;
        lastOracleUpdate = block.timestamp;
    }

    /**
     * @dev Register a new water conservation project
     * @param projectName Name of the water project
     * @param location Geographic location of the project
     * @param waterSaved Annual water savings in liters
     * @param creditRate Credits per liter saved
     */
    function registerProject(
        string calldata projectName,
        string calldata location,
        uint256 waterSaved,
        uint256 creditRate
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(bytes(projectName).length > 0, "WaterVault: Project name required");
        require(bytes(location).length > 0, "WaterVault: Location required");
        require(waterSaved > 0, "WaterVault: Water saved must be positive");
        require(creditRate > 0, "WaterVault: Credit rate must be positive");

        uint256 projectId = nextProjectId++;
        uint256 totalCredits = waterSaved * creditRate / 1e18; // Scale factor

        projects[projectId] = WaterProject({
            id: projectId,
            projectOwner: msg.sender,
            projectName: projectName,
            location: location,
            waterSaved: waterSaved,
            creditRate: creditRate,
            totalCredits: totalCredits,
            availableCredits: 0, // Credits available after verification
            isActive: false, // Requires verification
            verificationDate: 0,
            certificationHash: bytes32(0)
        });

        userProjects[msg.sender].push(projectId);

        emit ProjectRegistered(projectId, msg.sender, projectName, waterSaved);
        return projectId;
    }

    /**
     * @dev Verify a water project and enable credit issuance
     * @param projectId ID of the project to verify
     * @param certificationHash Hash of the certification document
     */
    function verifyProject(uint256 projectId, bytes32 certificationHash) 
        external 
        onlyOracle 
        nonReentrant 
    {
        require(projectId > 0 && projectId < nextProjectId, "WaterVault: Invalid project ID");
        require(certificationHash != bytes32(0), "WaterVault: Invalid certification hash");
        require(!usedCertifications[certificationHash], "WaterVault: Certification already used");

        WaterProject storage project = projects[projectId];
        require(!project.isActive, "WaterVault: Project already verified");

        project.isActive = true;
        project.verificationDate = block.timestamp;
        project.certificationHash = certificationHash;
        project.availableCredits = project.totalCredits;

        usedCertifications[certificationHash] = true;
        totalWaterSaved += project.waterSaved;

        emit ProjectVerified(projectId, project.waterSaved, certificationHash);
        emit ProjectStatusChanged(projectId, true);
    }

    /**
     * @dev Issue water credits for a verified project
     * @param projectId ID of the verified project
     * @param amount Amount of credits to issue
     * @param recipient Address to receive the credits
     */
    function issueCredits(uint256 projectId, uint256 amount, address recipient) 
        external 
        validProject(projectId) 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        require(recipient != address(0), "WaterVault: Invalid recipient");
        require(amount > 0, "WaterVault: Amount must be positive");

        WaterProject storage project = projects[projectId];
        require(msg.sender == project.projectOwner, "WaterVault: Only project owner can issue");
        require(project.availableCredits >= amount, "WaterVault: Insufficient available credits");

        uint256 creditId = nextCreditId++;
        
        credits[creditId] = WaterCredit({
            projectId: projectId,
            amount: amount,
            mintDate: block.timestamp,
            owner: recipient,
            isRetired: false
        });

        project.availableCredits -= amount;
        totalCreditsIssued += amount;
        userCredits[recipient].push(creditId);

        emit CreditsIssued(projectId, creditId, amount, recipient);
        return creditId;
    }

    /**
     * @dev Transfer water credits to another address
     * @param creditId ID of the credit to transfer
     * @param to Address to transfer to
     */
    function transferCredits(uint256 creditId, address to) 
        external 
        validCredit(creditId) 
        nonReentrant 
        whenNotPaused 
    {
        require(to != address(0), "WaterVault: Invalid recipient");
        WaterCredit storage credit = credits[creditId];
        require(msg.sender == credit.owner, "WaterVault: Only owner can transfer");

        // Remove from current owner's credits
        _removeUserCredit(credit.owner, creditId);
        
        // Update ownership
        credit.owner = to;
        userCredits[to].push(creditId);

        emit CreditsTransferred(creditId, msg.sender, to);
    }

    /**
     * @dev Retire water credits (permanently remove from circulation)
     * @param creditId ID of the credit to retire
     */
    function retireCredits(uint256 creditId) 
        external 
        validCredit(creditId) 
        nonReentrant 
        whenNotPaused 
    {
        WaterCredit storage credit = credits[creditId];
        require(msg.sender == credit.owner, "WaterVault: Only owner can retire");

        credit.isRetired = true;
        _removeUserCredit(credit.owner, creditId);

        emit CreditsRetired(creditId, msg.sender, credit.amount);
    }

    /**
     * @dev Update oracle address
     * @param newOracle New oracle address
     */
    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "WaterVault: Invalid oracle address");
        waterOracle = newOracle;
        lastOracleUpdate = block.timestamp;
        emit OracleUpdated(newOracle, block.timestamp);
    }

    /**
     * @dev Update platform fee rate
     * @param newFeeRate New fee rate in basis points
     */
    function updateFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= 1000, "WaterVault: Fee rate too high"); // Max 10%
        platformFeeRate = newFeeRate;
    }

    /**
     * @dev Pause the contract
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

    /**
     * @dev Deactivate a project (only owner or oracle)
     * @param projectId ID of the project to deactivate
     */
    function deactivateProject(uint256 projectId) external {
        require(projectId > 0 && projectId < nextProjectId, "WaterVault: Invalid project ID");
        require(
            msg.sender == owner() || msg.sender == waterOracle || msg.sender == projects[projectId].projectOwner,
            "WaterVault: Unauthorized"
        );

        projects[projectId].isActive = false;
        emit ProjectStatusChanged(projectId, false);
    }

    // View functions
    function getProject(uint256 projectId) external view returns (WaterProject memory) {
        require(projectId > 0 && projectId < nextProjectId, "WaterVault: Invalid project ID");
        return projects[projectId];
    }

    function getCredit(uint256 creditId) external view returns (WaterCredit memory) {
        require(creditId > 0 && creditId < nextCreditId, "WaterVault: Invalid credit ID");
        return credits[creditId];
    }

    function getUserProjects(address user) external view returns (uint256[] memory) {
        return userProjects[user];
    }

    function getUserCredits(address user) external view returns (uint256[] memory) {
        return userCredits[user];
    }

    function getActiveProjectsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextProjectId; i++) {
            if (projects[i].isActive) {
                count++;
            }
        }
        return count;
    }

    // Internal functions
    function _removeUserCredit(address user, uint256 creditId) internal {
        uint256[] storage userCreditsList = userCredits[user];
        for (uint256 i = 0; i < userCreditsList.length; i++) {
            if (userCreditsList[i] == creditId) {
                userCreditsList[i] = userCreditsList[userCreditsList.length - 1];
                userCreditsList.pop();
                break;
            }
        }
    }
}