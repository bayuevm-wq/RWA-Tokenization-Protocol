# 🏛️ RWA Tokenization Protocol — Enterprise Edition

![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)
![Hardhat](https://img.shields.io/badge/Hardhat-2.22-yellow?logo=hardhat)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)
![License](https://img.shields.io/badge/License-MIT-green)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?logo=githubactions)

An institutional-grade, modular Web3 protocol designed to bridge the gap between traditional finance (TradFi) and decentralized finance (DeFi). This protocol provides a comprehensive, scalable infrastructure for the tokenization, fractionalization, compliance, and yield distribution of Real-World Assets (RWA) such as real estate, private credit, luxury assets, and energy infrastructure.

---

## 📖 Executive Summary

The RWA Tokenization Protocol is built on a scalable **enterprise monorepo architecture**. It abstracts away the complexities of interacting with smart contracts by providing a unified, full-stack environment that encompasses the blockchain layer, a robust event-indexing backend, and an intuitive, modern investor dashboard.

### Core Protocol Pillars
1. **Fractional Ownership**: Divide high-value physical assets into liquid, transferrable ERC-20 tokens.
2. **Automated Yield Mechanics**: Epoch-based, mathematically secure yield distribution (Synthetix Accumulator Pattern) utilizing MockUSDC to simulate real revenue streaming.
3. **Institutional Compliance**: Strict, on-chain KYC/AML whitelist enforcement prior to any peer-to-peer asset transfer.
4. **Decentralized Governance (DAO)**: Transparent protocol management via OpenZeppelin Governor, allowing token holders to steer treasury allocations and platform parameters.
5. **Real-time Analytics**: A dedicated Node.js/PostgreSQL indexer tracking on-chain events to provide sub-second portfolio valuations and TVL metrics to the frontend.

---

## 🏗️ System Architecture

The protocol is organized into a tightly integrated `npm workspaces` monorepo, decoupling the smart contracts from the user interfaces while enabling shared configurations and types.

```mermaid
graph TB
    subgraph User Layer
        Investor["👤 Investor"]
        Admin["🔑 Protocol Admin"]
        DAO["🏛️ DAO Voters"]
    end

    subgraph Frontend [Next.js App Router]
        Dashboard["Investor Dashboard"]
        GovUI["Governance UI"]
        AdminPanel["Compliance & Admin"]
    end

    subgraph Backend [Node.js Indexer API]
        API["REST / GraphQL API"]
        EventSync["Viem Event Listener"]
        DB[(PostgreSQL)]
    end

    subgraph Smart Contracts [EVM Blockchain]
        Registry["AssetRegistry (UUPS)"]
        Token["AssetToken (ERC-20)"]
        Yield["YieldDistributor (UUPS)"]
        Treasury["TreasuryVault"]
        Governor["RWAGovernor"]
        Compliance["ComplianceManager"]
    end

    Investor --> Dashboard
    Admin --> AdminPanel
    DAO --> GovUI

    Dashboard <--> API
    GovUI <--> API
    AdminPanel --> Smart Contracts

    EventSync -->|Reads Events| Smart Contracts
    EventSync -->|Writes Data| DB
    API -->|Queries| DB
```

### Monorepo Structure

```text
RWA/
├── apps/
│   ├── frontend/         # Next.js 15 Web3 Dashboard (Investor & Admin Panels)
│   └── indexer/          # Express.js + Viem + PostgreSQL indexing backend
├── packages/
│   └── contracts/        # Hardhat project, Solidity contracts, and deployment scripts
├── docs/                 # Architecture diagrams, API specs, and Security Audits
├── docker-compose.yml    # Orchestrates the local simulation environment
├── package.json          # Root workspace configuration
└── tsconfig.json         # Shared TypeScript compiler options
```

---

## 📜 Smart Contract Suite

The blockchain layer is written in Solidity `0.8.28` and heavily utilizes OpenZeppelin v5 libraries. All core contracts use the **UUPS (Universal Upgradeable Proxy Standard)** pattern for secure, permissioned upgradeability.

| Contract Category | Contract Name | Technical Role & Responsibility |
|---|---|---|
| **Core Asset** | `AssetToken.sol` | An upgradeable, mint-capped ERC-20 token representing fractional asset shares. Hooked to reject transfers lacking KYC compliance. |
| **Registry** | `AssetRegistry.sol` | The single source of truth for metadata, category mapping, and valuation history of all tokenized assets on the protocol. |
| **Compliance** | `ComplianceManager.sol` | Maintains the protocol-wide KYC/AML whitelist. Consulted dynamically during every `AssetToken` transfer. |
| **Yield & Rewards** | `YieldDistributor.sol` | Employs a global reward-per-token accumulator to proportionally distribute USDC yield to token holders without exposing flash-loan vulnerabilities. |
| **Treasury** | `TreasuryVault.sol` | Securely stores protocol reserves and operational liquidity. Withdrawals are multi-sig or DAO gated via TimeLocks. |
| **Governance** | `RWAGovernor.sol` | The DAO engine. Uses `ERC20Votes` (RWAGovernanceToken) to create proposals, enforce quorum, and execute timelocked protocol upgrades. |

---

## 🚀 Deployment & Simulation Guide

To ensure rapid onboarding, the protocol ships with a fully containerized local simulation environment.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) (v20+)
- npm or yarn

### 1. One-Click Local Simulation
Spin up the entire protocol ecosystem with a single command. This will initialize the Hardhat node, PostgreSQL database, Indexer API, and Next.js frontend concurrently.

```bash
docker-compose up -d --build
```

### 2. Service Endpoints
Once the containers are running, the following services are available:

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Indexer API**: [http://localhost:4000/api/events](http://localhost:4000/api/events)
- **Hardhat RPC Node**: `http://localhost:8545`
- **PostgreSQL Database**: `localhost:5432`

### 3. Manual Deployment (Without Docker)

To run the repository natively:

```bash
# 1. Install dependencies across all workspaces
npm install

# 2. Compile smart contracts
npm run compile:contracts

# 3. Start the local Hardhat network (in Terminal 1)
npm run node -w packages/contracts

# 4. Deploy contracts to the local network (in Terminal 2)
npm run deploy:local -w packages/contracts

# 5. Start the Next.js Frontend
npm run dev:frontend
```

---

## 🔐 Security & Threat Mitigation

Security is a primary pillar of this enterprise protocol. We implement defense-in-depth strategies to secure investor funds and protocol integrity.

- **Proxy Upgrades**: Only the `UPGRADER_ROLE` (managed by the DAO Timelock) can upgrade UUPS proxies. Implementation contracts invoke `_disableInitializers()` upon deployment.
- **Reentrancy Guards**: All state-changing yield, deposit, and governance execution functions strictly implement `nonReentrant` modifiers following the Checks-Effects-Interactions pattern.
- **Role Segregation**: OpenZeppelin's `AccessControlUpgradeable` separates responsibilities (e.g., `MINTER_ROLE`, `VAULT_MANAGER_ROLE`, `REGISTRY_ROLE`) to minimize the blast radius of a compromised key.
- **Yield Manipulation Protection**: By utilizing a continuous accumulator pattern rather than snapshot arrays, the `YieldDistributor` prevents flash-loan sandwich attacks on reward emissions.

> **Note**: For a detailed breakdown of attack vectors, role matrices, and audit plans, refer to the [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

---

## 🛠️ Continuous Integration (CI/CD)

The repository leverages GitHub Actions to enforce code quality and prevent regression. The pipeline (`.github/workflows/ci.yml`) automatically triggers on Pull Requests to `main` and `develop`.

The automated pipeline executes:
1. **Solidity Compilation**: Verifies syntax and configuration via Hardhat.
2. **Contract Testing**: Runs the Mocha/Chai test suite with OpenZeppelin test helpers.
3. **Frontend Build**: Ensures Next.js production bundles compile successfully without TypeScript or ESLint errors.

---

## 🤝 Contributing

We welcome contributions from the community to improve the RWA Tokenization Protocol! 

1. **Fork the repository** and create your feature branch (`git checkout -b feature/AmazingFeature`).
2. **Commit your changes** ensuring you follow conventional commits (`git commit -m 'feat: Add AmazingFeature'`).
3. **Push to the branch** (`git push origin feature/AmazingFeature`).
4. **Open a Pull Request** against the `develop` branch.

Please ensure all tests pass (`npm run test:contracts`) and that you have linted your code before submitting a PR.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<p align="center">
  <b>Built with ❤️ for the future of decentralized asset tokenization.</b>
</p>
