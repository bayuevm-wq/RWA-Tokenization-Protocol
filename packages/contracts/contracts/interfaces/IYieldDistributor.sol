// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IYieldDistributor
 * @notice Interface for the yield distribution module that manages reward accumulation
 *         and claiming for holders of tokenized real-world assets.
 */
interface IYieldDistributor {
    /**
     * @notice Registers an asset token for yield distribution.
     * @param assetToken The address of the asset token contract.
     */
    function registerAssetToken(address assetToken) external;

    /**
     * @notice Deposits yield for distribution to holders of a specific asset token.
     * @param assetToken The address of the asset token contract.
     * @param amount The amount of reward tokens to deposit.
     */
    function depositYield(address assetToken, uint256 amount) external;

    /**
     * @notice Calculates the pending reward for an investor on a specific asset token.
     * @param assetToken The address of the asset token contract.
     * @param investor The address of the investor.
     * @return The amount of pending reward tokens.
     */
    function calculateReward(address assetToken, address investor) external view returns (uint256);

    /**
     * @notice Claims accumulated rewards for a specific asset token.
     * @param assetToken The address of the asset token contract.
     */
    function claimReward(address assetToken) external;

    /**
     * @notice Claims accumulated rewards across all registered asset tokens.
     */
    function claimAllRewards() external;

    /**
     * @notice Updates reward accounting when tokens are transferred between addresses.
     * @dev Called by the asset token contract during transfers.
     * @param assetToken The address of the asset token contract.
     * @param from The sender address.
     * @param to The receiver address.
     */
    function updateRewardOnTransfer(address assetToken, address from, address to) external;

    /**
     * @notice Returns the current reward-per-token accumulator value for an asset token.
     * @param assetToken The address of the asset token contract.
     * @return The accumulated reward per token (scaled by 1e18).
     */
    function rewardPerToken(address assetToken) external view returns (uint256);
}
