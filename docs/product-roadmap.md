# DUO product roadmap

Last updated: 2026-09-10

## Vision

DUO is a secure, user-owned wallet designed for interaction through AI
agents. It should let users understand and manage their wallet from the web or an
MCP-compatible client while preserving clear authorization boundaries, explicit
policies, reliable transaction verification, and immediate user control.

The product should progress from a human-approved transaction wallet to an
optional, tightly constrained automation platform. Autonomous execution must only
be enabled when the user grants it explicitly and when multiple independent
policy layers limit the agent's authority.

## Current state

- OAuth authorization-code flow with PKCE, dynamic client registration, refresh
  rotation, and revocation.
- Email OTP authentication and one Dynamic embedded EVM wallet per user.
- Monad testnet is the only configured network.
- Zerion provides normalized Monad testnet native and ERC-20 balances, token
  metadata, and available USD values to the authenticated Assets screen.
- `wallet_get_address` provides read-only wallet identity.
- `wallet_prepare_transfer` creates an immutable native MON transfer request.
- Every transfer is reviewed and signed by the wallet owner in the browser.
- `wallet_get_transfer_status` reports approval and confirmation state.
- The server stores public wallet and transaction metadata but no private keys,
  seed phrases, Dynamic JWTs, or key shares.
- The web application supports authentication, assets, Send, Receive,
  wallet-address display, MCP client setup, OAuth consent, and transaction
  approval.

## Product principles

1. Make the wallet observable before making it more powerful.
2. Add read-only agent capabilities before new signing capabilities.
3. Bind every write request to the authenticated user, wallet, MCP client, scope,
   network, complete payload, and expiry.
4. Keep the reviewed payload immutable through signing and verification.
5. Confirm success only after independent onchain verification.
6. Use integer arithmetic for asset amounts; never use floating-point values.
7. Identify tokens by network and contract address, not symbol alone.
8. Finish a trustworthy single-network experience before adding more networks.
9. Treat token metadata, prices, quotes, calldata, and remote responses as
   untrusted external data.
10. Give users a visible pause, revocation, and human-approval fallback path.

## Product capabilities

### Application shell

- Responsive navigation for Home, Discover, Earn, Activity, and Settings.
- Persistent shortcuts for Trade, Send, Receive, and Deposit.
- Focused sheets or dialogs for transactional workflows without losing portfolio
  context.
- Accessible loading, empty, stale, failure, and retry states.

### Home and portfolio

- Aggregated portfolio value.
- Historical value change for selectable periods.
- Asset list with token name, symbol, amount, fiat value, current price, and price
  movement.
- Network filtering and per-network totals.
- Coins, collectibles, DeFi positions, and open-orders views.
- Clear indication when an asset is unpriced, hidden, unverified, or suspected
  spam.

### Send

- Recipient entry using a validated address or supported name service.
- Paste, recent recipients, and optional address-book entries.
- Native and ERC-20 asset selection.
- Amount, available balance, fiat estimate, network fee estimate, and Use max.
- Insufficient-balance, unsupported-network, and precision validation.
- Human-readable review with full recipient, asset, amount, network, fee, and
  originating MCP client.
- Pending, rejected, expired, broadcasting, confirmed, and failed states.

### Receive and funding

- QR code, full and shortened address, and one-click address copy.
- Explicit network and supported-asset guidance.
- EIP-681 funding requests with amount, asset, network, expiry, refresh, cancel,
  and status tracking.
- Region-aware third-party fiat funding only after core wallet funding is stable.

### Trade

- Pay and receive asset selectors with search and network filters.
- Available balances, fiat estimates, and Use max.
- Quote, route, price impact, fees, allowance requirements, minimum received,
  slippage, and quote expiry.
- Immutable swap request and browser approval.
- Independent verification of approvals, execution, and final asset changes.

### Discover and token details

- Search by token name, symbol, or contract address.
- Contract-first token identity with network, decimals, verification state, and
  explorer links.
- Token detail with price, price history, volume, market context, and wallet
  balance when data is available.
- Categories such as Held, Majors, Trending, New, Apps, Memes, Stocks,
  Commodities, and Recently viewed.
- Network, timeframe, category, and sort filters.
- Ranking provenance and visible risk treatment for unverified or low-liquidity
  assets.

### Activity

