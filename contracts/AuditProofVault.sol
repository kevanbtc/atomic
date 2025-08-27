// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AuditProofVault
 * @dev ERC-6551 compatible vault for audit proof NFTs
 * @notice Enables audit proof NFTs to act as smart accounts with financial capabilities
 */
contract AuditProofVault is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // State variables
    address public immutable nftContract;
    uint256 public immutable tokenId;
    address public immutable registry;
    
    // Financial data
    struct FinancialData {
        uint256 totalDeposits;
        uint256 totalWithdrawals;
        uint256 creditLimit;
        bool isCollateralized;
        address[] approvedTokens;
        mapping(address => uint256) tokenBalances;
    }
    
    FinancialData public financialData;
    mapping(address => bool) public authorizedOperators;
    
    // Events
    event Deposit(address indexed token, uint256 amount, address indexed depositor);
    event Withdrawal(address indexed token, uint256 amount, address indexed recipient);
    event CreditLimitSet(uint256 newLimit);
    event CollateralizationStatusChanged(bool isCollateralized);
    event OperatorAuthorized(address indexed operator, bool authorized);
    
    // Custom errors
    error Unauthorized();
    error InsufficientBalance(address token, uint256 requested, uint256 available);
    error TokenNotApproved(address token);
    error InvalidCreditLimit(uint256 limit);
    
    constructor(
        address _nftContract,
        uint256 _tokenId,
        address _registry
    ) {
        nftContract = _nftContract;
        tokenId = _tokenId;
        registry = _registry;
    }
    
    /**
     * @dev Check if caller is the NFT owner or authorized operator
     */
    modifier onlyAuthorized() {
        address nftOwner = IERC721(nftContract).ownerOf(tokenId);
        if (msg.sender != owner && !authorizedOperators[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }
    
    /**
     * @dev Get the current owner of the associated NFT
     */
    function owner() public view returns (address) {
        return IERC721(nftContract).ownerOf(tokenId);
    }
    
    /**
     * @dev Deposit ERC20 tokens into the vault
     * @param token Token contract address
     * @param amount Amount to deposit
     */
    function depositToken(address token, uint256 amount) external nonReentrant {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Add to approved tokens if not already present
        if (financialData.tokenBalances[token] == 0) {
            financialData.approvedTokens.push(token);
        }
        
        financialData.tokenBalances[token] += amount;
        financialData.totalDeposits += amount;
        
        emit Deposit(token, amount, msg.sender);
    }
    
    /**
     * @dev Deposit ETH into the vault
     */
    function depositETH() external payable nonReentrant {
        financialData.tokenBalances[address(0)] += msg.value;
        financialData.totalDeposits += msg.value;
        
        emit Deposit(address(0), msg.value, msg.sender);
    }
    
    /**
     * @dev Withdraw ERC20 tokens from the vault
     * @param token Token contract address  
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function withdrawToken(
        address token,
        uint256 amount,
        address to
    ) external onlyAuthorized nonReentrant {
        uint256 balance = financialData.tokenBalances[token];
        if (balance < amount) {
            revert InsufficientBalance(token, amount, balance);
        }
        
        financialData.tokenBalances[token] -= amount;
        financialData.totalWithdrawals += amount;
        
        IERC20(token).safeTransfer(to, amount);
        
        emit Withdrawal(token, amount, to);
    }
    
    /**
     * @dev Withdraw ETH from the vault
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function withdrawETH(uint256 amount, address payable to) external onlyAuthorized nonReentrant {
        uint256 balance = financialData.tokenBalances[address(0)];
        if (balance < amount) {
            revert InsufficientBalance(address(0), amount, balance);
        }
        
        financialData.tokenBalances[address(0)] -= amount;
        financialData.totalWithdrawals += amount;
        
        to.transfer(amount);
        
        emit Withdrawal(address(0), amount, to);
    }
    
    /**
     * @dev Set credit limit for the vault (based on audit proof value)
     * @param newLimit New credit limit
     */
    function setCreditLimit(uint256 newLimit) external onlyAuthorized {
        // Could add logic to validate against appraised value from NFT
        financialData.creditLimit = newLimit;
        emit CreditLimitSet(newLimit);
    }
    
    /**
     * @dev Set collateralization status
     * @param isCollateralized Whether the vault is collateralized
     */
    function setCollateralizationStatus(bool isCollateralized) external onlyAuthorized {
        financialData.isCollateralized = isCollateralized;
        emit CollateralizationStatusChanged(isCollateralized);
    }
    
    /**
     * @dev Authorize an operator to manage the vault
     * @param operator Address to authorize
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedOperator(address operator, bool authorized) external onlyAuthorized {
        authorizedOperators[operator] = authorized;
        emit OperatorAuthorized(operator, authorized);
    }
    
    /**
     * @dev Get token balance in the vault
     * @param token Token address (address(0) for ETH)
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return financialData.tokenBalances[token];
    }
    
    /**
     * @dev Get list of approved tokens
     */
    function getApprovedTokens() external view returns (address[] memory) {
        return financialData.approvedTokens;
    }
    
    /**
     * @dev Get vault financial summary
     */
    function getFinancialSummary() external view returns (
        uint256 totalDeposits,
        uint256 totalWithdrawals,
        uint256 creditLimit,
        bool isCollateralized,
        uint256 ethBalance
    ) {
        return (
            financialData.totalDeposits,
            financialData.totalWithdrawals,
            financialData.creditLimit,
            financialData.isCollateralized,
            financialData.tokenBalances[address(0)]
        );
    }
    
    /**
     * @dev Execute arbitrary call (for advanced integrations)
     * @param to Target contract
     * @param value ETH value to send
     * @param data Call data
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyAuthorized nonReentrant returns (bytes memory result) {
        (bool success, bytes memory returnData) = to.call{value: value}(data);
        require(success, "Call failed");
        return returnData;
    }
    
    /**
     * @dev Receive ETH deposits
     */
    receive() external payable {
        financialData.tokenBalances[address(0)] += msg.value;
        financialData.totalDeposits += msg.value;
        emit Deposit(address(0), msg.value, msg.sender);
    }
    
    /**
     * @dev Handle NFT transfers (ERC721Receiver implementation)
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 _tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    
    /**
     * @dev Check if this contract supports an interface
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC721Receiver).interfaceId;
    }
}