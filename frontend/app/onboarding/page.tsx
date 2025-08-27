"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const subscriptionTiers = [
  {
    name: "Basic",
    price: "$350",
    period: "per month",
    description: "Essential ESG tokenization for small organizations",
    features: [
      "Water vault tokenization",
      "Carbon credit management",
      "Basic ESG scoring",
      "Community support",
      "API access (1,000 calls/month)",
      "Standard documentation"
    ],
    color: "border-blue-200 bg-blue-50"
  },
  {
    name: "Professional", 
    price: "$1,750",
    period: "per quarter",
    description: "Advanced ESG features with CBDC integration",
    features: [
      "Full ESG stablecoin access",
      "CBDC bridge integration", 
      "Advanced ESG analytics",
      "Priority support",
      "API access (10,000 calls/month)",
      "Custom integration assistance",
      "Multi-chain deployment"
    ],
    color: "border-green-200 bg-green-50",
    popular: true
  },
  {
    name: "Enterprise",
    price: "$7,000", 
    period: "per year",
    description: "Complete IP protection and enterprise features",
    features: [
      "Complete IP protection system",
      "Multi-chain deployment",
      "Custom contract development", 
      "24/7 premium support",
      "Unlimited API access",
      "Regulatory compliance assistance",
      "White-label solutions",
      "Dedicated account manager"
    ],
    color: "border-purple-200 bg-purple-50"
  },
  {
    name: "Sovereign",
    price: "$35,000",
    period: "per year", 
    description: "Nation-level ESG and CBDC infrastructure",
    features: [
      "Full sovereign CBDC system",
      "National ESG infrastructure",
      "Complete IP sovereignty",
      "Dedicated infrastructure",
      "Custom regulatory framework",
      "Central bank integration",
      "Global jurisdiction support",
      "Government-grade security"
    ],
    color: "border-gold-200 bg-gold-50"
  }
]

export default function Onboarding() {
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    companyName: "",
    contactEmail: "",
    contactName: "",
    organizationType: "",
    monthlyVolume: "",
    region: ""
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log("Form submitted:", { ...formData, selectedTier })
    alert(`Thank you! Your ${selectedTier !== null ? subscriptionTiers[selectedTier].name : 'subscription'} registration has been submitted. Our team will contact you within 24 hours.`)
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Enterprise Onboarding</h1>
        <p className="text-muted-foreground mt-2">
          Join leading organizations using Unykorn ESG tokenization platform
        </p>
      </div>

      {/* Value Proposition */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-blue-600">$52T+</CardTitle>
            <CardDescription>Global ESG Market TAM</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-green-600">$685M</CardTitle>
            <CardDescription>System Valuation</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-purple-600">9.2/10</CardTitle>
            <CardDescription>Technical Excellence</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Subscription Tiers */}
      <div>
        <h2 className="text-2xl font-bold text-center mb-6">Choose Your Subscription Tier</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {subscriptionTiers.map((tier, index) => (
            <Card 
              key={tier.name}
              className={`relative cursor-pointer transition-all hover:shadow-lg ${
                selectedTier === index ? 'ring-2 ring-primary' : ''
              } ${tier.color}`}
              onClick={() => setSelectedTier(index)}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{tier.price}</div>
                  <div className="text-sm text-muted-foreground">{tier.period}</div>
                </div>
                <CardDescription className="text-xs">
                  {tier.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start space-x-2">
                      <div className="text-green-500 mt-0.5">✓</div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Registration Form */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Complete Your Registration</CardTitle>
          <CardDescription>
            {selectedTier !== null 
              ? `Registering for ${subscriptionTiers[selectedTier].name} tier`
              : "Please select a subscription tier above"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  required
                  className="w-full p-2 border rounded-md"
                  placeholder="Your Organization"
                  value={formData.companyName}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Name *</label>
                <input
                  type="text"
                  name="contactName"
                  required
                  className="w-full p-2 border rounded-md"
                  placeholder="John Doe"
                  value={formData.contactName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Contact Email *</label>
              <input
                type="email"
                name="contactEmail"
                required
                className="w-full p-2 border rounded-md"
                placeholder="john@company.com"
                value={formData.contactEmail}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Organization Type</label>
                <select
                  name="organizationType"
                  className="w-full p-2 border rounded-md"
                  value={formData.organizationType}
                  onChange={handleInputChange}
                >
                  <option value="">Select Type</option>
                  <option value="corporation">Corporation</option>
                  <option value="financial-institution">Financial Institution</option>
                  <option value="government">Government Entity</option>
                  <option value="ngo">NGO/Non-Profit</option>
                  <option value="startup">Startup</option>
                  <option value="consulting">Consulting Firm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Region</label>
                <select
                  name="region"
                  className="w-full p-2 border rounded-md"
                  value={formData.region}
                  onChange={handleInputChange}
                >
                  <option value="">Select Region</option>
                  <option value="north-america">North America</option>
                  <option value="europe">Europe</option>
                  <option value="asia-pacific">Asia Pacific</option>
                  <option value="latin-america">Latin America</option>
                  <option value="middle-east-africa">Middle East & Africa</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Expected Monthly Transaction Volume</label>
              <select
                name="monthlyVolume"
                className="w-full p-2 border rounded-md"
                value={formData.monthlyVolume}
                onChange={handleInputChange}
              >
                <option value="">Select Volume</option>
                <option value="under-100k">Under $100k</option>
                <option value="100k-1m">$100k - $1M</option>
                <option value="1m-10m">$1M - $10M</option>
                <option value="10m-100m">$10M - $100M</option>
                <option value="over-100m">Over $100M</option>
              </select>
            </div>

            <div className="flex justify-between items-center pt-4">
              <div className="text-sm text-muted-foreground">
                * Required fields
              </div>
              <Button 
                type="submit" 
                size="lg"
                disabled={selectedTier === null || !formData.companyName || !formData.contactEmail}
              >
                Register for {selectedTier !== null ? subscriptionTiers[selectedTier].name : 'Selected'} Tier
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Benefits Summary */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Why Choose Unykorn ESG?</CardTitle>
          <CardDescription>
            Join the leaders in sustainable finance technology
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold">🚀 Market Leadership</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• First-mover advantage in blockchain ESG</li>
                <li>• $685M professionally validated system</li>
                <li>• 9.2/10 technical excellence rating</li>
                <li>• Investment-grade compliance (85%)</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">🛡️ Security & Compliance</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Multi-chain deployment (ETH/Polygon/Arbitrum)</li>
                <li>• ISO 20022, Basel III/IV compliance</li>
                <li>• Blockchain IP ownership protection</li>
                <li>• Enterprise-grade security patterns</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">📈 Business Growth</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Access to $52T+ global ESG market</li>
                <li>• Automated revenue distribution</li>
                <li>• White-label solutions available</li>
                <li>• 24/7 enterprise support</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">🌍 Global Reach</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Multi-jurisdiction regulatory support</li>
                <li>• CBDC integration capabilities</li>
                <li>• Carbon credit marketplace access</li>
                <li>• Water tokenization infrastructure</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}