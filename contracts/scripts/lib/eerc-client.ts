/**
 * Node-side eERC client: key derivation, proof generation, balance decryption.
 *
 * Key derivation replicates @avalabs/eerc-sdk (src/crypto/key.ts) bit-for-bit,
 * so a wallet that registers here derives the SAME decryption key the SDK
 * derives in the browser. Proofs are generated with snarkjs against the
 * prebuilt trusted-setup artifacts in circom/build (which match the
 * contracts/prod verifiers).
 */
import { createHash } from "node:crypto";
import path from "node:path";
import createBlakeHash from "blake-hash";
import { Base8, mulPointEscalar } from "@zk-kit/baby-jubjub";
import { poseidon3 } from "poseidon-lite";
import * as snarkjs from "snarkjs";
import type { Signer } from "ethers";
import { poseidonDecrypt } from "maci-crypto";
import { processPoseidonEncryption } from "../../src/poseidon";
import { encryptMessage } from "../../src/jub/jub";
import { int2str } from "../../src/metadata";

// ---- constants (verbatim from @avalabs/eerc-sdk src/utils/constants.ts) ----
export const SUB_GROUP_ORDER =
	2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const SHA_256_MAX_DIGEST =
	115792089237316195423570985008687907853269984665640564039457584007913129639936n;
export const REGISTER_MESSAGE = (user: string) =>
	`eERC\nRegistering user with\n Address:${user.toLowerCase()}`;

const BUILD = path.join(__dirname, "..", "..", "circom", "build");
export const CIRCUITS = {
	register: {
		wasm: path.join(BUILD, "registration", "registration.wasm"),
		zkey: path.join(BUILD, "registration", "circuit_final.zkey"),
	},
	transfer: {
		wasm: path.join(BUILD, "transfer", "transfer.wasm"),
		zkey: path.join(BUILD, "transfer", "transfer.zkey"),
	},
	withdraw: {
		wasm: path.join(BUILD, "withdraw", "withdraw.wasm"),
		zkey: path.join(BUILD, "withdraw", "circuit_final.zkey"),
	},
	mint: {
		wasm: path.join(BUILD, "mint", "mint.wasm"),
		zkey: path.join(BUILD, "mint", "mint.zkey"),
	},
} as const;

// ---- SDK-compatible key derivation ----

const hashKeyWithIndex = (keyHex: string, index: number): bigint => {
	// SDK: sha256(bytes(keyHex || sanitizeBytes(hex(index), 2)))
	let idx = index.toString(16);
	// pad to full bytes in 2-hex-char units, matching sanitizeBytes(str, 2)
	if (idx.length % 2 !== 0) idx = "0".repeat(2 - (idx.length % 2)) + idx;
	const buff = Buffer.from(keyHex + idx, "hex");
	return BigInt(`0x${createHash("sha256").update(buff).digest("hex")}`);
};

export const grindKey = (seedHex: string): string => {
	const limit = SUB_GROUP_ORDER;
	const maxAllowedValue = SHA_256_MAX_DIGEST - (SHA_256_MAX_DIGEST % limit);
	let i = 0;
	let key = hashKeyWithIndex(seedHex, i);
	i++;
	while (key >= maxAllowedValue) {
		key = hashKeyWithIndex(seedHex, i);
		i++;
		if (i > 1_000) throw new Error("Could not find a valid key");
	}
	return (key % limit).toString(16);
};

export const getPrivateKeyFromSignature = (signature: string): string => {
	const fixed = signature.replace(/^0x/, "");
	return grindKey(fixed.slice(0, 64));
};

/** SDK formatKeyForCurve: blake512 prune (EdDSA style) then >>3 mod subOrder */
export const formatKeyForCurve = (keyHex: string): bigint => {
	let hash: Buffer = createBlakeHash("blake512")
		.update(Buffer.from(keyHex, "hex"))
		.digest()
		.slice(0, 32);
	hash[0] &= 0xf8;
	hash[31] = (hash[31] & 0x7f) | 0x40;
	const le = BigInt(`0x${Buffer.from(hash).reverse().toString("hex")}`);
	return (le >> 3n) % SUB_GROUP_ORDER;
};

