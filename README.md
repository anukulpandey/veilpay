# 🔏 VeilPay — Confidential Payroll on Avalanche

> **Payroll on-chain, salaries invisible.** VeilPay pays teams in an encrypted
> stablecoin using Avalanche's **eERC (Encrypted ERC)** standard. Salary amounts
> are sealed with zk-SNARKs + ElGamal homomorphic encryption — yet a designated,
> **rotatable auditor key** can decrypt everything for compliance.
> Private for the world. Provable for the regulator.

Built for the **Team1 India Speedrun — Privacy on Avalanche** (July 2026).

---

## The problem

Companies want to run payroll on-chain (instant, borderless, programmable), but a
normal ERC-20 `transfer(alice, 2500e6)` publishes **everyone's salary, forever**.
That single leak kills the entire use case: no real company can pay employees
where each colleague, competitor, and ex-partner can read comp on Snowtrace.

Pure privacy coins solve the leak but create the opposite problem: **regulators
and auditors get nothing**, which is a non-starter for any Indian (or global)
business that files taxes.

## The solution

VeilPay uses **eERC converter mode** to wrap a stablecoin into `eUSDC`:

| | Normal ERC-20 payroll | Mixer-style privacy | **VeilPay (eERC)** |
|---|---|---|---|
| Amounts hidden | ❌ | ✅ | ✅ (ElGamal + zk-SNARK) |
| Auditor can decrypt | n/a | ❌ | ✅ (rotatable auditor key) |
| Self-custody balances | ✅ | ⚠️ | ✅ (no relayers, no mixers) |
| Payslips | off-chain | ❌ | ✅ **encrypted, on-chain, in the payment tx** |

### What a payroll run looks like

1. **Employer** shields treasury: `50,000 mUSDC → eUSDC` (one deposit).
2. **Run payroll**: for each employee the browser generates a **Groth16 transfer
   proof**; the amount is encrypted **three ways** in one transaction —
   ElGamal for sender + receiver balances, Poseidon for the employee's history,
   Poseidon for the **auditor**. An **encrypted payslip** (org, period, gross)
   rides along as encrypted metadata in the same tx.
3. **Employee** decrypts their balance + payslips locally (key derived from one
   wallet signature — no new seed phrase), and can withdraw back to plain mUSDC.
4. **Auditor** decrypts every amount from the `AuditorPCT` ciphertexts across
   the full chain history and exports a CSV compliance report — **without any
   employee's cooperation and without seeing anyone's keys**.

## Architecture

