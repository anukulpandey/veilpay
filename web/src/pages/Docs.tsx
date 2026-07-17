import { Footer, Nav } from "../router";

const SECTIONS = [
  ["what", "What is VeilPay"],
  ["quickstart", "Quickstart"],
  ["roles", "Roles & flows"],
  ["crypto", "The cryptography"],
  ["contracts", "Contracts & addresses"],
  ["local", "Run it locally"],
  ["faq", "FAQ"],
  ["security", "Security notes"],
] as const;

const ADDR = {
  eerc: "0xCB9aB1F20d1d5Cf990694e60470FB28B23041D1b",
  registrar: "0x91Ee29CF99EC38f5fe35FB00480cc2240845E6c8",
  payroll: "0x515bA9A35A496FC3FC5595c8A06C1343Da26a763",
  usdc: "0x55b14Cf06F3E4856EaC195D682d738DD279D63f5",
  transferVerifier: "0x1F1416F0F2b0E2eD3370A0230492601B08d3E125",
  registrationVerifier: "0x5B7b0393F1cD20B14e4AF5E20DB88084fBc063A2",
  withdrawVerifier: "0x5A6baF668B433E680d6E31edF50843388A5DdDF0",
};

const A = ({ a }: { a: string }) => (
  <a
    className="mono"
    href={`https://testnet.snowtrace.io/address/${a}`}
    target="_blank"
    rel="noreferrer"
  >
    {a}
  </a>
);

