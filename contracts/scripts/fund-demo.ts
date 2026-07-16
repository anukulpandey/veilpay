/**
 * Post-deploy Fuji setup:
 *   1. funds demo accounts (employer/alice/bob/auditor) with gas AVAX
 *   2. registers the demo auditor in eERC (Node-side proof)
 *   3. rotates the contract auditor to the demo auditor key
 *   4. writes deployments/fuji-demo.json for the frontend demo buttons
 *
 * Usage: npx hardhat run scripts/fund-demo.ts --network fuji
 */
import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";
import { EercUser, registrationProof } from "./lib/eerc-client";

const GAS_PER_ACCOUNT = ethers.parseEther("0.25");

const main = async () => {
	const [deployer] = await ethers.getSigners();
	const chainId = (await ethers.provider.getNetwork()).chainId;
	const keys = JSON.parse(
		fs.readFileSync(path.join(__dirname, "..", ".fuji-keys.json"), "utf8"),
	);
	const dep = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, "..", "deployments", `${network.name}.json`),
			"utf8",
		),
	);

	// 1. gas for demo accounts
	for (const label of ["employer", "alice", "bob", "auditor"]) {
		const to = keys[label].address;
		const bal = await ethers.provider.getBalance(to);
		if (bal < GAS_PER_ACCOUNT / 2n) {
			await (await deployer.sendTransaction({ to, value: GAS_PER_ACCOUNT })).wait();
			console.log(`funded ${label} ${to} with ${ethers.formatEther(GAS_PER_ACCOUNT)} AVAX`);
		}
	}

	// 2. register demo auditor
	const registrar = await ethers.getContractAt("Registrar", dep.contracts.registrar);
	const eerc = await ethers.getContractAt("EncryptedERC", dep.contracts.encryptedERC);
	const auditorSigner = new ethers.Wallet(keys.auditor.pk, ethers.provider);
	const auditor = await new EercUser(auditorSigner).init();
	if (!(await registrar.isUserRegistered(auditor.address))) {
		const proof = await registrationProof(auditor, chainId);
		await (await registrar.connect(auditorSigner).register(proof)).wait();
		console.log(`registered demo auditor ${auditor.address}`);
	}

	// 3. rotate contract auditor to demo auditor (rotatable auditor keys!)
	await (await eerc.connect(deployer).setAuditorPublicKey(auditor.address)).wait();
	console.log(`auditor rotated to ${auditor.address}`);

	// 4. demo keys file for the frontend
	const demo = [
		{ label: "Employer", role: "runs payroll", pk: keys.employer.pk },
		{ label: "Alice", role: "employee", pk: keys.alice.pk },
		{ label: "Bob", role: "employee", pk: keys.bob.pk },
		{ label: "Auditor", role: "compliance", pk: keys.auditor.pk },
	];
	fs.writeFileSync(
		path.join(__dirname, "..", "deployments", "fuji-demo.json"),
		JSON.stringify(demo, null, 2),
	);
	console.log("wrote deployments/fuji-demo.json");
	process.exit(0);
};

main().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
