import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// RWA Tokenization Platform — Yield Distribution Simulation
// ============================================================================
// Simulates a full yield cycle: calculates yield per asset, mints USDC to
// admin, deposits yield into YieldDistributor, shows claimable balances,
// and has one investor claim.
// ============================================================================

// ── Helpers ─────────────────────────────────────────────────────────────────
function divider(title: string) {
  console.log("\n" + "═".repeat(72));
  console.log(`  ${title}`);
  console.log("═".repeat(72));
}

function formatUSDC(amount: bigint): string {
  // USDC has 6 decimals
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole.toLocaleString()}.${frac.slice(0, 2)} USDC`;
}

function loadJSON(filename: string) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${filename} not found at ${filePath}.\n` +
      `Run the appropriate script first.`
    );
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const signers = await ethers.getSigners();
  if (signers.length < 5) {
    throw new Error("Need at least 5 signers. Run with a local Hardhat node.");
  }
  const [admin, , investor1, investor2, investor3] = signers;
  const investors = [
    { label: "Investor1", signer: investor1 },
    { label: "Investor2", signer: investor2 },
    { label: "Investor3", signer: investor3 },
  ];

  // Load deployed addresses and seed data
  const deployed = loadJSON("deployed-addresses.json");
  const seedData = loadJSON("seed-data.json");

  const {
    MockUSDC: mockUSDCAddr,
    YieldDistributor: yieldDistAddr,
  } = deployed.contracts;

  const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddr);
  const yieldDistributor = await ethers.getContractAt("YieldDistributor", yieldDistAddr);

  divider("RWA Yield Distribution Simulation");
  console.log(`  Admin          : ${admin.address}`);
  console.log(`  MockUSDC       : ${mockUSDCAddr}`);
  console.log(`  YieldDistributor: ${yieldDistAddr}`);

  // ── Step 1: Calculate Yield Amounts ───────────────────────────────────
  divider("Step 1 — Calculating Annual Yield Per Asset");

  interface YieldEntry {
    name: string;
    symbol: string;
    tokenAddress: string;
    valuationUSD: number;
    yieldBps: number;
    yieldAmountUSDC: bigint; // 6-decimal USDC
  }
  const yieldEntries: YieldEntry[] = [];
  let totalYieldUSDC = 0n;

  for (const asset of seedData.assets) {
    // Annual yield = valuation * yieldBps / 10000
    // In USDC (6 decimals)
    const yieldUSD = (asset.valuationUSD * asset.yieldBps) / 10000;
    const yieldAmountUSDC = BigInt(yieldUSD) * 1_000_000n; // Convert to 6-decimal USDC

    yieldEntries.push({
      name: asset.name,
      symbol: asset.symbol,
      tokenAddress: asset.tokenAddress,
      valuationUSD: asset.valuationUSD,
      yieldBps: asset.yieldBps,
      yieldAmountUSDC,
    });

    totalYieldUSDC += yieldAmountUSDC;

    console.log(`  ${asset.name}`);
    console.log(`     Valuation : $${asset.valuationUSD.toLocaleString()}`);
    console.log(`     Yield Rate: ${asset.yieldBps / 100}% (${asset.yieldBps} bps)`);
    console.log(`     Yield Amt : ${formatUSDC(yieldAmountUSDC)}`);
    console.log("");
  }

  console.log(`  📊  Total yield to distribute: ${formatUSDC(totalYieldUSDC)}`);

  // ── Step 2: Mint USDC to Admin ────────────────────────────────────────
  divider("Step 2 — Minting USDC to Admin");

  // Mint enough USDC to cover all yields (add a 10% buffer)
  const mintAmount = totalYieldUSDC + (totalYieldUSDC / 10n);
  const mintTx = await mockUSDC.connect(admin).mint(admin.address, mintAmount);
  await mintTx.wait();

  const adminBalance = await mockUSDC.balanceOf(admin.address);
  console.log(`  ✅  Minted ${formatUSDC(mintAmount)} to admin`);
  console.log(`  💰  Admin USDC balance: ${formatUSDC(adminBalance)}`);

  // ── Step 3: Approve YieldDistributor ──────────────────────────────────
  divider("Step 3 — Approving YieldDistributor");

  const approveTx = await mockUSDC.connect(admin).approve(yieldDistAddr, mintAmount);
  await approveTx.wait();
  console.log(`  ✅  Approved ${formatUSDC(mintAmount)} for YieldDistributor`);

  // ── Step 4: Deposit Yield for Each Asset ──────────────────────────────
  divider("Step 4 — Depositing Yield via YieldDistributor");

  for (const entry of yieldEntries) {
    if (!entry.tokenAddress) {
      console.log(`  ⚠️  Skipping ${entry.name} — no token address`);
      continue;
    }

    const depositTx = await yieldDistributor
      .connect(admin)
      .depositYield(entry.tokenAddress, entry.yieldAmountUSDC);
    await depositTx.wait();

    console.log(`  ✅  ${entry.symbol.padEnd(6)} — Deposited ${formatUSDC(entry.yieldAmountUSDC)}`);
  }

  // ── Step 5: Show Claimable Rewards per Investor ───────────────────────
  divider("Step 5 — Claimable Rewards Breakdown");

  console.log(
    "  " +
    "Asset".padEnd(8) +
    "Investor".padEnd(12) +
    "Tokens Held".padStart(14) +
    "Token %".padStart(10) +
    "Claimable".padStart(20)
  );
  console.log("  " + "─".repeat(64));

  interface ClaimInfo {
    investorLabel: string;
    investorAddress: string;
    assetSymbol: string;
    tokenAddress: string;
    tokensHeld: bigint;
    totalSupply: bigint;
    sharePercent: string;
    claimableUSDC: bigint;
  }
  const claimInfos: ClaimInfo[] = [];

  for (const entry of yieldEntries) {
    if (!entry.tokenAddress) continue;

    const assetToken = await ethers.getContractAt("AssetToken", entry.tokenAddress);
    const totalSupply = await assetToken.totalSupply();

    for (const inv of investors) {
      const balance = await assetToken.balanceOf(inv.signer.address);

      // Calculate expected share: (balance / totalSupply) * yieldAmount
      let expectedReward = 0n;
      if (totalSupply > 0n) {
        expectedReward = (entry.yieldAmountUSDC * balance) / totalSupply;
      }

      const sharePercent = totalSupply > 0n
        ? ((Number(balance) / Number(totalSupply)) * 100).toFixed(1)
        : "0.0";

      claimInfos.push({
        investorLabel: inv.label,
        investorAddress: inv.signer.address,
        assetSymbol: entry.symbol,
        tokenAddress: entry.tokenAddress,
        tokensHeld: balance,
        totalSupply,
        sharePercent,
        claimableUSDC: expectedReward,
      });

      console.log(
        "  " +
        entry.symbol.padEnd(8) +
        inv.label.padEnd(12) +
        balance.toLocaleString().padStart(14) +
        `${sharePercent}%`.padStart(10) +
        formatUSDC(expectedReward).padStart(20)
      );
    }
  }

  // ── Step 6: Investor1 Claims Rewards ──────────────────────────────────
  divider("Step 6 — Investor1 Claims Rewards");

  const investor1BalanceBefore = await mockUSDC.balanceOf(investor1.address);
  console.log(`  USDC balance before: ${formatUSDC(investor1BalanceBefore)}`);

  // Investor1 claims from each asset
  let totalClaimed = 0n;
  for (const entry of yieldEntries) {
    if (!entry.tokenAddress) continue;

    try {
      const claimTx = await yieldDistributor
        .connect(investor1)
        .claimYield(entry.tokenAddress);
      const receipt = await claimTx.wait();

      // Try to find claimed amount from event
      if (receipt && receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsed = yieldDistributor.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            if (parsed && (parsed.name === "YieldClaimed" || parsed.name === "RewardClaimed")) {
              const claimedAmount = parsed.args.amount ?? parsed.args[2];
              totalClaimed += BigInt(claimedAmount);
              console.log(`  ✅  Claimed from ${entry.symbol}: ${formatUSDC(BigInt(claimedAmount))}`);
              break;
            }
          } catch {
            // Not our event
          }
        }
      }
    } catch (err: any) {
      console.log(`  ⚠️  Could not claim from ${entry.symbol}: ${err.message?.slice(0, 80)}`);
    }
  }

  const investor1BalanceAfter = await mockUSDC.balanceOf(investor1.address);
  const actualGain = investor1BalanceAfter - investor1BalanceBefore;

  console.log(`\n  USDC balance after : ${formatUSDC(investor1BalanceAfter)}`);
  console.log(`  Actual USDC gained : ${formatUSDC(actualGain)}`);

  // ── Final Accounting Summary ──────────────────────────────────────────
  divider("Final Accounting Summary");

  const adminFinalBalance = await mockUSDC.balanceOf(admin.address);
  const distributorBalance = await mockUSDC.balanceOf(yieldDistAddr);

  console.log("  Account                                    USDC Balance");
  console.log("  " + "─".repeat(60));
  console.log(`  Admin (deployer)                           ${formatUSDC(adminFinalBalance)}`);
  console.log(`  YieldDistributor (contract)                ${formatUSDC(distributorBalance)}`);
  console.log(`  Investor1                                  ${formatUSDC(investor1BalanceAfter)}`);

  const inv2Balance = await mockUSDC.balanceOf(investor2.address);
  const inv3Balance = await mockUSDC.balanceOf(investor3.address);
  console.log(`  Investor2                                  ${formatUSDC(inv2Balance)}`);
  console.log(`  Investor3                                  ${formatUSDC(inv3Balance)}`);

  console.log("");
  console.log("  Yield Summary by Asset:");
  console.log("  " + "─".repeat(60));
  for (const entry of yieldEntries) {
    console.log(
      `  ${entry.name.padEnd(32)} ${formatUSDC(entry.yieldAmountUSDC).padStart(20)}`
    );
  }
  console.log("  " + "─".repeat(60));
  console.log(`  ${"Total Distributed".padEnd(32)} ${formatUSDC(totalYieldUSDC).padStart(20)}`);
  console.log(`  ${"Remaining in Distributor".padEnd(32)} ${formatUSDC(distributorBalance).padStart(20)}`);

  console.log("\n  🎉  Yield simulation complete!\n");
}

// ── Entry Point ─────────────────────────────────────────────────────────────
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌  Yield simulation failed:");
    console.error(error);
    process.exit(1);
  });
