import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  MINTER_ROLE,
  PAUSER_ROLE,
  COMPLIANCE_ROLE,
  DISTRIBUTOR_ROLE,
  ASSET_TOKEN_ROLE,
  DEFAULT_ADMIN_ROLE,
  whitelistAndKYC,
} from "../helpers/setup";

describe("AssetToken", function () {
  // ── Fixture ───────────────────────────────────────────────────────────────
  async function deployAssetToken() {
    const [admin, minter, pauser, investor1, investor2, unauthorized] =
      await ethers.getSigners();

    // Deploy MockUSDC (reward token for yield distributor)
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy ComplianceManager
    const ComplianceFactory = await ethers.getContractFactory("ComplianceManager");
    const complianceManager = await upgrades.deployProxy(
      ComplianceFactory,
      [admin.address],
      { kind: "uups" }
    );
    await complianceManager.waitForDeployment();
    await complianceManager.grantRole(COMPLIANCE_ROLE, admin.address);

    // Deploy YieldDistributor
    const YieldFactory = await ethers.getContractFactory("YieldDistributor");
    const yieldDistributor = await upgrades.deployProxy(
      YieldFactory,
      [admin.address, await mockUSDC.getAddress()],
      { kind: "uups" }
    );
    await yieldDistributor.waitForDeployment();
    await yieldDistributor.grantRole(DISTRIBUTOR_ROLE, admin.address);

    // Deploy AssetToken via proxy
    const AssetTokenFactory = await ethers.getContractFactory("AssetToken");
    const CAP = ethers.parseEther("10000"); // 10 000 tokens
    const ASSET_ID = ethers.keccak256(ethers.toUtf8Bytes("TEST_ASSET"));

    const assetToken = await upgrades.deployProxy(
      AssetTokenFactory,
      [
        "Test Asset Token",
        "TAT",
        CAP,
        admin.address,
        await complianceManager.getAddress(),
        await yieldDistributor.getAddress(),
        ASSET_ID,
      ],
      { kind: "uups" }
    );
    await assetToken.waitForDeployment();

    // Grant roles
    await assetToken.grantRole(MINTER_ROLE, admin.address);
    await assetToken.grantRole(MINTER_ROLE, minter.address);
    await assetToken.grantRole(PAUSER_ROLE, pauser.address);

    // Register the asset token in YieldDistributor
    await yieldDistributor.registerAssetToken(await assetToken.getAddress());

    // Grant ASSET_TOKEN_ROLE to the assetToken on the yieldDistributor
    await yieldDistributor.grantRole(ASSET_TOKEN_ROLE, await assetToken.getAddress());

    return {
      assetToken,
      complianceManager,
      yieldDistributor,
      mockUSDC,
      admin,
      minter,
      pauser,
      investor1,
      investor2,
      unauthorized,
      CAP,
      ASSET_ID,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═════════════════════════════════════════════════════════════════════════
  describe("Initialization", function () {
    it("should have the correct name", async function () {
      const { assetToken } = await loadFixture(deployAssetToken);
      expect(await assetToken.name()).to.equal("Test Asset Token");
    });

    it("should have the correct symbol", async function () {
      const { assetToken } = await loadFixture(deployAssetToken);
      expect(await assetToken.symbol()).to.equal("TAT");
    });

    it("should have the correct cap", async function () {
      const { assetToken, CAP } = await loadFixture(deployAssetToken);
      expect(await assetToken.cap()).to.equal(CAP);
    });

    it("should have the correct asset ID", async function () {
      const { assetToken, ASSET_ID } = await loadFixture(deployAssetToken);
      expect(await assetToken.assetId()).to.equal(ASSET_ID);
    });

    it("should grant DEFAULT_ADMIN_ROLE to the admin", async function () {
      const { assetToken, admin } = await loadFixture(deployAssetToken);
      expect(await assetToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should grant MINTER_ROLE to the admin", async function () {
      const { assetToken, admin } = await loadFixture(deployAssetToken);
      expect(await assetToken.hasRole(MINTER_ROLE, admin.address)).to.be.true;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // MINTING
  // ═════════════════════════════════════════════════════════════════════════
  describe("Minting", function () {
    it("should allow MINTER_ROLE to mint tokens", async function () {
      const { assetToken, admin, investor1 } = await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      await expect(assetToken.mint(investor1.address, amount))
        .to.emit(assetToken, "TokensMinted")
        .withArgs(investor1.address, amount);

      expect(await assetToken.balanceOf(investor1.address)).to.equal(amount);
    });

    it("should allow minting up to the cap", async function () {
      const { assetToken, admin, investor1, CAP } = await loadFixture(deployAssetToken);
      await assetToken.mint(investor1.address, CAP);
      expect(await assetToken.totalSupply()).to.equal(CAP);
    });

    it("should revert when minting would exceed the cap", async function () {
      const { assetToken, admin, investor1, CAP } = await loadFixture(deployAssetToken);
      const overCap = CAP + 1n;

      await expect(assetToken.mint(investor1.address, overCap))
        .to.be.revertedWithCustomError(assetToken, "CapExceeded");
    });

    it("should revert when minting after reaching the cap", async function () {
      const { assetToken, admin, investor1, investor2, CAP } =
        await loadFixture(deployAssetToken);
      await assetToken.mint(investor1.address, CAP);

      await expect(assetToken.mint(investor2.address, 1))
        .to.be.revertedWithCustomError(assetToken, "CapExceeded");
    });

    it("should revert when unauthorized account tries to mint", async function () {
      const { assetToken, investor1, unauthorized } =
        await loadFixture(deployAssetToken);

      await expect(
        assetToken.connect(unauthorized).mint(investor1.address, ethers.parseEther("1"))
      ).to.be.reverted;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BURNING
  // ═════════════════════════════════════════════════════════════════════════
  describe("Burning", function () {
    it("should allow DEFAULT_ADMIN_ROLE to burn tokens", async function () {
      const { assetToken, admin, investor1 } = await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      await assetToken.mint(investor1.address, amount);
      await expect(assetToken.burn(investor1.address, amount))
        .to.emit(assetToken, "TokensBurned")
        .withArgs(investor1.address, amount);

      expect(await assetToken.balanceOf(investor1.address)).to.equal(0);
    });

    it("should revert when unauthorized account tries to burn", async function () {
      const { assetToken, admin, investor1, unauthorized } =
        await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      await assetToken.mint(investor1.address, amount);

      await expect(
        assetToken.connect(unauthorized).burn(investor1.address, amount)
      ).to.be.reverted;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TRANSFERS (Compliance Checked)
  // ═════════════════════════════════════════════════════════════════════════
  describe("Transfers", function () {
    it("should allow transfer when both parties are compliant", async function () {
      const { assetToken, complianceManager, investor1, investor2 } =
        await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      // Setup compliance for both
      await whitelistAndKYC(complianceManager, investor1.address);
      await whitelistAndKYC(complianceManager, investor2.address);

      // Mint to investor1 (minting skips compliance)
      await assetToken.mint(investor1.address, amount);

      // Transfer from investor1 → investor2
      await expect(
        assetToken.connect(investor1).transfer(investor2.address, amount)
      ).to.not.be.reverted;

      expect(await assetToken.balanceOf(investor2.address)).to.equal(amount);
    });

    it("should revert transfer when 'from' is not compliant", async function () {
      const { assetToken, complianceManager, investor1, investor2 } =
        await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      // Only whitelist investor2
      await whitelistAndKYC(complianceManager, investor2.address);

      await assetToken.mint(investor1.address, amount);

      await expect(
        assetToken.connect(investor1).transfer(investor2.address, amount)
      ).to.be.revertedWithCustomError(assetToken, "TransferNotCompliant");
    });

    it("should revert transfer when 'to' is not compliant", async function () {
      const { assetToken, complianceManager, investor1, investor2 } =
        await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      // Only whitelist investor1
      await whitelistAndKYC(complianceManager, investor1.address);

      await assetToken.mint(investor1.address, amount);

      await expect(
        assetToken.connect(investor1).transfer(investor2.address, amount)
      ).to.be.revertedWithCustomError(assetToken, "TransferNotCompliant");
    });

    it("should allow transferFrom when both parties are compliant", async function () {
      const { assetToken, complianceManager, admin, investor1, investor2 } =
        await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("50");

      await whitelistAndKYC(complianceManager, investor1.address);
      await whitelistAndKYC(complianceManager, investor2.address);

      await assetToken.mint(investor1.address, amount);
      await assetToken.connect(investor1).approve(admin.address, amount);

      await expect(
        assetToken.transferFrom(investor1.address, investor2.address, amount)
      ).to.not.be.reverted;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // PAUSE / UNPAUSE
  // ═════════════════════════════════════════════════════════════════════════
  describe("Pause / Unpause", function () {
    it("should pause the contract", async function () {
      const { assetToken, pauser } = await loadFixture(deployAssetToken);

      await assetToken.connect(pauser).pause();
      expect(await assetToken.paused()).to.be.true;
    });

    it("should unpause the contract", async function () {
      const { assetToken, pauser } = await loadFixture(deployAssetToken);

      await assetToken.connect(pauser).pause();
      await assetToken.connect(pauser).unpause();
      expect(await assetToken.paused()).to.be.false;
    });

    it("should block transfers when paused", async function () {
      const { assetToken, complianceManager, pauser, investor1, investor2 } =
        await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      await whitelistAndKYC(complianceManager, investor1.address);
      await whitelistAndKYC(complianceManager, investor2.address);

      await assetToken.mint(investor1.address, amount);
      await assetToken.connect(pauser).pause();

      await expect(
        assetToken.connect(investor1).transfer(investor2.address, amount)
      ).to.be.reverted;
    });

    it("should allow transfers after unpausing", async function () {
      const { assetToken, complianceManager, pauser, investor1, investor2 } =
        await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("100");

      await whitelistAndKYC(complianceManager, investor1.address);
      await whitelistAndKYC(complianceManager, investor2.address);

      await assetToken.mint(investor1.address, amount);
      await assetToken.connect(pauser).pause();
      await assetToken.connect(pauser).unpause();

      await expect(
        assetToken.connect(investor1).transfer(investor2.address, amount)
      ).to.not.be.reverted;
    });

    it("should revert pause when called by unauthorized account", async function () {
      const { assetToken, unauthorized } = await loadFixture(deployAssetToken);
      await expect(assetToken.connect(unauthorized).pause()).to.be.reverted;
    });

    it("should revert unpause when called by unauthorized account", async function () {
      const { assetToken, pauser, unauthorized } = await loadFixture(deployAssetToken);
      await assetToken.connect(pauser).pause();
      await expect(assetToken.connect(unauthorized).unpause()).to.be.reverted;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SETTERS
  // ═════════════════════════════════════════════════════════════════════════
  describe("Setters", function () {
    it("should set a new ComplianceManager", async function () {
      const { assetToken, admin } = await loadFixture(deployAssetToken);

      // Deploy a new ComplianceManager to set
      const NewFactory = await ethers.getContractFactory("ComplianceManager");
      const newCM = await upgrades.deployProxy(NewFactory, [admin.address], {
        kind: "uups",
      });
      await newCM.waitForDeployment();

      await expect(assetToken.setComplianceManager(await newCM.getAddress()))
        .to.emit(assetToken, "ComplianceManagerUpdated");
    });

    it("should set a new YieldDistributor", async function () {
      const { assetToken, admin, mockUSDC } = await loadFixture(deployAssetToken);

      const NewFactory = await ethers.getContractFactory("YieldDistributor");
      const newYD = await upgrades.deployProxy(
        NewFactory,
        [admin.address, await mockUSDC.getAddress()],
        { kind: "uups" }
      );
      await newYD.waitForDeployment();

      await expect(assetToken.setYieldDistributor(await newYD.getAddress()))
        .to.emit(assetToken, "YieldDistributorUpdated");
    });

    it("should revert setComplianceManager for zero address", async function () {
      const { assetToken } = await loadFixture(deployAssetToken);
      await expect(
        assetToken.setComplianceManager(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(assetToken, "ZeroAddress");
    });

    it("should revert setYieldDistributor for zero address", async function () {
      const { assetToken } = await loadFixture(deployAssetToken);
      await expect(
        assetToken.setYieldDistributor(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(assetToken, "ZeroAddress");
    });

    it("should revert setComplianceManager when called by unauthorized account", async function () {
      const { assetToken, unauthorized } = await loadFixture(deployAssetToken);
      await expect(
        assetToken
          .connect(unauthorized)
          .setComplianceManager(unauthorized.address)
      ).to.be.reverted;
    });

    it("should revert setYieldDistributor when called by unauthorized account", async function () {
      const { assetToken, unauthorized } = await loadFixture(deployAssetToken);
      await expect(
        assetToken
          .connect(unauthorized)
          .setYieldDistributor(unauthorized.address)
      ).to.be.reverted;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TOTAL SUPPLY & BALANCE
  // ═════════════════════════════════════════════════════════════════════════
  describe("Supply", function () {
    it("should start with zero total supply", async function () {
      const { assetToken } = await loadFixture(deployAssetToken);
      expect(await assetToken.totalSupply()).to.equal(0);
    });

    it("should increase total supply after minting", async function () {
      const { assetToken, investor1 } = await loadFixture(deployAssetToken);
      const amount = ethers.parseEther("500");
      await assetToken.mint(investor1.address, amount);
      expect(await assetToken.totalSupply()).to.equal(amount);
    });
  });
});