- Unified activity feed for requests and confirmed onchain transactions.
- Asset, status, type, client, and network filters.
- Human-readable transaction types including sends, receives, swaps, approvals,
  contract execution, funding, and signatures.
- Detail view with transaction legs, value, date, status, network, request ID,
  full hash, originating client, and explorer link.
- Immediate display of pending requests followed by reconciliation to confirmed
  transactions.

### Earn and positions

- DeFi position detection with protocol-aware labels.
- Deposited amount, current value, rewards, APY provenance, and risk disclosures.
- Position actions routed through the same request, policy, approval, and
  verification system as other contract interactions.
- Referral counts, earnings, link/code sharing, rules, and empty states as a later
  growth feature.

### Collectibles and orders

- NFT collection and item gallery with network filtering.
- Verified collection and spam indicators.
- Open limit orders, order status, expiry, fills, and execution history.
- Order creation and cancellation with explicit review and verification.

### Settings and wallet management

- Local display currency.
- Privacy mode for obscuring financial values.
- Hide-small-balances and spam-asset preferences.
- Connected MCP clients with granted scopes, authorization date, last use, policy,
  and revocation.
- Policy summary, remaining budgets, autonomous activity, and emergency pause.
- Wallet delegation grant, status, expiry, and revocation.
- Optional wallet naming and identity integrations.
- Sign out, support, terms, version, and account diagnostics.

Private-key export is not part of the product plan. Dynamic remains the wallet
custody boundary, and the application must not expose or persist private keys or
seed phrases.

## MCP tool plan

### Wallet and portfolio reads

| Tool | Purpose | Target phase |
|---|---|---|
| `wallet_get_address` | Return the authenticated wallet address and canonical network | Existing |
| `wallet_get_wallets` | List user and agent wallets, supported networks, session state, policies, and delegation state | Phase 1 |
| `wallet_get_balance` | Return the native or requested asset balance | Phase 1 |
| `wallet_get_portfolio` | Return total value and a bounded, paginated asset breakdown | Phase 1 |
| `wallet_list_assets` | Return normalized assets with balances and metadata | Phase 1 |
| `wallet_list_activity` | Return cursor-paginated activity for one explicit network | Phase 1 |
| `wallet_get_transaction` | Return a normalized request or transaction detail | Phase 1 |
| `wallet_search_tokens` | Search a network-scoped token catalog | Phase 3 |
| `wallet_get_token` | Return verified token identity and market metadata | Phase 3 |
| `wallet_chain_rpc_request` | Run a restricted read-only JSON-RPC method | Phase 6 |

### Funding and transfers

| Tool | Purpose | Target phase |
|---|---|---|
| `wallet_fund` | Create, refresh, or cancel a tracked EIP-681 funding request | Phase 1-2 |
| `wallet_prepare_transfer` | Prepare a native or ERC-20 transfer for policy evaluation and approval | Existing; expand in Phase 2 |
| `wallet_cancel_transfer` | Cancel a pending request created by the same client | Phase 2 |
| `wallet_get_request_status` | Return common status for every request type | Phase 2 |

### Swaps and signatures

| Tool | Purpose | Target phase |
|---|---|---|
| `wallet_get_swap_quote` | Return a read-only quote with route, fees, impact, and expiry | Phase 4 |
| `wallet_prepare_swap` | Prepare an immutable swap request | Phase 4 |
| `wallet_prepare_signature` | Prepare a personal or typed-data signature request | Phase 5 |

### Contract and payment tools

| Tool | Purpose | Target phase |
|---|---|---|
| `wallet_prepare_calls` | Prepare a simulated same-network batch of contract calls | Phase 6 |
| `wallet_web_request` | Call an explicitly allowlisted partner API through a restricted gateway | Phase 6 |
| `wallet_help` | Return versioned capabilities and supported integration guidance | Phase 6 |
| `wallet_initiate_x402_request` | Initiate a paid HTTP request with an explicit maximum payment | Phase 7 |
| `wallet_complete_x402_request` | Complete one approved, bound, idempotent paid request | Phase 7 |

### Tool contract requirements

