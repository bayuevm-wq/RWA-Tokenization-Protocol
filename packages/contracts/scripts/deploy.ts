import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// RWA Tokenization Platform — Full Deployment Script
// ============================================================================
// Deploys every contract in dependency order, configures cross-contract RBAC
// roles, and persists deployed addresses to `deployed-addresses.json` so that
// seed and simulation scripts can consume them without manual copy-paste.
// ============================================================================

// ── Role Constants ──────────────────────────────────────────────────────────
const REGISTRY_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY_ROLE"));
const DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
const FACTORY_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("FACTORY_ROLE"));
const COMPLIANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMPLIANCE_ROLE"));

// ── Helpers ─────────────────────────────────────────────────────────────────
function divider(title: string) {
  console.log("\n" + "═".repeat(68));
  console.log(`  ${title}`);
  console.log("═".repeat(68));
}

function logAddress(label: string, address: string) {
  console.log(`  ✅  ${label.padEnd(30)} ${address}`);
}

function logRole(role: string, contract: string, grantee: string) {
  console.log(`  🔑  ${role.padEnd(20)} on ${contract.padEnd(22)} → ${grantee}`);
}

// ── Main Deployment ─────────────────────────────────────────────────────────
async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;

  divider("RWA Tokenization Platform — Deployment");
  console.log(`  Deployer / Admin : ${admin}`);
  console.log(`  Network          : ${(await ethers.provider.getNetwork()).name} (chainId ${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`  Block Number     : ${await ethers.provider.getBlockNumber()}`);
  console.log(`  Timestamp        : ${new Date().toISOString()}`);

  // ── 1. MockUSDC (regular deploy — NOT upgradeable) ────────────────────
  divider("1 / 6 — Deploying MockUSDC");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  logAddress("MockUSDC", mockUSDCAddress);

  // ── 2. ComplianceManager (UUPS proxy) ─────────────────────────────────
  divider("2 / 6 — Deploying ComplianceManager (UUPS)");
  const ComplianceManager = await ethers.getContractFactory("ComplianceManager");
  const complianceManager = await upgrades.deployProxy(
    ComplianceManager,
    [admin],
    { kind: "uups" }
  );
  await complianceManager.waitForDeployment();
  const complianceAddress = await complianceManager.getAddress();
  logAddress("ComplianceManager (proxy)", complianceAddress);

  // ── 3. YieldDistributor (UUPS proxy) ──────────────────────────────────
  divider("3 / 6 — Deploying YieldDistributor (UUPS)");
  const YieldDistributor = await ethers.getContractFactory("YieldDistributor");
  const yieldDistributor = await upgrades.deployProxy(
    YieldDistributor,
    [admin, mockUSDCAddress],
    { kind: "uups", unsafeAllow: ["constructor"] }
  );
  await yieldDistributor.waitForDeployment();
  const yieldDistributorAddress = await yieldDistributor.getAddress();
  logAddress("YieldDistributor (proxy)", yieldDistributorAddress);

  // ── 4. AssetToken implementation (regular deploy — used by factory) ───
  divider("4 / 6 — Deploying AssetToken Implementation");
  const AssetToken = await ethers.getContractFactory("AssetToken");
  const assetTokenImpl = await AssetToken.deploy();
  await assetTokenImpl.waitForDeployment();
  const assetTokenImplAddress = await assetTokenImpl.getAddress();
  logAddress("AssetToken (implementation)", assetTokenImplAddress);

  // ── 5. AssetRegistry (UUPS proxy) ─────────────────────────────────────
  divider("5 / 6 — Deploying AssetRegistry (UUPS)");
  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await upgrades.deployProxy(
    AssetRegistry,
    [admin],
    { kind: "uups" }
  );
  await assetRegistry.waitForDeployment();
  const registryAddress = await assetRegistry.getAddress();
  logAddress("AssetRegistry (proxy)", registryAddress);

  // ── 6. AssetFactory (UUPS proxy) ──────────────────────────────────────
  divider("6 / 6 — Deploying AssetFactory (UUPS)");
  const AssetFactory = await ethers.getContractFactory("AssetFactory");
  const assetFactory = await upgrades.deployProxy(
    AssetFactory,
    [admin, assetTokenImplAddress, registryAddress, complianceAddress, yieldDistributorAddress],
    { kind: "uups" }
  );
  await assetFactory.waitForDeployment();
  const factoryAddress = await assetFactory.getAddress();
  logAddress("AssetFactory (proxy)", factoryAddress);

  // ── Role Configuration ────────────────────────────────────────────────
  divider("Configuring Cross-Contract Roles");

  // AssetRegistry: grant REGISTRY_ROLE to AssetFactory
  const registryTx1 = await assetRegistry.grantRole(REGISTRY_ROLE, factoryAddress);
  await registryTx1.wait();
  logRole("REGISTRY_ROLE", "AssetRegistry", factoryAddress);

  // YieldDistributor: grant DISTRIBUTOR_ROLE to AssetFactory
  const yieldTx1 = await yieldDistributor.grantRole(DISTRIBUTOR_ROLE, factoryAddress);
  await yieldTx1.wait();
  logRole("DISTRIBUTOR_ROLE", "YieldDistributor", factoryAddress);

  // AssetFactory: grant FACTORY_ROLE to admin
  const factoryTx1 = await assetFactory.grantRole(FACTORY_ROLE, admin);
  await factoryTx1.wait();
  logRole("FACTORY_ROLE", "AssetFactory", admin);

  // ComplianceManager: grant COMPLIANCE_ROLE to admin
  const complianceTx1 = await complianceManager.grantRole(COMPLIANCE_ROLE, admin);
  await complianceTx1.wait();
  logRole("COMPLIANCE_ROLE", "ComplianceManager", admin);

  // ── Persist Addresses ─────────────────────────────────────────────────
  const deployedAddresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: admin,
    deployedAt: new Date().toISOString(),
    contracts: {
      MockUSDC: mockUSDCAddress,
      ComplianceManager: complianceAddress,
      YieldDistributor: yieldDistributorAddress,
      AssetTokenImplementation: assetTokenImplAddress,
      AssetRegistry: registryAddress,
      AssetFactory: factoryAddress,
    },
  };

  const outputPath = path.join(__dirname, "deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));

  divider("Deployment Summary");
  console.log(`  All addresses saved to: ${outputPath}`);
  console.log("");
  console.log("  Contract                       Address");
  console.log("  " + "─".repeat(64));
  logAddress("MockUSDC", mockUSDCAddress);
  logAddress("ComplianceManager", complianceAddress);
  logAddress("YieldDistributor", yieldDistributorAddress);
  logAddress("AssetToken (impl)", assetTokenImplAddress);
  logAddress("AssetRegistry", registryAddress);
  logAddress("AssetFactory", factoryAddress);
  console.log("");
  console.log("  🎉  Deployment complete!\n");
}

// ── Entry Point ─────────────────────────────────────────────────────────────
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌  Deployment failed:");
    console.error(error);
    process.exit(1);
  });
