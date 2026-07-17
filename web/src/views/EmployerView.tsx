import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { useEERC } from "@avalabs/eerc-sdk";
import { ABIS, EERC_DECIMALS, USDC_DECIMALS, type Deployment } from "../config";
import { short } from "../crypto";
import { SealedBalance, TxLink, fmtUnits, parseUnitsStrict, useToast } from "./ui";

type Props = {
  eerc: ReturnType<typeof useEERC>;
  deployment: Deployment;
  decryptionKey?: string;
};

type RowStatus = { state: "idle" | "proving" | "sent" | "error"; hash?: string; err?: string };

export function EmployerView({ eerc, deployment }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();
  const C = deployment.contracts;

  const enc = eerc.useEncryptedBalance(C.mockUSDC as `0x${string}`);
  // async loops (payroll) must read the FRESHEST hook state, not the render
  // they were started in - otherwise the 2nd transfer proves against a stale
  // encrypted balance and the contract rejects it with InvalidProof
  const encRef = useRef(enc);
  encRef.current = enc;

  // ---- plain + encrypted treasury ----
  const { data: usdcBal, refetch: refetchUsdc } = useReadContract({
    address: C.mockUSDC as `0x${string}`,
    abi: ABIS.SimpleERC20,
    functionName: "balanceOf",
    args: [address!],
    query: { refetchInterval: 8000 },
  });

  const [shieldAmt, setShieldAmt] = useState("50000");
  const [busy, setBusy] = useState("");

  const mintUsdc = async () => {
    setBusy("mint");
    try {
      const hash = await writeContractAsync({
        address: C.mockUSDC as `0x${string}`,
        abi: ABIS.SimpleERC20,
        functionName: "mint",
        args: [address!, 100_000n * 10n ** BigInt(USDC_DECIMALS)],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      refetchUsdc();
      toast.show("Minted 100,000 test mUSDC");
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setBusy("");
    }
  };

  const shield = async () => {
    setBusy("shield");
    try {
      const amount = parseUnitsStrict(shieldAmt, USDC_DECIMALS);
      const approveHash = await writeContractAsync({
        address: C.mockUSDC as `0x${string}`,
        abi: ABIS.SimpleERC20,
        functionName: "approve",
        args: [C.encryptedERC as `0x${string}`, amount],
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveHash });
      const { transactionHash } = await enc.deposit(amount);
      await publicClient!.waitForTransactionReceipt({ hash: transactionHash });
      refetchUsdc();
      enc.refetchBalance();
      toast.show(`Shielded ${shieldAmt} mUSDC into encrypted eUSDC`);
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setBusy("");
    }
  };

  // ---- org management ----
  const { data: orgIds, refetch: refetchOrgs } = useReadContract({
    address: C.payrollManager as `0x${string}`,
    abi: ABIS.PayrollManager,
    functionName: "orgsOfEmployer",
    args: [address!],
  });
  const orgId = (orgIds as bigint[] | undefined)?.[0];
  const { data: org } = useReadContract({
    address: C.payrollManager as `0x${string}`,
    abi: ABIS.PayrollManager,
    functionName: "getOrg",
    args: [orgId!],
    query: { enabled: orgId !== undefined },
  });
  const { data: employees, refetch: refetchEmployees } = useReadContract({
    address: C.payrollManager as `0x${string}`,
    abi: ABIS.PayrollManager,
    functionName: "employeesOf",
    args: [orgId!],
    query: { enabled: orgId !== undefined },
  });
  const { data: runs, refetch: refetchRuns } = useReadContract({
    address: C.payrollManager as `0x${string}`,
    abi: ABIS.PayrollManager,
    functionName: "runsOf",
    args: [orgId!],
    query: { enabled: orgId !== undefined },
  });

  const [orgName, setOrgName] = useState("");
  const [empAddr, setEmpAddr] = useState("");
  const [empLabel, setEmpLabel] = useState("");

  const createOrg = async () => {
    setBusy("org");
    try {
      const hash = await writeContractAsync({
        address: C.payrollManager as `0x${string}`,
        abi: ABIS.PayrollManager,
        functionName: "createOrg",
        args: [orgName],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      refetchOrgs();
      toast.show(`Org "${orgName}" created`);
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setBusy("");
    }
  };

  const addEmployee = async () => {
    setBusy("addEmp");
    try {
      const hash = await writeContractAsync({
        address: C.payrollManager as `0x${string}`,
        abi: ABIS.PayrollManager,
        functionName: "addEmployee",
        args: [orgId!, empAddr as `0x${string}`, empLabel],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      refetchEmployees();
      setEmpAddr("");
      setEmpLabel("");
      toast.show("Employee added to roster");
    } catch (e: any) {
      toast.show(e?.shortMessage || e?.message || String(e), true);
    } finally {
      setBusy("");
    }
  };

  // ---- payroll run ----
  const activeEmployees = useMemo(
    () => ((employees as any[]) || []).filter((e) => e.active),
    [employees],
  );
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [memo, setMemo] = useState("2026-07 salaries");
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [running, setRunning] = useState(false);

  const runPayroll = async () => {
    setRunning(true);
    const paid: string[] = [];
    try {
      for (const emp of activeEmployees) {
        const amtStr = amounts[emp.wallet];
        if (!amtStr) continue;
        const wallet = emp.wallet as `0x${string}`;
        setRowStatus((s) => ({ ...s, [wallet]: { state: "proving" } }));
        try {
          const { isRegistered } = await eerc.isAddressRegistered(wallet);
          if (!isRegistered) {
            throw new Error("employee has not registered their encryption key yet");
          }
          const amount = parseUnitsStrict(amtStr, EERC_DECIMALS);
          const payslip = JSON.stringify({
            v: 1,
            type: "payslip",
            org: (org as any)?.name || "org",
            period: memo,
            label: emp.label,
            gross: amtStr,
            currency: "eUSDC",
          });
          const balBefore = JSON.stringify(encRef.current.encryptedBalance, (_, v) =>
            typeof v === "bigint" ? v.toString() : v,
          );
          const { transactionHash } = await encRef.current.privateTransfer(
            wallet,
            amount,
            payslip,
          );
          await publicClient!.waitForTransactionReceipt({ hash: transactionHash });
          setRowStatus((s) => ({ ...s, [wallet]: { state: "sent", hash: transactionHash } }));
          paid.push(wallet);
          // wait until the hook has re-synced the new encrypted balance before
          // proving the next payment
          for (let t = 0; t < 30; t++) {
            encRef.current.refetchBalance();
            await new Promise((r) => setTimeout(r, 1500));
            const now = JSON.stringify(encRef.current.encryptedBalance, (_, v) =>
              typeof v === "bigint" ? v.toString() : v,
            );
            if (now !== balBefore) break;
          }
        } catch (e: any) {
          setRowStatus((s) => ({
            ...s,
            [wallet]: { state: "error", err: e?.shortMessage || e?.message || String(e) },
          }));
        }
      }
      if (paid.length > 0) {
        const hash = await writeContractAsync({
          address: C.payrollManager as `0x${string}`,
          abi: ABIS.PayrollManager,
          functionName: "logPayrollRun",
          args: [orgId!, paid.length, memo],
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        refetchRuns();
        toast.show(`Payroll run complete — ${paid.length} encrypted payments sent 🔒`);
      }
    } finally {
      setRunning(false);
    }
  };

  const decrypted = enc.decryptedBalance as bigint | undefined;

  return (
    <div className="grid">
      <div className="grid cols2">
        <div className="card">
          <h3>💵 Public treasury (mUSDC)</h3>
          <p className="sub">Plain ERC-20. Everyone on-chain can read this number.</p>
          <div className="balance">
            {usdcBal !== undefined ? fmtUnits(usdcBal as bigint, USDC_DECIMALS) : "—"}
            <span className="unit">mUSDC</span>
          </div>
          <div className="row gap">
            <button className="ghost small" onClick={mintUsdc} disabled={busy !== ""}>
              {busy === "mint" ? "minting…" : "Get 100k test mUSDC"}
            </button>
          </div>
          <hr className="divider" />
          <p className="sub" style={{ marginBottom: 8 }}>
            Shield funds into the encrypted treasury (eERC converter deposit):
          </p>
          <div className="row">
            <input
              className="grow"
              value={shieldAmt}
              onChange={(e) => setShieldAmt(e.target.value)}
              placeholder="amount (mUSDC)"
            />
            <button onClick={shield} disabled={busy !== ""}>
              {busy === "shield" ? "shielding…" : "Shield → eUSDC 🔒"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>🔐 Encrypted treasury (eUSDC)</h3>
          <p className="sub">
            ElGamal-encrypted balance on-chain. Decrypted locally in your browser — the
            RPC node, explorers and competitors see only ciphertext.
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
          </div>
        </div>
      </div>

      {orgId === undefined ? (
        <div className="card">
          <h3>🏢 Create your organization</h3>
          <p className="sub">One transaction sets up your payroll org on-chain.</p>
          <div className="row">
            <input
              className="grow"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder='e.g. "Acme India Pvt Ltd"'
            />
            <button onClick={createOrg} disabled={!orgName || busy !== ""}>
              {busy === "org" ? "creating…" : "Create org"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row spread">
              <h3>👥 Roster — {(org as any)?.name}</h3>
              <span className="badge info">org #{orgId?.toString()}</span>
            </div>
            <p className="sub">
              Employees must register once (one wallet signature) before they can receive
              encrypted salary.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Wallet</th>
                  <th>eERC key</th>
                  <th style={{ width: 140 }}>Salary (eUSDC)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map((emp) => (
                  <RosterRow
                    key={emp.wallet}
                    emp={emp}
                    eerc={eerc}
                    chainId={chainId}
                    amount={amounts[emp.wallet] || ""}
                    setAmount={(v) => setAmounts((a) => ({ ...a, [emp.wallet]: v }))}
                    status={rowStatus[emp.wallet]}
                  />
                ))}
                {activeEmployees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="note">
                      No employees yet — add your first hire below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="row gap">
              <input
                className="grow mono"
                value={empAddr}
                onChange={(e) => setEmpAddr(e.target.value)}
                placeholder="0x wallet address"
              />
              <input
                value={empLabel}
                onChange={(e) => setEmpLabel(e.target.value)}
                placeholder="name / role"
              />
              <button
                className="ghost"
                onClick={addEmployee}
                disabled={!empAddr.match(/^0x[0-9a-fA-F]{40}$/) || busy !== ""}
              >
                {busy === "addEmp" ? "adding…" : "+ Add"}
              </button>
            </div>
          </div>

          <div className="card">
            <h3>🚀 Run payroll</h3>
            <p className="sub">
              Each payment: a Groth16 transfer proof is generated in your browser, the
              amount is ElGamal-encrypted for the employee, Poseidon-encrypted for the
              auditor, and an encrypted payslip rides along in the same transaction.
            </p>
            <div className="row">
              <input
                className="grow"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="run memo, e.g. 2026-07 salaries"
              />
              <button
                onClick={runPayroll}
                disabled={
                  running ||
                  activeEmployees.length === 0 ||
                  !activeEmployees.some((e) => amounts[e.wallet])
                }
              >
                {running ? (
                  <>
                    <span className="spin">◌</span> running payroll…
                  </>
                ) : (
                  `Pay ${activeEmployees.filter((e) => amounts[e.wallet]).length || ""} employees 🔒`
                )}
              </button>
            </div>
            {(runs as any[])?.length > 0 && (
              <>
                <hr className="divider" />
                <table>
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>When</th>
                      <th>Paid</th>
                      <th>Memo</th>
                      <th>Amounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(runs as any[]).map((r, i) => (
                      <tr key={i}>
                        <td>#{i}</td>
                        <td>{new Date(Number(r.timestamp) * 1000).toLocaleString()}</td>
                        <td>{r.paidCount.toString()} employees</td>
                        <td>{r.memo}</td>
                        <td>
                          <span className="badge ok">🔒 encrypted</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RosterRow({
  emp,
  eerc,
  chainId,
  amount,
  setAmount,
  status,
}: {
  emp: any;
  eerc: ReturnType<typeof useEERC>;
  chainId: number;
  amount: string;
  setAmount: (v: string) => void;
  status?: RowStatus;
}) {
  const [registered, setRegistered] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    eerc
      .isAddressRegistered(emp.wallet)
      .then((r) => alive && setRegistered(r.isRegistered))
      .catch(() => alive && setRegistered(null));
    return () => {
      alive = false;
    };
  }, [emp.wallet, eerc.isAddressRegistered]);

  return (
    <tr>
      <td>{emp.label}</td>
      <td className="mono">{short(emp.wallet)}</td>
      <td>
        {registered === null ? (
          "…"
        ) : registered ? (
          <span className="badge ok">registered</span>
        ) : (
          <span className="badge warn">not registered</span>
        )}
      </td>
      <td>
        <input
          style={{ width: 120 }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="2500.00"
        />
      </td>
      <td>
        {!status || status.state === "idle" ? (
          <span className="note">—</span>
        ) : status.state === "proving" ? (
          <span className="badge info">
            <span className="spin">◌</span> proving…
          </span>
        ) : status.state === "sent" ? (
          <span className="badge ok">
            paid <TxLink chainId={chainId} hash={status.hash!} />
          </span>
        ) : (
          <span className="badge warn" title={status.err}>
            failed
          </span>
        )}
      </td>
    </tr>
  );
}
