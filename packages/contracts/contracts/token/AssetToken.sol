// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IAssetToken} from "../interfaces/IAssetToken.sol";
import {IComplianceManager} from "../interfaces/IComplianceManager.sol";
import {IYieldDistributor} from "../interfaces/IYieldDistributor.sol";

/**
 * @title AssetToken
 * @notice ERC-20 security token representing fractional ownership of a tokenized
 *         real-world asset. Enforces compliance checks on every peer-to-peer transfer
 *         and integrates with the yield distribution system.
 * @dev UUPS upgradeable. Minting is capped. Transfers (excluding mint/burn) are
 *      gated by the ComplianceManager. The YieldDistributor is notified on every
 *      balance-changing operation so reward accounting stays accurate.
 */
contract AssetToken is
    Initializable,
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    IAssetToken
{
    // ──────────────────────────────────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Role hash for addresses authorized to mint new tokens.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Role hash for addresses authorized to pause/unpause token transfers.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Role hash for addresses authorized to perform contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ──────────────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────────────

    /// @dev Maximum token supply.
    uint256 private _cap;

    /// @dev Reference to the compliance manager used for transfer validation.
    IComplianceManager private _complianceManager;

    /// @dev Reference to the yield distributor for reward accounting.
    IYieldDistributor private _yieldDistributor;

    /// @dev Unique identifier of the underlying real-world asset.
    bytes32 private _assetId;

    // ──────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when a mint would exceed the token cap.
    /// @param requested The amount requested to mint.
    /// @param available The remaining mintable supply.
    error CapExceeded(uint256 requested, uint256 available);

    /// @notice Thrown when a zero address is provided where a valid address is required.
    error ZeroAddress();

    /// @notice Thrown when a transfer fails the compliance check.
    /// @param from The sender address.
    /// @param to The receiver address.
    error TransferNotCompliant(address from, address to);

    /// @notice Thrown when an invalid (zero) cap is provided during initialization.
    error InvalidCap();

    // ──────────────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when new tokens are minted.
    event TokensMinted(address indexed to, uint256 amount);

    /// @notice Emitted when tokens are burned.
    event TokensBurned(address indexed from, uint256 amount);

    /// @notice Emitted when the compliance manager address is updated.
    event ComplianceManagerUpdated(address indexed oldManager, address indexed newManager);

    /// @notice Emitted when the yield distributor address is updated.
    event YieldDistributorUpdated(address indexed oldDistributor, address indexed newDistributor);

    // ──────────────────────────────────────────────────────────────────────────
    // Initializer
    // ──────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the AssetToken with all required parameters.
     * @param name_ The token name.
     * @param symbol_ The token symbol.
     * @param cap_ The maximum supply cap.
     * @param admin_ The address that will receive all administrative roles.
     * @param complianceManager_ The address of the ComplianceManager contract.
     * @param yieldDistributor_ The address of the YieldDistributor contract.
     * @param assetId_ The unique identifier of the underlying asset.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address admin_,
        address complianceManager_,
        address yieldDistributor_,
        bytes32 assetId_
    ) external initializer {
        if (cap_ == 0) revert InvalidCap();
        if (admin_ == address(0)) revert ZeroAddress();
        if (complianceManager_ == address(0)) revert ZeroAddress();
        if (yieldDistributor_ == address(0)) revert ZeroAddress();

        __ERC20_init(name_, symbol_);
        __ERC20Pausable_init();
        __AccessControl_init();



        _cap = cap_;
        _complianceManager = IComplianceManager(complianceManager_);
        _yieldDistributor = IYieldDistributor(yieldDistributor_);
        _assetId = assetId_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);
        _grantRole(UPGRADER_ROLE, admin_);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Token Operations
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IAssetToken
    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
        uint256 available = _cap - totalSupply();
        if (amount > available) {
            revert CapExceeded(amount, available);
        }

        _mint(to, amount);

        emit TokensMinted(to, amount);
    }

    /// @inheritdoc IAssetToken
    function burn(address from, uint256 amount) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);

        emit TokensBurned(from, amount);
    }

    /**
     * @notice Pauses all token transfers.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Configuration
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IAssetToken
    function setComplianceManager(
        address newManager
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newManager == address(0)) revert ZeroAddress();

        address oldManager = address(_complianceManager);
        _complianceManager = IComplianceManager(newManager);

        emit ComplianceManagerUpdated(oldManager, newManager);
    }

    /// @inheritdoc IAssetToken
    function setYieldDistributor(
        address newDistributor
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newDistributor == address(0)) revert ZeroAddress();

        address oldDistributor = address(_yieldDistributor);
        _yieldDistributor = IYieldDistributor(newDistributor);

        emit YieldDistributorUpdated(oldDistributor, newDistributor);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — View
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IAssetToken
    function cap() external view override returns (uint256) {
        return _cap;
    }

    /// @inheritdoc IAssetToken
    function assetId() external view override returns (bytes32) {
        return _assetId;
    }

    /**
     * @notice Returns the address of the current compliance manager.
     * @return The ComplianceManager contract address.
     */
    function complianceManager() external view returns (address) {
        return address(_complianceManager);
    }

    /**
     * @notice Returns the address of the current yield distributor.
     * @return The YieldDistributor contract address.
     */
    function yieldDistributor() external view returns (address) {
        return address(_yieldDistributor);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal Overrides
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Hook that is called on every token transfer (including mint and burn).
     *      Enforces compliance on peer-to-peer transfers and notifies the yield
     *      distributor so reward snapshots remain accurate.
     *
     *      Compliance is NOT checked for minting (from == address(0)) or
     *      burning (to == address(0)) — only for real peer-to-peer transfers.
     *
     * @param from The sender address (address(0) on mint).
     * @param to The receiver address (address(0) on burn).
     * @param value The amount of tokens being transferred.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        // Compliance check: only for peer-to-peer transfers (not mint/burn).
        if (from != address(0) && to != address(0)) {
            if (!_complianceManager.canTransfer(from, to, value)) {
                revert TransferNotCompliant(from, to);
            }
        }

        // Execute the transfer (includes pausable check).
        super._update(from, to, value);

        // Notify the yield distributor of the balance change.
        if (address(_yieldDistributor) != address(0)) {
            if (from != address(0) || to != address(0)) {
                _yieldDistributor.updateRewardOnTransfer(address(this), from, to);
            }
        }
    }

    /**
     * @dev Authorizes contract upgrades. Restricted to UPGRADER_ROLE.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {} // solhint-disable-line no-empty-blocks
}
