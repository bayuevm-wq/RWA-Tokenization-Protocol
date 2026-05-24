// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IAssetToken
 * @notice Interface for the ERC-20 security token representing a tokenized real-world asset.
 */
interface IAssetToken {
    /**
     * @notice Mints new tokens to a specified address.
     * @param to The address to receive the minted tokens.
     * @param amount The number of tokens to mint.
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Burns tokens from a specified address.
     * @param from The address from which tokens will be burned.
     * @param amount The number of tokens to burn.
     */
    function burn(address from, uint256 amount) external;

    /**
     * @notice Returns the maximum token supply cap.
     * @return The cap value.
     */
    function cap() external view returns (uint256);

    /**
     * @notice Returns the unique identifier of the underlying real-world asset.
     * @return The asset ID as a bytes32 hash.
     */
    function assetId() external view returns (bytes32);

    /**
     * @notice Updates the compliance manager contract address.
     * @param newManager The address of the new compliance manager.
     */
    function setComplianceManager(address newManager) external;

    /**
     * @notice Updates the yield distributor contract address.
     * @param newDistributor The address of the new yield distributor.
     */
    function setYieldDistributor(address newDistributor) external;
}