export class EercUser {
	signer: Signer;
	address = "";
	decryptionKey = ""; // hex, SDK-style
	formattedPrivateKey = 0n; // scalar on BabyJubJub
	publicKey: [bigint, bigint] = [0n, 0n];

	constructor(signer: Signer) {
		this.signer = signer;
	}

	/** Sign the SDK's fixed message and derive the eERC key pair. */
	async init(): Promise<this> {
		this.address = await this.signer.getAddress();
		const signature = await this.signer.signMessage(
			REGISTER_MESSAGE(this.address),
		);
		this.decryptionKey = getPrivateKeyFromSignature(signature);
		this.formattedPrivateKey = formatKeyForCurve(this.decryptionKey);
		const pk = mulPointEscalar(Base8, this.formattedPrivateKey);
		this.publicKey = [BigInt(pk[0]), BigInt(pk[1])];
		return this;
	}
}

// ---- proof helpers ----

type ProofCalldata = {
	proofPoints: { a: [string, string]; b: [[string, string], [string, string]]; c: [string, string] };
	publicSignals: string[];
};

const fullProve = async (
	input: Record<string, unknown>,
	circuit: { wasm: string; zkey: string },
): Promise<ProofCalldata> => {
	const { proof, publicSignals } = await snarkjs.groth16.fullProve(
		input,
		circuit.wasm,
		circuit.zkey,
	);
	const raw = JSON.parse(
		`[${await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)}]`,
	);
	return {
		proofPoints: { a: raw[0], b: raw[1], c: raw[2] },
		publicSignals: raw[3],
	};
};

export const registrationProof = async (user: EercUser, chainId: bigint) => {
	const registrationHash = poseidon3([
		chainId,
		user.formattedPrivateKey,
		BigInt(user.address),
	]);
	return fullProve(
		{
			SenderPrivateKey: user.formattedPrivateKey,
			SenderPublicKey: user.publicKey,
			SenderAddress: BigInt(user.address),
			ChainID: chainId,
			RegistrationHash: registrationHash,
		},
		CIRCUITS.register,
	);
};

/** Poseidon-encrypt an amount under the user's own key -> uint256[7] PCT. */
export const amountPCT = (publicKey: bigint[], amount: bigint): bigint[] => {
	const { ciphertext, nonce, authKey } = processPoseidonEncryption(
		[amount],
		publicKey,
	);
	return [...ciphertext, ...authKey, nonce];
};

export const transferProof = async (
	sender: EercUser,
	senderBalance: bigint,
	senderEncryptedBalance: bigint[], // [c1x,c1y,c2x,c2y]
	receiverPublicKey: bigint[],
	amount: bigint,
	auditorPublicKey: bigint[],
) => {
	const { cipher: encryptedAmountSender } = encryptMessage(
		sender.publicKey,
		amount,
	);
	const {
		cipher: encryptedAmountReceiver,
		random: encryptedAmountReceiverRandom,
	} = encryptMessage(receiverPublicKey, amount);
	const receiverPct = processPoseidonEncryption([amount], receiverPublicKey);
	const auditorPct = processPoseidonEncryption([amount], auditorPublicKey);
	const senderNewBalance = senderBalance - amount;
	const senderPct = processPoseidonEncryption(
		[senderNewBalance],
		sender.publicKey,
	);

	const proof = await fullProve(
		{
			ValueToTransfer: amount,
			SenderPrivateKey: sender.formattedPrivateKey,
			SenderPublicKey: sender.publicKey,
			SenderBalance: senderBalance,
			SenderBalanceC1: senderEncryptedBalance.slice(0, 2),
			SenderBalanceC2: senderEncryptedBalance.slice(2, 4),
			SenderVTTC1: encryptedAmountSender[0],
			SenderVTTC2: encryptedAmountSender[1],
			ReceiverPublicKey: receiverPublicKey,
			ReceiverVTTC1: encryptedAmountReceiver[0],
			ReceiverVTTC2: encryptedAmountReceiver[1],
			ReceiverVTTRandom: encryptedAmountReceiverRandom,
			ReceiverPCT: receiverPct.ciphertext,
			ReceiverPCTAuthKey: receiverPct.authKey,
			ReceiverPCTNonce: receiverPct.nonce,
			ReceiverPCTRandom: receiverPct.encRandom,
			AuditorPublicKey: auditorPublicKey,
			AuditorPCT: auditorPct.ciphertext,
			AuditorPCTAuthKey: auditorPct.authKey,
			AuditorPCTNonce: auditorPct.nonce,
			AuditorPCTRandom: auditorPct.encRandom,
		},
		CIRCUITS.transfer,
	);
	const senderBalancePCT = [
		...senderPct.ciphertext,
		...senderPct.authKey,
		senderPct.nonce,
	];
	return { proof, senderBalancePCT };
};

