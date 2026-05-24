// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IComplianceManager
 * @notice Interface for the compliance module that manages investor whitelisting,
 *         blacklisting, and KYC verification for security token transfers.
 */
interface IComplianceManager {
    /**
     * @notice Checks whether a transfer between two addresses is compliant.
     * @param from The sender address (address(0) for minting).
     * @param to The receiver address (address(0) for burning).
     * @param amount The amount of tokens being transferred.
     * @return True if the transfer is compliant, false otherwise.
     */
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    /**
     * @notice Checks whether an investor is whitelisted.
     * @param investor The address to check.
     * @return True if the investor is whitelisted.
     */
    function isWhitelisted(address investor) external view returns (bool);

    /**
     * @notice Checks whether an investor is blacklisted.
     * @param investor The address to check.
     * @return True if the investor is blacklisted.
     */
    function isBlacklisted(address investor) external view returns (bool);

    /**
     * @notice Adds an investor to the whitelist.
     * @param investor The address to whitelist.
     */
    function addToWhitelist(address investor) external;

    /**
     * @notice Removes an investor from the whitelist.
     * @param investor The address to remove from the whitelist.
     */
    function removeFromWhitelist(address investor) external;

    /**
     * @notice Adds an investor to the blacklist.
     * @param investor The address to blacklist.
     */
    function addToBlacklist(address investor) external;

    /**
     * @notice Removes an investor from the blacklist.
     * @param investor The address to remove from the blacklist.
     */
    function removeFromBlacklist(address investor) external;

    /**
     * @notice Sets the KYC verification status of an investor.
     * @param investor The address of the investor.
     * @param status True if KYC is verified, false otherwise.
     */
    function setKYCStatus(address investor, bool status) external;

    /**
     * @notice Adds multiple investors to the whitelist in a single transaction.
     * @param investors Array of addresses to whitelist.
     */
    function batchWhitelist(address[] calldata investors) external;
}
