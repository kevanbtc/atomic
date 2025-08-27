"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Compliance() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance Monitoring</h1>
        <p className="text-muted-foreground">
          Real-time compliance tracking with ISO 20022, Basel III/IV, and regulatory frameworks
        </p>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl text-green-600">85%</CardTitle>
            <CardDescription className="text-center">Overall Compliance Score</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-sm font-semibold text-green-600">Investment Grade</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl text-blue-600">24/7</CardTitle>
            <CardDescription className="text-center">Real-time Monitoring</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-sm font-semibold">Auto-compliance Checks</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl text-purple-600">8</CardTitle>
            <CardDescription className="text-center">Regulatory Frameworks</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-sm font-semibold">Multi-jurisdiction Support</div>
          </CardContent>
        </Card>
      </div>

      {/* Regulatory Framework Status */}
      <Card>
        <CardHeader>
          <CardTitle>Regulatory Framework Compliance</CardTitle>
          <CardDescription>
            Current compliance status across major financial regulatory frameworks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="font-medium">ISO 20022 - Financial Messaging</div>
                  <div className="text-sm text-muted-foreground">Standard financial message format compliance</div>
                </div>
              </div>
              <div className="text-green-600 font-semibold">✅ Compliant</div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="font-medium">Basel III/IV - Banking Regulations</div>
                  <div className="text-sm text-muted-foreground">Capital adequacy and liquidity requirements</div>
                </div>
              </div>
              <div className="text-green-600 font-semibold">✅ Compliant</div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="font-medium">SEC Securities Regulations</div>
                  <div className="text-sm text-muted-foreground">US securities law compliance</div>
                </div>
              </div>
              <div className="text-green-600 font-semibold">✅ Compliant</div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="font-medium">FATF - Anti-Money Laundering</div>
                  <div className="text-sm text-muted-foreground">Financial Action Task Force guidelines</div>
                </div>
              </div>
              <div className="text-green-600 font-semibold">✅ Compliant</div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div>
                  <div className="font-medium">GDPR - Data Protection</div>
                  <div className="text-sm text-muted-foreground">EU data protection regulations</div>
                </div>
              </div>
              <div className="text-yellow-600 font-semibold">⚠️ In Progress</div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="font-medium">MiCA - EU Crypto Regulation</div>
                  <div className="text-sm text-muted-foreground">Markets in Crypto-Assets regulation</div>
                </div>
              </div>
              <div className="text-green-600 font-semibold">✅ Compliant</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ISO 20022 Event Stream */}
      <Card>
        <CardHeader>
          <CardTitle>Live ISO 20022 Event Stream</CardTitle>
          <CardDescription>
            Real-time financial messaging events and compliance checks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <div className="font-mono text-sm bg-gray-100 p-3 rounded">
              <div className="text-green-600">[2025-08-26 15:23:45] PACS.008 - FIToFI Customer Credit Transfer</div>
              <div className="text-gray-600 ml-4">→ WaterVault Payment Settlement: $45,000</div>
              <div className="text-gray-600 ml-4">→ Status: ✅ Settlement Complete</div>
            </div>

            <div className="font-mono text-sm bg-gray-100 p-3 rounded">
              <div className="text-blue-600">[2025-08-26 15:22:12] CAMT.053 - Bank to Customer Statement</div>
              <div className="text-gray-600 ml-4">→ ESG Stablecoin Balance Report Generated</div>
              <div className="text-gray-600 ml-4">→ Current Balance: $2,400,000 UESG</div>
            </div>

            <div className="font-mono text-sm bg-gray-100 p-3 rounded">
              <div className="text-purple-600">[2025-08-26 15:20:33] PAIN.001 - Customer Credit Transfer Initiation</div>
              <div className="text-gray-600 ml-4">→ Carbon Credit Purchase: 25,000 credits</div>
              <div className="text-gray-600 ml-4">→ AML Check: ✅ Passed</div>
            </div>

            <div className="font-mono text-sm bg-gray-100 p-3 rounded">
              <div className="text-orange-600">[2025-08-26 15:18:54] BASEL-CAR - Capital Adequacy Report</div>
              <div className="text-gray-600 ml-4">→ Tier 1 Capital Ratio: 12.5% (Required: 8.0%)</div>
              <div className="text-gray-600 ml-4">→ Status: ✅ Above Minimum Requirements</div>
            </div>

            <div className="font-mono text-sm bg-gray-100 p-3 rounded">
              <div className="text-red-600">[2025-08-26 15:17:22] FATF-TRR - Travel Rule Report</div>
              <div className="text-gray-600 ml-4">→ Cross-border CBDC Transfer: $75,000</div>
              <div className="text-gray-600 ml-4">→ Originator/Beneficiary Info: ✅ Complete</div>
            </div>

            <div className="font-mono text-sm bg-gray-100 p-3 rounded">
              <div className="text-green-600">[2025-08-26 15:15:11] CAMT.060 - Account Reporting Request</div>
              <div className="text-gray-600 ml-4">→ ESG Performance Metrics Request</div>
              <div className="text-gray-600 ml-4">→ ESG Score: 88/100 ✅ Investment Grade</div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Auto-refreshing every 30 seconds
            </div>
            <Button variant="outline" size="sm">
              Export Compliance Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Travel Rule Compliance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>FATF Travel Rule Compliance</CardTitle>
            <CardDescription>
              Cross-border transaction monitoring and reporting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm">Transactions >$1000</span>
              <span className="text-green-600 font-semibold">100% Compliant</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Originator Info Complete</span>
              <span className="text-green-600 font-semibold">✅ Yes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Beneficiary Info Complete</span>
              <span className="text-green-600 font-semibold">✅ Yes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Automated Reporting</span>
              <span className="text-green-600 font-semibold">✅ Active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ESG Compliance Metrics</CardTitle>
            <CardDescription>
              Environmental, Social, and Governance compliance tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm">Carbon Footprint Tracking</span>
              <span className="text-green-600 font-semibold">✅ Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Water Quality Certification</span>
              <span className="text-green-600 font-semibold">✅ Verified</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Social Impact Reporting</span>
              <span className="text-green-600 font-semibold">✅ Current</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Governance Transparency</span>
              <span className="text-green-600 font-semibold">87% Score</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}