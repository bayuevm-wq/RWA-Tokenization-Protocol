"use client";

import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const proposals = [
  { id: 1, title: "Increase Solar Farm Alpha yield distribution to 8% APY", status: "Active", votesFor: "1.2M", votesAgainst: "100K", endDate: "2 days left" },
  { id: 2, title: "Add tokenized Gold Reserves to Treasury Vault", status: "Active", votesFor: "850K", votesAgainst: "500K", endDate: "5 days left" },
  { id: 3, title: "Upgrade AssetRegistry logic to V2", status: "Executed", votesFor: "2.1M", votesAgainst: "50K", endDate: "Ended" },
];

export default function GovernancePage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Wallet Not Connected</h2>
          <p className="text-muted-foreground">Please connect your wallet to participate in the RWA DAO.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Governance DAO</h1>
          <p className="text-muted-foreground">Vote on protocol upgrades and treasury allocations</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Your Voting Power</p>
            <p className="text-2xl font-bold text-primary">5,420 RWA</p>
          </div>
          <Button size="lg">Create Proposal</Button>
        </div>
      </div>

      <div className="grid gap-6">
        {proposals.map((proposal) => (
          <Card key={proposal.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{proposal.title}</CardTitle>
                  <CardDescription className="mt-1">Proposal #{proposal.id} • {proposal.endDate}</CardDescription>
                </div>
                <div className={`px-3 py-1 text-xs rounded-full font-medium ${
                  proposal.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                }`}>
                  {proposal.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>For: {proposal.votesFor}</span>
                  <span>Against: {proposal.votesAgainst}</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: "70%" }}></div>
                  <div className="bg-red-500 h-full" style={{ width: "30%" }}></div>
                </div>
              </div>
            </CardContent>
            {proposal.status === "Active" && (
              <CardFooter className="flex space-x-4">
                <Button className="w-full bg-green-600 hover:bg-green-700">Vote For</Button>
                <Button className="w-full bg-red-600 hover:bg-red-700">Vote Against</Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
