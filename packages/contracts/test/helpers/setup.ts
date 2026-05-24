import { ethers, upgrades } from "hardhat";

// ── Role Constants ──────────────────────────────────────────────────────────
export const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
export const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
export const COMPLIANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMPLIANCE_ROLE"));
export const DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
export const REGISTRY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY_ROLE"));
export const FACTORY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FACTORY_ROLE"));
export const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
export const ASSET_TOKEN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ASSET_TOKEN_ROLE"));
export const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

// ── Helper: whitelist + KYC ─────────────────────────────────────────────────
export async function whitelistAndKYC(complianceManager: any, address: string) {
  await complianceManager.addToWhitelist(address);
  await complianceManager.setKYCStatus(address, true);
}

// ── Main fixture ────────────────────────────────────────────────────────────
export async function deployFullPlatform() {
  const [admin, compliance, investor1, investor2, investor3, unauthorized] =
    await ethers.getSigners();

  // 1. MockUSDC (regular deploy – NOT upgradeable)
  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDCFactory.deploy();
  await mockUSDC.waitForDeployment();

  // 2. ComplianceManager (UUPS proxy)
  const ComplianceManagerFactory = await ethers.getContractFactory("ComplianceManager");
  const complianceManager = await upgrades.deployProxy(
    ComplianceManagerFactory,
    [admin.address],
    { kind: "uups" }
  );
  await complianceManager.waitForDeployment();

  // 3. YieldDistributor (UUPS proxy)
  const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
  const yieldDistributor = await upgrades.deployProxy(
    YieldDistributorFactory,
    [admin.address, await mockUSDC.getAddress()],
    { kind: "uups" }
  );
  await yieldDistributor.waitForDeployment();

  // 4. AssetToken implementation (plain deploy – used by factory as beacon / clone source)
  const AssetTokenFactory = await ethers.getContractFactory("AssetToken");
  const assetTokenImpl = await AssetTokenFactory.deploy();
  await assetTokenImpl.waitForDeployment();

  // 5. AssetRegistry (UUPS proxy)
  const AssetRegistryFactory = await ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await upgrades.deployProxy(
    AssetRegistryFactory,
    [admin.address],
    { kind: "uups" }
  );
  await assetRegistry.waitForDeployment();

  // 6. AssetFactory (UUPS proxy)
  const AssetFactoryFactory = await ethers.getContractFactory("AssetFactory");
  const assetFactory = await upgrades.deployProxy(
    AssetFactoryFactory,
    [
      admin.address,
      await assetTokenImpl.getAddress(),
      await assetRegistry.getAddress(),
      await complianceManager.getAddress(),
      await yieldDistributor.getAddress(),
    ],
    { kind: "uups" }
  );
  await assetFactory.waitForDeployment();

  // 7. Grant REGISTRY_ROLE to factory on AssetRegistry
  await assetRegistry.grantRole(REGISTRY_ROLE, await assetFactory.getAddress());

  // 8. Grant DISTRIBUTOR_ROLE to factory on YieldDistributor
  await yieldDistributor.grantRole(DISTRIBUTOR_ROLE, await assetFactory.getAddress());

  // 9. Grant FACTORY_ROLE to admin on AssetFactory
  await assetFactory.grantRole(FACTORY_ROLE, admin.address);

  // Grant COMPLIANCE_ROLE to admin on ComplianceManager (for convenience in tests)
  await complianceManager.grantRole(COMPLIANCE_ROLE, admin.address);

  // Grant DISTRIBUTOR_ROLE to admin on YieldDistributor (for convenience in tests)
  await yieldDistributor.grantRole(DISTRIBUTOR_ROLE, admin.address);

  return {
    mockUSDC,
    complianceManager,
    yieldDistributor,
    assetTokenImpl,
    assetRegistry,
    assetFactory,
    admin,
    compliance,
    investor1,
    investor2,
    investor3,
    unauthorized,
  };
}
