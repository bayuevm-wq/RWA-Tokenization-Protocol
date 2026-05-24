"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState("compliance");

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Wallet Not Connected</h2>
          <p className="text-muted-foreground">Please connect your admin wallet to view this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage assets, compliance, and yield distribution</p>
      </div>

      <div className="flex space-x-2 border-b pb-4">
        {["compliance", "assets", "yield"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "ghost"}
            onClick={() => setActiveTab(tab)}
            className="capitalize"
          >
            {tab}
          </Button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === "compliance" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Whitelist Manager</CardTitle>
                <CardDescription>Add or remove investor addresses from the whitelist.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Investor Address</label>
                  <input 
                    type="text" 
                    placeholder="0x..." 
                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">Remove</Button>
                <Button>Add to Whitelist</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>KYC Verification</CardTitle>
                <CardDescription>Update KYC status for specific addresses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Investor Address</label>
                  <input 
                    type="text" 
                    placeholder="0x..." 
                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">Revoke KYC</Button>
                <Button>Approve KYC</Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {activeTab === "assets" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Mint New RWA Token</CardTitle>
              <CardDescription>Deploy a new smart contract for a tokenized real-world asset.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Asset Name</label>
                  <input type="text" className="w-full h-10 rounded-md border bg-background px-3" placeholder="e.g. Solar Farm" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Token Symbol</label>
                  <input type="text" className="w-full h-10 rounded-md border bg-background px-3" placeholder="e.g. SOLAR" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valuation (USD)</label>
                  <input type="number" className="w-full h-10 rounded-md border bg-background px-3" placeholder="1000000" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Supply</label>
                  <input type="number" className="w-full h-10 rounded-md border bg-background px-3" placeholder="10000" />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Deploy Asset Contract</Button>
            </CardFooter>
          </Card>
        )}

        {activeTab === "yield" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Deposit Yield</CardTitle>
              <CardDescription>Distribute MockUSDC yield to token holders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Asset</label>
                <select className="w-full h-10 rounded-md border bg-background px-3">
                  <option>Manhattan Luxury Penthouse</option>
                  <option>Solar Farm Alpha</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (USDC)</label>
                <input type="number" className="w-full h-10 rounded-md border bg-background px-3" placeholder="5000" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Deposit & Distribute</Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
