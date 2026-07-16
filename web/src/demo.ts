/**
 * Demo wallet connector: a wagmi connector backed by a viem local account.
 * Lets anyone try VeilPay's three roles with one click - no extension needed.
 * Keys are public demo keys (hardhat defaults locally / faucet-funded on Fuji).
 */
import { createConnector } from "wagmi";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type EIP1193RequestFn,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPCS: Record<number, string> = {
  31337: "http://127.0.0.1:8545",
  43113: "https://api.avax-test.network/ext/bc/C/rpc",
};

export function demoWallet({
  pk,
  label,
  chains,
}: {
  pk: `0x${string}`;
  label: string;
  chains: readonly [Chain, ...Chain[]];
}) {
  const account = privateKeyToAccount(pk);

  return createConnector((config) => {
    let currentChainId = chains[0].id;

    const chainOf = (id: number) => chains.find((c) => c.id === id) ?? chains[0];
    const clients = () => {
      const chain = chainOf(currentChainId);
      const transport = http(RPCS[chain.id]);
      return {
        pc: createPublicClient({ chain, transport }),
        wc: createWalletClient({ account, chain, transport }),
      };
    };

    const request: EIP1193RequestFn = async ({ method, params }: any) => {
      const { pc, wc } = clients();
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account.address];
        case "eth_chainId":
          return `0x${currentChainId.toString(16)}`;
        case "personal_sign": {
          const [data] = params as [`0x${string}`, string];
          return account.signMessage({ message: { raw: data } });
        }
        case "eth_signTypedData_v4": {
          const [, json] = params as [string, string];
          return account.signTypedData(JSON.parse(json));
        }
        case "eth_sendTransaction": {
          const [tx] = params as [any];
          return wc.sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value ? BigInt(tx.value) : undefined,
            gas: tx.gas ? BigInt(tx.gas) : undefined,
            account,
            chain: chainOf(currentChainId),
          });
        }
        case "wallet_switchEthereumChain": {
          const [{ chainId }] = params as [{ chainId: string }];
          currentChainId = Number(BigInt(chainId));
          config.emitter.emit("change", { chainId: currentChainId });
          return null;
        }
        default:
          return pc.request({ method, params } as any);
      }
    };

    return {
      id: `demo-${label.toLowerCase()}`,
      name: `Demo: ${label}`,
      type: "demo" as const,
      async connect({ chainId }: { chainId?: number } = {}) {
        if (chainId) currentChainId = chainId;
        return { accounts: [account.address] as readonly `0x${string}`[], chainId: currentChainId };
      },
      async disconnect() {},
      async getAccounts() {
        return [account.address] as readonly `0x${string}`[];
      },
      async getChainId() {
        return currentChainId;
      },
      async getProvider() {
        return { request };
      },
      async isAuthorized() {
        return false;
      },
      async switchChain({ chainId }: { chainId: number }) {
        currentChainId = chainId;
        config.emitter.emit("change", { chainId });
        return chainOf(chainId);
      },
      onAccountsChanged() {},
      onChainChanged() {},
      onDisconnect() {},
    };
  });
}

import fujiDemo from "./gen/fuji-demo.json";

/** Hardhat's well-known dev accounts (local) - deployer is the auditor. */
const HARDHAT_KEYS: { label: string; role: string; pk: `0x${string}` }[] = [
  {
    label: "Employer",
    role: "runs payroll",
    pk: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  {
    label: "Alice",
    role: "employee",
    pk: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
  {
    label: "Bob",
    role: "employee",
    pk: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  },
  {
    label: "Auditor",
    role: "compliance",
    pk: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  {
    label: "Guest",
    role: "new joiner",
    pk: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  },
];

/** Prefer faucet-funded Fuji demo identities when they exist. */
export const DEMO_KEYS: { label: string; role: string; pk: `0x${string}` }[] =
  (fujiDemo as any[]).length > 0 ? (fujiDemo as any) : HARDHAT_KEYS;
