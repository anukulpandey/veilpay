
import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";
import { EercUser, registrationProof } from "./lib/eerc-client";

const main = async () => {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const keys = JSON.parse(fs.readFileSync(path.join(__dirname, "..", ".fuji-keys.json"), "utf8"));
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", network.name + ".json"), "utf8"));
  const registrar = await ethers.getContractAt("Registrar", dep.contracts.registrar);
  for (const label of ["alice", "bob"]) {
    const signer = new ethers.Wallet(keys[label].pk, ethers.provider);
    if (await registrar.isUserRegistered(signer.address)) { console.log(label, "already registered"); continue; }
    const u = await new EercUser(signer).init();
    const proof = await registrationProof(u, chainId);
    await (await registrar.connect(signer).register(proof)).wait();
    console.log("registered", label, signer.address);
  }
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exitCode = 1; });
