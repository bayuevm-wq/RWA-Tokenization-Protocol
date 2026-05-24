// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {IAssetRegistry} from "../interfaces/IAssetRegistry.sol";
import {IComplianceManager} from "../interfaces/IComplianceManager.sol";
import {IYieldDistributor} from "../interfaces/IYieldDistributor.sol";
import {AssetToken} from "../token/AssetToken.sol";

/**
 * @title AssetFactory
 * @notice Factory contract that deploys new AssetToken UUPS proxies and registers
 *         them in the AssetRegistry and YieldDistributor in a single transaction.
 * @dev UUPS upgradeable. The factory must hold DISTRIBUTOR_ROLE on the YieldDistributor
 *      and REGISTRY_ROLE on the AssetRegistry to perform registrations.
 */
contract AssetFactory is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    // ──────────────────────────────────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Role hash for addresses authorized to create new asset tokens.
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /// @notice Role hash for addresses authorized to perform contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ──────────────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────────────

    /// @dev Address of the AssetToken implementation contract used for proxy cloning.
    address private _tokenImplementation;

    /// @dev Reference to the AssetRegistry for on-chain asset cataloging.
    IAssetRegistry private _registry;

    /// @dev Reference to the ComplianceManager for transfer compliance.
    IComplianceManager private _complianceManager;

    /// @dev Reference to the YieldDistributor for reward distribution.
    IYieldDistributor private _yieldDistributor;

    /// @dev Ordered list of all deployed token proxy addresses.
    address[] private _deployedTokens;

    // ──────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when a zero address is provided where a valid address is required.
    error ZeroAddress();

    /// @notice Thrown when invalid parameters are provided for asset creation.
    error InvalidParameters();

    // ──────────────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new asset token proxy is deployed and registered.
    event AssetTokenCreated(
        address indexed tokenAddress,
        bytes32 indexed assetId,
        string name,
        string symbol
    );

    /// @notice Emitted when the token implementation address is updated.
    event TokenImplementationUpdated(address indexed oldImpl, address indexed newImpl);

    // ──────────────────────────────────────────────────────────────────────────
    // Initializer
    // ──────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the AssetFactory with all required dependencies.
     * @param admin The address that will receive all administrative roles.
     * @param tokenImplementation_ The address of the AssetToken implementation contract.
     * @param registry_ The address of the AssetRegistry contract.
     * @param complianceManager_ The address of the ComplianceManager contract.
     * @param yieldDistributor_ The address of the YieldDistributor contract.
     */
    function initialize(
        address admin,
        address tokenImplementation_,
        address registry_,
        address complianceManager_,
        address yieldDistributor_
    ) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        if (tokenImplementation_ == address(0)) revert ZeroAddress();
        if (registry_ == address(0)) revert ZeroAddress();
        if (complianceManager_ == address(0)) revert ZeroAddress();
        if (yieldDistributor_ == address(0)) revert ZeroAddress();

        __AccessControl_init();


        _tokenImplementation = tokenImplementation_;
        _registry = IAssetRegistry(registry_);
        _complianceManager = IComplianceManager(complianceManager_);
        _yieldDistributor = IYieldDistributor(yieldDistributor_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FACTORY_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Asset Creation
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deploys a new AssetToken proxy, registers it in the YieldDistributor
     *         and AssetRegistry, and returns the token address and asset ID.
     * @param name The name of the new token.
     * @param symbol The symbol of the new token.
     * @param category The asset category for registry classification.
     * @param valuation The current valuation of the underlying asset.
     * @param maxTokenSupply The maximum supply cap for the new token.
     * @param yieldBasisPoints The expected annual yield in basis points.
     * @param metadataURI The off-chain metadata URI (e.g., IPFS hash).
     * @return tokenAddress The address of the deployed token proxy.
     * @return assetId The unique identifier assigned to the asset.
     */
    function createAsset(
        string calldata name,
        string calldata symbol,
        IAssetRegistry.AssetCategory category,
        uint256 valuation,
        uint256 maxTokenSupply,
        uint256 yieldBasisPoints,
        string calldata metadataURI
    ) external onlyRole(FACTORY_ROLE) returns (address tokenAddress, bytes32 assetId) {
        if (maxTokenSupply == 0) revert InvalidParameters();
        if (valuation == 0) revert InvalidParameters();

        // Generate a deterministic asset ID before deployment.
        assetId = keccak256(
            abi.encodePacked(name, symbol, block.timestamp, _deployedTokens.length)
        );

        // Encode the AssetToken initialize calldata.
        bytes memory initData = abi.encodeWithSelector(
            AssetToken(address(0)).initialize.selector,
            name,
            symbol,
            maxTokenSupply,
            msg.sender,
            address(_complianceManager),
            address(_yieldDistributor),
            assetId
        );

        // Deploy a new ERC1967 proxy pointing to the token implementation.
        ERC1967Proxy proxy = new ERC1967Proxy(_tokenImplementation, initData);
        tokenAddress = address(proxy);

        // Register the new token in the yield distributor.
        _yieldDistributor.registerAssetToken(tokenAddress);

        // Register the asset in the on-chain registry.
        _registry.registerAsset(
            name,
            category,
            valuation,
            maxTokenSupply,
            yieldBasisPoints,
            metadataURI,
            tokenAddress
        );

        // Track the deployment.
        _deployedTokens.push(tokenAddress);

        emit AssetTokenCreated(tokenAddress, assetId, name, symbol);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Configuration
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @notice Updates the AssetToken implementation address used for future deployments.
     * @param newImplementation The address of the new implementation contract.
     */
    function setTokenImplementation(
        address newImplementation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newImplementation == address(0)) revert ZeroAddress();

        address oldImpl = _tokenImplementation;
        _tokenImplementation = newImplementation;

        emit TokenImplementationUpdated(oldImpl, newImplementation);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — View
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the list of all deployed token proxy addresses.
     * @return Array of deployed token addresses.
     */
    function getDeployedTokens() external view returns (address[] memory) {
        return _deployedTokens;
    }

    /**
     * @notice Returns the total number of deployed token proxies.
     * @return The count of deployed tokens.
     */
    function getDeployedTokenCount() external view returns (uint256) {
        return _deployedTokens.length;
    }

    /**
     * @notice Returns the current token implementation address.
     * @return The implementation contract address.
     */
    function tokenImplementation() external view returns (address) {
        return _tokenImplementation;
    }

    /**
     * @notice Returns the address of the AssetRegistry.
     * @return The registry contract address.
     */
    function registry() external view returns (address) {
        return address(_registry);
    }

    /**
     * @notice Returns the address of the ComplianceManager.
     * @return The compliance manager contract address.
     */
    function complianceManager() external view returns (address) {
        return address(_complianceManager);
    }

    /**
     * @notice Returns the address of the YieldDistributor.
     * @return The yield distributor contract address.
     */
    function yieldDistributorAddress() external view returns (address) {
        return address(_yieldDistributor);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Authorizes contract upgrades. Restricted to UPGRADER_ROLE.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {} // solhint-disable-line no-empty-blocks
}
