import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          🦄 Unykorn ESG System
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Professional ESG tokenization platform with blockchain-secured IP protection. 
          Valued at <span className="font-semibold text-primary">$685 Million</span> through comprehensive audit.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/dashboard">View Dashboard</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/onboarding">Enterprise Onboarding</Link>
          </Button>
        </div>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💧 Water Tokenization
            </CardTitle>
            <CardDescription>
              Tokenize water assets with quality scoring and sustainability tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Professional-grade water vault with quality scores, location tracking, and sustainability ratings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🌱 Carbon Credits
            </CardTitle>
            <CardDescription>
              Multi-registry carbon credit management with retirement tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Support for forestry, renewable energy, and direct air capture projects with pricing multipliers.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏛️ ESG Stablecoin
            </CardTitle>
            <CardDescription>
              Multi-collateral stablecoin backed by ESG assets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Dynamic collateralization with ESG scoring and stability mechanisms for institutional use.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🛡️ IP Protection
            </CardTitle>
            <CardDescription>
              Blockchain-secured intellectual property ownership
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Immutable ownership certificates stored on IPFS with professional audit validation.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">$685M</CardTitle>
            <CardDescription>Professional System Valuation</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">9.2/10</CardTitle>
            <CardDescription>Technical Excellence Rating</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">$52T+</CardTitle>
            <CardDescription>Global ESG Market TAM</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Business Model */}
      <Card>
        <CardHeader>
          <CardTitle>4-Tier Subscription Model</CardTitle>
          <CardDescription>
            Enterprise-grade subscription tiers with automated revenue distribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="font-semibold">Basic</div>
              <div className="text-2xl font-bold text-primary">$350/mo</div>
              <div className="text-sm text-muted-foreground">Water/Carbon tokenization</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="font-semibold">Professional</div>
              <div className="text-2xl font-bold text-primary">$1,750/qtr</div>
              <div className="text-sm text-muted-foreground">Full ESG stablecoin access</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="font-semibold">Enterprise</div>
              <div className="text-2xl font-bold text-primary">$7,000/yr</div>
              <div className="text-sm text-muted-foreground">Complete IP protection</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="font-semibold">Sovereign</div>
              <div className="text-2xl font-bold text-primary">$35,000/yr</div>
              <div className="text-sm text-muted-foreground">National CBDC systems</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}