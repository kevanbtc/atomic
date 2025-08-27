// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Define ICarbonOracle interface locally  
interface ICarbonOracle {
    function getCarbonPrice() external view returns (uint256);
    function verifyCarbonCredit(bytes32 creditId) external view returns (bool);
}

contract MockCarbonOracle is ICarbonOracle {
    mapping(bytes32 => bool) private creditVerification;
    uint256 private carbonPrice;
    
    constructor() {
        carbonPrice = 50 * 10**18; // $50 per tonne
    }
    
    function getCarbonPrice() external view override returns (uint256) {
        return carbonPrice;
    }
    
    function verifyCarbonCredit(bytes32 creditId) external view override returns (bool) {
        // Default to true if not set
        return creditVerification[creditId] != false;
    }
    
    function setCarbonPrice(uint256 _price) external {
        carbonPrice = _price;
    }
    
    function setCreditVerification(bytes32 _creditId, bool _verified) external {
        creditVerification[_creditId] = _verified;
    }
}