export function Docs() {
  return (
    <>
      <Nav route="docs" />
      <div className="docs">
        <aside className="docs-side">
          <div className="docs-side-title">Documentation</div>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#/docs/${id}`} onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
            }}>
              {label}
            </a>
          ))}
        </aside>
        <main className="docs-main">
          <h1>VeilPay Documentation</h1>
          <p className="lead">
            Confidential payroll rails on Avalanche, built on the eERC (Encrypted ERC)
            token standard. This page covers the product, the flows, the cryptography,
            and every deployed contract.
          </p>

          <h2 id="what">What is VeilPay</h2>
          <p>
            VeilPay lets an organization pay salaries in a stablecoin <em>on-chain</em>{" "}
            without publishing amounts. A normal ERC-20 transfer writes{" "}
            <code>transfer(alice, 2500e6)</code> into a public ledger forever — which is
            why no serious company runs payroll on-chain today. VeilPay wraps the
            stablecoin into an <strong>encrypted token (eUSDC)</strong> using eERC's
            converter mode: balances and transfer amounts become ElGamal ciphertexts,
            validity is enforced by Groth16 zk-SNARKs, and a designated{" "}
            <strong>auditor key</strong> can decrypt amounts for compliance.
          </p>
          <p>Three properties make it adoptable by a real business:</p>
          <ul>
            <li>
              <strong>Privacy</strong> — salary amounts are unreadable to everyone
              except sender, receiver, and auditor. This includes RPC providers,
              explorers, and colleagues.
            </li>
            <li>
              <strong>Compliance</strong> — the auditor decrypts every payment without
              any employee's cooperation, and the auditor key is rotatable by the
              contract owner.
            </li>
            <li>
              <strong>Self-custody</strong> — no mixers, relayers, or custodians.
              Users hold their own keys and can withdraw to the plain stablecoin at
              any time.
            </li>
          </ul>

          <h2 id="quickstart">Quickstart (60 seconds, zero setup)</h2>
          <p>
            The <a href="#/app">app</a> ships with funded demo identities on Avalanche
            Fuji, so you can play every role without a wallet extension:
          </p>
          <ol>
            <li>
              Open the <a href="#/app">app</a> and click <strong>Try as Employer</strong>.
              If prompted, register — your browser generates a zk registration proof
              (~2s) and submits it on-chain.
            </li>
            <li>
              In the <strong>Employer</strong> tab: mint test mUSDC, then{" "}
              <strong>Shield</strong> it into encrypted eUSDC. Click the blurred
              balance to decrypt it locally.
            </li>
            <li>
              Enter salary amounts in the roster and hit <strong>Pay</strong>. Watch
              the Groth16 transfer proof generate in your browser; each row links to
              the transaction on Snowtrace — open it, the amount isn't there.
            </li>
            <li>
              Switch role (top bar) to <strong>Alice</strong> → Employee tab: decrypt
              her balance and read the payslip that was decrypted from{" "}
              <em>inside the payment transaction</em>.
            </li>
            <li>
              Switch to <strong>Auditor</strong> → Auditor tab →{" "}
              <strong>Decrypt all transfers</strong>: every amount, full history, CSV
              export.
            </li>
          </ol>
          <p>
            Prefer your own wallet? <strong>Connect wallet</strong> works with Core or
            MetaMask on Fuji — registration is one signature.
          </p>

          <h2 id="roles">Roles & flows</h2>
          <h3>🏢 Employer</h3>
          <ul>
            <li>
              <strong>Shield</strong>: approve + deposit mUSDC into the eERC converter.
              The contract encrypts the deposit to your public key; dust beyond the
              encrypted system's 2-decimal precision is returned.
            </li>
            <li>
              <strong>Org & roster</strong>: create an org and add employees by wallet
              address in PayrollManager. The roster stores a display label only —
              never amounts.
            </li>
            <li>
              <strong>Run payroll</strong>: for each employee the app checks their
              registration, generates a transfer proof against your current encrypted
              balance, attaches an encrypted payslip, submits, waits for the balance
              ciphertext to re-sync, then proceeds to the next employee. The run is
              logged on-chain (count + memo, no amounts).
            </li>
          </ul>
          <h3>👤 Employee</h3>
          <ul>
            <li>
              <strong>Balance</strong>: decrypted locally from your Poseidon ciphertext
              history and verified against the ElGamal balance.
            </li>
            <li>
              <strong>Payslips</strong>: the app scans <code>PrivateMessage</code>{" "}
              events addressed to you and decrypts each payslip with your key.
            </li>
            <li>
              <strong>Withdraw</strong>: a withdraw proof converts eUSDC back to plain
              mUSDC. (Withdraw amounts are public by design — that's your off-ramp
              record.)
            </li>
          </ul>
          <h3>🕵️ Auditor</h3>
          <ul>
            <li>
              Every private transfer carries a <code>uint256[7]</code> Poseidon
              ciphertext (<em>AuditorPCT</em>) addressed to the auditor's public key.
            </li>
            <li>
              The console scans all <code>PrivateTransfer</code> events since
              deployment, decrypts each AuditorPCT, and exports CSV. Rows encrypted to
              a <em>previous</em> auditor key (before a rotation) are skipped
              gracefully.
            </li>
            <li>
              The contract owner can rotate the auditor with{" "}
              <code>setAuditorPublicKey(address)</code> — we rotated ours post-deploy.
            </li>
          </ul>

          <h2 id="crypto">The cryptography</h2>
          <h3>Keys from one signature</h3>
          <p>
            Your wallet signs a fixed message; the signature's <code>r</code> component
            is ground through SHA-256 (<em>grindKey</em>) into a scalar seed, then
            Blake512-pruned (EdDSA-style) onto the BabyJubJub curve. The result: a
            deterministic key pair — same wallet, same keys, any device — with no new
            seed phrase to back up.
          </p>
          <h3>Three encryptions per salary</h3>
          <ul>
            <li>
              <strong>ElGamal (homomorphic)</strong> — the transfer amount is encrypted
              to both sender and receiver balance ciphertexts; the contract adds and
              subtracts ciphertexts without ever seeing plaintext.
            </li>
            <li>
              <strong>Poseidon PCT for the receiver</strong> — an exact-amount
              ciphertext so the employee can reconstruct their balance without brute
              force.
            </li>
            <li>
              <strong>Poseidon PCT for the auditor</strong> — the compliance channel.
            </li>
          </ul>
          <p>
            A Groth16 proof (proven in-browser via snarkjs against the protocol's
            production trusted-setup artifacts) ties it together: it proves the sender
            knows their key, their balance covers the amount, and all three
            encryptions encode the <em>same</em> value — without revealing it.
          </p>
          <h3>Encrypted payslips</h3>
          <p>
            The payslip JSON is chunked into 250-bit field elements and encrypted with
            Poseidon-ECDH to the employee's public key, then attached as{" "}
            <code>bytes</code> metadata on the same <code>transfer(...)</code> call.
            The employee's browser decrypts it from the <code>PrivateMessage</code>{" "}
            event. Nothing about the payslip touches any server.
          </p>

          <h2 id="contracts">Contracts & addresses (Avalanche Fuji, 43113)</h2>
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>EncryptedERC (converter)</td><td><A a={ADDR.eerc} /></td></tr>
              <tr><td>Registrar</td><td><A a={ADDR.registrar} /></td></tr>
              <tr><td>PayrollManager</td><td><A a={ADDR.payroll} /></td></tr>
              <tr><td>Mock USDC (open mint)</td><td><A a={ADDR.usdc} /></td></tr>
              <tr><td>Registration verifier</td><td><A a={ADDR.registrationVerifier} /></td></tr>
              <tr><td>Transfer verifier</td><td><A a={ADDR.transferVerifier} /></td></tr>
              <tr><td>Withdraw verifier</td><td><A a={ADDR.withdrawVerifier} /></td></tr>
            </tbody>
          </table>
          <p>
            The verifier set is the <strong>production trusted-setup</strong> set from
            the audited{" "}
            <a
              href="https://github.com/ava-labs/EncryptedERC"
              target="_blank"
              rel="noreferrer"
            >
              ava-labs/EncryptedERC
            </a>{" "}
            protocol — we verified the Groth16 verification-key constants match the
            shipped proving artifacts before deploying.
          </p>

          <h2 id="local">Run it locally</h2>
          <pre>{`# Node >= 22
git clone https://github.com/anukulpandey/veilpay && cd veilpay

# contracts + asserted end-to-end test
cd contracts && npm install --ignore-scripts && npx hardhat compile
npx hardhat node                                  # terminal 1
npx hardhat run scripts/deploy.ts    --network localhost   # terminal 2
npx hardhat run scripts/e2e-local.ts --network localhost   # full story, asserted

# frontend
cd ../web && npm install && npm run dev           # http://localhost:5173`}</pre>

          <h2 id="faq">FAQ</h2>
          <p><strong>Is it actually private?</strong><br />
            Amounts: yes — ElGamal ciphertexts + zk proofs, decryptable only by
            sender, receiver, and auditor. Graph metadata (who paid whom, when) is
            visible by design: that's what makes the auditor story and the org
            registry work. Hiding amounts is precisely what makes payroll viable.
          </p>
          <p><strong>What can the auditor see?</strong><br />
            Exact amounts, parties, and timestamps of every eERC operation — decrypted
            from ciphertexts addressed to the auditor key. The auditor never holds
            user keys and cannot move anyone's funds.
          </p>
          <p><strong>What if an employee loses their device?</strong><br />
            Keys re-derive from a wallet signature. Same wallet → same keys, on any
            device. Losing the wallet itself means losing the encrypted balance — the
            same rule as any self-custodial asset.
          </p>
          <p><strong>Why Avalanche / eERC?</strong><br />
            eERC is the only audited, standard-shaped encrypted token protocol with
            converter mode (wrap existing stablecoins) and built-in auditor
            compliance — and C-Chain fees make ~1M-gas encrypted transfers practical.
            The same stack deploys unchanged to a dedicated Avalanche L1 for
            enterprise isolation.
          </p>
          <p><strong>Is this production-ready?</strong><br />
            The protocol layer is audited upstream. VeilPay itself is a hackathon
            build on Fuji testnet — see security notes below.
          </p>

          <h2 id="security">Security notes</h2>
          <ul>
            <li>
              eERC contracts and circuits are audited upstream (Circom + Gnark audits,
              2025); we deploy them unmodified with the production verifier set.
            </li>
            <li>
              The demo identities bundled in the app are throwaway testnet keys, public
              by design so anyone can try the product.
            </li>
            <li>
              PayrollManager stores employer-chosen display labels; use pseudonyms if
              a roster itself is sensitive. A production build would encrypt labels to
              org members' keys via the same metadata channel.
            </li>
            <li>
              Withdraw amounts are public by protocol design — treat withdrawals as
              your public off-ramp events.
            </li>
          </ul>
        </main>
      </div>
      <Footer />
    </>
  );
}
