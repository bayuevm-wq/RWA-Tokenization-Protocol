"use client";

import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const yieldPositions = [
  { id: 1, asset: "Manhattan Luxury Penthouse", amount: "500", reward: "25.50 USDC" },
  { id: 2, asset: "Downtown Office Tower", amount: "250", reward: "12.00 USDC" },
  { id: 3, asset: "Solar Farm Alpha", amount: "1000", reward: "83.00 USDC" },
];

export default function YieldPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Wallet Not Connected</h2>
          <p className="text-muted-foreground">Please connect your wallet to view your yield distributions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Yield Distributions</h1>
          <p className="text-muted-foreground">Claim your earned yields from real-world assets</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Pending</p>
            <p className="text-2xl font-bold text-primary">120.50 USDC</p>
          </div>
          <Button size="lg">Claim All Rewards</Button>
        </div>
      </div>

      <div className="grid gap-4">
        {yieldPositions.map((pos) => (
          <Card key={pos.id} className="flex flex-col md:flex-row items-center justify-between p-4">
            <div className="flex-1">
              <CardHeader className="p-0 pb-2 md:pb-0">
                <CardTitle className="text-lg">{pos.asset}</CardTitle>
                <CardDescription>Holding: {pos.amount} Tokens</CardDescription>
              </CardHeader>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Pending Reward</p>
                <p className="text-lg font-bold text-green-500">{pos.reward}</p>
              </div>
              <Button variant="outline">Claim</Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Yield History</CardTitle>
          <CardDescription>Your recently claimed yields</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { date: "May 1, 2026", asset: "Solar Farm Alpha", amount: "75.00 USDC", txHash: "0x1234...5678" },
              { date: "Apr 1, 2026", asset: "Manhattan Luxury Penthouse", amount: "24.50 USDC", txHash: "0x8765...4321" },
            ].map((history, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{history.asset}</p>
                  <p className="text-xs text-muted-foreground">{history.date} • {history.txHash}</p>
                </div>
                <div className="font-bold text-muted-foreground">
                  +{history.amount}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
