"use client";

import {
  getAuthToken,
  useOpenFundingOptions,
} from "@dynamic-labs/sdk-react-core";
import { MONAD_TESTNET } from "@mcp-wallet/shared";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AgentSetup } from "./agent-setup";
import { usePublicConfig } from "./providers";

type WalletView = "home" | "send" | "receive" | "agent";
type ActionIcon = "home" | "send" | "receive" | "fund" | "agent";

interface WalletAsset {
  id: string;
  type: "native" | "erc20";
  name: string;
  symbol: string;
  decimals: number;
  amount: string;
  amount_raw: string;
  contract_address: string | null;
  price_usd: number | null;
  value_usd: number | null;
  change_1d: number | null;
  icon_url: string | null;
  verified: boolean;
}

interface WalletResponse {
  wallet: {
    address: string;
    chain: string;
    network: string;
    chain_id: number;
  };
  portfolio: {
    total_value_usd: number | null;
    currency: "usd";
    source: "zerion";
  };
  assets: WalletAsset[];
  error?: string;
}

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 6,
});

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatUsd(value: number | null) {
  return value === null ? undefined : usdFormatter.format(value);
}

function formatPrice(value: number | null) {
  return value === null ? undefined : priceFormatter.format(value);
}

function formatAllocation(value: number | null, total: number | null) {
  if (value === null || total === null || total <= 0) return "—";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function amountToWei(value: string) {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,18}))?$/.exec(value.trim());
  if (!match) return undefined;
  const whole = BigInt(match[1] ?? "0");
  const fraction = (match[2] ?? "").padEnd(18, "0");
  return whole * 10n ** 18n + BigInt(fraction || "0");
}

function assetErrorMessage(error?: string) {
  if (error === "assets_indexing") {
    return "Zerion is indexing this wallet. Try refreshing in a few seconds.";
  }
  if (error === "assets_lookup_failed") {
    return "Zerion did not return Monad testnet assets. Try refreshing.";
  }
  if (error === "invalid_dynamic_session") return "Your wallet session has expired.";
  return "The wallet balance is temporarily unavailable.";
}

function WalletIcon({ name }: { name: ActionIcon }) {
  if (name === "home") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /></svg>;
  }
  if (name === "send") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.5 18-3.2-7.3L3 10.5zM10.3 13.7 21 3" /></svg>;
  }
  if (name === "receive") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v13m0 0 5-5m-5 5-5-5M5 21h14" /></svg>;
  }
  if (name === "fund") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h8M8 12h5M6 3h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /></svg>;
}

