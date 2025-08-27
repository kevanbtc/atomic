import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractAddresses from '../../deployments/localhost.json';

// Contract ABIs (simplified for demo)
const ABIS = {
  WaterVault: [
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256) external",
    "function burn(uint256) external"
  ],
  CarbonVault: [
    "function totalCreditsIssued() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function issueCredits(address, uint256) external",
    "function retireCredits(uint256) external"
  ],
  ESGStablecoin: [
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256) external",
    "function burn(uint256) external"
  ],
  CBDCBridge: [
    "function totalBridgedAmount() view returns (uint256)",
    "function bridgeFromCBDC(uint256) external",
    "function bridgeToCBDC(uint256) external"
  ]
};

export const useContract = (contractName) => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initContract = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask not found');
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        
        const contractAddress = contractAddresses[contractName];
        if (!contractAddress) {
          throw new Error(`Contract ${contractName} not found in deployments`);
        }

        const contractInstance = new ethers.Contract(
          contractAddress,
          ABIS[contractName],
          signer
        );

        setContract(contractInstance);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    initContract();
  }, [contractName]);

  return { contract, loading, error };
};