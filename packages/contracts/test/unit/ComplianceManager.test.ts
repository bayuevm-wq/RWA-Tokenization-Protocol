import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  COMPLIANCE_ROLE,
  DEFAULT_ADMIN_ROLE,
} from "../helpers/setup";

describe("ComplianceManager", function () {
  // ── Fixture ───────────────────────────────────────────────────────────────
  async function deployComplianceManager() {
    const [admin, complianceOfficer, user1, user2, user3, unauthorized] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ComplianceManager");
    const complianceManager = await upgrades.deployProxy(Factory, [admin.address], {
      kind: "uups",
    });
    await complianceManager.waitForDeployment();

    // Grant COMPLIANCE_ROLE to admin so all management calls go through
    await complianceManager.grantRole(COMPLIANCE_ROLE, admin.address);

    return { complianceManager, admin, complianceOfficer, user1, user2, user3, unauthorized };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // WHITELIST
  // ═════════════════════════════════════════════════════════════════════════
  describe("Whitelist", function () {
    it("should add an address to the whitelist", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await expect(complianceManager.addToWhitelist(user1.address))
        .to.emit(complianceManager, "InvestorWhitelisted")
        .withArgs(user1.address);

      expect(await complianceManager.isWhitelisted(user1.address)).to.be.true;
    });

    it("should remove an address from the whitelist", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await complianceManager.addToWhitelist(user1.address);
      await expect(complianceManager.removeFromWhitelist(user1.address))
        .to.emit(complianceManager, "InvestorRemovedFromWhitelist")
        .withArgs(user1.address);

      expect(await complianceManager.isWhitelisted(user1.address)).to.be.false;
    });

    it("should revert when whitelisting an already whitelisted address", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await complianceManager.addToWhitelist(user1.address);
      await expect(complianceManager.addToWhitelist(user1.address))
        .to.be.revertedWithCustomError(complianceManager, "AlreadyWhitelisted")
        .withArgs(user1.address);
    });

    it("should revert when removing a non-whitelisted address", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await expect(complianceManager.removeFromWhitelist(user1.address))
        .to.be.revertedWithCustomError(complianceManager, "NotWhitelisted")
        .withArgs(user1.address);
    });

    it("should revert when whitelisting the zero address", async function () {
      const { complianceManager } = await loadFixture(deployComplianceManager);

      await expect(complianceManager.addToWhitelist(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(complianceManager, "ZeroAddress");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BLACKLIST
  // ═════════════════════════════════════════════════════════════════════════
  describe("Blacklist", function () {
    it("should add an address to the blacklist", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await expect(complianceManager.addToBlacklist(user1.address))
        .to.emit(complianceManager, "InvestorBlacklisted")
        .withArgs(user1.address);

      expect(await complianceManager.isBlacklisted(user1.address)).to.be.true;
    });

    it("should remove an address from the blacklist", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await complianceManager.addToBlacklist(user1.address);
      await expect(complianceManager.removeFromBlacklist(user1.address))
        .to.emit(complianceManager, "InvestorRemovedFromBlacklist")
        .withArgs(user1.address);

      expect(await complianceManager.isBlacklisted(user1.address)).to.be.false;
    });

    it("should revert when blacklisting an already blacklisted address", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await complianceManager.addToBlacklist(user1.address);
      await expect(complianceManager.addToBlacklist(user1.address))
        .to.be.revertedWithCustomError(complianceManager, "AlreadyBlacklisted")
        .withArgs(user1.address);
    });

    it("should revert when removing a non-blacklisted address", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await expect(complianceManager.removeFromBlacklist(user1.address))
        .to.be.revertedWithCustomError(complianceManager, "NotBlacklisted")
        .withArgs(user1.address);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // KYC STATUS
  // ═════════════════════════════════════════════════════════════════════════
  describe("KYC Status", function () {
    it("should set KYC status to true", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await expect(complianceManager.setKYCStatus(user1.address, true))
        .to.emit(complianceManager, "KYCStatusUpdated")
        .withArgs(user1.address, true);

      const info = await complianceManager.getInvestorInfo(user1.address);
      expect(info.kycVerified).to.be.true;
    });

    it("should set KYC status to false", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await complianceManager.setKYCStatus(user1.address, true);
      await expect(complianceManager.setKYCStatus(user1.address, false))
        .to.emit(complianceManager, "KYCStatusUpdated")
        .withArgs(user1.address, false);

      const info = await complianceManager.getInvestorInfo(user1.address);
      expect(info.kycVerified).to.be.false;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // canTransfer
  // ═════════════════════════════════════════════════════════════════════════
  describe("canTransfer", function () {
    it("should return true when both from and to are whitelisted and KYC verified", async function () {
      const { complianceManager, user1, user2 } = await loadFixture(deployComplianceManager);

      await complianceManager.addToWhitelist(user1.address);
      await complianceManager.setKYCStatus(user1.address, true);
      await complianceManager.addToWhitelist(user2.address);
      await complianceManager.setKYCStatus(user2.address, true);

      expect(
        await complianceManager.canTransfer(user1.address, user2.address, 100)
      ).to.be.true;
    });

    it("should return false when 'from' is not whitelisted", async function () {
      const { complianceManager, user1, user2 } = await loadFixture(deployComplianceManager);

      // only whitelist and KYC user2
      await complianceManager.addToWhitelist(user2.address);
      await complianceManager.setKYCStatus(user2.address, true);

      expect(
        await complianceManager.canTransfer(user1.address, user2.address, 100)
      ).to.be.false;
    });

    it("should return false when 'to' is blacklisted", async function () {
      const { complianceManager, user1, user2 } = await loadFixture(deployComplianceManager);

      await complianceManager.addToWhitelist(user1.address);
      await complianceManager.setKYCStatus(user1.address, true);
      await complianceManager.addToWhitelist(user2.address);
      await complianceManager.setKYCStatus(user2.address, true);
      await complianceManager.addToBlacklist(user2.address);

      expect(
        await complianceManager.canTransfer(user1.address, user2.address, 100)
      ).to.be.false;
    });

    it("should return true when from or to is the zero address (mint / burn)", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      // mint: from = 0x0
      expect(
        await complianceManager.canTransfer(ethers.ZeroAddress, user1.address, 100)
      ).to.be.true;

      // burn: to = 0x0
      expect(
        await complianceManager.canTransfer(user1.address, ethers.ZeroAddress, 100)
      ).to.be.true;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BATCH WHITELIST
  // ═════════════════════════════════════════════════════════════════════════
  describe("Batch Whitelist", function () {
    it("should whitelist multiple addresses in one call", async function () {
      const { complianceManager, user1, user2, user3 } =
        await loadFixture(deployComplianceManager);

      await complianceManager.batchWhitelist([
        user1.address,
        user2.address,
        user3.address,
      ]);

      expect(await complianceManager.isWhitelisted(user1.address)).to.be.true;
      expect(await complianceManager.isWhitelisted(user2.address)).to.be.true;
      expect(await complianceManager.isWhitelisted(user3.address)).to.be.true;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // INVESTOR TYPE
  // ═════════════════════════════════════════════════════════════════════════
  describe("Investor Type", function () {
    it("should set investor type", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await expect(complianceManager.setInvestorType(user1.address, 2))
        .to.emit(complianceManager, "InvestorTypeUpdated")
        .withArgs(user1.address, 2);

      const info = await complianceManager.getInvestorInfo(user1.address);
      expect(info.investorType).to.equal(2);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // INVESTOR INFO
  // ═════════════════════════════════════════════════════════════════════════
  describe("Investor Info", function () {
    it("should return correct investor info after full setup", async function () {
      const { complianceManager, user1 } = await loadFixture(deployComplianceManager);

      await complianceManager.addToWhitelist(user1.address);
      await complianceManager.setKYCStatus(user1.address, true);
      await complianceManager.setInvestorType(user1.address, 1);

      const info = await complianceManager.getInvestorInfo(user1.address);
      expect(info.whitelisted).to.be.true;
      expect(info.blacklisted).to.be.false;
      expect(info.kycVerified).to.be.true;
      expect(info.investorType).to.equal(1);
      expect(info.whitelistedAt).to.be.gt(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ACCESS CONTROL
  // ═════════════════════════════════════════════════════════════════════════
  describe("Access Control", function () {
    it("should revert addToWhitelist when called by unauthorized account", async function () {
      const { complianceManager, user1, unauthorized } =
        await loadFixture(deployComplianceManager);

      await expect(
        complianceManager.connect(unauthorized).addToWhitelist(user1.address)
      ).to.be.reverted;
    });

    it("should revert removeFromWhitelist when called by unauthorized account", async function () {
      const { complianceManager, user1, unauthorized } =
        await loadFixture(deployComplianceManager);

      await expect(
        complianceManager.connect(unauthorized).removeFromWhitelist(user1.address)
      ).to.be.reverted;
    });

    it("should revert addToBlacklist when called by unauthorized account", async function () {
      const { complianceManager, user1, unauthorized } =
        await loadFixture(deployComplianceManager);

      await expect(
        complianceManager.connect(unauthorized).addToBlacklist(user1.address)
      ).to.be.reverted;
    });

    it("should revert setKYCStatus when called by unauthorized account", async function () {
      const { complianceManager, user1, unauthorized } =
        await loadFixture(deployComplianceManager);

      await expect(
        complianceManager.connect(unauthorized).setKYCStatus(user1.address, true)
      ).to.be.reverted;
    });

    it("should revert batchWhitelist when called by unauthorized account", async function () {
      const { complianceManager, user1, user2, unauthorized } =
        await loadFixture(deployComplianceManager);

      await expect(
        complianceManager
          .connect(unauthorized)
          .batchWhitelist([user1.address, user2.address])
      ).to.be.reverted;
    });
  });
});
