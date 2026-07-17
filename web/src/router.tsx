import { useEffect, useState } from "react";

export type Route = "landing" | "app" | "docs";

const parse = (): Route => {
  const h = window.location.hash;
  if (h.startsWith("#/app")) return "app";
  if (h.startsWith("#/docs")) return "docs";
  return "landing";
};

export const useHashRoute = (): Route => {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
};

export const Nav = ({ route }: { route: Route }) => (
  <nav className="nav">
    <a href="#/" className="nav-brand">
      🔏 Veil<em>Pay</em>
    </a>
    <div className="nav-links">
      <a href="#/docs" className={route === "docs" ? "on" : ""}>
        Docs
      </a>
      <a href="https://github.com/anukulpandey/veilpay" target="_blank" rel="noreferrer">
        GitHub
      </a>
      <a href="#/app" className="nav-cta">
        {route === "app" ? "App" : "Launch App"}
      </a>
    </div>
  </nav>
);

export const Footer = () => (
  <footer className="footer">
    <div>
      <span className="nav-brand" style={{ fontSize: 15 }}>
        🔏 Veil<em>Pay</em>
      </span>
      <p className="note" style={{ marginTop: 6 }}>
        Confidential payroll on Avalanche eERC.
        <br />
        Built for the Team1 India Speedrun — Privacy on Avalanche, July 2026.
      </p>
    </div>
    <div className="footer-links">
      <a href="#/app">Launch App</a>
      <a href="#/docs">Documentation</a>
      <a href="https://github.com/anukulpandey/veilpay" target="_blank" rel="noreferrer">
        GitHub
      </a>
      <a
        href="https://testnet.snowtrace.io/address/0xCB9aB1F20d1d5Cf990694e60470FB28B23041D1b"
        target="_blank"
        rel="noreferrer"
      >
        Contract on Snowtrace
      </a>
    </div>
  </footer>
);
