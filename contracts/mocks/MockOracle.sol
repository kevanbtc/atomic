// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockOracle {
    mapping(address => uint256) public prices;
    mapping(address => uint256) public esgScores;
    mapping(string => string) public testResults;
    
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "MockOracle: Only owner can call");
        _;
    }
    
    function setPrice(address asset, uint256 price) external onlyOwner {
        prices[asset] = price;
    }
    
    function getPrice(address asset) external view returns (uint256) {
        return prices[asset] == 0 ? 1e18 : prices[asset]; // Default $1
    }
    
    function setESGScore(address asset, uint256 score) external onlyOwner {
        esgScores[asset] = score;
    }
    
    function getESGScore(address asset) external view returns (uint256) {
        return esgScores[asset] == 0 ? 80 : esgScores[asset]; // Default 80
    }
    
    function storeTestResults(string memory key, string memory results) external {
        testResults[key] = results;
    }
    
    function getTestResults(string memory key) external view returns (string memory) {
        return testResults[key];
    }
}