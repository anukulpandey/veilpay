import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { useEERC } from "@avalabs/eerc-sdk";
import { CIRCUIT_URLS, DEPLOYMENTS, deploymentFor, keyStorageId } from "../config";
import { short } from "../crypto";
import { EmployerView } from "../views/EmployerView";
import { EmployeeView } from "../views/EmployeeView";
import { AuditorView } from "../views/AuditorView";
import { Nav } from "../router";

// prefer Fuji when deployed there, else local hardhat
const preferredChainId = DEPLOYMENTS["43113"] ? 43113 : 31337;

export function AppPage() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const deployment = deploymentFor(chainId);

  const demoConnectors = connectors.filter((c) => c.type === "demo");
  const switchRole = async (id: string) => {
    disconnect();
    const c = connectors.find((x) => x.id === id);
    if (c) setTimeout(() => connect({ connector: c, chainId: preferredChainId }), 150);
  };

  return (
    <>
      <Nav route="app" />
      {isConnected && (
        <div className="appbar">
          {connector?.type === "demo" && (
            <span className="row" style={{ gap: 6 }}>
              <span className="note" style={{ marginRight: 2 }}>role:</span>
              {demoConnectors.map((c) => (
                <button
                  key={c.id}
                  className="ghost small"
                  style={
                    connector?.id === c.id
                      ? { borderColor: "var(--violet)", color: "var(--text)" }
                      : { color: "var(--muted)" }
                  }
                  onClick={() => switchRole(c.id)}
                >
                  {c.name.replace("Demo: ", "")}
                </button>
              ))}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span className={`pill ${deployment ? "ok" : "warn"}`}>
            <span className="dot" />
            {chainId === avalancheFuji.id
              ? "Avalanche Fuji"
              : chainId === 31337
                ? "Local Hardhat"
                : `chain ${chainId}`}
          </span>
          <span className="pill mono">{address ? short(address) : ""}</span>
          <button className="ghost small" onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
      )}

      {!isConnected ? (
        <ConnectScreen
          onConnect={() => connect({ connector: connectors[0], chainId: preferredChainId })}
          onDemo={(id) => {
            const c = connectors.find((x) => x.id === id);
            if (c) connect({ connector: c, chainId: preferredChainId });
          }}
          demoConnectors={demoConnectors.map((c) => ({ id: c.id, name: c.name }))}
          hasConnector={connectors.some((c) => c.type !== "demo")}
        />
      ) : !deployment ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <h3 style={{ justifyContent: "center" }}>Unsupported network</h3>
          <p className="sub">VeilPay is deployed on Avalanche Fuji (and local hardhat for dev).</p>
          <button onClick={() => switchChain({ chainId: avalancheFuji.id })}>
            Switch to Avalanche Fuji
          </button>
        </div>
      ) : (
        <Dashboard key={`${chainId}-${address}`} />
      )}
    </>
  );
}

function ConnectScreen({
  onConnect,
  onDemo,
  demoConnectors,
  hasConnector,
}: {
  onConnect: () => void;
  onDemo: (id: string) => void;
  demoConnectors: { id: string; name: string }[];
  hasConnector: boolean;
}) {
  return (
    <div className="hero" style={{ padding: "60px 10px 40px" }}>
      <h2 style={{ fontSize: 34 }}>
        Enter the <span className="grad">encrypted payroll</span> office
      </h2>
      <p>
        Connect your own wallet, or jump straight in with a one-click demo identity —
        each button is a funded account on Avalanche Fuji playing a different role.
      </p>
      <div className="row" style={{ justifyContent: "center", gap: 10 }}>
        <button onClick={onConnect} disabled={!hasConnector}>
          {hasConnector ? "Connect wallet" : "Install Core or MetaMask"}
        </button>
        {demoConnectors.map((c, i) => (
          <button key={c.id} className="ghost" onClick={() => onDemo(c.id)}>
            {["🏢", "👩", "👨", "🕵️", "🧑‍🚀"][i] || "🎭"} {c.name.replace("Demo: ", "Try as ")}
          </button>
        ))}
      </div>
      <p className="note" style={{ marginTop: 26 }}>
        New here? Read <a href="#/docs">the docs</a> — or just click{" "}
        <strong>Try as Employer</strong> and run a payroll.
      </p>
    </div>
  );
}

