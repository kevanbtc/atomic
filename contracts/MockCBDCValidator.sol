// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Define ICBDCValidator interface locally
interface ICBDCValidator {
    function validateTransaction(bytes32 txHash, bytes memory signature) external view returns (bool);
    function isAuthorizedCBDC(address cbdcToken) external view returns (bool);
}

contract MockCBDCValidator is ICBDCValidator {
    mapping(bytes32 => bool) private transactionValidations;
    mapping(address => bool) private authorizedTokens;
    
    constructor() {}
    
    function validateTransaction(bytes32 txHash, bytes memory signature) external view override returns (bool) {
        // Simplified validation - in practice would verify signature
        return transactionValidations[txHash] != false; // Default true
    }
    
    function isAuthorizedCBDC(address cbdcToken) external view override returns (bool) {
        return authorizedTokens[cbdcToken];
    }
    
    function setTransactionValidation(bytes32 _txHash, bool _valid) external {
        transactionValidations[_txHash] = _valid;
    }
    
    function setAuthorizedCBDC(address _token, bool _authorized) external {
        authorizedTokens[_token] = _authorized;
    }
}