/**
 * Browser-side PCT/metadata decryption, independent of the SDK's 1000-block
 * audit window. Mirrors @avalabs/eerc-sdk key semantics exactly:
 * scalar = formatKeyForCurve(decryptionKeyHex); sharedKey = authKey * scalar.
 */
import createBlakeHash from "blake-hash";
import { Buffer } from "buffer";
import { mulPointEscalar } from "@zk-kit/baby-jubjub";
import { poseidonDecrypt } from "@zk-kit/poseidon-cipher";

const SUB_GROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

export const formatKeyForCurve = (keyHex: string): bigint => {
  const hash: Buffer = createBlakeHash("blake512")
    .update(Buffer.from(keyHex.replace(/^0x/, ""), "hex"))
    .digest()
    .slice(0, 32);
  hash[0] &= 0xf8;
  hash[31] = (hash[31] & 0x7f) | 0x40;
  const le = BigInt(`0x${Buffer.from(hash).reverse().toString("hex")}`);
  return (le >> 3n) % SUB_GROUP_ORDER;
};

/** Decrypt a uint256[7] Poseidon ciphertext (PCT) -> single amount. */
export const decryptPCT = (scalar: bigint, pct: bigint[]): bigint => {
  const sharedKey = mulPointEscalar([pct[4], pct[5]], scalar);
  const out = poseidonDecrypt(pct.slice(0, 4), sharedKey, pct[6], 1);
  return BigInt(out[0]);
};

/** Decrypt encrypted payslip/metadata bytes (length|nonce|authKey|cipher words). */
export const decryptMetadataBytes = (
  scalar: bigint,
  encryptedMessage: string,
): string => {
  const hex = encryptedMessage.replace(/^0x/, "");
  const word = (i: number) => BigInt(`0x${hex.slice(i * 64, (i + 1) * 64)}`);
  const length = Number(word(0));
  const nonce = word(1);
  const authKey: [bigint, bigint] = [word(2), word(3)];
  const ciphertext: bigint[] = [];
  for (let i = 4; i * 64 < hex.length; i++) ciphertext.push(word(i));
  const sharedKey = mulPointEscalar(authKey, scalar);
  const fields = poseidonDecrypt(ciphertext, sharedKey, nonce, length);
  return fieldsToString(fields.slice(0, length).map((x) => BigInt(x)));
};

// inverse of the contracts repo's str2int (250-bit chunks, base-256 bytes)
const fieldsToString = (chunks: bigint[]): string => {
  const chunkSize = 2n ** 250n;
  let result = 0n;
  for (let i = chunks.length - 1; i >= 0; i--) result = result * chunkSize + chunks[i];
  if (result === 0n) return "";
  let hex = result.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  return Buffer.from(hex, "hex").toString("utf8").replace(/\u0000/g, "");
};

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
