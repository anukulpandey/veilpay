import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import type { useEERC } from "@avalabs/eerc-sdk";
import { ABIS, EERC_DECIMALS, type Deployment } from "../config";
import { decryptPCT, formatKeyForCurve, short } from "../crypto";
import { TxLink, fmtUnits, useToast } from "./ui";
import { getLogsChunked } from "./logs";

type Props = {
  eerc: ReturnType<typeof useEERC>;
  deployment: Deployment;
  decryptionKey?: string;
};

type AuditRow = {
  kind: string;
  from: string;
  to: string;
  amount: bigint;
  txHash: string;
  blockNumber: bigint;
};

export function AuditorView({ eerc, deployment, decryptionKey }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const toast = useToast();
  const C = deployment.contracts;

  const isAuditor = eerc.areYouAuditor;
  const isOwner =
    address && eerc.owner && address.toLowerCase() === String(eerc.owner).toLowerCase();

  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  const becomeAuditor = async () => {
    setBusy(true);
    try {
      await eerc.setContractAuditorPublicKey(address!);
      eerc.refetchAuditor();
      toast.show("You are now the designated auditor");
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setBusy(false);
    }
  };

  const audit = useCallback(async () => {
    if (!publicClient || !decryptionKey) return;
    setScanning(true);
    try {
      const scalar = formatKeyForCurve(decryptionKey);
      const events = (ABIS.EncryptedERC as any[]).filter(
        (x) => x.type === "event" && ["PrivateTransfer"].includes(x.name),
      );
      const out: AuditRow[] = [];
      for (const ev of events) {
        const logs = await getLogsChunked(publicClient, {
          address: C.encryptedERC as `0x${string}`,
          event: ev,
          fromBlock: BigInt(deployment.startBlock ?? 0),
        });
        for (const log of logs) {
          const a = (log as any).args;
          try {
            const amount = decryptPCT(
              scalar,
              (a.auditorPCT as bigint[]).map((x) => BigInt(x)),
            );
            out.push({
              kind: ev.name,
              from: a.from,
              to: a.to,
              amount,
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber!,
            });
          } catch {
            // PCT addressed to a previous auditor key — rotation is supported
          }
        }
      }
      out.sort((x, y) => Number(y.blockNumber - x.blockNumber));
      setRows(out);
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setScanning(false);
    }
  }, [publicClient, decryptionKey, C.encryptedERC, deployment.startBlock]);

  const exportCsv = () => {
    if (!rows) return;
    const csv = [
      "type,from,to,amount_eusdc,tx_hash,block",
      ...rows.map(
        (r) =>
          `${r.kind},${r.from},${r.to},${fmtUnits(r.amount, EERC_DECIMALS).replace(/,/g, "")},${r.txHash},${r.blockNumber}`,
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "veilpay-audit-report.csv";
    a.click();
  };

  if (!isAuditor) {
    return (
      <div className="card">
        <h3>🕵️ Auditor console</h3>
        <p className="sub">
          eERC has compliance built in: every encrypted payment carries a second
          ciphertext addressed to the designated auditor's rotatable public key. The
          auditor — and only the auditor — can decrypt amounts without any user's key.
        </p>
        {isOwner ? (
          <div className="row">
            <button onClick={becomeAuditor} disabled={busy || !eerc.isRegistered}>
              {busy ? "setting…" : "Make my account the auditor"}
            </button>
            <span className="note">
              you are the contract owner, so you can designate the auditor
            </span>
          </div>
        ) : (
          <p className="note">
            Connected account is not the designated auditor
            {eerc.auditorAddress ? (
              <>
                {" "}
                — current auditor: <span className="mono">{short(eerc.auditorAddress)}</span>
              </>
            ) : null}
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row spread">
        <h3>🕵️ Compliance audit — full transfer history</h3>
        <span className="badge ok">you are the auditor</span>
      </div>
      <p className="sub">
        Scans every PrivateTransfer since deployment and decrypts the auditor ciphertext
        (AuditorPCT) with your key — no user cooperation needed, no 1000-block window
        limits. This is what "compliance-friendly privacy" means.
      </p>
      <div className="row">
        <button onClick={audit} disabled={scanning || !decryptionKey}>
          {scanning ? (
            <>
              <span className="spin">◌</span> decrypting history…
            </>
          ) : (
            "Decrypt all transfers"
          )}
        </button>
        {rows && rows.length > 0 && (
          <button className="ghost" onClick={exportCsv}>
            Export CSV report
          </button>
        )}
        {!decryptionKey && (
          <span className="note" style={{ color: "var(--amber)" }}>
            unlock your account first
          </span>
        )}
      </div>
      {rows && (
        <>
          <hr className="divider" />
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Amount (decrypted)</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txHash + r.from}>
                  <td>
                    <span className="badge info">{r.kind}</span>
                  </td>
                  <td className="mono">{short(r.from)}</td>
                  <td className="mono">{short(r.to)}</td>
                  <td className="mono" style={{ color: "var(--green)" }}>
                    {fmtUnits(r.amount, EERC_DECIMALS)} eUSDC
                  </td>
                  <td>
                    <TxLink chainId={chainId} hash={r.txHash} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="note">
                    No private transfers found since deployment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
