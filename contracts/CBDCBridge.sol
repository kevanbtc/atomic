// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// MessageHashUtils not available in this version

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ICBDCValidator {
    function validateTransaction(bytes32 txHash, bytes memory signature) external view returns (bool);
    function isAuthorizedCBDC(address cbdcToken) external view returns (bool);
}

contract CBDCBridge is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    // MessageHashUtils usage removed for compatibility
    
    ICBDCValidator public cbdcValidator;
    
    struct BridgeTransaction {
        bytes32 txId;
        address sourceToken;
        address targetToken;
        address sender;
        address recipient;
        uint256 amount;
        uint256 sourceChain;
        uint256 targetChain;
        uint256 timestamp;
        bool completed;
        bool cancelled;
    }
    
    mapping(bytes32 => BridgeTransaction) public bridgeTransactions;
    mapping(address => bool) public authorizedValidators;
    mapping(address => uint256) public tokenLimits; // daily limits
    mapping(address => mapping(uint256 => uint256)) public dailyVolume; // token => day => volume
    
    uint256 public constant MIN_CONFIRMATION_TIME = 300; // 5 minutes
    uint256 public constant MAX_TRANSACTION_AMOUNT = 1000000 * 10**18; // 1M tokens
    uint256 public bridgeFee = 10; // 0.1% in basis points
    
    event BridgeInitiated(
        bytes32 indexed txId,
        address indexed sourceToken,
        address indexed sender,
        uint256 amount,
        uint256 targetChain
    );
    event BridgeCompleted(bytes32 indexed txId, address indexed recipient);
    event BridgeCancelled(bytes32 indexed txId, string reason);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event TokenLimitSet(address indexed token, uint256 limit);
    
    modifier onlyAuthorizedValidator() {
        require(authorizedValidators[msg.sender], "Not authorized validator");
        _;
    }
    
    constructor(address _cbdcValidator) {
        cbdcValidator = ICBDCValidator(_cbdcValidator);
        authorizedValidators[msg.sender] = true;
    }
    
    function addValidator(address _validator) external onlyOwner {
        require(_validator != address(0), "Invalid validator address");
        authorizedValidators[_validator] = true;
        emit ValidatorAdded(_validator);
    }
    
    function removeValidator(address _validator) external onlyOwner {
        authorizedValidators[_validator] = false;
        emit ValidatorRemoved(_validator);
    }
    
    function setTokenLimit(address _token, uint256 _limit) external onlyOwner {
        tokenLimits[_token] = _limit;
        emit TokenLimitSet(_token, _limit);
    }
    
    function initiateBridge(
        address _sourceToken,
        address _targetToken,
        address _recipient,
        uint256 _amount,
        uint256 _targetChain
    ) external payable nonReentrant whenNotPaused {
        require(_amount > 0 && _amount <= MAX_TRANSACTION_AMOUNT, "Invalid amount");
        require(_recipient != address(0), "Invalid recipient");
        require(cbdcValidator.isAuthorizedCBDC(_sourceToken), "Unauthorized source token");
        require(cbdcValidator.isAuthorizedCBDC(_targetToken), "Unauthorized target token");
        
        // Check daily limits
        uint256 today = block.timestamp / 86400;
        require(dailyVolume[_sourceToken][today] + _amount <= tokenLimits[_sourceToken], "Daily limit exceeded");
        
        // Calculate fee
        uint256 fee = (_amount * bridgeFee) / 10000;
        require(msg.value >= fee, "Insufficient bridge fee");
        
        bytes32 txId = keccak256(abi.encodePacked(
            _sourceToken,
            _targetToken,
            msg.sender,
            _recipient,
            _amount,
            block.chainid,
            _targetChain,
            block.timestamp
        ));
        
        require(bridgeTransactions[txId].txId == bytes32(0), "Transaction already exists");
        
        // Lock source tokens
        IERC20(_sourceToken).transferFrom(msg.sender, address(this), _amount);
        
        bridgeTransactions[txId] = BridgeTransaction({
            txId: txId,
            sourceToken: _sourceToken,
            targetToken: _targetToken,
            sender: msg.sender,
            recipient: _recipient,
            amount: _amount,
            sourceChain: block.chainid,
            targetChain: _targetChain,
            timestamp: block.timestamp,
            completed: false,
            cancelled: false
        });
        
        dailyVolume[_sourceToken][today] += _amount;
        
        emit BridgeInitiated(txId, _sourceToken, msg.sender, _amount, _targetChain);
    }
    
    function completeBridge(
        bytes32 _txId,
        bytes memory _validatorSignature
    ) external onlyAuthorizedValidator nonReentrant {
        BridgeTransaction storage transaction = bridgeTransactions[_txId];
        require(transaction.txId != bytes32(0), "Transaction does not exist");
        require(!transaction.completed, "Transaction already completed");
        require(!transaction.cancelled, "Transaction was cancelled");
        require(
            block.timestamp >= transaction.timestamp + MIN_CONFIRMATION_TIME,
            "Minimum confirmation time not met"
        );
        
        // Validate the transaction with CBDC validator
        require(
            cbdcValidator.validateTransaction(_txId, _validatorSignature),
            "Invalid validator signature"
        );
        
        transaction.completed = true;
        
        // Release tokens to recipient (in practice, this would mint on target chain)
        IERC20(transaction.targetToken).transfer(transaction.recipient, transaction.amount);
        
        emit BridgeCompleted(_txId, transaction.recipient);
    }
    
    function cancelBridge(bytes32 _txId, string memory _reason) external {
        BridgeTransaction storage transaction = bridgeTransactions[_txId];
        require(transaction.txId != bytes32(0), "Transaction does not exist");
        require(!transaction.completed, "Transaction already completed");
        require(!transaction.cancelled, "Transaction already cancelled");
        require(
            msg.sender == transaction.sender || msg.sender == owner(),
            "Only sender or owner can cancel"
        );
        
        transaction.cancelled = true;
        
        // Return locked tokens to sender
        IERC20(transaction.sourceToken).transfer(transaction.sender, transaction.amount);
        
        emit BridgeCancelled(_txId, _reason);
    }
    
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
    
    function setBridgeFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee too high"); // Max 10%
        bridgeFee = _fee;
    }
    
    function setCBDCValidator(address _newValidator) external onlyOwner {
        require(_newValidator != address(0), "Invalid validator address");
        cbdcValidator = ICBDCValidator(_newValidator);
    }
    
    function getBridgeTransaction(bytes32 _txId) external view returns (BridgeTransaction memory) {
        return bridgeTransactions[_txId];
    }
    
    function getDailyVolume(address _token, uint256 _day) external view returns (uint256) {
        return dailyVolume[_token][_day];
    }
    
    function getTodayVolume(address _token) external view returns (uint256) {
        uint256 today = block.timestamp / 86400;
        return dailyVolume[_token][today];
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}