```
┌──────────────────────────── Browser (React + wagmi) ───────────────────────────┐
│  Employer view        Employee view        Auditor view                        │
│  roster / run payroll  balance + payslips  full-history decrypt + CSV          │
│        │                    │                    │                             │
│  @avalabs/eerc-sdk (snarkjs Groth16 proving, wasm/zkey self-hosted)            │
│  + custom PCT/metadata decryption (@zk-kit) — no 1000-block audit window       │
└───────┬───────────────────────┬─────────────────────┬──────────────────────────┘
        │ zk proofs             │ reads               │ log scans
┌───────▼───────────────────────▼─────────────────────▼──────────────────────────┐
│                        Avalanche Fuji C-Chain                                   │
│  Registrar ── EncryptedERC (converter mode) ── 5 Groth16 verifiers (prod set)   │
│                   │            │                                                │
│            SimpleERC20     PayrollManager                                       │
│            (mock USDC)     (orgs / rosters / run log — never sees amounts)      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Contracts** are the audited [ava-labs/EncryptedERC](https://github.com/ava-labs/EncryptedERC)
protocol (Registrar, EncryptedERC converter, production trusted-setup verifiers)
plus one thin addition:

- [`PayrollManager.sol`](contracts/contracts/payroll/PayrollManager.sol) — org &
  roster registry and payroll-run log. **Salaries never touch this contract**;
  they exist only as eERC ciphertexts. It records the public facts (who works
  where, when a run happened) and nothing else.

### Deep-tech highlights (what we're proud of)

- **Real Groth16 proofs in the browser** for register / transfer / withdraw,
  against the repo's production trusted-setup artifacts (we verified the
  `contracts/prod` verifiers match the shipped zkeys before deploying).
- **Encrypted on-chain payslips**: eERC's encrypted-metadata channel
  (`transfer(..., bytes message)`) carries a Poseidon-ECDH-encrypted payslip in
  the salary transaction itself. The employee's browser decrypts it locally.
- **Signature-derived keys**: one `personal_sign` deterministically derives the
  BabyJubJub key pair (SDK-compatible grindKey → Blake512 pruning). Same wallet,
  same key, any device — reproduced bit-for-bit in our Node tooling
  ([`eerc-client.ts`](contracts/scripts/lib/eerc-client.ts)) so deploy scripts,
  e2e tests, and the browser all interoperate.
- **Full-history auditor console**: we re-implemented PCT decryption client-side
  (`mulPointEscalar(authKey, scalar)` + Poseidon decrypt via @zk-kit) so the
  auditor scans from deployment block with no window limits, survives **auditor
  key rotation** (we rotate the auditor to a fresh key post-deploy), and exports
  CSV for filings.
- **One-click demo roles**: a custom wagmi connector wraps viem local accounts
  as EIP-1193 providers — judges can switch Employer → Alice → Bob → Auditor
  instantly, no wallet extension required.

## Live on Avalanche Fuji (chain 43113)

| Contract | Address |
|---|---|
| EncryptedERC (converter) | [`0xCB9aB1F20d1d5Cf990694e60470FB28B23041D1b`](https://testnet.snowtrace.io/address/0xCB9aB1F20d1d5Cf990694e60470FB28B23041D1b) |
| Registrar | `0x91Ee29CF99EC38f5fe35FB00480cc2240845E6c8` |
| PayrollManager | `0x515bA9A35A496FC3FC5595c8A06C1343Da26a763` |
| Mock USDC (open mint) | `0x55b14Cf06F3E4856EaC195D682d738DD279D63f5` |
| Transfer verifier (prod set) | `0x1F1416F0F2b0E2eD3370A0230492601B08d3E125` |

Full manifest: [`contracts/deployments/fuji.json`](contracts/deployments/fuji.json).
Sample **encrypted payroll transactions** (amounts are ciphertext — try to find the salary):
[`0xa894…9994`](https://testnet.snowtrace.io/tx/0xa8947a8be30a166def3b625557a2aeded3f479588a84467474f8b0964f6d9994)
*(Alice, gross 2,500.00 — only she and the auditor can know that)* and
[`0xac99…d31f`](https://testnet.snowtrace.io/tx/0xac99f555228fa7debf2978b53e0d1facc4ee2b2481d2adf7e7d998f1848cd31f)
*(Bob)* — demo identities in `contracts/deployments/fuji-demo.json`.

- **E2E proof of the whole flow** (local): `contracts/scripts/e2e-local.ts` —
  registers 4 users, shields 50k, runs encrypted payroll, decrypts payslips,
  withdraws, audits. Every step asserted.

## Run it yourself

```bash
# 0. Node >= 22
# 1. Contracts
cd contracts
npm install --ignore-scripts      # prebuilt circuits + verifiers ship in-repo
npx hardhat compile

# 2. Local end-to-end (fresh terminal: npx hardhat node)
npx hardhat run scripts/deploy.ts    --network localhost
npx hardhat run scripts/e2e-local.ts --network localhost   # full payroll story, asserted

# 3. Fuji
echo "PRIVATE_KEY=<funded key, no 0x>" > .env
npx hardhat run scripts/deploy.ts    --network fuji
npx hardhat run scripts/fund-demo.ts --network fuji        # demo roles + auditor rotation

# 4. Frontend
cd ../web
npm install
npm run sync                      # pulls addresses + ABIs from contracts
npm run dev                       # http://localhost:5173
```

## Judging criteria mapping

- **Value proposition**: payroll is the on-chain use case blocked *only* by
  privacy; VeilPay unblocks it while staying auditor-friendly (the version of
  privacy a real business can adopt).
- **Technical complexity**: browser-side Groth16 proving, three-layer amount
  encryption, encrypted metadata payslips, SDK-compatible key derivation
  reimplemented server-side, full-history auditor decryption with key rotation.
- **Avalanche usage**: eERC standard (converter mode) + official
  `@avalabs/eerc-sdk` + production verifier set, deployed on Fuji C-Chain;
  PayrollManager composes with, not around, the standard.

## Repo layout

```
contracts/   ava-labs/EncryptedERC + PayrollManager + deploy/e2e tooling
web/         React + wagmi + @avalabs/eerc-sdk frontend (3 role views)
deck/        pitch slides
```

## Security notes

- eERC contracts/circuits: audited upstream (Circom + Gnark audits, 2025).
- Demo private keys in the frontend are throwaway testnet identities, by design.
- `PayrollManager` stores employer-chosen display labels; use pseudonyms if the
  roster itself is sensitive (a production version would encrypt labels to the
  org members' keys — the eERC metadata channel already supports this).
