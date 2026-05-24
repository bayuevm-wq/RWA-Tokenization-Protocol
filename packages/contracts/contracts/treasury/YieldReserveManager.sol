// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IYieldDistributor.sol";

/**
 * @title YieldReserveManager
 * @dev Manages MockUSDC liquidity and automates yield distributions from Treasury Vault
 * to the YieldDistributor.
 */
contract YieldReserveManager is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant RESERVE_MANAGER_ROLE = keccak256("RESERVE_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IERC20 private _yieldToken;
    IYieldDistributor private _yieldDistributor;

    event YieldDistributed(address indexed assetToken, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address defaultAdmin, 
        address yieldToken_, 
        address yieldDistributor_
    ) public initializer {
        if (yieldToken_ == address(0) || yieldDistributor_ == address(0)) revert ZeroAddress();

        __AccessControl_init();


        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);

        _yieldToken = IERC20(yieldToken_);
        _yieldDistributor = IYieldDistributor(yieldDistributor_);
    }

    /**
     * @dev Distribute yield to a specific asset token. 
     * Requires the ReserveManager to hold enough yieldToken balance.
     */
    function distributeYield(address assetToken, uint256 amount) external onlyRole(RESERVE_MANAGER_ROLE) {
        if (assetToken == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Approve YieldDistributor to spend tokens
        _yieldToken.approve(address(_yieldDistributor), amount);
        
        // Call depositYield on the YieldDistributor
        _yieldDistributor.depositYield(assetToken, amount);

        emit YieldDistributed(assetToken, amount);
    }

    function setYieldDistributor(address newDistributor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newDistributor == address(0)) revert ZeroAddress();
        _yieldDistributor = IYieldDistributor(newDistributor);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
