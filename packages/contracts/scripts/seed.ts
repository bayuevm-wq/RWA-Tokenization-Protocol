import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// RWA Tokenization Platform — Seed Data Script
// ============================================================================
// Populates the locally-deployed platform with 5 sample assets, whitelists
// three investors, and distributes asset tokens to each of them.
// ============================================================================

// ── Role Constants ──────────────────────────────────────────────────────────
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

// ── Category Enum Mapping ───────────────────────────────────────────────────
const Category = {
  RealEstate: 0,
  CommercialBuilding: 1,
  PreciousMetal: 2,
  LuxuryVehicle: 3,
  EnergyInfrastructure: 4,
} as const;

// ── Sample Assets ───────────────────────────────────────────────────────────
const ASSETS = [
  {
    name: "Manhattan Luxury Penthouse",
    symbol: "MLP",
    category: Category.RealEstate,
    valuationUSD: 2_500_000,
    maxTokenSupply: 25_000,
    yieldBps: 850,
    metadataURI: "ipfs://QmManhattanPenthouseMetadata",
  },
  {
    name: "Downtown Office Tower",
    symbol: "DOT",
    category: Category.CommercialBuilding,
    valuationUSD: 10_000_000,
    maxTokenSupply: 100_000,
    yieldBps: 620,
    metadataURI: "ipfs://QmDowntownOfficeTowerMetadata",
  },
  {
    name: "Gold Bullion Reserve",
    symbol: "GBR",
    category: Category.PreciousMetal,
    valuationUSD: 500_000,
    maxTokenSupply: 5_000,
    yieldBps: 300,
    metadataURI: "ipfs://QmGoldBullionReserveMetadata",
  },
  {
    name: "Vintage Ferrari 250 GTO",
    symbol: "FGTO",
    category: Category.LuxuryVehicle,
    valuationUSD: 48_000_000,
    maxTokenSupply: 480_000,
    yieldBps: 150,
    metadataURI: "ipfs://QmVintageFerrari250GTOMetadata",
  },
  {
    name: "Solar Farm Alpha",
    symbol: "SFA",
    category: Category.EnergyInfrastructure,
    valuationUSD: 5_000_000,
    maxTokenSupply: 50_000,
    yieldBps: 1100,
    metadataURI: "ipfs://QmSolarFarmAlphaMetadata",
  },
];

// ── Investor Allocation Ratios ──────────────────────────────────────────────
// Distribute tokens: investor1 = 50%, investor2 = 30%, investor3 = 20%
const ALLOCATION_RATIOS = [50, 30, 20];

// ── Helpers ─────────────────────────────────────────────────────────────────
function divider(title: string) {
  console.log("\n" + "═".repeat(68));
  console.log(`  ${title}`);
  console.log("═".repeat(68));
}

function categoryName(cat: number): string {
  const names = ["RealEstate", "CommercialBuilding", "PreciousMetal", "LuxuryVehicle", "EnergyInfrastructure"];
  return names[cat] ?? "Unknown";
}

