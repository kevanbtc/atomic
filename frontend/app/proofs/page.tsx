"use client"

import { useState } from "react"
import { useAccount } from 'wagmi'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Proofs() {
  const { address, isConnected } = useAccount()
  const [selectedProof, setSelectedProof] = useState<number | null>(null)

  // Demo audit proof data
  const auditProofs = [
    {
      id: 1,
      title: "Unykorn System Comprehensive Audit",
      appraisedValue: "$685,000,000",
      auditFirm: "Professional Technical Analysis",
      timestamp: "2025-08-26",
      ipfsCID: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      documentHash: "0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
      status: "Verified",
      grade: "A+ (9.2/10)",
      compliance: "85% - Investment Grade"
    }
  ]

  const ipfsProofs = [
    {
      name: "Complete System Audit Report",
      description: "Comprehensive technical and financial audit",
      cid: "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
      size: "2.4 MB",
      type: "Markdown Document",
      uploadDate: "2025-08-26"
    },
    {
      name: "Business Valuation Report",
      description: "Professional $685M business valuation",
      cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      size: "1.8 MB", 
      type: "PDF Document",
      uploadDate: "2025-08-26"
    },
    {
      name: "Technical Architecture Documentation",
      description: "Complete system architecture and API docs",
      cid: "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
      size: "3.2 MB",
      type: "Documentation",
      uploadDate: "2025-08-26"
    },
    {
      name: "IP Ownership Certificates",
      description: "Blockchain-backed ownership proofs",
      cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", 
      size: "1.1 MB",
      type: "Legal Documents",
      uploadDate: "2025-08-26"
    }
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IP Proof & IPFS Explorer</h1>
        <p className="text-muted-foreground">
          View audit proofs, IP ownership certificates, and IPFS-stored documentation
        </p>
      </div>

      {!isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            <strong>Demo Mode:</strong> Connect your wallet to interact with your audit proof NFTs. Displaying sample data for demonstration.
          </p>
        </div>
      )}

      {/* Audit Proof NFTs */}
      <Card>
        <CardHeader>
          <CardTitle>🏆 Audit Proof NFTs</CardTitle>
          <CardDescription>
            Blockchain-secured audit validation certificates with immutable ownership
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {auditProofs.map((proof, index) => (
              <div
                key={proof.id}
                className={`border rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
                  selectedProof === index ? 'ring-2 ring-primary bg-primary/5' : ''
                }`}
                onClick={() => setSelectedProof(selectedProof === index ? null : index)}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{proof.title}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Appraised Value:</span>
                        <span className="ml-2 text-green-600 font-bold">{proof.appraisedValue}</span>
                      </div>
                      <div>
                        <span className="font-medium">Audit Firm:</span>
                        <span className="ml-2">{proof.auditFirm}</span>
                      </div>
                      <div>
                        <span className="font-medium">Technical Grade:</span>
                        <span className="ml-2 text-green-600 font-semibold">{proof.grade}</span>
                      </div>
                      <div>
                        <span className="font-medium">Compliance:</span>
                        <span className="ml-2 text-green-600 font-semibold">{proof.compliance}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {proof.status}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Token ID #{proof.id}
                    </div>
                  </div>
                </div>

                {selectedProof === index && (
                  <div className="mt-6 pt-6 border-t space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">IPFS Content ID</h4>
                        <div className="bg-gray-100 p-2 rounded font-mono text-sm break-all">
                          {proof.ipfsCID}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Document Hash</h4>
                        <div className="bg-gray-100 p-2 rounded font-mono text-sm break-all">
                          {proof.documentHash}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <Button size="sm" onClick={() => window.open(`https://ipfs.io/ipfs/${proof.ipfsCID}`, '_blank')}>
                        View on IPFS
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${proof.ipfsCID}`, '_blank')}>
                        Pinata Gateway
                      </Button>
                      <Button variant="outline" size="sm">
                        Download Certificate
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* IPFS Document Explorer */}
      <Card>
        <CardHeader>
          <CardTitle>📁 IPFS Document Explorer</CardTitle>
          <CardDescription>
            Immutable documentation and reports stored on IPFS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ipfsProofs.map((doc, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{doc.name}</h4>
                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                  </div>
                  <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {doc.type}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span className="font-medium">{doc.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Upload Date:</span>
                    <span className="font-medium">{doc.uploadDate}</span>
                  </div>
                  <div>
                    <span>IPFS CID:</span>
                    <div className="bg-gray-100 p-1 rounded font-mono text-xs mt-1 break-all">
                      {doc.cid}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => window.open(`https://ipfs.io/ipfs/${doc.cid}`, '_blank')}
                  >
                    View Document
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(doc.cid)}
                  >
                    Copy CID
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* IP Protection Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-600">100%</CardTitle>
            <CardDescription>IP Ownership Secured</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            All intellectual property secured via blockchain certificates
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-blue-600">IPFS</CardTitle>
            <CardDescription>Immutable Storage</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            All documents stored on decentralized IPFS network
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-purple-600">Multi-Chain</CardTitle>
            <CardDescription>Global Protection</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            IP certificates deployable across all major blockchains
          </CardContent>
        </Card>
      </div>

      {/* Security Features */}
      <Card>
        <CardHeader>
          <CardTitle>🛡️ IP Protection Security Features</CardTitle>
          <CardDescription>
            Advanced security mechanisms protecting your intellectual property
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Blockchain Security</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Immutable ownership records</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Multi-signature validation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Tamper-proof audit trails</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Cross-chain compatibility</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Document Security</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>IPFS distributed storage</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Cryptographic hashing</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Content verification</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Global accessibility</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}