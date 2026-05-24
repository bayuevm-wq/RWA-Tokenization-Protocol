// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice A simple ERC-20 mock stablecoin used for testing yield distribution.
 * @dev NOT upgradeable. Anyone can mint tokens — intended for testnet/local use only.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin Mock", "USDC") {}

    /**
     * @notice Returns the number of decimals used by the token.
     * @return 6, matching real USDC.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Mints tokens to a specified address.
     * @dev Open mint function for testing — no access control.
     * @param to The address to receive the minted tokens.
     * @param amount The number of tokens to mint (in smallest unit, i.e., 6 decimals).
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
