"use client";

import {
  getAuthToken,
  useOpenFundingOptions,
} from "@dynamic-labs/sdk-react-core";
import { MONAD_TESTNET } from "@mcp-wallet/shared";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "./providers";

type WalletView = "assets" | "send" | "receive";

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

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatUsd(value: number | null) {
  return value === null ? undefined : usdFormatter.format(value);
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

export function WalletWorkspace({ walletAddress }: { walletAddress: string }) {
  const { apiUrl } = usePublicConfig();
  const { openFundingOptions } = useOpenFundingOptions();
  const [view, setView] = useState<WalletView>("assets");
  const [assets, setAssets] = useState<WalletAsset[]>();
  const [portfolioValueUsd, setPortfolioValueUsd] = useState<number | null>(null);
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
      const result = (await response.json().catch(() => undefined)) as
        | WalletResponse
        | undefined;
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

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

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
      setSendError(
        error instanceof Error ? error.message : "The transfer request could not be prepared.",
      );
      setPreparing(false);
    }
  }

  return (
    <section className="wallet-workspace" aria-label="DUO wallet">
      <aside className="wallet-navigation">
        <div className="wallet-identity">
          <span className="wallet-avatar">D</span>
          <div>
            <strong>DUO wallet</strong>
            <code>{shortAddress(walletAddress)}</code>
          </div>
        </div>
        <nav aria-label="Wallet sections">
          {(["assets", "send", "receive"] as const).map((item) => (
            <button
              key={item}
              className={view === item ? "active" : undefined}
              aria-current={view === item ? "page" : undefined}
              onClick={() => chooseView(item)}
            >
              <span className={`nav-icon nav-icon-${item}`} aria-hidden="true" />
              {item[0]?.toUpperCase()}{item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="network-badge">
          <span className="network-dot" />
          <div><span>Network</span><strong>{MONAD_TESTNET.name}</strong></div>
        </div>
      </aside>

      <div className="wallet-content">
        {view === "assets" ? (
          <section aria-labelledby="assets-title">
            <div className="workspace-heading">
              <div>
                <span className="panel-label">Portfolio</span>
                <h1 id="assets-title">Assets</h1>
              </div>
              <button className="text-button" onClick={() => void loadAssets()} disabled={loadingAssets}>
                {loadingAssets ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="balance-card">
              <span>MON balance</span>
              <strong>{loadingAssets && !nativeAsset ? "—" : `${nativeAsset?.amount ?? "0"} MON`}</strong>
              <small>
                {formatUsd(portfolioValueUsd)
                  ? `${formatUsd(portfolioValueUsd)} total asset value · Zerion`
                  : "Monad testnet assets powered by Zerion"}
              </small>
              <div className="wallet-actions">
                <button className="primary-button" onClick={() => chooseView("send")}>Send</button>
                <button className="secondary-button" onClick={() => chooseView("receive")}>Receive</button>
              </div>
            </div>

            <div className="asset-list-header">
              <span>Assets{assets ? ` · ${assets.length}` : ""}</span><span>Balance</span>
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
                    <span className="asset-token">{asset.symbol.slice(0, 1).toUpperCase()}</span>
                    <span className="asset-name">
                      <strong>{asset.name}</strong>
                      <small>
                        {asset.symbol} · {asset.type === "native" ? "Native asset" : asset.verified ? "Verified token" : "Unverified token"}
                      </small>
                    </span>
                    <span className="asset-balance">
                      <strong>{asset.amount} {asset.symbol}</strong>
                      <small>{formatUsd(asset.value_usd) ?? "Price unavailable"}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {view === "send" ? (
          <section aria-labelledby="send-title">
            <div className="workspace-heading">
              <div><span className="panel-label">Transfer</span><h1 id="send-title">Send MON</h1></div>
            </div>
            <form className="send-form" onSubmit={prepareSend}>
              <label>
                <span>Recipient address</span>
                <input
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="0x…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label>
                <span>Amount</span>
                <div className="amount-input">
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                  <strong>MON</strong>
                </div>
              </label>
              <div className="available-balance">
                <span>Available: {nativeAsset?.amount ?? "—"} MON</span>
                <span>Network fee is additional</span>
              </div>
              <div className="send-review-note">
                <span aria-hidden="true">✓</span>
                <p>You will review the full recipient and amount before DUO asks your wallet to sign.</p>
              </div>
              {sendError ? <p className="inline-error" role="alert">{sendError}</p> : null}
              <button className="primary-button wide" disabled={preparing}>
                {preparing ? "Preparing review…" : "Review transfer"}
              </button>
            </form>
          </section>
        ) : null}

        {view === "receive" ? (
          <section aria-labelledby="receive-title">
            <div className="workspace-heading">
              <div><span className="panel-label">Funding</span><h1 id="receive-title">Receive MON</h1></div>
            </div>
            <div className="receive-card">
              <div className="receive-mark" aria-hidden="true">
                <span>D</span>
              </div>
              <h2>Your DUO address</h2>
              <p>Send MON on Monad Testnet to this address only.</p>
              <code>{walletAddress}</code>
              <div className="receive-actions">
                <button className="primary-button" onClick={copyAddress}>{copied ? "Copied" : "Copy address"}</button>
                <button className="secondary-button" onClick={openFundingOptions}>Funding options</button>
              </div>
            </div>
            <div className="network-warning">
              <strong>Monad Testnet only</strong>
              <p>Assets sent on another network may not appear in DUO. Use test funds only.</p>
            </div>
            <a className="explorer-link" href={`${MONAD_TESTNET.blockExplorerUrl}/address/${walletAddress}`} target="_blank" rel="noreferrer">
              View address on explorer ↗
            </a>
          </section>
        ) : null}
      </div>
    </section>
  );
}
