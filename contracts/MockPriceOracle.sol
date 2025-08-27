// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Define IPriceOracle interface locally
interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
    function getESGScore(address token) external view returns (uint256);
}

contract MockPriceOracle is IPriceOracle {
    mapping(address => uint256) private tokenPrices;
    mapping(address => uint256) private esgScores;
    
    constructor() {
        // Default prices and ESG scores
    }
    
    function getPrice(address token) external view override returns (uint256) {
        uint256 price = tokenPrices[token];
        return price == 0 ? 1 * 10**18 : price; // Default $1
    }
    
    function getESGScore(address token) external view override returns (uint256) {
        uint256 score = esgScores[token];
        return score == 0 ? 80 : score; // Default score of 80
    }
    
    function setPrice(address _token, uint256 _price) external {
        tokenPrices[_token] = _price;
    }
    
    function setESGScore(address _token, uint256 _score) external {
        esgScores[_token] = _score;
    }
}