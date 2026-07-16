/**
 * VeilPay full deployment:
 *   prod verifiers (match circom/build zkeys) -> BabyJubJub -> Registrar ->
 *   EncryptedERC (converter mode) -> Mock USDC -> PayrollManager,
 * then registers the deployer as the eERC auditor using the same
 * signature-derived key the browser SDK would derive.
 *
 * Usage: npx hardhat run scripts/deploy.ts --network fuji|localhost
 */
import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";
import { DECIMALS } from "./constants";
import { EercUser, registrationProof } from "./lib/eerc-client";

const main = async () => {
	const [deployer] = await ethers.getSigners();
	const chainId = (await ethers.provider.getNetwork()).chainId;
	console.log(`network=${network.name} chainId=${chainId} deployer=${deployer.address}`);
	console.log(`balance=${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} AVAX`);

	// 1. prod verifiers (trusted-setup set matching circom/build zkeys)
	const verifierNames = [
		"RegistrationVerifier",
		"MintVerifier",
		"WithdrawVerifier",
		"TransferVerifier",
		"BurnVerifier",
	] as const;
	const verifiers: Record<string, string> = {};
	for (const name of verifierNames) {
		const f = await ethers.getContractFactory(`contracts/prod/${name}.sol:${name}`);
		const c = await f.deploy();
		await c.waitForDeployment();
		verifiers[name] = c.target.toString();
		console.log(`${name}: ${c.target}`);
	}

	// 2. BabyJubJub library
	const babyJubJub = await (await ethers.getContractFactory("BabyJubJub")).deploy();
	await babyJubJub.waitForDeployment();
	console.log(`BabyJubJub: ${babyJubJub.target}`);

	// 3. Registrar
	const registrar = await (
		await ethers.getContractFactory("Registrar")
	).deploy(verifiers.RegistrationVerifier);
	await registrar.waitForDeployment();
	console.log(`Registrar: ${registrar.target}`);

	// 4. EncryptedERC in converter mode
	const eercFactory = await ethers.getContractFactory("EncryptedERC", {
		libraries: {
			"contracts/libraries/BabyJubJub.sol:BabyJubJub": babyJubJub.target,
		},
	});
	const eerc = await eercFactory.deploy({
		registrar: registrar.target,
		isConverter: true,
		name: "",
		symbol: "",
		mintVerifier: verifiers.MintVerifier,
		withdrawVerifier: verifiers.WithdrawVerifier,
		transferVerifier: verifiers.TransferVerifier,
		burnVerifier: verifiers.BurnVerifier,
		decimals: DECIMALS,
	});
	await eerc.waitForDeployment();
	console.log(`EncryptedERC (converter): ${eerc.target}`);

	// 5. Mock USDC (6 decimals, open mint = demo faucet)
	const usdc = await (
		await ethers.getContractFactory("SimpleERC20")
	).deploy("VeilPay Mock USDC", "mUSDC", 6);
	await usdc.waitForDeployment();
	await (await usdc.mint(deployer.address, 1_000_000_000_000n)).wait(); // 1M mUSDC
	console.log(`Mock USDC: ${usdc.target}`);

	// 6. PayrollManager
	const payroll = await (await ethers.getContractFactory("PayrollManager")).deploy();
	await payroll.waitForDeployment();
	console.log(`PayrollManager: ${payroll.target}`);

	// 7. register deployer as eERC user + set as auditor
	const auditor = await new EercUser(deployer).init();
	const proof = await registrationProof(auditor, chainId);
	await (await registrar.register(proof)).wait();
	await (await eerc.setAuditorPublicKey(deployer.address)).wait();
	console.log(`auditor registered + set: ${deployer.address}`);

	const out = {
		network: network.name,
		chainId: chainId.toString(),
		deployer: deployer.address,
		auditor: deployer.address,
		startBlock: await ethers.provider.getBlockNumber(),
		contracts: {
			registrationVerifier: verifiers.RegistrationVerifier,
			mintVerifier: verifiers.MintVerifier,
			withdrawVerifier: verifiers.WithdrawVerifier,
			transferVerifier: verifiers.TransferVerifier,
			burnVerifier: verifiers.BurnVerifier,
			babyJubJub: babyJubJub.target.toString(),
			registrar: registrar.target.toString(),
			encryptedERC: eerc.target.toString(),
			mockUSDC: usdc.target.toString(),
			payrollManager: payroll.target.toString(),
		},
	};
	const dir = path.join(__dirname, "..", "deployments");
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, `${network.name}.json`),
		JSON.stringify(out, null, 2),
	);
	console.table(out.contracts);
	console.log(`written to deployments/${network.name}.json`);
	process.exit(0); // snarkjs leaves worker threads open
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
