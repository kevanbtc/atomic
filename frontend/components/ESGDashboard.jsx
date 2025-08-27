import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { formatEther, parseEther } from 'ethers/lib/utils';

const ESGDashboard = () => {
  const [metrics, setMetrics] = useState({
    waterTokens: '0',
    carbonCredits: '0',
    stablecoinSupply: '0',
    cbdcBridged: '0'
  });

  const waterVault = useContract('WaterVault');
  const carbonVault = useContract('CarbonVault');
  const esgStablecoin = useContract('ESGStablecoin');
  const cbdcBridge = useContract('CBDCBridge');

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const [water, carbon, supply, bridged] = await Promise.all([
        waterVault?.totalSupply() || '0',
        carbonVault?.totalCreditsIssued() || '0', 
        esgStablecoin?.totalSupply() || '0',
        cbdcBridge?.totalBridgedAmount() || '0'
      ]);

      setMetrics({
        waterTokens: formatEther(water),
        carbonCredits: carbon.toString(),
        stablecoinSupply: formatEther(supply),
        cbdcBridged: formatEther(bridged)
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  return (
    <div className="esg-dashboard">
      <h1>ESG System Dashboard</h1>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Water Tokens</h3>
          <div className="metric-value">{metrics.waterTokens}</div>
          <div className="metric-unit">WATER</div>
        </div>

        <div className="metric-card">
          <h3>Carbon Credits</h3>
          <div className="metric-value">{metrics.carbonCredits}</div>
          <div className="metric-unit">tCO2e</div>
        </div>

        <div className="metric-card">
          <h3>ESG Stablecoin</h3>
          <div className="metric-value">{metrics.stablecoinSupply}</div>
          <div className="metric-unit">ESGUSD</div>
        </div>

        <div className="metric-card">
          <h3>CBDC Bridged</h3>
          <div className="metric-value">{metrics.cbdcBridged}</div>
          <div className="metric-unit">USD</div>
        </div>
      </div>

      <button onClick={loadMetrics} className="refresh-btn">
        Refresh Metrics
      </button>
    </div>
  );
};

export default ESGDashboard;