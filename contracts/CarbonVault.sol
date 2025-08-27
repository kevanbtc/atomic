// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface ICarbonOracle {
    function getCarbonPrice() external view returns (uint256);
    function verifyCarbonCredit(bytes32 creditId) external view returns (bool);
}

contract CarbonVault is ERC20, ERC20Burnable, Ownable, ReentrancyGuard, Pausable {
    ICarbonOracle public carbonOracle;
    
    struct CarbonCredit {
        bytes32 creditId;
        address issuer;
        uint256 amount; // tonnes of CO2
        uint256 vintage; // year of credit generation
        string projectType;
        bool verified;
        bool retired;
    }
    
    mapping(bytes32 => CarbonCredit) public carbonCredits;
    mapping(address => bytes32[]) public userCredits;
    mapping(address => bool) public authorizedIssuers;
    
    uint256 public constant MIN_VINTAGE = 2020;
    uint256 public constant MAX_SUPPLY = 10000000 * 10**18; // 10M tonnes
    
    event CarbonCreditIssued(bytes32 indexed creditId, address indexed issuer, uint256 amount);
    event CarbonCreditRetired(bytes32 indexed creditId, address indexed retiree);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);
    
    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized issuer");
        _;
    }
    
    constructor(address _carbonOracle) ERC20("Carbon Credit Token", "CARBON") Ownable(msg.sender) {
        carbonOracle = ICarbonOracle(_carbonOracle);
        authorizedIssuers[msg.sender] = true;
    }
    
    function authorizeIssuer(address _issuer) external onlyOwner {
        authorizedIssuers[_issuer] = true;
        emit IssuerAuthorized(_issuer);
    }
    
    function revokeIssuer(address _issuer) external onlyOwner {
        authorizedIssuers[_issuer] = false;
        emit IssuerRevoked(_issuer);
    }
    
    function issueCarbonCredit(
        bytes32 _creditId,
        address _to,
        uint256 _amount,
        uint256 _vintage,
        string memory _projectType
    ) external onlyAuthorizedIssuer whenNotPaused {
        require(carbonCredits[_creditId].creditId == bytes32(0), "Credit already exists");
        require(_vintage >= MIN_VINTAGE, "Vintage too old");
        require(_vintage <= (block.timestamp / (365 * 24 * 60 * 60)) + 1970, "Future vintage not allowed");
        require(totalSupply() + _amount <= MAX_SUPPLY, "Max supply exceeded");
        
        bool verified = carbonOracle.verifyCarbonCredit(_creditId);
        require(verified, "Oracle verification failed");
        
        carbonCredits[_creditId] = CarbonCredit({
            creditId: _creditId,
            issuer: msg.sender,
            amount: _amount,
            vintage: _vintage,
            projectType: _projectType,
            verified: true,
            retired: false
        });
        
        userCredits[_to].push(_creditId);
        _mint(_to, _amount);
        
        emit CarbonCreditIssued(_creditId, msg.sender, _amount);
    }
    
    function retireCarbonCredit(bytes32 _creditId) external nonReentrant {
        CarbonCredit storage credit = carbonCredits[_creditId];
        require(credit.creditId != bytes32(0), "Credit does not exist");
        require(!credit.retired, "Credit already retired");
        require(balanceOf(msg.sender) >= credit.amount, "Insufficient balance");
        
        credit.retired = true;
        _burn(msg.sender, credit.amount);
        
        emit CarbonCreditRetired(_creditId, msg.sender);
    }
    
    function tradeCarbonCredit(bytes32 _creditId, address _to, uint256 _amount) external {
        CarbonCredit storage credit = carbonCredits[_creditId];
        require(credit.creditId != bytes32(0), "Credit does not exist");
        require(!credit.retired, "Credit is retired");
        require(_amount <= credit.amount, "Amount exceeds credit");
        require(balanceOf(msg.sender) >= _amount, "Insufficient balance");
        
        _transfer(msg.sender, _to, _amount);
    }
    
    function getCarbonCredit(bytes32 _creditId) external view returns (CarbonCredit memory) {
        return carbonCredits[_creditId];
    }
    
    function getUserCredits(address _user) external view returns (bytes32[] memory) {
        return userCredits[_user];
    }
    
    function setCarbonOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle address");
        carbonOracle = ICarbonOracle(_newOracle);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}