- Resolve the active authenticated wallet server-side.
- Reject wallet addresses that are not owned by the authenticated user.
- Allow transactional tools only for wallets authorized in the current session.
- Use canonical network identifiers returned by `wallet_get_wallets`.
- Accept human-readable decimal strings and convert them using asset decimals.
- Require contract address and decimals for an unknown ERC-20.
- Bound list sizes and use opaque cursors for activity.
- Return concise text plus structured content for every tool.
- Mark genuinely read-only tools with MCP read-only annotations.
- Require a dedicated OAuth scope for each materially different write authority.
- Return a request ID and approval URL unless a valid autonomous policy permits
  execution.
- Return `completed` only after the relevant verifier confirms the transaction or
  signature.

## Architecture roadmap

### Shared domain models

Define normalized contracts in `packages/shared`:

- `Network`
- `Wallet`
- `Asset`
- `Balance`
- `Portfolio`
- `Activity`
- `Transaction`
- `WalletRequest`
- `Policy`
- `PolicyDecision`

The API, MCP tools, web application, approval UI, and background workers must use
the same domain definitions.

### Service boundaries

- `WalletAccessService`: ownership, active wallet, OAuth client, session scopes,
  delegation, policy, and limits.
- `ChainRegistry`: canonical network identity, RPC, explorer, native asset, and
  capability matrix.
- `ChainDataProvider`: balances, receipts, logs, fees, blocks, and simulations.
- `PortfolioProvider`: asset normalization, prices, P&L, and pagination.
- `TokenCatalog`: token identity, metadata, search, and trust signals.
- `NameResolver`: address and supported name-service resolution.
- `RequestOrchestrator`: immutable request creation, policy evaluation, approval,
  rejection, expiry, signing, broadcast, verification, idempotency, and status.
- `QuoteProvider`: swap routes, fees, price impact, allowances, and minimum output.
- `RestrictedHttpClient`: approved partner APIs and x402 endpoints.
- `DelegatedSigningService`: isolated use of encrypted Dynamic delegation
  material.

Provider calls should not be embedded directly in MCP handlers. Tool handlers
should validate input, enforce scope, call a domain service, and format a stable
result.

### Generic request model

Generalize the current `transfer_requests` design into a shared request envelope
with typed detail tables.

Shared fields:

- request ID and request type
- user, wallet, network, OAuth client, and required scope
- immutable normalized review summary and payload digest
- state and structured decision/failure code
- idempotency key and optional provider reference
- created, expiry, approved/rejected, submitted, and resolved timestamps
- verified transaction hashes or signature result

Typed detail tables should store immutable transfer, swap, signature, batch-call,
funding, and x402 fields. Avoid using an unvalidated JSON payload as the sole
source of truth.

Status transitions must use conditional updates so approval, rejection, expiry,
cancellation, signing workers, and verification workers cannot overwrite one
another.

### OAuth scopes

| Scope | Authority |
|---|---|
| `wallet:read` | Wallets, balances, portfolio, token search, activity, transaction detail, and restricted read RPC |
| `wallet:transfer` | Native/ERC-20 transfer and tracked funding-request management |
| `wallet:swap` | Swap request creation |
| `wallet:sign` | Personal and typed-data signature requests |
| `wallet:contract` | Arbitrary or batched contract calls |
| `wallet:x402` | Paid HTTP requests with a maximum payment |

Quote lookup can remain read-only. Arbitrary contract calls must not inherit
ordinary transfer permission because calldata can create unlimited approvals or
invoke unrelated contracts.

## Policy-constrained agent access

### Target operating modes

| Mode | Behavior | Intended use |
|---|---|---|
| Human approval | Every write is reviewed and signed in the browser | Default and fallback |
| Delegated with policy | The server signs only after both application and wallet-provider policies pass | Repetitive, low-value, explicitly constrained actions |
| Dedicated autonomous wallet | An isolated, minimally funded wallet operates within strict policy | Bots, scheduled jobs, and machine payments |

The first autonomous deployment should use a dedicated, minimally funded wallet.
Blast radius is then limited by both policy and the balance held in the wallet.

### Dynamic capabilities and constraints

Dynamic documents delegated access for v3 TSS-MPC embedded wallets:

1. The user approves delegation for a specific wallet.
2. Dynamic sends an encrypted delegated MPC share and per-wallet API key to a
   verified webhook.
3. A server-side SDK can sign or send on behalf of the wallet.
4. Revocation triggers a webhook and the application deletes the delegation
   material.

Dynamic also documents pre-signing Policies & Rules with:

