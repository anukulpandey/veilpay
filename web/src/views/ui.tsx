import { createContext, useContext, useRef, useState } from "react";
import { explorerTx } from "../config";
import { short } from "../crypto";

export const useToastState = () => {
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = (m: string, error = false) => {
    setMsg(m);
    setIsError(error);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 6000);
  };
  return { msg, isError, show };
};

export const ToastCtx = createContext<ReturnType<typeof useToastState> | null>(null);
export const useToast = () => useContext(ToastCtx)!;

export const Toast = ({ msg, error }: { msg: string; error: boolean }) => (
  <div className={`toast ${error ? "error" : ""}`}>{msg}</div>
);

export const TxLink = ({ chainId, hash }: { chainId?: number; hash: string }) =>
  chainId === 43113 ? (
    <a href={explorerTx(chainId, hash)} target="_blank" rel="noreferrer" className="mono">
      {short(hash)} ↗
    </a>
  ) : (
    <span className="mono">{short(hash)}</span>
  );

/** Format a bigint of `decimals` fixed-point into a human string. */
export const fmtUnits = (v: bigint, decimals: number): string => {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0");
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${wholeStr}.${frac}`;
};

/** Parse "1234.56" into bigint with `decimals` places; throws on bad input. */
export const parseUnitsStrict = (s: string, decimals: number): bigint => {
  const m = s.trim().match(/^(\d+)(?:\.(\d*))?$/);
  if (!m) throw new Error(`invalid amount: ${s}`);
  const frac = (m[2] || "").padEnd(decimals, "0");
  if (frac.length > decimals) throw new Error(`too many decimal places (max ${decimals})`);
  return BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt(frac || "0");
};

export const SealedBalance = ({
  value,
  unit,
  ready,
}: {
  value: string;
  unit: string;
  ready: boolean;
}) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <div>
      <div
        className={`balance ${revealed ? "revealed" : "sealed"}`}
        onClick={() => setRevealed((r) => !r)}
        style={{ cursor: "pointer" }}
        title={revealed ? "click to seal" : "click to decrypt & reveal"}
      >
        {ready ? value : "•••••"}
        <span className="unit">{unit}</span>
      </div>
      <span className="reveal-hint">
        {revealed
          ? "🔓 decrypted locally with your key — click to seal"
          : "🔒 encrypted on-chain — click to decrypt (only you can)"}
      </span>
    </div>
  );
};
