"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center pt-24 pb-12 sm:pt-32">
      <div className="container px-4 md:px-6 flex flex-col items-center text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4 max-w-3xl"
        >
          <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
            Institutional Grade RWA Tokenization
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Fractionalize Real-World Assets with Confidence
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Secure, compliant, and transparent tokenization of physical assets. Earn yields from institutional-grade real estate, commodities, and infrastructure on-chain.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Button asChild size="lg" className="h-12 px-8">
            <Link href="/dashboard">Launch App</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-8">
            <Link href="/marketplace">Explore Assets</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-16 w-full max-w-5xl rounded-xl border bg-card p-2 shadow-2xl overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-accent/10 opacity-50" />
          <div className="relative rounded-lg border bg-background/50 backdrop-blur-xl p-8 h-[400px] flex items-center justify-center">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight text-foreground/80">Dashboard Preview</h3>
              <p className="text-muted-foreground">Log in with your wallet to view real-time metrics</p>
            </div>
          </div>
        </motion.div>
      </div>

      <section className="container px-4 md:px-6 mt-32 space-y-16">
        <div className="mx-auto max-w-2xl text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">Why Tokenize Real-World Assets?</h2>
          <p className="text-muted-foreground">Unlock liquidity and democratize access to high-value physical assets through blockchain technology.</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Fractional Ownership",
              description: "Invest in high-value assets like commercial real estate and luxury vehicles with minimal capital.",
            },
            {
              title: "Automated Yield",
              description: "Receive proportional yield distributions automatically via smart contracts in stablecoins.",
            },
            {
              title: "Institutional Compliance",
              description: "Built-in KYC/AML whitelisting and transfer restrictions ensure regulatory compliance.",
            },
          ].map((feature, i) => (
            <div key={i} className="flex flex-col space-y-2 p-6 border rounded-xl bg-card">
              <h3 className="font-semibold text-xl">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
