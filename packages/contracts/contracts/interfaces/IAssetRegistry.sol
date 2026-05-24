// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IAssetRegistry
 * @notice Interface for the on-chain asset catalog that tracks all tokenized
 *         real-world assets, their valuations, and associated token contracts.
 */
interface IAssetRegistry {
    /// @notice Categories of real-world assets supported by the platform.
    enum AssetCategory {
        RealEstate,
        CommercialBuilding,
        PreciousMetal,
        LuxuryVehicle,
        EnergyInfrastructure
    }

    /// @notice Complete information record for a registered asset.
    struct AssetInfo {
        bytes32 id;
        string name;
        AssetCategory category;
        uint256 valuation;
        uint256 maxTokenSupply;
        uint256 yieldBasisPoints;
        string metadataURI;
        address tokenAddress;
        bool isActive;
        uint256 createdAt;
    }

    /**
     * @notice Registers a new real-world asset on-chain.
     * @param name Human-readable name of the asset.
     * @param category The asset category.
     * @param valuation The current valuation in base currency units.
     * @param maxTokenSupply Maximum number of tokens that can represent this asset.
     * @param yieldBasisPoints Expected annual yield in basis points (1 bp = 0.01%).
     * @param metadataURI URI pointing to off-chain metadata (e.g., IPFS hash).
     * @param tokenAddress Address of the deployed asset token contract.
     * @return The generated unique asset ID.
     */
    function registerAsset(
        string calldata name,
        AssetCategory category,
        uint256 valuation,
        uint256 maxTokenSupply,
        uint256 yieldBasisPoints,
        string calldata metadataURI,
        address tokenAddress
    ) external returns (bytes32);

    /**
     * @notice Updates the valuation of a registered asset.
     * @param assetId The unique identifier of the asset.
     * @param newValuation The new valuation amount.
     */
    function updateAssetValuation(bytes32 assetId, uint256 newValuation) external;

    /**
     * @notice Updates the yield basis points of a registered asset.
     * @param assetId The unique identifier of the asset.
     * @param newYieldBps The new yield in basis points.
     */
    function updateAssetYield(bytes32 assetId, uint256 newYieldBps) external;

    /**
     * @notice Updates the metadata URI of a registered asset.
     * @param assetId The unique identifier of the asset.
     * @param metadataURI The new metadata URI.
     */
    function updateAssetMetadata(bytes32 assetId, string calldata metadataURI) external;

    /**
     * @notice Deactivates a registered asset.
     * @param assetId The unique identifier of the asset.
     */
    function deactivateAsset(bytes32 assetId) external;

    /**
     * @notice Reactivates a previously deactivated asset.
     * @param assetId The unique identifier of the asset.
     */
    function activateAsset(bytes32 assetId) external;

    /**
     * @notice Returns the full information of a registered asset.
     * @param assetId The unique identifier of the asset.
     * @return The AssetInfo struct for the requested asset.
     */
    function getAsset(bytes32 assetId) external view returns (AssetInfo memory);

    /**
     * @notice Returns all currently active assets.
     * @return An array of AssetInfo structs for active assets.
     */
    function getActiveAssets() external view returns (AssetInfo[] memory);

    /**
     * @notice Returns the total number of registered assets.
     * @return The count of registered assets.
     */
    function getAssetCount() external view returns (uint256);
}