- allow and deny rules
- chain and chain-ID restrictions
- address allowlists and denylists
- transaction simulation and execution-path address evaluation
- native and token value limits
- per-call limits and an API field for cumulative limits
- contract ABI, function name, and argument constraints in the API schema
- environment, account, wallet, and signer layers
- policy auditability and violation webhooks
- operation restrictions such as blocking key export or client signing

Current vendor constraints:

- Dynamic v3 TSS-MPC wallets are required.
- Production delegated access requires a Dynamic Enterprise plan.
- Wallet and signer policy layers are marked early access.
- Function and argument constraints appear in the API schema, but their detailed
  behavior and availability require confirmation.
- Monad testnet is supported by Dynamic's balance APIs, but delegated signing,
  policy simulation, and broadcast support for chain ID 10143 require explicit
  vendor confirmation.

Delegated access cannot export private keys, refresh or reshare the wallet, or
modify policies. The delegated signer must never be able to relax its own limits.

### Defense in depth

Autonomous execution must pass every layer:

1. **OAuth scope** — the MCP client has the required capability.
2. **Application policy** — network, asset, recipient, contract, method,
   arguments, amount, cumulative budget, rate, and expiry are allowed.
3. **Simulation and decoding** — the expected execution path and asset changes
   match the request.
4. **Provider policy** — the strongest supported restrictions are enforced before
   signing outside the application process.
5. **Isolated signer** — delegation material is decrypted only inside a dedicated
   worker using envelope encryption backed by a managed key service.
6. **Verification** — the exact receipt or signature is independently checked.
7. **Audit and response** — budgets are consumed atomically, activity is recorded,
   and anomaly controls can pause execution.

The delegated share, per-wallet API key, and developer credentials together are
highly sensitive signing material. They must never appear in the web application,
MCP output, logs, analytics, error reports, or the general API process.

Never enable a policy that blocks the wallet owner from revoking delegation.
Never permit automatic arbitrary message signing, typed-data signing, token
approvals, or raw contract calls. These operations can create authority that
bypasses an apparent transfer limit.

### Initial autonomous policy

- One dedicated wallet.
- One explicitly supported network.
- One asset identified by contract address and decimals.
- A small recipient or service-contract allowlist.
- A small maximum per request.
- A lower cumulative session and daily budget.
- Exact allowed function selectors and constrained arguments.
- Short policy and delegation expiry.
- No swaps, bridges, arbitrary calls, approvals, or message signing.
- Human approval fallback for every non-matching or ambiguous request.
- Immediate owner revocation and a server-side emergency pause.

## Security requirements

- Simulate transfers, swaps, and contract calls before approval or autonomous
  execution whenever supported.
- Display decoded intent and raw destination/contract identifiers.
- For EIP-712, render the domain, chain ID, verifying contract, primary type, and
  every message field; flag permits and unlimited approvals.
- Cap contract-call batch length, calldata size, and total native value.
- Require one network per batch and do not claim atomicity unless the wallet
  mechanism guarantees it.
- Restrict RPC proxying with a positive method allowlist. Reject submission,
  subscription, debug, admin, tracing, and provider-specific write methods.
- Restrict partner HTTP to HTTPS and server-controlled hostnames; defend against
  SSRF, unsafe redirects, sensitive headers, oversized responses, and secret
  logging.
- Bind x402 authorization to method, URL, body digest, recipient, asset, network,
  amount ceiling, challenge expiry, and one idempotent replay.
- Verify webhook signatures against the raw request body using constant-time
  comparison.
- Encrypt delegated material again before storage and support rotation without
  interrupting revocation.
- Add rate limits, velocity limits, anomaly detection, automatic pauses, and
  violation alerts before production autonomy.

## Delivery roadmap

### Phase 0: Product and provider decisions

Objective: establish stable contracts and remove architectural ambiguity.

- Confirm whether Monad testnet remains the first network or the project is moving
  to another network.
- Use Zerion for Monad testnet native/ERC-20 balances, token metadata, and
  available prices. Keep direct JSON-RPC for transaction verification.
- Select providers for transaction history, simulations, and swap quotes.
- Implement shared domain contracts and provider interfaces.
- Define data freshness, caching, pagination, rate limits, degraded states, and
  price-unavailable behavior.
- Define the generic request model and state machine before adding more writes.

Exit criteria:

