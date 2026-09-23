"use client";

import {
  DynamicWidget,
  getAuthToken,
  useDynamicContext,
  useIsLoggedIn,
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import { useEffect, useMemo, useState } from "react";
import { AgentSetup } from "./agent-setup";
import { usePublicConfig } from "./providers";
import { WalletWorkspace } from "./wallet-workspace";

export function WalletDashboard() {
  const { apiUrl } = usePublicConfig();
  const mcpUrl = `${apiUrl.replace(/\/$/, "")}/mcp`;
  const isLoggedIn = useIsLoggedIn();
  const wallets = useUserWallets();
  const { sdkHasLoaded, setShowAuthFlow } = useDynamicContext();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [syncError, setSyncError] = useState<string>();
  const wallet = useMemo(
    () =>
      wallets.find(
        (candidate) =>
          candidate.connector.isEmbeddedWallet && candidate.chain.toUpperCase() === "EVM",
      ),
    [wallets],
  );

  useEffect(() => {
    if (!isLoggedIn || !wallet?.address) return;
    const token = getAuthToken();
    if (!token) return;

    const controller = new AbortController();
    void fetch(`${apiUrl}/api/session`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ wallet_address: wallet.address }),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const data = (await response.json().catch(() => undefined)) as
          | { error?: string }
          | undefined;
        setSyncError(data?.error ?? "Unable to sync the wallet session");
      } else {
        setSyncError(undefined);
      }
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name !== "AbortError") {
        setSyncError("The local API is unavailable");
      }
    });

    return () => controller.abort();
  }, [isLoggedIn, wallet?.address]);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="DUO home">
          <span className="brand-mark">D</span>
          <span>DUO</span>
        </a>
        {isLoggedIn ? <DynamicWidget variant="dropdown" /> : null}
      </header>

      {showDisclaimer ? (
        <div className="disclaimer-backdrop">
          <section
            className="disclaimer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disclaimer-title"
            aria-describedby="disclaimer-copy"
          >
            <span className="panel-label">Testnet notice</span>
            <h2 id="disclaimer-title">Use test funds only.</h2>
            <p id="disclaimer-copy">
              Review every transfer before approving. DUO is
              experimental and not financial advice.
            </p>
            <button
              className="warning-ack-button"
              autoFocus
              onClick={() => setShowDisclaimer(false)}
            >
              I understand
            </button>
          </section>
        </div>
      ) : null}

      <section className={isLoggedIn ? "hero hero-wallet" : "hero hero-solo"}>
        {!isLoggedIn ? (
          <div className="hero-copy">
            <h1>Your agent wallet.</h1>
            <p>You approve every transfer.</p>

            {!sdkHasLoaded ? (
              <div className="status-row"><span className="pulse" /> Loading secure sign-in…</div>
            ) : (
              <button className="primary-button" onClick={() => setShowAuthFlow(true)}>
                Continue with email
              </button>
            )}
          </div>
        ) : null}

        {isLoggedIn ? (
          <>
            {wallet ? <WalletWorkspace walletAddress={wallet.address} mcpUrl={mcpUrl} /> : (
              <div className="wallet-panel empty-state">
                <span className="pulse" />
                <p>Creating your embedded EVM wallet…</p>
              </div>
            )}
            {syncError ? <p className="inline-error dashboard-error">{syncError}</p> : null}
          </>
        ) : null}
      </section>

      {!isLoggedIn ? (
        <div className="public-agent-setup">
          <AgentSetup mcpUrl={mcpUrl} />
        </div>
      ) : null}
    </main>
  );
}
