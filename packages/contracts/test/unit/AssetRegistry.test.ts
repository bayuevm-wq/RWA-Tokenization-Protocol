import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  REGISTRY_ROLE,
  DEFAULT_ADMIN_ROLE,
} from "../helpers/setup";

describe("AssetRegistry", function () {
  // ── Fixture ───────────────────────────────────────────────────────────────
  async function deployAssetRegistry() {
    const [admin, registrar, tokenAddress, unauthorized] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("AssetRegistry");
    const assetRegistry = await upgrades.deployProxy(Factory, [admin.address], {
      kind: "uups",
    });
    await assetRegistry.waitForDeployment();

    // Grant REGISTRY_ROLE to admin
    await assetRegistry.grantRole(REGISTRY_ROLE, admin.address);

    return { assetRegistry, admin, registrar, tokenAddress, unauthorized };
  }

  // Helper: register a sample asset and return its ID
  async function registerSampleAsset(
    assetRegistry: any,
    tokenAddr: string,
    overrides?: { name?: string }
  ) {
    const tx = await assetRegistry.registerAsset(
      overrides?.name ?? "Manhattan Office Building",
      1, // category
      ethers.parseEther("5000000"), // valuation
      ethers.parseEther("10000"), // maxTokenSupply
      500, // yieldBasisPoints (5%)
      "ipfs://QmSampleMetadata",
      tokenAddr
    );
    const receipt = await tx.wait();

    // Extract asset ID from the event
    const event = receipt?.logs
      .map((log: any) => {
        try {
          return assetRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === "AssetRegistered");

    return event?.args?.[0] as string;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // REGISTER ASSET
  // ═════════════════════════════════════════════════════════════════════════
  describe("Register Asset", function () {
    it("should register a new asset and emit AssetRegistered", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      await expect(
        assetRegistry.registerAsset(
          "Manhattan Office Building",
          1,
          ethers.parseEther("5000000"),
          ethers.parseEther("10000"),
          500,
          "ipfs://QmSampleMetadata",
          tokenAddress.address
        )
      ).to.emit(assetRegistry, "AssetRegistered");
    });

    it("should return a valid asset ID (bytes32)", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);
      expect(assetId).to.not.equal(ethers.ZeroHash);
    });

    it("should revert with InvalidValuation for zero valuation", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      await expect(
        assetRegistry.registerAsset(
          "Bad Asset",
          1,
          0, // invalid
          ethers.parseEther("10000"),
          500,
          "ipfs://QmBad",
          tokenAddress.address
        )
      ).to.be.revertedWithCustomError(assetRegistry, "InvalidValuation");
    });

    it("should revert with InvalidTokenSupply for zero maxTokenSupply", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      await expect(
        assetRegistry.registerAsset(
          "Bad Asset",
          1,
          ethers.parseEther("5000000"),
          0, // invalid
          500,
          "ipfs://QmBad",
          tokenAddress.address
        )
      ).to.be.revertedWithCustomError(assetRegistry, "InvalidTokenSupply");
    });

    it("should revert with ZeroAddress for zero token address", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      await expect(
        assetRegistry.registerAsset(
          "Bad Asset",
          1,
          ethers.parseEther("5000000"),
          ethers.parseEther("10000"),
          500,
          "ipfs://QmBad",
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(assetRegistry, "ZeroAddress");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // UPDATE ASSET
  // ═════════════════════════════════════════════════════════════════════════
  describe("Update Asset", function () {
    it("should update asset valuation", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);

      await expect(
        assetRegistry.updateAssetValuation(assetId, ethers.parseEther("7500000"))
      )
        .to.emit(assetRegistry, "AssetUpdated")
        .withArgs(assetId);
    });

    it("should update asset yield basis points", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);

      await expect(assetRegistry.updateAssetYield(assetId, 750))
        .to.emit(assetRegistry, "AssetUpdated")
        .withArgs(assetId);
    });

    it("should update asset metadata URI", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);

      await expect(
        assetRegistry.updateAssetMetadata(assetId, "ipfs://QmUpdated")
      )
        .to.emit(assetRegistry, "AssetUpdated")
        .withArgs(assetId);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ACTIVATE / DEACTIVATE
  // ═════════════════════════════════════════════════════════════════════════
  describe("Activate / Deactivate", function () {
    it("should deactivate an asset", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);

      await expect(assetRegistry.deactivateAsset(assetId))
        .to.emit(assetRegistry, "AssetDeactivated")
        .withArgs(assetId);
    });

    it("should reactivate a deactivated asset", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);

      await assetRegistry.deactivateAsset(assetId);
      await expect(assetRegistry.activateAsset(assetId))
        .to.emit(assetRegistry, "AssetActivated")
        .withArgs(assetId);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GETTERS
  // ═════════════════════════════════════════════════════════════════════════
  describe("Getters", function () {
    it("should return the correct asset via getAsset", async function () {
      const { assetRegistry, tokenAddress } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);
      const asset = await assetRegistry.getAsset(assetId);
      expect(asset.tokenAddress).to.equal(tokenAddress.address);
    });

    it("should return active assets only via getActiveAssets", async function () {
      const { assetRegistry, tokenAddress, admin } =
        await loadFixture(deployAssetRegistry);

      const id1 = await registerSampleAsset(assetRegistry, tokenAddress.address, {
        name: "Asset 1",
      });
      const id2 = await registerSampleAsset(assetRegistry, admin.address, {
        name: "Asset 2",
      });

      // deactivate asset 1
      await assetRegistry.deactivateAsset(id1!);

      const activeAssets = await assetRegistry.getActiveAssets();
      // Only asset 2 should be active
      expect(activeAssets.length).to.equal(1);
    });

    it("should return all assets via getAllAssets", async function () {
      const { assetRegistry, tokenAddress, admin } =
        await loadFixture(deployAssetRegistry);

      await registerSampleAsset(assetRegistry, tokenAddress.address, {
        name: "Asset A",
      });
      await registerSampleAsset(assetRegistry, admin.address, { name: "Asset B" });

      const allAssets = await assetRegistry.getAllAssets();
      expect(allAssets.length).to.equal(2);
    });

    it("should return correct count via getAssetCount", async function () {
      const { assetRegistry, tokenAddress, admin } =
        await loadFixture(deployAssetRegistry);

      expect(await assetRegistry.getAssetCount()).to.equal(0);

      await registerSampleAsset(assetRegistry, tokenAddress.address, {
        name: "Count A",
      });
      expect(await assetRegistry.getAssetCount()).to.equal(1);

      await registerSampleAsset(assetRegistry, admin.address, { name: "Count B" });
      expect(await assetRegistry.getAssetCount()).to.equal(2);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // NOT FOUND ERRORS
  // ═════════════════════════════════════════════════════════════════════════
  describe("Not Found Errors", function () {
    it("should revert getAsset for non-existent asset", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("DOES_NOT_EXIST"));
      await expect(assetRegistry.getAsset(fakeId)).to.be.revertedWithCustomError(
        assetRegistry,
        "AssetNotFound"
      );
    });

    it("should revert updateAssetValuation for non-existent asset", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("DOES_NOT_EXIST"));
      await expect(
        assetRegistry.updateAssetValuation(fakeId, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(assetRegistry, "AssetNotFound");
    });

    it("should revert deactivateAsset for non-existent asset", async function () {
      const { assetRegistry } = await loadFixture(deployAssetRegistry);

      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("DOES_NOT_EXIST"));
      await expect(
        assetRegistry.deactivateAsset(fakeId)
      ).to.be.revertedWithCustomError(assetRegistry, "AssetNotFound");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // ACCESS CONTROL
  // ═════════════════════════════════════════════════════════════════════════
  describe("Access Control", function () {
    it("should revert registerAsset from unauthorized caller", async function () {
      const { assetRegistry, tokenAddress, unauthorized } =
        await loadFixture(deployAssetRegistry);

      await expect(
        assetRegistry
          .connect(unauthorized)
          .registerAsset(
            "Unauth Asset",
            1,
            ethers.parseEther("1000000"),
            ethers.parseEther("10000"),
            500,
            "ipfs://QmUnauth",
            tokenAddress.address
          )
      ).to.be.reverted;
    });

    it("should revert updateAssetValuation from unauthorized caller", async function () {
      const { assetRegistry, tokenAddress, unauthorized } =
        await loadFixture(deployAssetRegistry);

      const assetId = await registerSampleAsset(assetRegistry, tokenAddress.address);

      await expect(
        assetRegistry
          .connect(unauthorized)
          .updateAssetValuation(assetId!, ethers.parseEther("99"))
      ).to.be.reverted;
    });
  });
});