- One network is canonical across the shared package, web app, API, approvals,
  tools, and documentation.
- Provider interfaces are isolated and mockable.
- Request-state invariants and conditional transitions are tested.

### Phase 1: Wallet visibility

Objective: answer “what do I own and what happened?” in web and MCP.

- Native balance and refresh state.
- Token list with amount, metadata, contract, price when available, and explorer
  links.
- Portfolio total with explicit partial and unpriced states.
- Receive QR and network safety messaging.
- Unified activity list for onchain transactions and local requests.
- Transaction detail view.
- Privacy mode and hide-small-balances preferences.
- Read-only MCP tools for wallet identity, balances, portfolio, assets, activity,
  and transactions.

Exit criteria:

- Web and MCP return the same balance and recent confirmed transactions.
- Empty, loading, stale, rate-limited, and provider-failure states are tested.
- No endpoint exposes a wallet not bound to the authenticated user.

### Phase 2: Complete transfers and request orchestration

Objective: provide a complete, reusable payment lifecycle.

- Generalize request status across all future write types.
- Add Send to the dashboard using the existing approval flow.
- Add fee estimates, spendable balance, fiat estimates, and insufficient-funds
  checks.
- Add address validation, recent recipients, and optional address book.
- Add explicit rejection and cancellation.
- Reconcile pending requests to confirmed activity.
- Add ERC-20 transfers after native transfer behavior is complete.
- Add tracked funding requests with refresh and cancel.

Exit criteria:

- Web and MCP can create the same immutable transfer request.
- Signing remains in the browser.
- Sender, recipient, asset, amount, network, and success are verified independently.

### Phase 3: Token intelligence

Objective: provide trustworthy asset search and details.

- Token catalog keyed by network and native/contract identity.
- Search by name, symbol, and address.
- Token details, price data, market context, verification, and explorer links.
- Held, Majors, and Recently viewed categories first.
- Trending and New only after ranking provenance and abuse controls exist.
- Spam and symbol-collision defenses.

Exit criteria:

- Every asset action uses network plus contract/native identity.
- Unverified and spam assets are visibly differentiated and filterable.

### Phase 4: Swaps

Objective: add safe asset trading through immutable requests.

- Quote-only API and UI.
- Route, fees, price impact, allowance, minimum received, slippage, and expiry.
- Safe Use max behavior that preserves network fees.
- Immutable swap requests and dedicated browser review.
- Independent approval and settlement verification.
- Swap activity records and MCP quote/prepare/status tools.
- Add `wallet:swap` authorization.

Exit criteria:

- Quote expiry, slippage, token approvals, price impact, and fees are tested.
- Signed calldata cannot differ from the reviewed request.

### Phase 5: Client controls, signatures, and application policies

Objective: make agent authority visible and enforceable while retaining approval.

- Connected-client page with scopes, last use, policies, and revocation.
- Per-client assets, recipients, functions, per-request limits, cumulative limits,
  rate limits, and expiry.
- Policy decision and budget tables with atomic reservation/consumption.
- Authorization and transaction audit log.
- Personal-message signing with full human review.
- Typed-data signing only after complete domain and permit-risk rendering.
- Add `wallet:sign` authorization.
- Continue browser approval while validating policy decisions in dry-run mode.

Exit criteria:

- Revocation invalidates the intended client's tokens without affecting others.
- Limits are enforced server-side.
- Completed signatures are recovered and verified against the wallet address.

### Phase 6: Contract tooling and advanced portfolio

Objective: support protocol interactions through a controlled execution surface.

- Restricted read-only RPC tool.
- Simulated contract-call batches with decoding and dedicated authorization.
- Restricted partner HTTP client only for explicitly supported integrations.
- Capability/help metadata for agents.
- Historical portfolio chart and P&L.
- DeFi positions, collectibles, open orders, decoded contract activity, and
  notifications.

Exit criteria:

- Arbitrary calls require `wallet:contract` and always require human approval.
- The RPC and HTTP gateways pass allowlist, SSRF, redirect, header, and response
  limit tests.
- Every new write has an immutable detail model and verifier.

### Phase 7: Delegated automation canary

Objective: prove tightly bounded automatic execution on sandbox/testnet.

- Confirm v3 wallet configuration and vendor access requirements.
- Confirm delegated signing and policy support for the selected network.
- Prove delegation grant, compliant execution, policy violation, revocation, and
  rotation in an isolated prototype.
