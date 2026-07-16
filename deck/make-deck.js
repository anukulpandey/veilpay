/* VeilPay pitch deck generator */
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaLock, FaLockOpen, FaBuilding, FaUserCheck, FaShieldAlt, FaFileInvoiceDollar,
  FaKey, FaRocket, FaEyeSlash, FaBalanceScale, FaCubes, FaBolt,
} = require("react-icons/fa");

// palette
const BG = "0B1120";
const BG2 = "111A2E";
const CARD = "18233B";
const TEXT = "E8ECF4";
const MUTED = "8B93A7";
const RED = "E84142";
const VIOLET = "7C5CFF";
const GREEN = "2FD48F";
const AMBER = "FFC555";

const iconPng = async (Icon, color, size = 256) => {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Icon, { color: `#${color}`, size }),
  );
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
};

(async () => {
  const icons = {};
  for (const [k, [I, c]] of Object.entries({
    lock: [FaLock, TEXT],
    lockRed: [FaLock, RED],
    lockViolet: [FaLock, VIOLET],
    open: [FaLockOpen, RED],
    building: [FaBuilding, VIOLET],
    userCheck: [FaUserCheck, GREEN],
    shield: [FaShieldAlt, GREEN],
    invoice: [FaFileInvoiceDollar, AMBER],
    key: [FaKey, AMBER],
    rocket: [FaRocket, RED],
    eyeSlash: [FaEyeSlash, VIOLET],
    scale: [FaBalanceScale, GREEN],
    cubes: [FaCubes, VIOLET],
    bolt: [FaBolt, AMBER],
  })) {
    icons[k] = await iconPng(I, c);
  }

  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

  const W = 13.33;
  const H = 7.5;

  const base = (slide, bg = BG) => {
    slide.background = { color: bg };
  };

  const circleIcon = (slide, icon, x, y, d = 0.62, fill = CARD) => {
    slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill } });
    const pad = d * 0.26;
    slide.addImage({ data: icon, x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
  };

  // ---------- 1. TITLE ----------
  let s = pres.addSlide();
  base(s);
  circleIcon(s, icons.lockViolet, W / 2 - 0.55, 1.15, 1.1, BG2);
  s.addText("VeilPay", {
    x: 0, y: 2.35, w: W, h: 1.3, align: "center",
    fontSize: 66, bold: true, color: TEXT, fontFace: "Arial",
  });
  s.addText([
    { text: "Payroll on-chain, ", options: { color: TEXT } },
    { text: "salaries invisible.", options: { color: RED } },
  ], {
    x: 0, y: 3.6, w: W, h: 0.7, align: "center", fontSize: 28, bold: true, fontFace: "Arial",
  });
  s.addText(
    "Confidential payroll & auditor-ready treasury on Avalanche eERC",
    { x: 0, y: 4.35, w: W, h: 0.5, align: "center", fontSize: 16, color: MUTED, fontFace: "Arial" },
  );
  s.addText(
    "Team1 India Speedrun — Privacy on Avalanche · July 2026 · built on Fuji",
    { x: 0, y: 6.6, w: W, h: 0.4, align: "center", fontSize: 12, color: MUTED, fontFace: "Arial" },
  );

  // ---------- 2. PROBLEM ----------
  s = pres.addSlide();
  base(s);
  s.addText("Payroll wants to be on-chain. Privacy says no.", {
    x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 34, bold: true, color: TEXT, fontFace: "Arial",
  });
  s.addText(
    "Instant, borderless, programmable payments are perfect for payroll — except a normal token transfer publishes every salary, forever.",
    { x: 0.6, y: 1.35, w: 11.5, h: 0.6, fontSize: 15, color: MUTED, fontFace: "Arial" },
  );
  // plaintext leak card
  s.addShape("roundRect", { x: 0.6, y: 2.2, w: 6.0, h: 2.9, fill: { color: "2A1518" }, rectRadius: 0.12 });
  circleIcon(s, icons.open, 0.9, 2.5);
  s.addText("What Snowtrace shows today", {
    x: 1.65, y: 2.5, w: 4.6, h: 0.6, fontSize: 15, bold: true, color: RED, fontFace: "Arial",
  });
  s.addText(
    "transfer(alice, 2,500.00 USDC)\ntransfer(bob,   1,800.00 USDC)\ntransfer(carol, 4,100.00 USDC)",
    { x: 1.0, y: 3.3, w: 5.3, h: 1.1, fontSize: 14, color: TEXT, fontFace: "Courier New" },
  );
  s.addText("Every colleague, competitor and stranger reads your comp. The use case dies here.", {
    x: 1.0, y: 4.4, w: 5.3, h: 0.6, fontSize: 12, italic: true, color: MUTED, fontFace: "Arial",
  });
  // the dilemma card
  s.addShape("roundRect", { x: 6.9, y: 2.2, w: 5.8, h: 2.9, fill: { color: CARD }, rectRadius: 0.12 });
  circleIcon(s, icons.scale, 7.2, 2.5);
  s.addText("…and the obvious fixes fail", {
    x: 7.95, y: 2.5, w: 4.5, h: 0.6, fontSize: 15, bold: true, color: TEXT, fontFace: "Arial",
  });
  s.addText([
    { text: "Off-chain payroll: ", options: { bold: true, color: TEXT } },
    { text: "gives up everything crypto rails offer.", options: { color: MUTED, breakLine: true } },
    { text: "Mixer-style privacy: ", options: { bold: true, color: TEXT } },
    { text: "auditors & tax authorities get nothing — a non-starter for any registered business.", options: { color: MUTED } },
  ], { x: 7.3, y: 3.25, w: 5.1, h: 1.6, fontSize: 13.5, fontFace: "Arial", paraSpaceAfter: 10 });
  s.addText([
    { text: "The gap: ", options: { bold: true, color: AMBER } },
    { text: "privacy that a real, compliant company can actually adopt.", options: { color: TEXT } },
  ], { x: 0.6, y: 5.6, w: 11.5, h: 0.6, fontSize: 18, fontFace: "Arial" });

  // ---------- 3. SOLUTION ----------
  s = pres.addSlide();
  base(s);
  s.addText("VeilPay: encrypted payroll with a compliance master key", {
    x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 32, bold: true, color: TEXT, fontFace: "Arial",
  });
  s.addText(
    "Built on eERC — Avalanche's encrypted token standard (zk-SNARKs + ElGamal homomorphic encryption, fully on-chain, no relayers).",
    { x: 0.6, y: 1.3, w: 12, h: 0.5, fontSize: 15, color: MUTED, fontFace: "Arial" },
  );
  const rows = [
    [
      { text: "", options: {} },
      { text: "Normal ERC-20", options: { bold: true, color: MUTED } },
      { text: "Mixer privacy", options: { bold: true, color: MUTED } },
      { text: "VeilPay (eERC)", options: { bold: true, color: GREEN } },
    ],
    ["Salary amounts hidden", "✗", "✓", "✓  ElGamal + Groth16"],
    ["Auditor can decrypt", "—", "✗", "✓  rotatable auditor key"],
    ["Self-custody, no mixer", "✓", "✗", "✓  balances stay yours"],
    ["Payslips", "off-chain", "✗", "✓  encrypted, inside the payment tx"],
    ["Exit to plain stablecoin", "✓", "risky", "✓  converter deposit / withdraw"],
  ].map((r, i) =>
    r.map((c, j) => {
      const t = typeof c === "string" ? c : c.text;
      const o = typeof c === "string" ? {} : c.options;
      return {
        text: t,
        options: {
          fontFace: "Arial",
          fontSize: i === 0 ? 14 : 13.5,
          color: o.color || (t.startsWith("✓") ? GREEN : t === "✗" ? RED : j === 0 ? TEXT : MUTED),
          bold: o.bold || j === 0,
          fill: { color: i === 0 ? BG2 : i % 2 ? CARD : BG2 },
          align: j === 0 ? "left" : "center",
          valign: "middle",
        },
      };
    }),
  );
  s.addTable(rows, {
    x: 0.6, y: 2.05, w: 12.1, colW: [3.6, 2.5, 2.5, 3.5],
    border: { type: "solid", color: BG, pt: 1 },
    rowH: 0.62,
  });
  s.addText([
    { text: "Private for the world. ", options: { color: VIOLET, bold: true } },
    { text: "Provable for the regulator.", options: { color: GREEN, bold: true } },
  ], { x: 0.6, y: 6.3, w: 12, h: 0.6, fontSize: 20, align: "center", fontFace: "Arial" });

  // ---------- 4. HOW IT WORKS ----------
  s = pres.addSlide();
  base(s);
  s.addText("One payroll run, four encrypted moments", {
    x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 34, bold: true, color: TEXT, fontFace: "Arial",
  });
  const steps = [
    [icons.building, "1 · Shield treasury", "Employer deposits mUSDC into the eERC converter → encrypted eUSDC balance. Public sees ciphertext only."],
    [icons.lockViolet, "2 · Pay with proofs", "Browser generates a Groth16 proof per employee. One tx encrypts the amount 3 ways — sender, employee, auditor — and carries an encrypted payslip."],
    [icons.key, "3 · Employee decrypts", "Key derived from one wallet signature. Balance + payslips decrypt locally; withdraw back to plain mUSDC anytime."],
    [icons.shield, "4 · Auditor audits", "Auditor decrypts every amount from its dedicated ciphertext across full history. CSV export for filings. No user keys needed."],
  ];
  steps.forEach(([icon, title, body], i) => {
    const x = 0.6 + i * 3.13;
    s.addShape("roundRect", { x, y: 1.7, w: 2.9, h: 4.0, fill: { color: CARD }, rectRadius: 0.1 });
    circleIcon(s, icon, x + 0.25, 2.0, 0.66, BG2);
    s.addText(title, { x: x + 0.2, y: 2.85, w: 2.5, h: 0.5, fontSize: 16, bold: true, color: TEXT, fontFace: "Arial" });
    s.addText(body, { x: x + 0.2, y: 3.4, w: 2.5, h: 2.1, fontSize: 12, color: MUTED, fontFace: "Arial" });
    if (i < 3) {
      s.addText("→", { x: x + 2.86, y: 3.3, w: 0.4, h: 0.5, fontSize: 22, color: VIOLET, bold: true, align: "center" });
    }
  });
  s.addText(
    "tx on Snowtrace:  from 0x7099…  to 0x3C44…  amount: 🔒 0x1f3a9e…c2  payslip: 🔒 0x8d41…77b0",
    { x: 0.6, y: 6.1, w: 12.1, h: 0.5, fontSize: 13, color: MUTED, fontFace: "Courier New", align: "center" },
  );

  // ---------- 5. LIVE ON FUJI ----------
  s = pres.addSlide();
  base(s);
  s.addText("Everything you'll see is live", {
    x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 34, bold: true, color: TEXT, fontFace: "Arial",
  });
  const demo = [
    [icons.rocket, "Deployed on Avalanche Fuji", "Audited eERC contracts (converter mode) + production trusted-setup verifiers + PayrollManager. Addresses in the repo."],
    [icons.bolt, "Proofs in the browser, live", "Registration ~1.1s, transfers in seconds — snarkjs Groth16 against self-hosted wasm/zkey artifacts."],
    [icons.userCheck, "One-click demo roles", "Custom wagmi connector wraps demo identities — judges switch Employer → Alice → Bob → Auditor instantly. No extension, no seed phrases."],
    [icons.invoice, "Asserted end-to-end test", "scripts/e2e-local.ts replays the entire story — register, shield 50k, encrypted payroll, payslip decrypt, withdraw, audit — with hard asserts."],
  ];
  demo.forEach(([icon, title, body], i) => {
    const x = 0.6 + (i % 2) * 6.2;
    const y = 1.75 + Math.floor(i / 2) * 2.5;
    s.addShape("roundRect", { x, y, w: 5.9, h: 2.2, fill: { color: CARD }, rectRadius: 0.1 });
    circleIcon(s, icon, x + 0.25, y + 0.3, 0.62, BG2);
    s.addText(title, { x: x + 1.05, y: y + 0.28, w: 4.6, h: 0.5, fontSize: 16, bold: true, color: TEXT, fontFace: "Arial" });
    s.addText(body, { x: x + 1.05, y: y + 0.85, w: 4.6, h: 1.25, fontSize: 12.5, color: MUTED, fontFace: "Arial" });
  });
  s.addText("Demo flow: pay two salaries → open the tx (nothing readable) → Alice reveals balance + payslip → auditor decrypts everything → CSV.", {
    x: 0.6, y: 6.6, w: 12.1, h: 0.5, fontSize: 13, italic: true, color: AMBER, fontFace: "Arial", align: "center",
  });

  // ---------- 6. TECH DEPTH ----------
  s = pres.addSlide();
  base(s);
  s.addText("Under the hood (the parts we built)", {
    x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 34, bold: true, color: TEXT, fontFace: "Arial",
  });
  const tech = [
    [icons.cubes, "Verifier ↔ zkey forensics", "Matched the production trusted-setup verifier set to the shipped zkeys by comparing Groth16 vkey constants (delta/IC points) before deploying — proofs verify on-chain, first try."],
    [icons.key, "SDK-exact key derivation in Node", "Reimplemented grindKey → Blake512 pruning bit-for-bit, so deploy scripts, e2e tests and the browser SDK derive identical keys from one wallet signature. Verified by cross-decryption."],
    [icons.invoice, "Encrypted payslips on-chain", "Poseidon-ECDH metadata channel inside the salary tx: org, period, gross — decryptable only by the employee. No side-channel server."],
    [icons.eyeSlash, "Full-history auditor console", "Client-side PCT decryption (@zk-kit): scans from deploy block, survives auditor key rotation (we rotate post-deploy), exports CSV. The SDK's stock audit window is 1,000 blocks — ours is unlimited."],
  ];
  tech.forEach(([icon, title, body], i) => {
    const y = 1.6 + i * 1.32;
    circleIcon(s, icon, 0.7, y, 0.6, CARD);
    s.addText(title, { x: 1.55, y: y - 0.05, w: 4.1, h: 0.7, fontSize: 15.5, bold: true, color: TEXT, fontFace: "Arial", valign: "middle" });
    s.addText(body, { x: 5.8, y: y - 0.12, w: 6.9, h: 1.25, fontSize: 12.5, color: MUTED, fontFace: "Arial", valign: "middle" });
  });
  s.addText("Stack: EncryptedERC (audited) · @avalabs/eerc-sdk · snarkjs · wagmi/viem · Hardhat · React", {
    x: 0.6, y: 6.85, w: 12.1, h: 0.4, fontSize: 12, color: MUTED, fontFace: "Courier New", align: "center",
  });

  // ---------- 7. WHY IT WINS ----------
  s = pres.addSlide();
  base(s);
  s.addText("Mapped to the judging criteria", {
    x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 34, bold: true, color: TEXT, fontFace: "Arial",
  });
  const crit = [
    ["Value proposition", GREEN, "Payroll is the on-chain use case blocked only by privacy. VeilPay is the version of privacy a compliant business can adopt — India's crypto-salary startups and DAOs are the immediate market."],
    ["Technical complexity", VIOLET, "Browser Groth16 proving · three-layer amount encryption · encrypted metadata payslips · SDK-compatible crypto reimplemented in Node · rotation-aware full-history audit decryption."],
    ["Avalanche technology", RED, "eERC standard at the core (converter mode), official eERC SDK, production verifier set, deployed on Fuji C-Chain. PayrollManager composes with the standard — never around it."],
  ];
  crit.forEach(([title, color, body], i) => {
    const x = 0.6 + i * 4.25;
    s.addShape("roundRect", { x, y: 1.8, w: 3.95, h: 4.1, fill: { color: CARD }, rectRadius: 0.1 });
    s.addText(title, { x: x + 0.3, y: 2.1, w: 3.35, h: 0.6, fontSize: 18, bold: true, color, fontFace: "Arial" });
    s.addText(body, { x: x + 0.3, y: 2.8, w: 3.35, h: 2.9, fontSize: 13, color: TEXT, fontFace: "Arial" });
  });

  // ---------- 8. CLOSE ----------
  s = pres.addSlide();
  base(s);
  circleIcon(s, icons.lockViolet, W / 2 - 0.45, 1.3, 0.9, BG2);
  s.addText("Salaries were the last thing keeping payroll off-chain.", {
    x: 1, y: 2.5, w: W - 2, h: 0.8, align: "center", fontSize: 30, bold: true, color: TEXT, fontFace: "Arial",
  });
  s.addText("Now they're the only thing nobody can see.", {
    x: 1, y: 3.35, w: W - 2, h: 0.7, align: "center", fontSize: 24, color: RED, bold: true, fontFace: "Arial",
  });
  s.addText(
    "VeilPay · eERC confidential payroll on Avalanche Fuji\nGitHub repo + live demo + asserted e2e in the submission",
    { x: 1, y: 4.6, w: W - 2, h: 0.9, align: "center", fontSize: 15, color: MUTED, fontFace: "Arial" },
  );
  s.addText("🔏", { x: 0, y: 5.7, w: W, h: 0.6, align: "center", fontSize: 28 });

  await pres.writeFile({ fileName: "VeilPay-pitch.pptx" });
  console.log("deck written");
})();
