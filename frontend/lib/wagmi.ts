import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, arbitrum, localhost } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Unykorn ESG Tokenization System',
  projectId: 'unykorn-esg-system', // Replace with your WalletConnect project ID
  chains: [mainnet, polygon, arbitrum, localhost],
  ssr: true,
});

export { mainnet, polygon, arbitrum, localhost };