function Dashboard() {
  const { address } = useAccount();
  const chainId = useChainId();
  const deployment = deploymentFor(chainId)!;
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [storedKey, setStoredKey] = useState<string | undefined>(() =>
    address && chainId
      ? localStorage.getItem(keyStorageId(chainId, address)) || undefined
      : undefined,
  );

  const eerc = useEERC(
    publicClient as any,
    walletClient as any,
    deployment.contracts.encryptedERC as `0x${string}`,
    CIRCUIT_URLS as any,
    storedKey,
  );

  const saveKey = (key: string) => {
    if (address && chainId) localStorage.setItem(keyStorageId(chainId, address), key);
    setStoredKey(key);
  };

  const [tab, setTab] = useState<"employer" | "employee" | "auditor">("employer");
  const tabs = useMemo(
    () =>
      [
        ["employer", "🏢 Employer"],
        ["employee", "👤 Employee"],
        ["auditor", "🕵️ Auditor"],
      ] as const,
    [],
  );

  useEffect(() => {
    // re-read stored key when account/chain changes
    if (address && chainId) {
      setStoredKey(localStorage.getItem(keyStorageId(chainId, address)) || undefined);
    }
  }, [address, chainId]);

  if (!walletClient || !eerc.isInitialized) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <span className="spin">◌</span> initializing encrypted token client…
      </div>
    );
  }

  return (
    <>
      <RegistrationGate eerc={eerc} storedKey={storedKey} saveKey={saveKey} />
      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "auditor" && eerc.areYouAuditor ? " ✓" : ""}
          </button>
        ))}
      </div>
      {tab === "employer" && (
        <EmployerView eerc={eerc} deployment={deployment} decryptionKey={storedKey} />
      )}
      {tab === "employee" && (
        <EmployeeView eerc={eerc} deployment={deployment} decryptionKey={storedKey} />
      )}
      {tab === "auditor" && (
        <AuditorView eerc={eerc} deployment={deployment} decryptionKey={storedKey} />
      )}
    </>
  );
}

function RegistrationGate({
  eerc,
  storedKey,
  saveKey,
}: {
  eerc: ReturnType<typeof useEERC>;
  storedKey?: string;
  saveKey: (k: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (eerc.isRegistered && (storedKey || eerc.isDecryptionKeySet)) return null;

  const action = async () => {
    setBusy(true);
    setErr("");
    try {
      if (!eerc.isRegistered) {
        const { key } = await eerc.register();
        saveKey(key);
      } else {
        const key = await eerc.generateDecryptionKey();
        saveKey(key);
      }
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: "rgba(124,92,255,0.5)" }}>
      <h3>🔑 {eerc.isRegistered ? "Unlock your encrypted account" : "Create your privacy account"}</h3>
      <p className="sub">
        {eerc.isRegistered
          ? "Sign the eERC message to re-derive your decryption key on this device."
          : "One signature derives your personal BabyJubJub key pair and registers it on-chain with a zk proof. No new seed phrase to manage — your wallet is your key."}
      </p>
      <div className="row">
        <button onClick={action} disabled={busy}>
          {busy ? (
            <>
              <span className="spin">◌</span>{" "}
              {eerc.isRegistered ? "unlocking…" : "proving registration…"}
            </>
          ) : eerc.isRegistered ? (
            "Sign to unlock"
          ) : (
            "Register (generates zk proof)"
          )}
        </button>
        {err && <span className="note" style={{ color: "var(--red2)" }}>{err}</span>}
      </div>
    </div>
  );
}
