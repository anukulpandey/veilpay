import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { DEMO_KEYS, demoWallet } from "./demo";

export const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

const chains = [avalancheFuji, hardhatLocal] as const;

export const config = createConfig({
  chains,
  connectors: [
    injected(),
    ...DEMO_KEYS.map((k) => demoWallet({ pk: k.pk, label: k.label, chains })),
  ],
  transports: {
    [avalancheFuji.id]: http(),
    [hardhatLocal.id]: http(),
  },
});
