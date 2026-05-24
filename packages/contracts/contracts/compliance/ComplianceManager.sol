// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IComplianceManager} from "../interfaces/IComplianceManager.sol";

/**
 * @title ComplianceManager
 * @notice Manages investor compliance including whitelist, blacklist, and KYC verification
 *         for security token transfers on the RWA platform.
 * @dev UUPS upgradeable. Role-based access control restricts compliance operations
 *      to authorized compliance officers.
 */
contract ComplianceManager is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IComplianceManager
{
    // ──────────────────────────────────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Role hash for compliance officers who manage investor status.
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    /// @notice Role hash for addresses authorized to perform contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ──────────────────────────────────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Classification of investor sophistication level.
    enum InvestorType {
        Retail,
        Accredited,
        Institutional
    }

    /// @notice On-chain compliance record for a single investor.
    struct InvestorInfo {
        bool whitelisted;
        bool blacklisted;
        bool kycVerified;
        InvestorType investorType;
        uint256 whitelistedAt;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────────────

    /// @dev Investor address → compliance record.
    mapping(address => InvestorInfo) private _investors;

    // ──────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when attempting to whitelist an already-whitelisted address.
    error AlreadyWhitelisted(address investor);

    /// @notice Thrown when an operation requires the address to be whitelisted.
    error NotWhitelisted(address investor);

    /// @notice Thrown when attempting to blacklist an already-blacklisted address.
    error AlreadyBlacklisted(address investor);

    /// @notice Thrown when an operation requires the address to be blacklisted.
    error NotBlacklisted(address investor);

    /// @notice Thrown when a zero address is provided where a valid address is required.
    error ZeroAddress();

    // ──────────────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when an investor is added to the whitelist.
    event InvestorWhitelisted(address indexed investor, uint256 timestamp);

    /// @notice Emitted when an investor is removed from the whitelist.
    event InvestorRemovedFromWhitelist(address indexed investor);

    /// @notice Emitted when an investor is added to the blacklist.
    event InvestorBlacklisted(address indexed investor);

    /// @notice Emitted when an investor is removed from the blacklist.
    event InvestorRemovedFromBlacklist(address indexed investor);

    /// @notice Emitted when an investor's KYC verification status changes.
    event KYCStatusUpdated(address indexed investor, bool status);

    /// @notice Emitted when an investor's classification type changes.
    event InvestorTypeUpdated(address indexed investor, InvestorType investorType);

    // ──────────────────────────────────────────────────────────────────────────
    // Initializer
    // ──────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the ComplianceManager with an admin address.
     * @param admin The address that will receive all administrative roles.
     */
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert ZeroAddress();

        __AccessControl_init();


        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Compliance Checks
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IComplianceManager
    function canTransfer(
        address from,
        address to,
        uint256 /* amount */
    ) external view override returns (bool) {
        // Minting (from == 0) and burning (to == 0) are always allowed.
        if (from == address(0) || to == address(0)) {
            return true;
        }

        // Both parties must be whitelisted, KYC-verified, and not blacklisted.
        InvestorInfo storage sender = _investors[from];
        InvestorInfo storage receiver = _investors[to];

        return (sender.whitelisted &&
            sender.kycVerified &&
            !sender.blacklisted &&
            receiver.whitelisted &&
            receiver.kycVerified &&
            !receiver.blacklisted);
    }

    /// @inheritdoc IComplianceManager
    function isWhitelisted(address investor) external view override returns (bool) {
        return _investors[investor].whitelisted;
    }

    /// @inheritdoc IComplianceManager
    function isBlacklisted(address investor) external view override returns (bool) {
        return _investors[investor].blacklisted;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Whitelist Management
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IComplianceManager
    function addToWhitelist(address investor) external override onlyRole(COMPLIANCE_ROLE) {
        _addToWhitelist(investor);
    }

    /// @inheritdoc IComplianceManager
    function removeFromWhitelist(address investor) external override onlyRole(COMPLIANCE_ROLE) {
        if (investor == address(0)) revert ZeroAddress();
        if (!_investors[investor].whitelisted) revert NotWhitelisted(investor);

        _investors[investor].whitelisted = false;
        _investors[investor].whitelistedAt = 0;

        emit InvestorRemovedFromWhitelist(investor);
    }

    /// @inheritdoc IComplianceManager
    function batchWhitelist(
        address[] calldata investors
    ) external override onlyRole(COMPLIANCE_ROLE) {
        uint256 length = investors.length;
        for (uint256 i; i < length; ) {
            _addToWhitelist(investors[i]);
            unchecked {
                ++i;
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Blacklist Management
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IComplianceManager
    function addToBlacklist(address investor) external override onlyRole(COMPLIANCE_ROLE) {
        if (investor == address(0)) revert ZeroAddress();
        if (_investors[investor].blacklisted) revert AlreadyBlacklisted(investor);

        _investors[investor].blacklisted = true;

        emit InvestorBlacklisted(investor);
    }

    /// @inheritdoc IComplianceManager
    function removeFromBlacklist(address investor) external override onlyRole(COMPLIANCE_ROLE) {
        if (investor == address(0)) revert ZeroAddress();
        if (!_investors[investor].blacklisted) revert NotBlacklisted(investor);

        _investors[investor].blacklisted = false;

        emit InvestorRemovedFromBlacklist(investor);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — KYC & Investor Type
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IComplianceManager
    function setKYCStatus(
        address investor,
        bool status
    ) external override onlyRole(COMPLIANCE_ROLE) {
        if (investor == address(0)) revert ZeroAddress();

        _investors[investor].kycVerified = status;

        emit KYCStatusUpdated(investor, status);
    }

    /**
     * @notice Sets the investor classification type.
     * @param investor The address of the investor.
     * @param investorType The new investor type classification.
     */
    function setInvestorType(
        address investor,
        InvestorType investorType
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (investor == address(0)) revert ZeroAddress();

        _investors[investor].investorType = investorType;

        emit InvestorTypeUpdated(investor, investorType);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — View
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full compliance record for an investor.
     * @param investor The address to query.
     * @return The InvestorInfo struct containing all compliance data.
     */
    function getInvestorInfo(address investor) external view returns (InvestorInfo memory) {
        return _investors[investor];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Internal whitelist logic shared by single and batch operations.
     * @param investor The address to whitelist.
     */
    function _addToWhitelist(address investor) internal {
        if (investor == address(0)) revert ZeroAddress();
        if (_investors[investor].whitelisted) revert AlreadyWhitelisted(investor);

        _investors[investor].whitelisted = true;
        _investors[investor].whitelistedAt = block.timestamp;

        emit InvestorWhitelisted(investor, block.timestamp);
    }

    /**
     * @dev Authorizes contract upgrades. Restricted to UPGRADER_ROLE.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {} // solhint-disable-line no-empty-blocks
}
