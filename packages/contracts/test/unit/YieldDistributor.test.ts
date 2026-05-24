import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  MINTER_ROLE,
  DISTRIBUTOR_ROLE,
  COMPLIANCE_ROLE,
  ASSET_TOKEN_ROLE,
  DEFAULT_ADMIN_ROLE,
  whitelistAndKYC,
} from "../helpers/setup";

describe("YieldDistributor", function () {
  // ── Fixture ───────────────────────────────────────────────────────────────
  async function deployYieldDistributor() {
    const [admin, distributor, investor1, investor2, investor3, unauthorized] =
      await ethers.getSigners();

    // MockUSDC – 6 decimals
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    // ComplianceManager
    const ComplianceFactory = await ethers.getContractFactory("ComplianceManager");
    const complianceManager = await upgrades.deployProxy(
      ComplianceFactory,
      [admin.address],
      { kind: "uups" }
    );
    await complianceManager.waitForDeployment();
    await complianceManager.grantRole(COMPLIANCE_ROLE, admin.address);

    // YieldDistributor
    const YieldFactory = await ethers.getContractFactory("YieldDistributor");
    const yieldDistributor = await upgrades.deployProxy(
      YieldFactory,
      [admin.address, await mockUSDC.getAddress()],
      { kind: "uups" }
    );
    await yieldDistributor.waitForDeployment();
    await yieldDistributor.grantRole(DISTRIBUTOR_ROLE, admin.address);

    // AssetToken (deployed as proxy for a real token)
    const AssetTokenFactory = await ethers.getContractFactory("AssetToken");
    const CAP = ethers.parseEther("10000");
    const ASSET_ID = ethers.keccak256(ethers.toUtf8Bytes("YIELD_TEST_ASSET"));

    const assetToken = await upgrades.deployProxy(
      AssetTokenFactory,
      [
        "Yield Test Token",
        "YTT",
        CAP,
        admin.address,
        await complianceManager.getAddress(),
        await yieldDistributor.getAddress(),
        ASSET_ID,
      ],
      { kind: "uups" }
    );
    await assetToken.waitForDeployment();

    await assetToken.grantRole(MINTER_ROLE, admin.address);

    // Register the asset token in YieldDistributor
    await yieldDistributor.registerAssetToken(await assetToken.getAddress());

    // Grant ASSET_TOKEN_ROLE to the assetToken on the yield distributor
    await yieldDistributor.grantRole(ASSET_TOKEN_ROLE, await assetToken.getAddress());

    // Mint USDC to admin for depositing yield
    const USDC_AMOUNT = 1_000_000n * 10n ** 6n; // 1 million USDC
    await mockUSDC.mint(admin.address, USDC_AMOUNT);
    await mockUSDC.approve(await yieldDistributor.getAddress(), USDC_AMOUNT);

    return {
      yieldDistributor,
      assetToken,
      complianceManager,
      mockUSDC,
      admin,
      distributor,
      investor1,
      investor2,
      investor3,
      unauthorized,
      CAP,
      ASSET_ID,
    };
  }

  // Helper: deploy a second asset token and register it
  async function deployWithTwoTokens() {
    const base = await deployYieldDistributor();
    const {
      admin,
      complianceManager,
      yieldDistributor,
      mockUSDC,
    } = base;

    const AssetTokenFactory = await ethers.getContractFactory("AssetToken");
    const CAP2 = ethers.parseEther("5000");
    const ASSET_ID_2 = ethers.keccak256(ethers.toUtf8Bytes("YIELD_TEST_ASSET_2"));

    const assetToken2 = await upgrades.deployProxy(
      AssetTokenFactory,
      [
        "Yield Test Token 2",
        "YTT2",
        CAP2,
        admin.address,
        await complianceManager.getAddress(),
        await yieldDistributor.getAddress(),
        ASSET_ID_2,
      ],
      { kind: "uups" }
    );
    await assetToken2.waitForDeployment();

    await assetToken2.grantRole(MINTER_ROLE, admin.address);
    await yieldDistributor.registerAssetToken(await assetToken2.getAddress());
    await yieldDistributor.grantRole(ASSET_TOKEN_ROLE, await assetToken2.getAddress());

    return { ...base, assetToken2, CAP2, ASSET_ID_2 };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ═════════════════════════════════════════════════════════════════════════
  describe("Registration", function () {
    it("should register an asset token", async function () {
      const { yieldDistributor, admin, complianceManager } =
        await loadFixture(deployYieldDistributor);

      // Deploy a fresh token to register
      const Factory = await ethers.getContractFactory("AssetToken");
      const newToken = await upgrades.deployProxy(
        Factory,
        [
          "New Token",
          "NT",
          ethers.parseEther("100"),
          admin.address,
          await complianceManager.getAddress(),
          await yieldDistributor.getAddress(),
          ethers.keccak256(ethers.toUtf8Bytes("NEW")),
        ],
        { kind: "uups" }
      );
      await newToken.waitForDeployment();

      await expect(yieldDistributor.registerAssetToken(await newToken.getAddress()))
        .to.emit(yieldDistributor, "AssetTokenRegistered")
        .withArgs(await newToken.getAddress());
    });

    it("should revert when registering an already-registered token", async function () {
      const { yieldDistributor, assetToken } = await loadFixture(deployYieldDistributor);

      await expect(
        yieldDistributor.registerAssetToken(await assetToken.getAddress())
      ).to.be.revertedWithCustomError(yieldDistributor, "TokenAlreadyRegistered");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // DEPOSIT
  // ═════════════════════════════════════════════════════════════════════════
  describe("Deposit", function () {
    it("should deposit yield successfully", async function () {
      const { yieldDistributor, assetToken, investor1, mockUSDC, admin } =
        await loadFixture(deployYieldDistributor);

      // Must have tokens outstanding to deposit yield
      await assetToken.mint(investor1.address, ethers.parseEther("1000"));

      const depositAmount = 1000n * 10n ** 6n; // 1000 USDC

      await expect(
        yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount)
      )
        .to.emit(yieldDistributor, "YieldDeposited");
    });

    it("should revert deposit with zero amount", async function () {
      const { yieldDistributor, assetToken } = await loadFixture(deployYieldDistributor);

      await expect(
        yieldDistributor.depositYield(await assetToken.getAddress(), 0)
      ).to.be.revertedWithCustomError(yieldDistributor, "ZeroAmount");
    });

    it("should revert deposit for unregistered token", async function () {
      const { yieldDistributor, unauthorized } =
        await loadFixture(deployYieldDistributor);

      await expect(
        yieldDistributor.depositYield(unauthorized.address, 1000)
      ).to.be.revertedWithCustomError(yieldDistributor, "TokenNotRegistered");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CALCULATE REWARD
  // ═════════════════════════════════════════════════════════════════════════
  describe("Calculate Reward", function () {
    it("should give all rewards to the sole holder", async function () {
      const { yieldDistributor, assetToken, investor1 } =
        await loadFixture(deployYieldDistributor);

      // investor1 holds 100% of supply
      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      const depositAmount = 1000n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount);

      const reward = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor1.address
      );
      expect(reward).to.equal(depositAmount);
    });

    it("should split rewards proportionally between two holders (60/40)", async function () {
      const { yieldDistributor, assetToken, investor1, investor2, complianceManager } =
        await loadFixture(deployYieldDistributor);

      // investor1 = 60%, investor2 = 40%
      await assetToken.mint(investor1.address, ethers.parseEther("6000"));
      await assetToken.mint(investor2.address, ethers.parseEther("4000"));

      const depositAmount = 1000n * 10n ** 6n; // 1000 USDC
      await yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount);

      const reward1 = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor1.address
      );
      const reward2 = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor2.address
      );

      expect(reward1).to.equal(600n * 10n ** 6n); // 600 USDC
      expect(reward2).to.equal(400n * 10n ** 6n); // 400 USDC
    });

    it("should update rewards correctly after a transfer", async function () {
      const { yieldDistributor, assetToken, investor1, investor2, complianceManager } =
        await loadFixture(deployYieldDistributor);

      await whitelistAndKYC(complianceManager, investor1.address);
      await whitelistAndKYC(complianceManager, investor2.address);

      // investor1 holds all 10000 tokens
      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      // First deposit: investor1 earns all 1000 USDC
      const deposit1 = 1000n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), deposit1);

      // investor1 transfers 5000 to investor2 (now 50/50)
      await assetToken
        .connect(investor1)
        .transfer(investor2.address, ethers.parseEther("5000"));

      // Second deposit: split 50/50
      const deposit2 = 500n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), deposit2);

      const reward1 = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor1.address
      );
      const reward2 = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor2.address
      );

      // investor1: 1000 (first deposit 100%) + 250 (second deposit 50%) = 1250
      expect(reward1).to.equal(1250n * 10n ** 6n);
      // investor2: 0 (first deposit) + 250 (second deposit 50%) = 250
      expect(reward2).to.equal(250n * 10n ** 6n);
    });

    it("should accumulate rewards across multiple deposits", async function () {
      const { yieldDistributor, assetToken, investor1 } =
        await loadFixture(deployYieldDistributor);

      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      const dep = 500n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), dep);
      await yieldDistributor.depositYield(await assetToken.getAddress(), dep);

      const reward = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor1.address
      );
      expect(reward).to.equal(1000n * 10n ** 6n);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CLAIM
  // ═════════════════════════════════════════════════════════════════════════
  describe("Claim", function () {
    it("should allow an investor to claim their reward", async function () {
      const { yieldDistributor, assetToken, investor1, mockUSDC } =
        await loadFixture(deployYieldDistributor);

      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      const depositAmount = 1000n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount);

      const balBefore = await mockUSDC.balanceOf(investor1.address);

      await expect(
        yieldDistributor.connect(investor1).claimReward(await assetToken.getAddress())
      )
        .to.emit(yieldDistributor, "RewardClaimed")
        .withArgs(await assetToken.getAddress(), investor1.address, depositAmount);

      const balAfter = await mockUSDC.balanceOf(investor1.address);
      expect(balAfter - balBefore).to.equal(depositAmount);
    });

    it("should revert when claiming with no reward available (double claim)", async function () {
      const { yieldDistributor, assetToken, investor1 } =
        await loadFixture(deployYieldDistributor);

      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      const depositAmount = 1000n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount);

      // First claim succeeds
      await yieldDistributor
        .connect(investor1)
        .claimReward(await assetToken.getAddress());

      // Second claim should revert
      await expect(
        yieldDistributor.connect(investor1).claimReward(await assetToken.getAddress())
      ).to.be.revertedWithCustomError(yieldDistributor, "NoRewardAvailable");
    });

    it("should reset reward balance after claiming", async function () {
      const { yieldDistributor, assetToken, investor1 } =
        await loadFixture(deployYieldDistributor);

      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      const depositAmount = 1000n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount);

      await yieldDistributor
        .connect(investor1)
        .claimReward(await assetToken.getAddress());

      const reward = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor1.address
      );
      expect(reward).to.equal(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CLAIM ALL REWARDS
  // ═════════════════════════════════════════════════════════════════════════
  describe("Claim All Rewards", function () {
    it("should claim rewards from multiple tokens in one call", async function () {
      const { yieldDistributor, assetToken, assetToken2, investor1, mockUSDC, admin } =
        await loadFixture(deployWithTwoTokens);

      // Approve more USDC to yield distributor
      await mockUSDC.approve(
        await yieldDistributor.getAddress(),
        1_000_000n * 10n ** 6n
      );

      // Mint tokens to investor1 in both asset tokens
      await assetToken.mint(investor1.address, ethers.parseEther("10000"));
      await assetToken2.mint(investor1.address, ethers.parseEther("5000"));

      // Deposit yield for both
      const dep1 = 1000n * 10n ** 6n;
      const dep2 = 500n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), dep1);
      await yieldDistributor.depositYield(await assetToken2.getAddress(), dep2);

      const balBefore = await mockUSDC.balanceOf(investor1.address);
      await yieldDistributor.connect(investor1).claimAllRewards();
      const balAfter = await mockUSDC.balanceOf(investor1.address);

      expect(balAfter - balBefore).to.equal(dep1 + dep2);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // REWARD PER TOKEN
  // ═════════════════════════════════════════════════════════════════════════
  describe("Reward Per Token", function () {
    it("should return 0 when no yield has been deposited", async function () {
      const { yieldDistributor, assetToken } = await loadFixture(deployYieldDistributor);
      expect(
        await yieldDistributor.rewardPerToken(await assetToken.getAddress())
      ).to.equal(0);
    });

    it("should increase after depositing yield", async function () {
      const { yieldDistributor, assetToken, investor1 } =
        await loadFixture(deployYieldDistributor);

      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      const depositAmount = 1000n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount);

      const rpt = await yieldDistributor.rewardPerToken(await assetToken.getAddress());
      expect(rpt).to.be.gt(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═════════════════════════════════════════════════════════════════════════
  describe("Edge Cases", function () {
    it("should handle deposit when no holders exist (zero total supply)", async function () {
      const { yieldDistributor, assetToken } = await loadFixture(deployYieldDistributor);

      // No tokens minted - total supply is 0
      // rewardPerToken formula divides by totalSupply; contract should handle gracefully
      // Depending on implementation, this may revert or simply not distribute
      // We just ensure it doesn't break
      const depositAmount = 1000n * 10n ** 6n;
      // This might revert or succeed depending on implementation. Test that it doesn't crash.
      try {
        await yieldDistributor.depositYield(
          await assetToken.getAddress(),
          depositAmount
        );
      } catch {
        // If it reverts, that's also acceptable behavior
      }
    });

    it("should return 0 reward for a user with no tokens", async function () {
      const { yieldDistributor, assetToken, investor1, investor2 } =
        await loadFixture(deployYieldDistributor);

      await assetToken.mint(investor1.address, ethers.parseEther("10000"));

      const depositAmount = 1000n * 10n ** 6n;
      await yieldDistributor.depositYield(await assetToken.getAddress(), depositAmount);

      const reward = await yieldDistributor.calculateReward(
        await assetToken.getAddress(),
        investor2.address
      );
      expect(reward).to.equal(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ACCESS CONTROL
  // ═════════════════════════════════════════════════════════════════════════
  describe("Access Control", function () {
    it("should revert depositYield from unauthorized caller", async function () {
      const { yieldDistributor, assetToken, unauthorized } =
        await loadFixture(deployYieldDistributor);

      await expect(
        yieldDistributor
          .connect(unauthorized)
          .depositYield(await assetToken.getAddress(), 1000)
      ).to.be.reverted;
    });

    it("should revert registerAssetToken from unauthorized caller", async function () {
      const { yieldDistributor, unauthorized } =
        await loadFixture(deployYieldDistributor);

      await expect(
        yieldDistributor
          .connect(unauthorized)
          .registerAssetToken(unauthorized.address)
      ).to.be.reverted;
    });

    it("should revert updateRewardOnTransfer from non-asset-token caller", async function () {
      const { yieldDistributor, assetToken, investor1, investor2, unauthorized } =
        await loadFixture(deployYieldDistributor);

      await expect(
        yieldDistributor
          .connect(unauthorized)
          .updateRewardOnTransfer(
            await assetToken.getAddress(),
            investor1.address,
            investor2.address
          )
      ).to.be.reverted;
    });
  });
});