- Implement signed delegation/violation webhooks and encrypted credential storage.
- Add an isolated signing worker.
- Mirror application policy into a non-signer-modifiable provider policy.
- Enable automatic execution for one conservative allowlisted payment policy and
  internal canary account.
- Fall back to browser approval for missing, stale, ambiguous, unsupported, or
  exceeded constraints.

Exit criteria:

- A database compromise alone cannot produce usable signing credentials.
- Policy-violating requests fail at both application and provider layers.
- Pause and revocation stop execution immediately.
- Budgets and idempotency remain correct across retries and concurrent requests.

### Phase 8: Bounded automation and network expansion

Objective: release opt-in autonomy and expand network coverage safely.

- User-facing delegation consent with authority, limits, expiry, and revocation.
- Small-balance, small-limit production rollout using dedicated wallets.
- Daily/session caps, velocity controls, anomaly detection, alerts, and circuit
  breakers.
- Human approval for policy creation or expansion; immediate pause and reductions.
- Add networks one at a time using a capability matrix for read, receive, send,
  swap, fees, policies, and delegated signing.
- Add bridging only with destination guarantees and partial-failure handling.
- Add x402 only on explicitly supported networks with `wallet:x402` authorization.
- Evaluate fiat funding after core funding and automation are stable.

Exit criteria:

- Autonomous access is opt-in, time-limited, observable, and revocable.
- Each supported network passes the complete safety and verification suite.
- Assets, recipients, functions, and limits expand only from reviewed evidence.

### Phase 9: Growth features

Objective: add non-core discovery and growth loops after wallet utility is stable.

- Richer asset categories and discovery ranking.
- Referral program and earnings dashboard.
- Optional naming and verification integrations.
- Advanced alerts and user-configured notifications.

## Release milestones

1. **Wallet visibility:** balances, portfolio, receive QR, activity, explorer
   links, privacy, and read-only MCP tools.
2. **Reliable payments:** complete send UI, common request state, cancellation,
   reconciliation, tracked funding, and ERC-20 transfers.
3. **Asset intelligence:** token catalog, search, details, verification, prices,
   and discovery.
4. **Safe trading:** quotes, swap approvals, immutable requests, and settlement
   verification.
5. **Agent controls:** connected clients, revocation, application policies,
   budgets, signatures, and audit log.
6. **Protocol access:** restricted RPC/HTTP, simulated contract batches, DeFi
   positions, collectibles, and orders.
7. **Policy-constrained automation:** isolated delegated signing, canary rollout,
   circuit breakers, and explicit opt-in.
8. **Network and product breadth:** additional networks, machine payments,
   funding integrations, and growth features.

## First implementation epic

The first engineering epic is **Wallet visibility**:

1. Add a Zerion provider adapter for Monad testnet fungible positions.
2. Add normalized native and token balance services with mocked tests, then add
   the activity service.
3. Add authenticated API routes for the web dashboard.
4. Build Home portfolio, Receive, Activity, and transaction-detail surfaces.
5. Add `wallet_get_balance`, `wallet_get_portfolio`, `wallet_list_assets`,
   `wallet_list_activity`, and `wallet_get_transaction`.
6. Add privacy mode, pagination, explorer links, and complete failure states.
7. Run typecheck, tests, production build, and funded-wallet manual acceptance.

This release delivers immediate user value, establishes the shared data model,
and introduces no new signing authority.

## External dependencies requiring confirmation

- [Zerion supported chains](https://developers.zerion.io/supported-blockchains)
- [Zerion wallet fungible positions](https://developers.zerion.io/api-reference/wallets/get-wallet-fungible-positions)
- [Dynamic agent wallet patterns](https://www.dynamic.xyz/docs/overview/agents/overview)
- [Dynamic delegated access](https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/delegated-access/overview)
- [Dynamic delegation webhook and storage](https://www.dynamic.xyz/docs/react/wallets/embedded-wallets/mpc/delegated-access/receiving-delegation)
- [Dynamic Policies & Rules](https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/overview)
- [Dynamic policy layers](https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/policy-layers)
- [Dynamic policy API](https://www.dynamic.xyz/docs/api-reference/waas/create-a-new-waas-policy-for-an-environment-or-add-new-rules-to-an-existing-policy)
