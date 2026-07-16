// Copies deployment addresses + ABIs from the contracts package into src/gen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const contracts = path.join(here, "..", "..", "contracts");
const gen = path.join(here, "..", "src", "gen");
fs.mkdirSync(gen, { recursive: true });

const deployments = {};
const depDir = path.join(contracts, "deployments");
if (fs.existsSync(depDir)) {
  for (const f of fs.readdirSync(depDir)) {
    if (f.endsWith(".json")) {
      const d = JSON.parse(fs.readFileSync(path.join(depDir, f), "utf8"));
      deployments[d.chainId] = d;
    }
  }
}
fs.writeFileSync(path.join(gen, "deployments.json"), JSON.stringify(deployments, null, 2));

// Fuji demo keys (public testnet demo identities), if generated
const demoFile = path.join(contracts, "deployments", "fuji-demo.json");
fs.writeFileSync(
  path.join(gen, "fuji-demo.json"),
  fs.existsSync(demoFile) ? fs.readFileSync(demoFile, "utf8") : "[]",
);

const abiOf = (rel) =>
  JSON.parse(
    fs.readFileSync(path.join(contracts, "artifacts", "contracts", rel), "utf8"),
  ).abi;

fs.writeFileSync(
  path.join(gen, "abis.json"),
  JSON.stringify(
    {
      PayrollManager: abiOf("payroll/PayrollManager.sol/PayrollManager.json"),
      EncryptedERC: abiOf("EncryptedERC.sol/EncryptedERC.json"),
      SimpleERC20: abiOf("tokens/SimpleERC20.sol/SimpleERC20.json"),
      Registrar: abiOf("Registrar.sol/Registrar.json"),
    },
    null,
    2,
  ),
);
// circuit artifacts (wasm/zkey) from the contracts repo -> public/circuits
const circuits = path.join(here, "..", "public", "circuits");
fs.mkdirSync(circuits, { recursive: true });
const build = path.join(contracts, "circom", "build");
const map = {
  "RegistrationCircuit.wasm": "registration/registration.wasm",
  "RegistrationCircuit.zkey": "registration/circuit_final.zkey",
  "TransferCircuit.wasm": "transfer/transfer.wasm",
  "TransferCircuit.zkey": "transfer/transfer.zkey",
  "WithdrawCircuit.wasm": "withdraw/withdraw.wasm",
  "WithdrawCircuit.zkey": "withdraw/circuit_final.zkey",
  "MintCircuit.wasm": "mint/mint.wasm",
  "MintCircuit.zkey": "mint/mint.zkey",
  "BurnCircuit.wasm": "burn/burn.wasm",
  "BurnCircuit.zkey": "burn/burn.zkey",
};
for (const [dst, src] of Object.entries(map)) {
  fs.copyFileSync(path.join(build, src), path.join(circuits, dst));
}

console.log("synced deployments:", Object.keys(deployments).join(", ") || "(none)");
console.log("synced circuit artifacts to public/circuits");
