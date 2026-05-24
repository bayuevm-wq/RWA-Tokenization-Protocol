// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IAssetRegistry} from "../interfaces/IAssetRegistry.sol";

/**
 * @title AssetRegistry
 * @notice On-chain catalog of all tokenized real-world assets. Stores asset metadata,
 *         valuations, yield parameters, and links each record to its deployed token contract.
 * @dev UUPS upgradeable. Only addresses with REGISTRY_ROLE may modify asset records.
 */
contract AssetRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IAssetRegistry
{
    // ──────────────────────────────────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Role hash for addresses authorized to manage asset records.
    bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");

    /// @notice Role hash for addresses authorized to perform contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ──────────────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────────────

    /// @dev Asset ID → full asset information record.
    mapping(bytes32 => AssetInfo) private _assets;

    /// @dev Ordered list of all asset IDs (for enumeration).
    bytes32[] private _assetIds;

    /// @dev Running count of registered assets (used in ID generation).
    uint256 private _assetCount;

    // ──────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when an operation references a non-existent asset ID.
    error AssetNotFound(bytes32 assetId);

    /// @notice Thrown when an operation requires an active asset but it is inactive.
    error AssetNotActive(bytes32 assetId);

    /// @notice Thrown when a zero or invalid valuation is provided.
    error InvalidValuation();

    /// @notice Thrown when a zero or invalid max token supply is provided.
    error InvalidTokenSupply();

    /// @notice Thrown when a zero address is provided where a valid address is required.
    error ZeroAddress();

    // ──────────────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new asset is registered.
    event AssetRegistered(bytes32 indexed assetId, string name, address indexed tokenAddress);

    /// @notice Emitted when an asset's valuation is updated.
    event AssetValuationUpdated(bytes32 indexed assetId, uint256 oldValuation, uint256 newValuation);

    /// @notice Emitted when an asset's yield basis points are updated.
    event AssetYieldUpdated(bytes32 indexed assetId, uint256 oldYieldBps, uint256 newYieldBps);

    /// @notice Emitted when an asset's metadata URI is updated.
    event AssetMetadataUpdated(bytes32 indexed assetId, string metadataURI);

    /// @notice Emitted when an asset is deactivated.
    event AssetDeactivated(bytes32 indexed assetId);

    /// @notice Emitted when an asset is activated.
    event AssetActivated(bytes32 indexed assetId);

    // ──────────────────────────────────────────────────────────────────────────
    // Initializer
    // ──────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the AssetRegistry with an admin address.
     * @param admin The address that will receive all administrative roles.
     */
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert ZeroAddress();

        __AccessControl_init();


        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRY_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Asset Registration
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IAssetRegistry
    function registerAsset(
        string calldata name,
        AssetCategory category,
        uint256 valuation,
        uint256 maxTokenSupply,
        uint256 yieldBasisPoints,
        string calldata metadataURI,
        address tokenAddress
    ) external override onlyRole(REGISTRY_ROLE) returns (bytes32) {
        if (valuation == 0) revert InvalidValuation();
        if (maxTokenSupply == 0) revert InvalidTokenSupply();
        if (tokenAddress == address(0)) revert ZeroAddress();

        bytes32 assetId = keccak256(
            abi.encodePacked(name, block.timestamp, _assetCount)
        );

        AssetInfo storage asset = _assets[assetId];
        asset.id = assetId;
        asset.name = name;
        asset.category = category;
        asset.valuation = valuation;
        asset.maxTokenSupply = maxTokenSupply;
        asset.yieldBasisPoints = yieldBasisPoints;
        asset.metadataURI = metadataURI;
        asset.tokenAddress = tokenAddress;
        asset.isActive = true;
        asset.createdAt = block.timestamp;

        _assetIds.push(assetId);
        _assetCount++;

        emit AssetRegistered(assetId, name, tokenAddress);

        return assetId;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Asset Updates
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IAssetRegistry
    function updateAssetValuation(
        bytes32 assetId,
        uint256 newValuation
    ) external override onlyRole(REGISTRY_ROLE) {
        if (newValuation == 0) revert InvalidValuation();
        AssetInfo storage asset = _getExistingAsset(assetId);

        uint256 oldValuation = asset.valuation;
        asset.valuation = newValuation;

        emit AssetValuationUpdated(assetId, oldValuation, newValuation);
    }

    /// @inheritdoc IAssetRegistry
    function updateAssetYield(
        bytes32 assetId,
        uint256 newYieldBps
    ) external override onlyRole(REGISTRY_ROLE) {
        AssetInfo storage asset = _getExistingAsset(assetId);

        uint256 oldYieldBps = asset.yieldBasisPoints;
        asset.yieldBasisPoints = newYieldBps;

        emit AssetYieldUpdated(assetId, oldYieldBps, newYieldBps);
    }

    /// @inheritdoc IAssetRegistry
    function updateAssetMetadata(
        bytes32 assetId,
        string calldata metadataURI
    ) external override onlyRole(REGISTRY_ROLE) {
        AssetInfo storage asset = _getExistingAsset(assetId);

        asset.metadataURI = metadataURI;

        emit AssetMetadataUpdated(assetId, metadataURI);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Activation / Deactivation
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IAssetRegistry
    function deactivateAsset(bytes32 assetId) external override onlyRole(REGISTRY_ROLE) {
        AssetInfo storage asset = _getExistingAsset(assetId);
        if (!asset.isActive) revert AssetNotActive(assetId);

        asset.isActive = false;

        emit AssetDeactivated(assetId);
    }

    /// @inheritdoc IAssetRegistry
    function activateAsset(bytes32 assetId) external override onlyRole(REGISTRY_ROLE) {
        AssetInfo storage asset = _getExistingAsset(assetId);

        asset.isActive = true;

        emit AssetActivated(assetId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — View
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IAssetRegistry
    function getAsset(bytes32 assetId) external view override returns (AssetInfo memory) {
        if (_assets[assetId].createdAt == 0) revert AssetNotFound(assetId);
        return _assets[assetId];
    }

    /// @inheritdoc IAssetRegistry
    function getActiveAssets() external view override returns (AssetInfo[] memory) {
        uint256 length = _assetIds.length;

        // First pass: count active assets.
        uint256 activeCount;
        for (uint256 i; i < length; ) {
            if (_assets[_assetIds[i]].isActive) {
                activeCount++;
            }
            unchecked {
                ++i;
            }
        }

        // Second pass: collect active assets.
        AssetInfo[] memory activeAssets = new AssetInfo[](activeCount);
        uint256 idx;
        for (uint256 i; i < length; ) {
            if (_assets[_assetIds[i]].isActive) {
                activeAssets[idx] = _assets[_assetIds[i]];
                idx++;
            }
            unchecked {
                ++i;
            }
        }

        return activeAssets;
    }

    /**
     * @notice Returns all registered assets regardless of active status.
     * @return An array of all AssetInfo structs.
     */
    function getAllAssets() external view returns (AssetInfo[] memory) {
        uint256 length = _assetIds.length;
        AssetInfo[] memory allAssets = new AssetInfo[](length);

        for (uint256 i; i < length; ) {
            allAssets[i] = _assets[_assetIds[i]];
            unchecked {
                ++i;
            }
        }

        return allAssets;
    }

    /// @inheritdoc IAssetRegistry
    function getAssetCount() external view override returns (uint256) {
        return _assetCount;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Retrieves an existing asset or reverts if not found.
     * @param assetId The unique identifier of the asset.
     * @return A storage pointer to the AssetInfo struct.
     */
    function _getExistingAsset(bytes32 assetId) internal view returns (AssetInfo storage) {
        AssetInfo storage asset = _assets[assetId];
        if (asset.createdAt == 0) revert AssetNotFound(assetId);
        return asset;
    }

    /**
     * @dev Authorizes contract upgrades. Restricted to UPGRADER_ROLE.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {} // solhint-disable-line no-empty-blocks
}