function loadAddresses() {
  const filePath = path.join(__dirname, "deployed-addresses.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `deployed-addresses.json not found at ${filePath}.\n` +
      `Run the deploy script first: npx hardhat run scripts/deploy.ts --network localhost`
    );
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Get signers: [admin, _, investor1, investor2, investor3]
  const signers = await ethers.getSigners();
  if (signers.length < 5) {
    throw new Error("Need at least 5 signers. Run with a local Hardhat node (npx hardhat node).");
  }
  const [admin, , investor1, investor2, investor3] = signers;
  const investors = [investor1, investor2, investor3];

  divider("RWA Tokenization Platform — Seed Script");
  console.log(`  Admin     : ${admin.address}`);
  console.log(`  Investor1 : ${investor1.address}`);
  console.log(`  Investor2 : ${investor2.address}`);
  console.log(`  Investor3 : ${investor3.address}`);

  // Load deployed addresses
  const deployed = loadAddresses();
  const {
    MockUSDC: mockUSDCAddr,
    ComplianceManager: complianceAddr,
    AssetFactory: factoryAddr,
  } = deployed.contracts;

  // Attach to contracts
  const complianceManager = await ethers.getContractAt("ComplianceManager", complianceAddr);
  const assetFactory = await ethers.getContractAt("AssetFactory", factoryAddr);

  // ── Step 1: Whitelist & KYC-Verify Investors ──────────────────────────
  divider("Step 1 — Whitelisting & KYC-Verifying Investors");

  for (const investor of investors) {
    const tx1 = await complianceManager.connect(admin).whitelistAddress(investor.address);
    await tx1.wait();
    const tx2 = await complianceManager.connect(admin).verifyKYC(investor.address);
    await tx2.wait();
    console.log(`  ✅  ${investor.address} — whitelisted & KYC verified`);
  }

  // ── Step 2: Create Assets ─────────────────────────────────────────────
  divider("Step 2 — Creating Sample Assets");

  interface CreatedAsset {
    name: string;
    symbol: string;
    category: number;
    tokenAddress: string;
    assetId: string;
    maxSupply: bigint;
    yieldBps: number;
    valuationUSD: number;
  }
  const createdAssets: CreatedAsset[] = [];

  for (const asset of ASSETS) {
    const valuationWei = ethers.parseEther(asset.valuationUSD.toString());

    const tx = await assetFactory.connect(admin).createAsset(
      asset.name,
      asset.symbol,
      asset.category,
      valuationWei,
      asset.maxTokenSupply,
      asset.yieldBps,
      asset.metadataURI
    );
    const receipt = await tx.wait();

    // Parse the AssetTokenCreated event
    let tokenAddress = "";
    let assetId = "";

    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = assetFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed && parsed.name === "AssetTokenCreated") {
            tokenAddress = parsed.args.tokenAddress ?? parsed.args[0];
            assetId = parsed.args.assetId?.toString() ?? parsed.args[1]?.toString();
            break;
          }
        } catch {
          // Not an event from this contract — skip
        }
      }
    }

    createdAssets.push({
      name: asset.name,
      symbol: asset.symbol,
      category: asset.category,
      tokenAddress,
      assetId,
      maxSupply: BigInt(asset.maxTokenSupply),
      yieldBps: asset.yieldBps,
      valuationUSD: asset.valuationUSD,
    });

    console.log(`  ✅  ${asset.name} (${asset.symbol})`);
    console.log(`      Token  : ${tokenAddress}`);
    console.log(`      Asset# : ${assetId}`);
    console.log(`      Type   : ${categoryName(asset.category)} | Yield: ${asset.yieldBps / 100}%`);
    console.log("");
  }

  // ── Step 3: Distribute Tokens to Investors ────────────────────────────
  divider("Step 3 — Minting & Distributing Tokens");

  const allocationSummary: {
    asset: string;
    investor: string;
    amount: string;
  }[] = [];

  for (const asset of createdAssets) {
    if (!asset.tokenAddress) {
      console.log(`  ⚠️  Skipping ${asset.name} — no token address`);
      continue;
    }

    const assetToken = await ethers.getContractAt("AssetToken", asset.tokenAddress);

    // The admin should already have MINTER_ROLE from factory setup,
    // but grant it just in case for direct minting.
    try {
      const grantTx = await assetToken.connect(admin).grantRole(MINTER_ROLE, admin.address);
      await grantTx.wait();
    } catch {
      // Role may already be granted — continue
    }

    console.log(`\n  📦 ${asset.name} (${asset.symbol}) — Supply: ${asset.maxSupply.toLocaleString()}`);

    for (let i = 0; i < investors.length; i++) {
      const investor = investors[i];
      const amount = (asset.maxSupply * BigInt(ALLOCATION_RATIOS[i])) / 100n;

      const mintTx = await assetToken.connect(admin).mint(investor.address, amount);
      await mintTx.wait();

      allocationSummary.push({
        asset: asset.symbol,
        investor: `Investor${i + 1}`,
        amount: amount.toString(),
      });

      console.log(`     → Investor${i + 1}: ${amount.toLocaleString()} tokens (${ALLOCATION_RATIOS[i]}%)`);
    }
  }

  // ── Step 4: Save Created Asset Addresses ──────────────────────────────
  const seedData = {
    seedAt: new Date().toISOString(),
    investors: investors.map((inv, i) => ({
      label: `Investor${i + 1}`,
      address: inv.address,
    })),
    assets: createdAssets.map((a) => ({
      name: a.name,
      symbol: a.symbol,
      category: categoryName(a.category),
      tokenAddress: a.tokenAddress,
      assetId: a.assetId,
      maxSupply: a.maxSupply.toString(),
      yieldBps: a.yieldBps,
      valuationUSD: a.valuationUSD,
    })),
    allocations: allocationSummary,
  };

  const seedPath = path.join(__dirname, "seed-data.json");
  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2));

  // ── Summary ───────────────────────────────────────────────────────────
  divider("Seed Summary");
  console.log(`  Assets created  : ${createdAssets.length}`);
  console.log(`  Investors setup : ${investors.length}`);
  console.log(`  Allocations     : ${allocationSummary.length}`);
  console.log(`  Seed data saved : ${seedPath}`);
  console.log("");

  console.log("  Asset                         Symbol  Category               Tokens     Yield");
  console.log("  " + "─".repeat(90));
  for (const a of createdAssets) {
    console.log(
      `  ${a.name.padEnd(30)} ${a.symbol.padEnd(7)} ${categoryName(a.category).padEnd(22)} ${a.maxSupply.toLocaleString().padStart(10)} ${(a.yieldBps / 100).toFixed(1).padStart(6)}%`
    );
  }

  console.log("\n  🎉  Seed complete! Platform is ready for simulation.\n");
}

// ── Entry Point ─────────────────────────────────────────────────────────────
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌  Seed script failed:");
    console.error(error);
    process.exit(1);
  });
