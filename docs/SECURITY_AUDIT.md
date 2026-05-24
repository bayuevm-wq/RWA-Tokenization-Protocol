# Security Audit & Threat Model

## Overview
This document outlines the security architecture, threat model, and known limitations for the RWA Tokenization Simulation Protocol.

## Architecture Security

### Smart Contracts (Phase 1 & 2)
1. **Upgradability**: All contracts are deployed behind an ERC1967 UUPS Proxy. Upgrades are strictly gated by the `UPGRADER_ROLE` managed by the `TimelockController`.
2. **Access Control**: Role-based access control (`AccessControlUpgradeable`) ensures explicit permission grants for minting (`MINTER_ROLE`), treasury management (`VAULT_MANAGER_ROLE`), and registry updates (`REGISTRY_ROLE`).
3. **Pausability**: Critical components like `AssetToken` and `TreasuryVault` implement `PausableUpgradeable` to allow rapid halting of transfers/deposits in emergencies.

## Threat Model & Vectors

### 1. Reentrancy Attacks
- **Vector**: Malicious contracts exploiting state changes during token transfers.
- **Mitigation**: Critical state-changing functions (deposits, claims) use `nonReentrant` modifiers from `ReentrancyGuardUpgradeable`.

### 2. Privilege Escalation
- **Vector**: A compromised admin account modifying roles.
- **Mitigation**: Separation of duties. The `DEFAULT_ADMIN_ROLE` is transferred to a Timelock contract governed by the DAO. Emergency roles are separated from day-to-day manager roles.

### 3. Flash Loan / Reward Manipulation
- **Vector**: Users acquiring massive amounts of `AssetToken` to manipulate the reward snapshots instantly.
- **Mitigation**: The Synthetix reward-per-token accumulator snapshot logic inherently protects against manipulation, as rewards distribute strictly based on time held since the last update.

### 4. Treasury Drain
- **Vector**: Unauthorized extraction of MockUSDC from `TreasuryVault`.
- **Mitigation**: `withdraw()` is tightly gated to the `VAULT_MANAGER_ROLE`. Emergency withdrawals require a multisig `EMERGENCY_ADMIN_ROLE`.

## Role Matrix
| Contract | Role | Privilege |
|---|---|---|
| `AssetToken` | `MINTER_ROLE` | Can mint new asset fractions |
| `TreasuryVault`| `VAULT_MANAGER_ROLE` | Can withdraw regular yields |
| `AssetRegistry`| `REGISTRY_ROLE` | Can create/update assets |
| `RWAGovernor` | `DEFAULT_ADMIN_ROLE`| Controls DAO parameters |

## Future Hardening
- Implement formal verification (Certora).
- Conduct external auditing (e.g. Trail of Bits, OpenZeppelin).
