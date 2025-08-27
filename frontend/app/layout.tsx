"use client"

import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { config } from '@/lib/wagmi'
import { Navbar } from '@/components/Navbar'

const queryClient = new QueryClient()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>Unykorn ESG Tokenization System</title>
        <meta name="description" content="Professional ESG tokenization platform with IP protection and compliance monitoring" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <div className="relative flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1">
                  <div className="container mx-auto py-6">
                    {children}
                  </div>
                </main>
                <footer className="border-t py-6 md:py-0">
                  <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                    <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                      <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Built by{" "}
                        <span className="font-medium text-foreground">
                          Unykorn Technologies
                        </span>
                        . Secured by blockchain IP protection.
                      </p>
                    </div>
                  </div>
                </footer>
              </div>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}