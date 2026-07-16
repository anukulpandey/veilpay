import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { useEERC } from "@avalabs/eerc-sdk";
import { ABIS, EERC_DECIMALS, USDC_DECIMALS, type Deployment } from "../config";
import { decryptMetadataBytes, formatKeyForCurve } from "../crypto";
import { SealedBalance, TxLink, fmtUnits, parseUnitsStrict, useToast } from "./ui";
import { getLogsChunked } from "./logs";

type Props = {
  eerc: ReturnType<typeof useEERC>;
  deployment: Deployment;
  decryptionKey?: string;
};

type Payslip = {
  txHash: string;
  from: string;
  blockNumber: bigint;
  raw: string;
  data?: { org?: string; period?: string; gross?: string; label?: string; currency?: string };
};

export function EmployeeView({ eerc, deployment, decryptionKey }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();
  const C = deployment.contracts;

  const enc = eerc.useEncryptedBalance(C.mockUSDC as `0x${string}`);
  const decrypted = enc.decryptedBalance as bigint | undefined;

  // ---- my orgs ----
  const { data: orgIds } = useReadContract({
    address: C.payrollManager as `0x${string}`,
    abi: ABIS.PayrollManager,
    functionName: "orgsOfEmployee",
    args: [address!],
  });

  // ---- payslips: scan PrivateMessage logs addressed to me, decrypt locally ----
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [scanning, setScanning] = useState(false);

  const scan = useCallback(async () => {
    if (!publicClient || !address || !decryptionKey) return;
    setScanning(true);
    try {
      const abiEvent = (ABIS.EncryptedERC as any[]).find(
        (x) => x.type === "event" && x.name === "PrivateMessage",
      );
      const logs = await getLogsChunked(publicClient, {
        address: C.encryptedERC as `0x${string}`,
        event: abiEvent,
        args: { to: address },
        fromBlock: BigInt(deployment.startBlock ?? 0),
      });
      const scalar = formatKeyForCurve(decryptionKey);
      const out: Payslip[] = [];
      for (const log of logs) {
        const meta = (log as any).args.metadata;
        try {
          const raw = decryptMetadataBytes(scalar, meta.encryptedMsg);
          let data: Payslip["data"];
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.type === "payslip") data = parsed;
          } catch {
            /* free-form message */
          }
          out.push({
            txHash: log.transactionHash!,
            from: meta.messageFrom,
            blockNumber: log.blockNumber!,
            raw,
            data,
          });
        } catch {
          // not decryptable by us (shouldn't happen for messages addressed to us)
        }
      }
      setSlips(out.reverse());
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setScanning(false);
    }
  }, [publicClient, address, decryptionKey, C.encryptedERC, deployment.startBlock]);

  useEffect(() => {
    scan();
  }, [scan]);

  // ---- withdraw ----
  const [wAmt, setWAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    setBusy(true);
    try {
      const amount = parseUnitsStrict(wAmt, EERC_DECIMALS);
      const { transactionHash } = await enc.withdraw(amount);
      await publicClient!.waitForTransactionReceipt({ hash: transactionHash });
      enc.refetchBalance();
      toast.show(`Unshielded ${wAmt} eUSDC back to public mUSDC`);
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setBusy(false);
    }
  };

  const { data: usdcBal } = useReadContract({
    address: C.mockUSDC as `0x${string}`,
    abi: ABIS.SimpleERC20,
    functionName: "balanceOf",
    args: [address!],
    query: { refetchInterval: 8000 },
  });

  return (
    <div className="grid">
      <div className="grid cols2">
        <div className="card">
          <h3>💰 My encrypted salary balance</h3>
          <p className="sub">
            Your employer, your colleagues, explorers — nobody can read this. It decrypts
            only with the key derived from your wallet signature.
          </p>
          <SealedBalance
            value={decrypted !== undefined ? fmtUnits(decrypted, EERC_DECIMALS) : "—"}
            unit="eUSDC"
            ready={decrypted !== undefined}
          />
          <div className="row gap">
            <button className="ghost small" onClick={() => enc.refetchBalance()}>
              Refresh
            </button>
            {(orgIds as bigint[] | undefined)?.length ? (
              <span className="badge info">
                on payroll of {(orgIds as bigint[]).length} org
                {(orgIds as bigint[]).length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          <hr className="divider" />
          <p className="sub" style={{ marginBottom: 8 }}>
            Unshield to public mUSDC (current public balance:{" "}
            {usdcBal !== undefined ? fmtUnits(usdcBal as bigint, USDC_DECIMALS) : "—"}):
          </p>
          <div className="row">
            <input
              className="grow"
              value={wAmt}
              onChange={(e) => setWAmt(e.target.value)}
              placeholder="amount (eUSDC), e.g. 1000.00"
            />
            <button onClick={withdraw} disabled={busy || !wAmt}>
              {busy ? (
                <>
                  <span className="spin">◌</span> proving…
                </>
              ) : (
                "Withdraw"
              )}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>🧾 My payslips</h3>
          <p className="sub">
            Encrypted payslips ride inside the payment transaction itself
            (Poseidon-encrypted to your public key). Decrypted here, locally.
          </p>
          <div className="row">
            <button className="ghost small" onClick={scan} disabled={scanning}>
              {scanning ? (
                <>
                  <span className="spin">◌</span> scanning chain…
                </>
              ) : (
                "Rescan"
              )}
            </button>
            {!decryptionKey && (
              <span className="note" style={{ color: "var(--amber)" }}>
                unlock your account first to decrypt payslips
              </span>
            )}
          </div>
          {slips.map((s) => (
            <div className="payslip" key={s.txHash}>
              <div className="head">
                <span>
                  from <span className="mono">{s.from.slice(0, 10)}…</span>
                </span>
                <TxLink chainId={chainId} hash={s.txHash} />
              </div>
              {s.data ? (
                <div className="body">
                  {s.data.org && `🏢 ${s.data.org}\n`}
                  {s.data.label && `👤 ${s.data.label}\n`}
                  {s.data.period && `🗓  ${s.data.period}\n`}
                  {s.data.gross && `💵 gross: ${s.data.gross} ${s.data.currency || ""}`}
                </div>
              ) : (
                <div className="body">{s.raw}</div>
              )}
            </div>
          ))}
          {slips.length === 0 && !scanning && (
            <p className="note" style={{ marginTop: 12 }}>
              No payslips found yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
