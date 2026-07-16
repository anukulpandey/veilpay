# VeilPay — 3-minute live demo script

> Setup before demo: `npm run dev` in `web/`, page open on the hero. Nothing else.
> Every step below is real — proofs generate live in the browser, transactions
> land on Fuji (or local hardhat as fallback).

### 0:00 — The hook (hero page)

- "This is a payroll transaction on normal ERC-20 — *everyone's salary, public
  forever*." *(point at the red box)*
- "Same payroll on VeilPay — ciphertext. Only the employee and one designated
  auditor can decrypt. That's eERC, Avalanche's encrypted token standard."

### 0:25 — Employer runs payroll

1. Click **Try as Employer** (demo connector — no wallet fumbling).
2. Point at the two treasury cards: public mUSDC vs **encrypted eUSDC** —
   click the blurred balance: "decrypts locally with a key derived from one
   wallet signature; the RPC node and Snowtrace see only ciphertext."
3. (Roster is pre-loaded.) Type salaries for Alice + Bob, click **Pay 2
   employees 🔒**.
4. While the spinner runs: "the browser is generating a Groth16 zk proof right
   now — proving the encrypted balance covers the salary without revealing
   either. The amount gets encrypted three ways in one tx: for me, for the
   employee, and for the auditor. And an **encrypted payslip** rides along in
   the same transaction."
5. Row flips to **paid** with a Snowtrace link — open it: "here's the tx.
   Find the salary. You can't."

### 1:30 — Employee sees money + payslip

1. Switch role → **Alice**, tab **Employee**.
2. Click the blurred balance → reveals. "Alice decrypts her salary. Her
   colleagues can't. Her landlord can't."
3. Point at **My payslips**: decrypted from the on-chain encrypted metadata —
   org, period, gross. "The payslip lives *inside* the payment transaction,
   encrypted to Alice's key."
4. Withdraw 500 → "and she can exit to plain USDC whenever she wants.
   Self-custody the whole way, no mixer, no relayer."

### 2:20 — The regulator's view

1. Switch role → **Auditor**, tab **Auditor**.
2. Click **Decrypt all transfers** → full table appears with exact amounts.
3. "The auditor decrypts every payment from a dedicated ciphertext in each
   transfer — without any employee's key, across the entire chain history.
   Keys are **rotatable** — we actually rotated the auditor key after deploy."
4. Click **Export CSV report**: "this file goes to the tax filing. Privacy for
   the world, provability for the regulator."

### 2:50 — Close

- "Everything you saw is on Avalanche Fuji: audited eERC contracts in converter
  mode, official eERC SDK, Groth16 proofs in the browser, plus our
  PayrollManager for org state — which never sees a single amount."
- "Payroll is the killer use case privacy was blocking. VeilPay unblocks it."

---

## Fallback plan

If Fuji RPC is slow during the demo: `npx hardhat node` +
`npx hardhat run scripts/deploy.ts --network localhost` +
`npx hardhat run scripts/e2e-local.ts --network localhost` pre-seeds the exact
same story locally; the app auto-detects the chain. The e2e script output is
also a complete, asserted receipt of the whole flow if live demo gods are angry.
