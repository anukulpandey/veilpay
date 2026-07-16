/**
 * VeilPay end-to-end payroll story with REAL Groth16 proofs against the
 * prebuilt trusted-setup artifacts + prod verifiers:
 *
 *   1. deploy stack (run scripts/deploy.ts first, or --network localhost here)
 *   2. employer + 2 employees register (signature-derived keys, SDK-identical)
 *   3. employer shields 50,000 mUSDC -> eUSDC (deposit)
 *   4. payroll run: encrypted transfers w/ encrypted payslip metadata
 *   5. employees decrypt balances + payslips; withdraw to plain mUSDC
 *   6. auditor decrypts every transfer amount from AuditorPCT
 *
 * If every assert passes, the identical flow works on Fuji.
 * Usage: npx hardhat run scripts/e2e-local.ts --network localhost
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";
import { encryptMetadata } from "../src/metadata";
import {
	EercUser,
	registrationProof,
	amountPCT,
	transferProof,
	withdrawProof,
	decryptBalance,
	decryptPCT,
	decryptPayslip,
} from "./lib/eerc-client";

const eercBalance = async (
	eerc: any,
	user: EercUser,
	token: string,
): Promise<{ plain: bigint; egct: bigint[] }> => {
	const [eGCT, , amountPCTs, balancePCT] = await eerc.getBalanceFromTokenAddress(
		user.address,
		token,
	);
	const plain = decryptBalance(
		user.formattedPrivateKey,
		balancePCT.map((x: bigint) => BigInt(x)),
		amountPCTs.map((a: any) => ({ pct: a.pct.map((x: bigint) => BigInt(x)) })),
	);
	const egct = [eGCT.c1.x, eGCT.c1.y, eGCT.c2.x, eGCT.c2.y].map((x: bigint) =>
		BigInt(x),
	);
	return { plain, egct };
};

const main = async () => {
	const chainId = (await ethers.provider.getNetwork()).chainId;
	const dep = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, "..", "deployments", `${network.name}.json`),
			"utf8",
		),
	);
	const C = dep.contracts;
	const [deployer, employerS, aliceS, bobS] = await ethers.getSigners();

	const registrar = await ethers.getContractAt("Registrar", C.registrar);
	const eerc = await ethers.getContractAt("EncryptedERC", C.encryptedERC, deployer);
	const usdc = await ethers.getContractAt("SimpleERC20", C.mockUSDC);
	const payroll = await ethers.getContractAt("PayrollManager", C.payrollManager);

	// --- registration (auditor/deployer already registered by deploy.ts) ---
	const auditor = await new EercUser(deployer).init();
	const employer = await new EercUser(employerS).init();
	const alice = await new EercUser(aliceS).init();
	const bob = await new EercUser(bobS).init();
	for (const [name, u, signer] of [
		["employer", employer, employerS],
		["alice", alice, aliceS],
		["bob", bob, bobS],
	] as const) {
		const proof = await registrationProof(u, chainId);
		await (await registrar.connect(signer).register(proof)).wait();
		assert(await registrar.isUserRegistered(u.address), `${name} not registered`);
		console.log(`registered ${name} ${u.address}`);
	}
	const auditorPub = (await eerc.auditorPublicKey()) as unknown as [bigint, bigint];
	const auditorPublicKey = [BigInt(auditorPub[0]), BigInt(auditorPub[1])];
	assert.deepEqual(auditorPublicKey, auditor.publicKey, "auditor key mismatch");

	// --- employer shields treasury: 50,000 mUSDC (6 dec) -> eUSDC (2 dec) ---
	const depositAmount = 50_000_000000n; // 50k mUSDC, 6 decimals
	await (await usdc.mint(employer.address, depositAmount)).wait();
	await (await usdc.connect(employerS).approve(eerc.target, depositAmount)).wait();
	// amountPCT commits the deposited amount under the depositor's own key,
	// in eERC decimals (2): 50,000.00 -> 5_000_000
	const depositEercUnits = 5_000_000n;
	await (
		await eerc
			.connect(employerS)
			["deposit(uint256,address,uint256[7])"](
				depositAmount,
				usdc.target,
				amountPCT(employer.publicKey, depositEercUnits) as any,
			)
	).wait();
	let empBal = await eercBalance(eerc, employer, usdc.target as string);
	console.log(`employer shielded balance: ${empBal.plain} (expect ${depositEercUnits})`);
	assert.equal(empBal.plain, depositEercUnits, "deposit balance mismatch");

	// --- payroll setup ---
	await (await payroll.connect(employerS).createOrg("Acme India Pvt Ltd")).wait();
	await (await payroll.connect(employerS).addEmployee(0, alice.address, "Alice - Sr Engineer")).wait();
	await (await payroll.connect(employerS).addEmployee(0, bob.address, "Bob - Designer")).wait();

	// --- payroll run: encrypted transfers with encrypted payslips ---
	const tokenId = await eerc.tokenIds(usdc.target);
	const salaries: [EercUser, bigint, string][] = [
		[alice, 250_000n, "Acme payslip 2026-07: gross 2500.00 eUSDC"], // 2500.00
		[bob, 180_000n, "Acme payslip 2026-07: gross 1800.00 eUSDC"], // 1800.00
	];
	let senderBalance = depositEercUnits;
	for (const [emp, amount, payslip] of salaries) {
		empBal = await eercBalance(eerc, employer, usdc.target as string);
		assert.equal(empBal.plain, senderBalance, "sender balance drift");
		const { proof, senderBalancePCT } = await transferProof(
			employer,
			senderBalance,
			empBal.egct,
			emp.publicKey,
			amount,
			auditorPublicKey,
		);
		const message = encryptMetadata(emp.publicKey, payslip);
		await (
			await eerc
				.connect(employerS)
				["transfer(address,uint256,((uint256[2],uint256[2][2],uint256[2]),uint256[32]),uint256[7],bytes)"](
					emp.address,
					tokenId,
					proof as any,
					senderBalancePCT as any,
					message,
				)
		).wait();
		senderBalance -= amount;
		console.log(`paid ${amount} eUSDC-cents to ${emp.address}`);
	}
	await (await payroll.connect(employerS).logPayrollRun(0, 2, "2026-07 salaries")).wait();

	// --- employees decrypt balances + payslips ---
	const aliceBal = await eercBalance(eerc, alice, usdc.target as string);
	const bobBal = await eercBalance(eerc, bob, usdc.target as string);
	console.log(`alice decrypted balance: ${aliceBal.plain} (expect 250000)`);
	console.log(`bob   decrypted balance: ${bobBal.plain} (expect 180000)`);
	assert.equal(aliceBal.plain, 250_000n);
	assert.equal(bobBal.plain, 180_000n);

	// payslips from PrivateMessage events
	const msgEvents = await eerc.queryFilter(eerc.filters.PrivateMessage(), 0);
	const aliceMsgs = msgEvents.filter(
		(e: any) => e.args.metadata.messageTo.toLowerCase() === alice.address.toLowerCase(),
	);
	assert(aliceMsgs.length >= 1, "no payslip message for alice");
	const slip = decryptPayslip(
		alice.formattedPrivateKey,
		(aliceMsgs.at(-1) as any).args.metadata.encryptedMsg,
	);
	console.log(`alice decrypted payslip: "${slip}"`);
	assert.equal(slip, salaries[0][2]);

	// employer balance reduced
	empBal = await eercBalance(eerc, employer, usdc.target as string);
	assert.equal(empBal.plain, depositEercUnits - 250_000n - 180_000n);

	// --- alice withdraws 1000.00 eUSDC to plain mUSDC ---
	const withdrawUnits = 100_000n; // 1000.00 in 2-dec units
	const { proof: wProof, userBalancePCT } = await withdrawProof(
		alice,
		aliceBal.plain,
		aliceBal.egct,
		withdrawUnits,
		auditorPublicKey,
	);
	const before = await usdc.balanceOf(alice.address);
	await (
		await eerc
			.connect(aliceS)
			["withdraw(uint256,((uint256[2],uint256[2][2],uint256[2]),uint256[16]),uint256[7])"](
				tokenId,
				wProof as any,
				userBalancePCT as any,
			)
	).wait();
	const gained = (await usdc.balanceOf(alice.address)) - before;
	console.log(`alice withdrew: ${gained} mUSDC base units (expect 1000000000)`);
	assert.equal(gained, 1_000_000000n); // 1000.00 mUSDC in 6 decimals

	// --- auditor decrypts every transfer from AuditorPCT ---
	const transfers = await eerc.queryFilter(eerc.filters.PrivateTransfer(), 0);
	console.log("auditor view of private transfers:");
	for (const ev of transfers) {
		const pct = (ev as any).args.auditorPCT.map((x: bigint) => BigInt(x));
		const amount = decryptPCT(auditor.formattedPrivateKey, pct)[0];
		console.log(
			`  ${(ev as any).args.from} -> ${(ev as any).args.to}: ${amount} (decrypted by auditor)`,
		);
	}
	const decryptedAmounts = transfers.map(
		(ev) =>
			decryptPCT(
				auditor.formattedPrivateKey,
				(ev as any).args.auditorPCT.map((x: bigint) => BigInt(x)),
			)[0],
	);
	assert.deepEqual(decryptedAmounts, [250_000n, 180_000n]);

	console.log("\nE2E PASS: register -> shield -> encrypted payroll -> payslip decrypt -> withdraw -> audit all verified");
	process.exit(0);
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
