// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Define IWaterOracle interface locally
interface IWaterOracle {
    function getWaterPrice() external view returns (uint256);
    function getWaterQuality(bytes32 sourceId) external view returns (uint256);
}

contract MockWaterOracle is IWaterOracle {
    mapping(bytes32 => uint256) private waterQuality;
    uint256 private waterPrice;
    
    constructor() {
        waterPrice = 1 * 10**18; // $1 per unit
    }
    
    function getWaterPrice() external view override returns (uint256) {
        return waterPrice;
    }
    
    function getWaterQuality(bytes32 sourceId) external view override returns (uint256) {
        uint256 quality = waterQuality[sourceId];
        return quality == 0 ? 85 : quality; // Default quality of 85
    }
    
    function setWaterPrice(uint256 _price) external {
        waterPrice = _price;
    }
    
    function setWaterQuality(bytes32 _sourceId, uint256 _quality) external {
        waterQuality[_sourceId] = _quality;
    }
}