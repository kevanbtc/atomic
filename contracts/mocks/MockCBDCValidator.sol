// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockCBDCValidator {
    mapping(address => bool) public authorizedCBDCs;
    mapping(bytes32 => bool) public validTransactions;
    
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "MockCBDCValidator: Only owner can call");
        _;
    }
    
    function setAuthorizedCBDC(address cbdcToken, bool authorized) external onlyOwner {
        authorizedCBDCs[cbdcToken] = authorized;
    }
    
    function isAuthorizedCBDC(address cbdcToken) external view returns (bool) {
        return authorizedCBDCs[cbdcToken];
    }
    
    function setTransactionValid(bytes32 txHash, bool valid) external onlyOwner {
        validTransactions[txHash] = valid;
    }
    
    function validateTransaction(bytes32 txHash, bytes memory) external view returns (bool) {
        return validTransactions[txHash];
    }
}