export const withdrawProof = async (
	user: EercUser,
	userBalance: bigint,
	userEncryptedBalance: bigint[],
	amount: bigint,
	auditorPublicKey: bigint[],
) => {
	const auditorPct = processPoseidonEncryption([amount], auditorPublicKey);
	const newBalance = userBalance - amount;
	const userPct = processPoseidonEncryption([newBalance], user.publicKey);

	const proof = await fullProve(
		{
			ValueToWithdraw: amount,
			SenderPrivateKey: user.formattedPrivateKey,
			SenderPublicKey: user.publicKey,
			SenderBalance: userBalance,
			SenderBalanceC1: userEncryptedBalance.slice(0, 2),
			SenderBalanceC2: userEncryptedBalance.slice(2, 4),
			AuditorPublicKey: auditorPublicKey,
			AuditorPCT: auditorPct.ciphertext,
			AuditorPCTAuthKey: auditorPct.authKey,
			AuditorPCTNonce: auditorPct.nonce,
			AuditorPCTRandom: auditorPct.encRandom,
		},
		CIRCUITS.withdraw,
	);
	const userBalancePCT = [
		...userPct.ciphertext,
		...userPct.authKey,
		userPct.nonce,
	];
	return { proof, userBalancePCT };
};

/**
 * Decrypt a uint256[7] PCT -> amount.
 * IMPORTANT: `formattedPrivateKey` is the ALREADY-formatted BabyJubJub scalar
 * (SDK semantics: sharedKey = authKey * scalar, no re-hash). The repo's
 * processPoseidonDecryption re-formats internally and only suits its raw
 * test keys - do not use it with signature-derived keys.
 */
export const decryptPCT = (
	formattedPrivateKey: bigint,
	pct: bigint[],
	length = 1,
): bigint[] => {
	const sharedKey = mulPointEscalar(
		[pct[4], pct[5]] as [bigint, bigint],
		formattedPrivateKey,
	);
	const decrypted = poseidonDecrypt(pct.slice(0, 4), sharedKey, pct[6], length);
	return decrypted.slice(0, length).map((x: bigint) => BigInt(x));
};

/** Decrypt encrypted payslip/metadata bytes (format of src/metadata.ts). */
export const decryptPayslip = (
	formattedPrivateKey: bigint,
	encryptedMessage: string,
): string => {
	const hex = encryptedMessage.replace(/^0x/, "");
	const word = (i: number) => BigInt(`0x${hex.slice(i * 64, (i + 1) * 64)}`);
	const length = Number(word(0));
	const nonce = word(1);
	const authKey: [bigint, bigint] = [word(2), word(3)];
	const ciphertext: bigint[] = [];
	for (let i = 4; i * 64 < hex.length; i++) ciphertext.push(word(i));
	const sharedKey = mulPointEscalar(authKey, formattedPrivateKey);
	const decrypted = poseidonDecrypt(ciphertext, sharedKey, nonce, length);
	return int2str(decrypted.slice(0, length).map((x: bigint) => BigInt(x)));
};

/**
 * Reconstruct a user's plain balance the same way the SDK does:
 * decrypt balancePCT (if set) plus every amountPCT and sum.
 */
export const decryptBalance = (
	formattedPrivateKey: bigint,
	balancePCT: bigint[],
	amountPCTs: { pct: bigint[] }[],
): bigint => {
	let total = 0n;
	if (balancePCT.some((x) => x !== 0n)) {
		total += decryptPCT(formattedPrivateKey, balancePCT)[0];
	}
	for (const { pct } of amountPCTs) {
		if (pct.some((x) => x !== 0n)) {
			total += decryptPCT(formattedPrivateKey, pct)[0];
		}
	}
	return total;
};