export function WalletWorkspace({
  walletAddress,
  mcpUrl,
}: {
  walletAddress: string;
  mcpUrl: string;
}) {
  const { apiUrl } = usePublicConfig();
  const { openFundingOptions } = useOpenFundingOptions();
  const [view, setView] = useState<WalletView>("home");
  const [assets, setAssets] = useState<WalletAsset[]>();
  const [portfolioValueUsd, setPortfolioValueUsd] = useState<number | null>(null);
  const [hasActivity, setHasActivity] = useState<boolean>();
  const [assetError, setAssetError] = useState<string>();
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [copied, setCopied] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendError, setSendError] = useState<string>();
  const [preparing, setPreparing] = useState(false);

  const nativeAsset = assets?.find((asset) => asset.type === "native");
  const balanceWei = useMemo(
    () => (nativeAsset ? BigInt(nativeAsset.amount_raw) : undefined),
    [nativeAsset],
  );

  const loadAssets = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setAssetError("invalid_dynamic_session");
      setLoadingAssets(false);
      return;
    }

    setLoadingAssets(true);
    setAssetError(undefined);
    try {
      const response = await fetch(
        `${apiUrl}/api/wallet?address=${encodeURIComponent(walletAddress)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const result = (await response.json().catch(() => undefined)) as WalletResponse | undefined;
      if (!response.ok || !result) {
        throw new Error(result?.error ?? "assets_lookup_failed");
      }
      setAssets(result.assets);
      setPortfolioValueUsd(result.portfolio.total_value_usd);
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : "assets_lookup_failed");
    } finally {
      setLoadingAssets(false);
    }
  }, [apiUrl, walletAddress]);

  const loadActivity = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const response = await fetch(
        `${apiUrl}/api/transfers/activity?wallet_address=${encodeURIComponent(walletAddress)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const result = (await response.json().catch(() => undefined)) as { has_activity?: boolean } | undefined;
      if (response.ok && typeof result?.has_activity === "boolean") {
        setHasActivity(result.has_activity);
      }
    } catch {
      // Keep onboarding in the sidebar when activity cannot be determined.
    }
  }, [apiUrl, walletAddress]);

  useEffect(() => {
    void loadAssets();
    void loadActivity();
  }, [loadActivity, loadAssets]);

  async function copyAddress() {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  }

  function chooseView(nextView: WalletView) {
    setView(nextView);
    setSendError(undefined);
  }

  async function prepareSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendError(undefined);

    const normalizedRecipient = recipient.trim();
    const amountWei = amountToWei(amount);
    if (!addressPattern.test(normalizedRecipient)) {
      setSendError("Enter a complete EVM recipient address.");
      return;
    }
    if (normalizedRecipient.toLowerCase() === walletAddress.toLowerCase()) {
      setSendError("The recipient cannot be your DUO wallet.");
      return;
    }
    if (!amountWei || amountWei <= 0n) {
      setSendError("Enter a positive MON amount with no more than 18 decimals.");
      return;
    }
    if (balanceWei !== undefined && amountWei > balanceWei) {
      setSendError("This amount is greater than your available balance.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setSendError("Your wallet session has expired. Sign in again.");
      return;
    }

    setPreparing(true);
    try {
      const response = await fetch(`${apiUrl}/api/transfers`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          recipient_address: normalizedRecipient,
          amount,
        }),
      });
      const result = (await response.json().catch(() => undefined)) as
        | { approval_url?: string; error?: string; message?: string }
        | undefined;
      if (!response.ok || !result?.approval_url) {
        throw new Error(
          result?.error === "recipient_is_sender"
            ? "The recipient cannot be your DUO wallet."
            : result?.message ?? "The transfer request could not be prepared.",
        );
      }
      window.location.assign(result.approval_url);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The transfer request could not be prepared.");
      setPreparing(false);
    }
  }

  return (
    <section className="wallet-workspace" aria-label="DUO wallet">
      <aside className="wallet-navigation">
        <div className="wallet-identity">
          <span className="wallet-avatar">D</span>
          <div>
            <strong>DUO</strong>
            <code>{shortAddress(walletAddress)}</code>
          </div>
        </div>

        <nav aria-label="Wallet sections">
          <button className={view === "home" ? "active" : undefined} aria-current={view === "home" ? "page" : undefined} onClick={() => chooseView("home")}>
            <span className="sidebar-icon"><WalletIcon name="home" /></span>
            Home
          </button>
          <button className={view === "agent" ? "active" : undefined} aria-current={view === "agent" ? "page" : undefined} onClick={() => chooseView("agent")}>
            <span className="sidebar-icon"><WalletIcon name="agent" /></span>
            Agent setup
          </button>
        </nav>

        <div className="network-badge">
          <span className="network-dot" />
          <div><span>Network</span><strong>{MONAD_TESTNET.name}</strong></div>
        </div>
      </aside>

      <div className="wallet-content">
        {view === "home" ? (
          <section aria-labelledby="home-title">
            <div className="workspace-heading">
              <h1 id="home-title">Home</h1>
              <button className="refresh-button" onClick={() => void loadAssets()} disabled={loadingAssets}>
                {loadingAssets ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="portfolio-card">
              <span>Portfolio value</span>
              <strong>{loadingAssets && assets === undefined ? "—" : formatUsd(portfolioValueUsd) ?? "$0.00"}</strong>
              <small>Fungible assets on Monad Testnet · Zerion</small>
            </div>

            <div className="quick-actions" aria-label="Wallet actions">
              <button onClick={() => chooseView("send")}><span><WalletIcon name="send" /></span><strong>Send</strong></button>
              <button onClick={() => chooseView("receive")}><span><WalletIcon name="receive" /></span><strong>Receive</strong></button>
              <button onClick={openFundingOptions}><span><WalletIcon name="fund" /></span><strong>Fund</strong></button>
            </div>

            <div className="token-toolbar">
              <div className="token-tabs" role="tablist" aria-label="Asset types">
                <button role="tab" aria-selected="true">Tokens</button>
              </div>
              <span className="single-network"><span className="network-dot" /> {MONAD_TESTNET.name}</span>
            </div>

            <div className="asset-table-header" aria-hidden="true">
              <span>Asset</span><span>Balance</span><span>Portfolio</span><span>Price</span>
            </div>

            {assetError ? (
              <div className="workspace-error">
                <p>{assetErrorMessage(assetError)}</p>
                <button className="text-button" onClick={() => void loadAssets()}>Try again</button>
              </div>
            ) : loadingAssets && !assets ? (
              <div className="asset-loading"><span className="pulse" /> Reading onchain balance…</div>
            ) : (
              <div className="asset-rows">
                {assets?.map((asset) => (
                  <div className="asset-row" key={asset.id}>
                    <span className="asset-token">
                      {asset.icon_url ? <img src={asset.icon_url} alt="" /> : asset.symbol.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="asset-name"><strong>{asset.name}</strong><small>{asset.symbol}</small></span>
                    <span className="asset-balance"><strong>{formatUsd(asset.value_usd) ?? "—"}</strong><small>{asset.amount} {asset.symbol}</small></span>
                    <span className="asset-allocation">{formatAllocation(asset.value_usd, portfolioValueUsd)}</span>
                    <span className="asset-price">
                      <strong>{formatPrice(asset.price_usd) ?? "—"}</strong>
                      {asset.change_1d !== null ? (
                        <small className={asset.change_1d >= 0 ? "positive" : "negative"}>{asset.change_1d >= 0 ? "▲" : "▼"} {Math.abs(asset.change_1d).toFixed(2)}%</small>
                      ) : <small>Price unavailable</small>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hasActivity === false ? (
              <div className="first-run-setup">
                <div className="first-run-copy">
                  <span>Next step</span>
                  <h2>Connect DUO to your agent</h2>
                  <p>Your wallet has no transfer activity yet. Install the MCP server to let your agent prepare requests for you to review.</p>
                </div>
                <AgentSetup mcpUrl={mcpUrl} />
              </div>
            ) : null}
          </section>
        ) : null}

        {view === "send" ? (
          <section aria-labelledby="send-title" className="focused-wallet-view">
            <div className="workspace-heading">
              <div><span className="panel-label">Transfer</span><h1 id="send-title">Send MON</h1></div>
              <button className="refresh-button" onClick={() => chooseView("home")}>Back home</button>
            </div>
            <form className="send-form" onSubmit={prepareSend}>
              <label><span>Recipient address</span><input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} /></label>
              <label><span>Amount</span><div className="amount-input"><input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" /><strong>MON</strong></div></label>
              <div className="available-balance"><span>Available: {nativeAsset?.amount ?? "—"} MON</span><span>Network fee is additional</span></div>
              <div className="send-review-note"><span aria-hidden="true">✓</span><p>You will review the full recipient and amount before DUO asks your wallet to sign.</p></div>
              {sendError ? <p className="inline-error" role="alert">{sendError}</p> : null}
              <button className="primary-button wide" disabled={preparing}>{preparing ? "Preparing review…" : "Review transfer"}</button>
            </form>
          </section>
        ) : null}

        {view === "receive" ? (
          <section aria-labelledby="receive-title" className="focused-wallet-view">
            <div className="workspace-heading">
              <div><span className="panel-label">Funding</span><h1 id="receive-title">Receive MON</h1></div>
              <button className="refresh-button" onClick={() => chooseView("home")}>Back home</button>
            </div>
            <div className="receive-card">
              <div className="receive-mark" aria-hidden="true"><span>D</span></div>
              <h2>Your DUO address</h2>
              <p>Send MON on Monad Testnet to this address only.</p>
              <code>{walletAddress}</code>
              <div className="receive-actions">
                <button className="primary-button" onClick={copyAddress}>{copied ? "Copied" : "Copy address"}</button>
                <button className="secondary-button" onClick={openFundingOptions}>Funding options</button>
              </div>
            </div>
            <div className="network-warning"><strong>Monad Testnet only</strong><p>Assets sent on another network may not appear in DUO. Use test funds only.</p></div>
            <a className="explorer-link" href={`${MONAD_TESTNET.blockExplorerUrl}/address/${walletAddress}`} target="_blank" rel="noreferrer">View address on explorer ↗</a>
          </section>
        ) : null}

        {view === "agent" ? (
          <section aria-labelledby="agent-view-title" className="focused-wallet-view agent-view">
            <div className="workspace-heading">
              <div><span className="panel-label">Settings</span><h1 id="agent-view-title">Agent setup</h1></div>
              <button className="refresh-button" onClick={() => chooseView("home")}>Back home</button>
            </div>
            <AgentSetup mcpUrl={mcpUrl} />
          </section>
        ) : null}
      </div>
    </section>
  );
}
