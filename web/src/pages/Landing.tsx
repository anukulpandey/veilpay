import { Footer, Nav } from "../router";

const STEPS = [
  {
    icon: "🏦",
    title: "Shield your treasury",
    body: "Deposit a stablecoin into the eERC converter and receive encrypted eUSDC. From this moment, your balance is ciphertext on-chain.",
  },
  {
    icon: "🔏",
    title: "Pay with zero-knowledge proofs",
    body: "Each salary generates a Groth16 proof in your browser — proving the funds exist without revealing them. The amount is encrypted for you, the employee, and the auditor in one transaction.",
  },
  {
    icon: "🧾",
    title: "Payslips ride inside the payment",
    body: "Org, period, and gross amount travel as encrypted metadata inside the same transaction. No side-channel servers, no email attachments — the payslip IS on-chain, and only the employee can read it.",
  },
  {
    icon: "🕵️",
    title: "Auditors decrypt, others can't",
    body: "A designated, rotatable auditor key decrypts every amount across full history and exports CSV — without touching any employee's keys. Compliance without surveillance.",
  },
];

const FEATURES = [
  {
    icon: "🙈",
    title: "Amounts are invisible",
    body: "ElGamal encryption over BabyJubJub + zk-SNARKs. Snowtrace shows a payment happened — never how much.",
  },
  {
    icon: "🔑",
    title: "One signature, no new seed",
    body: "Your encryption keys derive deterministically from a single wallet signature. Same wallet, same keys, any device.",
  },
  {
    icon: "🧾",
    title: "Encrypted on-chain payslips",
    body: "Poseidon-ECDH encrypted metadata inside the salary transaction. The employee's browser decrypts it locally.",
  },
  {
    icon: "⚖️",
    title: "Compliance built in",
    body: "Every payment carries a ciphertext addressed to the auditor's rotatable public key. Full-history decryption + CSV export.",
  },
  {
    icon: "🤲",
    title: "Fully self-custodial",
    body: "No mixers, no relayers, no custodians. Balances stay yours; exit to the plain stablecoin any time with one proof.",
  },
  {
    icon: "🧩",
    title: "Composable org registry",
    body: "PayrollManager keeps rosters and run history on-chain — and never sees a single amount. Salaries exist only as eERC ciphertexts.",
  },
];

const AUDIENCES = [
  {
    icon: "🚀",
    title: "Web3-native startups",
    body: "Pay your team in stablecoins without publishing the comp ladder to every competitor and colleague.",
  },
  {
    icon: "🏛️",
    title: "DAOs & contributor collectives",
    body: "Transparent treasuries don't have to mean transparent salaries. Keep governance open and comp private.",
  },
  {
    icon: "🌏",
    title: "Agencies & global contractors",
    body: "Cross-border payouts with per-contractor confidentiality — and an audit trail your accountant can actually use.",
  },
];

export function Landing() {
  return (
    <>
      <Nav route="landing" />
      <div className="hero">
        <h2>
          Payroll on-chain, <span className="grad">salaries invisible.</span>
        </h2>
        <p>
          VeilPay pays your team in an encrypted stablecoin on Avalanche. Amounts are
          sealed with zk-SNARKs + ElGamal encryption — yet a designated auditor can
          still decrypt for compliance. Private for the world, provable for the
          regulator.
        </p>
        <div className="hero-badges">
          <span className="pill">eERC encrypted token standard</span>
          <span className="pill">Groth16 proofs in your browser</span>
          <span className="pill">Auditor-ready compliance</span>
          <span className="pill ok">
            <span className="dot" /> Live on Avalanche Fuji
          </span>
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 10 }}>
          <a href="#/app">
            <button>Launch App →</button>
          </a>
          <a href="#/docs">
            <button className="ghost">Read the docs</button>
          </a>
        </div>
        <div className="compare">
          <div className="box bad">
            <div className="t">❌ Payroll with normal ERC-20</div>
            transfer(alice, <b>2,500.00 USDC</b>)<br />
            transfer(bob, &nbsp;&nbsp;<b>1,800.00 USDC</b>)<br />
            → everyone's salary is public, forever
          </div>
          <div className="box good">
            <div className="t">✅ Payroll with VeilPay (eERC)</div>
            transfer(alice, <b>0x1f3a…e9c2 🔒</b>)<br />
            transfer(bob, &nbsp;&nbsp;<b>0x8d41…77b0 🔒</b>)<br />
            → only employee + auditor can decrypt
          </div>
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">How it works</h2>
        <p className="section-sub">
          Four encrypted moments, one payroll run. Everything happens on the C-Chain —
          no off-chain services hold your data.
        </p>
        <div className="grid4">
          {STEPS.map((s, i) => (
            <div className="card step" key={s.title}>
              <div className="step-icon">{s.icon}</div>
              <div className="step-n">STEP {i + 1}</div>
              <h3>{s.title}</h3>
              <p className="sub" style={{ marginBottom: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Why teams choose VeilPay</h2>
        <div className="grid3">
          {FEATURES.map((f) => (
            <div className="card" key={f.title}>
              <h3>
                <span className="feat-icon">{f.icon}</span> {f.title}
              </h3>
              <p className="sub" style={{ marginBottom: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Built for</h2>
        <div className="grid3">
          {AUDIENCES.map((a) => (
            <div className="card" key={a.title}>
              <h3>
                <span className="feat-icon">{a.icon}</span> {a.title}
              </h3>
              <p className="sub" style={{ marginBottom: 0 }}>{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="card proof-strip">
          <h3>🧪 Don't trust — verify</h3>
          <p className="sub">
            VeilPay is live on Avalanche Fuji. Here are two real payroll transactions.
            Open them on Snowtrace and try to find the salary — you can't. The
            employees decrypted 2,500.00 and 1,800.00 eUSDC; you see ciphertext.
          </p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <a
              className="pill mono"
              href="https://testnet.snowtrace.io/tx/0xa8947a8be30a166def3b625557a2aeded3f479588a84467474f8b0964f6d9994"
              target="_blank"
              rel="noreferrer"
            >
              salary tx → 0xa894…9994 ↗
            </a>
            <a
              className="pill mono"
              href="https://testnet.snowtrace.io/tx/0xac99f555228fa7debf2978b53e0d1facc4ee2b2481d2adf7e7d998f1848cd31f"
              target="_blank"
              rel="noreferrer"
            >
              salary tx → 0xac99…d31f ↗
            </a>
            <a
              className="pill mono"
              href="https://testnet.snowtrace.io/address/0xCB9aB1F20d1d5Cf990694e60470FB28B23041D1b"
              target="_blank"
              rel="noreferrer"
            >
              eERC contract ↗
            </a>
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: "center" }}>
        <h2 className="section-title">Try every role in 60 seconds</h2>
        <p className="section-sub" style={{ margin: "0 auto 22px" }}>
          One-click demo identities — Employer, Employee, Auditor — no wallet
          extension, no faucets, no setup. Real zk proofs on a real network.
        </p>
        <a href="#/app">
          <button style={{ fontSize: 16, padding: "13px 26px" }}>
            Launch the app →
          </button>
        </a>
      </section>

      <Footer />
    </>
  );
}
