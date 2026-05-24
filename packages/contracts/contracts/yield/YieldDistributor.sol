// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IYieldDistributor} from "../interfaces/IYieldDistributor.sol";

/**
 * @title YieldDistributor
 * @notice Distributes yield (in a reward token such as USDC) to holders of tokenized
 *         real-world assets using the Synthetix reward-per-token accumulator pattern.
 * @dev UUPS upgradeable. Each registered asset token has its own independent reward
 *      accumulator. When yield is deposited, the reward-per-token is increased
 *      proportionally to the total supply of the asset token. Investors can claim
 *      accrued rewards at any time.
 */
contract YieldDistributor is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    IYieldDistributor
{
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Role hash for addresses authorized to deposit yield and register tokens.
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /// @notice Role hash for addresses authorized to perform contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice Role hash granted to asset token contracts so they can call updateRewardOnTransfer.
    bytes32 public constant ASSET_TOKEN_ROLE = keccak256("ASSET_TOKEN_ROLE");

    // ──────────────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────────────

    /// @dev The ERC-20 token used for reward payments (e.g., USDC).
    IERC20 private _rewardToken;

    /// @dev Accumulated reward per token for each asset token (scaled by 1e18).
    mapping(address => uint256) private _rewardPerTokenStored;

    /// @dev Last snapshotted reward-per-token for each user per asset token.
    mapping(address => mapping(address => uint256)) private _userRewardPerTokenPaid;

    /// @dev Unclaimed reward balance for each user per asset token.
    mapping(address => mapping(address => uint256)) private _rewards;

    /// @dev Total yield deposited for each asset token (lifetime, for accounting).
    mapping(address => uint256) private _totalYieldDeposited;

    /// @dev Ordered list of all registered asset token addresses.
    address[] private _registeredTokens;

    /// @dev Lookup for whether an address is a registered asset token.
    mapping(address => bool) private _isRegisteredToken;

    // ──────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when an operation references an unregistered asset token.
    error TokenNotRegistered(address token);

    /// @notice Thrown when a claim is attempted with no accrued reward.
    error NoRewardAvailable();

    /// @notice Thrown when a zero amount is provided where a positive value is required.
    error ZeroAmount();

    /// @notice Thrown when a zero address is provided where a valid address is required.
    error ZeroAddress();

    /// @notice Thrown when attempting to register an already-registered asset token.
    error TokenAlreadyRegistered(address token);

    // ──────────────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when yield is deposited for distribution to asset token holders.
    event YieldDeposited(
        address indexed assetToken,
        uint256 amount,
        uint256 rewardPerToken
    );

    /// @notice Emitted when an investor claims their accumulated rewards.
    event RewardClaimed(
        address indexed assetToken,
        address indexed investor,
        uint256 amount
    );

    /// @notice Emitted when a new asset token is registered for yield distribution.
    event AssetTokenRegistered(address indexed assetToken);

    // ──────────────────────────────────────────────────────────────────────────
    // Initializer
    // ──────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the YieldDistributor with an admin and reward token.
     * @param admin The address that will receive all administrative roles.
     * @param rewardToken_ The address of the ERC-20 token used for reward payments.
     */
    function initialize(address admin, address rewardToken_) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        if (rewardToken_ == address(0)) revert ZeroAddress();

        __AccessControl_init();



        _rewardToken = IERC20(rewardToken_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Token Registration
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IYieldDistributor
    function registerAssetToken(
        address assetToken
    ) external override onlyRole(DISTRIBUTOR_ROLE) {
        if (assetToken == address(0)) revert ZeroAddress();
        if (_isRegisteredToken[assetToken]) revert TokenAlreadyRegistered(assetToken);

        _isRegisteredToken[assetToken] = true;
        _registeredTokens.push(assetToken);

        // Grant ASSET_TOKEN_ROLE so the token contract can call updateRewardOnTransfer.
        _grantRole(ASSET_TOKEN_ROLE, assetToken);

        emit AssetTokenRegistered(assetToken);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Yield Deposit
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IYieldDistributor
    function depositYield(
        address assetToken,
        uint256 amount
    ) external override onlyRole(DISTRIBUTOR_ROLE) {
        if (!_isRegisteredToken[assetToken]) revert TokenNotRegistered(assetToken);
        if (amount == 0) revert ZeroAmount();

        uint256 totalSupply = IERC20(assetToken).totalSupply();

        if (totalSupply > 0) {
            _rewardPerTokenStored[assetToken] += (amount * 1e18) / totalSupply;
        }

        _rewardToken.safeTransferFrom(msg.sender, address(this), amount);

        _totalYieldDeposited[assetToken] += amount;

        emit YieldDeposited(assetToken, amount, _rewardPerTokenStored[assetToken]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — View
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IYieldDistributor
    function rewardPerToken(address assetToken) external view override returns (uint256) {
        return _rewardPerTokenStored[assetToken];
    }

    /// @inheritdoc IYieldDistributor
    function calculateReward(
        address assetToken,
        address investor
    ) public view override returns (uint256) {
        uint256 balance = IERC20(assetToken).balanceOf(investor);
        uint256 perTokenDelta = _rewardPerTokenStored[assetToken] -
            _userRewardPerTokenPaid[assetToken][investor];

        return (balance * perTokenDelta) / 1e18 + _rewards[assetToken][investor];
    }

    /**
     * @notice Returns the address of the reward token.
     * @return The reward token contract address.
     */
    function rewardToken() external view returns (address) {
        return address(_rewardToken);
    }

    /**
     * @notice Returns the list of all registered asset token addresses.
     * @return Array of registered asset token addresses.
     */
    function getRegisteredTokens() external view returns (address[] memory) {
        return _registeredTokens;
    }

    /**
     * @notice Returns the total yield deposited for a specific asset token.
     * @param assetToken The address of the asset token.
     * @return The total lifetime yield deposited.
     */
    function totalYieldDeposited(address assetToken) external view returns (uint256) {
        return _totalYieldDeposited[assetToken];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Reward Claiming
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IYieldDistributor
    function claimReward(address assetToken) external override nonReentrant {
        if (!_isRegisteredToken[assetToken]) revert TokenNotRegistered(assetToken);

        _updateReward(assetToken, msg.sender);

        uint256 reward = _rewards[assetToken][msg.sender];
        if (reward == 0) revert NoRewardAvailable();

        // Effects before interactions.
        _rewards[assetToken][msg.sender] = 0;

        _rewardToken.safeTransfer(msg.sender, reward);

        emit RewardClaimed(assetToken, msg.sender, reward);
    }

    /// @inheritdoc IYieldDistributor
    function claimAllRewards() external override nonReentrant {
        uint256 totalReward;
        uint256 length = _registeredTokens.length;

        for (uint256 i; i < length; ) {
            address token = _registeredTokens[i];
            _updateReward(token, msg.sender);

            uint256 reward = _rewards[token][msg.sender];
            if (reward > 0) {
                _rewards[token][msg.sender] = 0;
                totalReward += reward;

                emit RewardClaimed(token, msg.sender, reward);
            }

            unchecked {
                ++i;
            }
        }

        if (totalReward == 0) revert NoRewardAvailable();

        _rewardToken.safeTransfer(msg.sender, totalReward);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External — Transfer Hook
    // ──────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IYieldDistributor
    function updateRewardOnTransfer(
        address assetToken,
        address from,
        address to
    ) external override onlyRole(ASSET_TOKEN_ROLE) {
        if (from != address(0)) {
            _updateReward(assetToken, from);
        }
        if (to != address(0)) {
            _updateReward(assetToken, to);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Snapshots the current reward state for a specific account and asset token.
     * @param assetToken The asset token to snapshot.
     * @param account The investor account to update.
     */
    function _updateReward(address assetToken, address account) internal {
        _rewards[assetToken][account] = calculateReward(assetToken, account);
        _userRewardPerTokenPaid[assetToken][account] = _rewardPerTokenStored[assetToken];
    }

    /**
     * @dev Authorizes contract upgrades. Restricted to UPGRADER_ROLE.
     * @param newImplementation Address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {} // solhint-disable-line no-empty-blocks
}
