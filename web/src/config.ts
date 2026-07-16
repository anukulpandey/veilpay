import deployments from "./gen/deployments.json";
import abis from "./gen/abis.json";

export type Deployment = {
  network: string;
  chainId: string;
  deployer: string;
  auditor: string;
  startBlock?: number;
  contracts: {
    registrar: string;
    encryptedERC: string;
    mockUSDC: string;
    payrollManager: string;
  };
};

export const DEPLOYMENTS = deployments as unknown as Record<string, Deployment>;
export const ABIS = abis as Record<string, any>;

export const deploymentFor = (chainId: number | undefined) =>
  chainId ? DEPLOYMENTS[String(chainId)] : undefined;

// served from public/circuits (see scripts that copy from contracts/circom/build)
export const CIRCUIT_URLS = {
  register: {
    wasm: "/circuits/RegistrationCircuit.wasm",
    zkey: "/circuits/RegistrationCircuit.zkey",
  },
  transfer: {
    wasm: "/circuits/TransferCircuit.wasm",
    zkey: "/circuits/TransferCircuit.zkey",
  },
  mint: { wasm: "/circuits/MintCircuit.wasm", zkey: "/circuits/MintCircuit.zkey" },
  withdraw: {
    wasm: "/circuits/WithdrawCircuit.wasm",
    zkey: "/circuits/WithdrawCircuit.zkey",
  },
  burn: { wasm: "/circuits/BurnCircuit.wasm", zkey: "/circuits/BurnCircuit.zkey" },
};

export const EERC_DECIMALS = 2; // encrypted-system decimals
export const USDC_DECIMALS = 6;

export const explorerTx = (chainId: number | undefined, hash: string) =>
  chainId === 43113 ? `https://testnet.snowtrace.io/tx/${hash}` : `#${hash}`;

export const keyStorageId = (chainId: number, address: string) =>
  `veilpay.key.${chainId}.${address.toLowerCase()}`;
