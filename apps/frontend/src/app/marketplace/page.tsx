"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const assets = [
  { id: 1, name: "Manhattan Luxury Penthouse", category: "Real Estate", apy: "8.5%", valuation: "$2,500,000", available: "15,000 / 25,000" },
  { id: 2, name: "Downtown Office Tower", category: "Commercial Building", apy: "6.2%", valuation: "$10,000,000", available: "45,000 / 100,000" },
  { id: 3, name: "Gold Bullion Reserve", category: "Precious Metal", apy: "3.0%", valuation: "$500,000", available: "1,200 / 5,000" },
  { id: 4, name: "Vintage Ferrari 250 GTO", category: "Luxury Vehicle", apy: "1.5%", valuation: "$48,000,000", available: "300,000 / 480,000" },
  { id: 5, name: "Solar Farm Alpha", category: "Energy Infrastructure", apy: "11.0%", valuation: "$5,000,000", available: "5,000 / 50,000" },
];

export default function MarketplacePage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Marketplace</h1>
          <p className="text-muted-foreground">Discover and invest in fractionalized real-world assets</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <Card key={asset.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{asset.name}</CardTitle>
                <div className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
                  {asset.apy} APY
                </div>
              </div>
              <CardDescription>{asset.category}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valuation</span>
                <span className="font-semibold">{asset.valuation}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tokens Available</span>
                <span className="font-semibold">{asset.available}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Funding Progress</span>
                  <span>{Math.round((parseInt(asset.available.split(' / ')[0].replace(/,/g, '')) / parseInt(asset.available.split(' / ')[1].replace(/,/g, ''))) * 100)}% Available</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${100 - Math.round((parseInt(asset.available.split(' / ')[0].replace(/,/g, '')) / parseInt(asset.available.split(' / ')[1].replace(/,/g, ''))) * 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Invest Now</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
