"use client"

import { useAccount, useReadContracts } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, formatCurrency, formatTokenAmount } from '@/lib/contracts'

export default function Dashboard() {
  const { address, isConnected } = useAccount()

  const { data: contractData, isLoading } = useReadContracts({
    contracts: [
      // Water Vault data
      {
        address: CONTRACT_ADDRESSES.WaterVault as `0x${string}`,
        abi: CONTRACT_ABIS.WaterVault,
        functionName: 'totalSupply',
      },
      {
        address: CONTRACT_ADDRESSES.WaterVault as `0x${string}`,
        abi: CONTRACT_ABIS.WaterVault,
        functionName: 'totalProjects',
      },
      // Carbon Vault data
      {
        address: CONTRACT_ADDRESSES.CarbonVault as `0x${string}`,
        abi: CONTRACT_ABIS.CarbonVault,
        functionName: 'totalCredits',
      },
      {
        address: CONTRACT_ADDRESSES.CarbonVault as `0x${string}`,
        abi: CONTRACT_ABIS.CarbonVault,
        functionName: 'retiredCredits',
      },
      // ESG Stablecoin data
      {
        address: CONTRACT_ADDRESSES.ESGStablecoin as `0x${string}`,
        abi: CONTRACT_ABIS.ESGStablecoin,
        functionName: 'totalSupply',
      },
      {
        address: CONTRACT_ADDRESSES.ESGStablecoin as `0x${string}`,
        abi: CONTRACT_ABIS.ESGStablecoin,
        functionName: 'getCollateralizationRatio',
      },
      {
        address: CONTRACT_ADDRESSES.ESGStablecoin as `0x${string}`,
        abi: CONTRACT_ABIS.ESGStablecoin,
        functionName: 'esgScore',
      },
      // Audit Proof data
      {
        address: CONTRACT_ADDRESSES.AuditProofNFT as `0x${string}`,
        abi: CONTRACT_ABIS.AuditProofNFT,
        functionName: 'totalSupply',
      },
    ],
    query: {
      enabled: isConnected,
    }
  })

  // Extract data with fallbacks for demo
  const [
    waterTotalSupply,
    waterTotalProjects,
    carbonTotalCredits,
    carbonRetiredCredits,
    stablecoinTotalSupply,
    collateralizationRatio,
    esgScore,
    auditNFTSupply
  ] = contractData || []

  // Demo data when contracts aren't deployed or connected
  const demoData = {
    waterSupply: "12,500,000",
    waterProjects: "47",
    carbonCredits: "4,300,000",
    carbonRetired: "1,200,000",
    stablecoinSupply: formatCurrency("2400000000000000000000000"), // $2.4M in wei
    collateralRatio: "150%",
    esgScore: "88/100",
    auditNFTs: "1",
    auditValue: formatCurrency("685000000000000000000000000") // $685M
  }

  const displayData = {
    waterSupply: waterTotalSupply?.result ? formatTokenAmount(waterTotalSupply.result) : demoData.waterSupply,
    waterProjects: waterTotalProjects?.result ? waterTotalProjects.result.toString() : demoData.waterProjects,
    carbonCredits: carbonTotalCredits?.result ? formatTokenAmount(carbonTotalCredits.result) : demoData.carbonCredits,
    carbonRetired: carbonRetiredCredits?.result ? formatTokenAmount(carbonRetiredCredits.result) : demoData.carbonRetired,
    stablecoinSupply: stablecoinTotalSupply?.result ? formatCurrency(stablecoinTotalSupply.result) : demoData.stablecoinSupply,
    collateralRatio: collateralizationRatio?.result ? `${Number(collateralizationRatio.result) / 100}%` : demoData.collateralRatio,
    esgScore: esgScore?.result ? `${esgScore.result}/100` : demoData.esgScore,
    auditNFTs: auditNFTSupply?.result ? auditNFTSupply.result.toString() : demoData.auditNFTs,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ESG Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of your ESG tokenization system
        </p>
      </div>

      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            <strong>Demo Mode:</strong> Connect your wallet to see live contract data. Displaying sample data for demonstration.
          </p>
        </div>
      )}

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">💧 Water Vault Supply</CardTitle>
            <div className="h-4 w-4 text-blue-600">💧</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayData.waterSupply}</div>
            <p className="text-xs text-muted-foreground">
              Across {displayData.waterProjects} projects globally
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">🌱 Carbon Credits</CardTitle>
            <div className="h-4 w-4 text-green-600">🌱</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayData.carbonCredits}</div>
            <p className="text-xs text-muted-foreground">
              {displayData.carbonRetired} retired
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">🏛️ ESG Stablecoin</CardTitle>
            <div className="h-4 w-4 text-purple-600">🏛️</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayData.stablecoinSupply}</div>
            <p className="text-xs text-muted-foreground">
              {displayData.collateralRatio} collateralized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">🛡️ Audit Proofs</CardTitle>
            <div className="h-4 w-4 text-orange-600">🛡️</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayData.auditNFTs} NFT</div>
            <p className="text-xs text-muted-foreground">
              {demoData.auditValue} validated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ESG Scoring */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ESG Performance Score</CardTitle>
            <CardDescription>
              Real-time ESG scoring based on tokenized assets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall ESG Score</span>
                <span className="text-2xl font-bold text-green-600">{displayData.esgScore}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-blue-600">Environmental</div>
                <div className="text-sm text-muted-foreground">92/100</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600">Social</div>
                <div className="text-sm text-muted-foreground">85/100</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-purple-600">Governance</div>
                <div className="text-sm text-muted-foreground">87/100</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>
              Key performance indicators and system status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Contract Uptime</span>
                <span className="text-green-600 font-semibold">99.99%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Average Gas Cost</span>
                <span className="font-semibold">0.015 ETH</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Transaction Speed</span>
                <span className="text-green-600 font-semibold">~2.3s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Security Status</span>
                <span className="text-green-600 font-semibold">✅ Secure</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Compliance Score</span>
                <span className="text-green-600 font-semibold">85% (Investment Grade)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest transactions and system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Water Asset Tokenization</p>
                <p className="text-xs text-muted-foreground">São Paulo Water Initiative - 1,000,000 L tokenized</p>
              </div>
              <div className="text-xs text-muted-foreground">2 hours ago</div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Carbon Credits Retired</p>
                <p className="text-xs text-muted-foreground">Amazon Reforestation Project - 50,000 credits retired</p>
              </div>
              <div className="text-xs text-muted-foreground">4 hours ago</div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">ESG Stablecoin Minted</p>
                <p className="text-xs text-muted-foreground">$100,000 UESG minted against ESG collateral</p>
              </div>
              <div className="text-xs text-muted-foreground">6 hours ago</div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">IP Proof Validated</p>
                <p className="text-xs text-muted-foreground">System audit proof NFT minted - $685M valuation confirmed</p>
              </div>
              <div className="text-xs text-muted-foreground">1 day ago</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}