# DUO

DUO is an OAuth-protected wallet with a Model Context Protocol server, backed by a Dynamic embedded wallet on Monad testnet.

It lets a coding agent read a wallet address and prepare native MON transfers. The agent never receives a private key or signing authority: every transfer is reviewed and signed by the wallet owner in the browser.

## Features

- OAuth authorization-code flow with PKCE, dynamic client registration, refresh-token rotation, and revocation.
- MCP Streamable HTTP endpoint with OAuth discovery metadata.
- Email OTP authentication through Dynamic and an automatically created embedded EVM wallet.
- Monad testnet fungible balances, token metadata, and available USD values through Zerion.
- `wallet_get_address` under the `wallet:read` scope.
- `wallet_prepare_transfer` and `wallet_get_transfer_status` under the `wallet:transfer` scope.
- Immutable, short-lived transfer requests with explicit browser approval.
- Independent server verification of the confirmed sender, recipient, and amount.
- PostgreSQL persistence with hashed OAuth tokens and no wallet secrets.

The current transfer implementation supports native testnet MON only. ERC-20 transfers, delegated signing, and server-side signing are intentionally excluded.

---

## For users

### 1. Create your wallet

Visit the [DUO website](https://web-production-5396e.up.railway.app/), select **Continue with email**, and complete sign-up.

### 2. Connect your coding agent

Add this remote HTTP MCP server to your MCP-compatible agent:

| Setting | Value |
|---|---|
| Name | `mcp-wallet` |
| URL | [https://sweet-grace-production-42fd.up.railway.app/mcp](https://sweet-grace-production-42fd.up.railway.app/mcp) |

Complete the authorization screen when it opens.

### 3. Use it

Ask your agent to get your wallet address or prepare a Monad testnet transfer. Preparing a transfer never moves funds by itself; every transfer must be reviewed and approved in your browser.

> DUO currently uses Monad testnet. Use testnet funds only.

---

## For contributors: develop DUO

### Local setup

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Docker Compose and Git.
2. Create a sandbox environment in the [Dynamic dashboard](https://app.dynamic.xyz).
3. Enable Email OTP authentication and EVM embedded wallets with **Create on sign up**.
4. Copy the Dynamic environment ID.
5. Create an API key in the [Zerion dashboard](https://dashboard.zerion.io).
6. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

7. Set at least these values in `.env`:

   ```dotenv
   DYNAMIC_ENVIRONMENT_ID=your-dynamic-environment-id
   ZERION_API_KEY=your-zerion-api-key
   TOKEN_PEPPER=replace-this-with-a-long-random-value
   ```

   Generate a suitable pepper with `openssl rand -hex 32`. Never commit `.env`.

8. Build and start the complete stack:

   ```bash
   docker compose up --build
   ```

The first build may take several minutes. The one-shot `migrate` service must finish before the API, web application, and worker become ready.

| Local service | URL |
|---|---|
| Wallet website | [http://localhost:3000](http://localhost:3000) |
| MCP endpoint | `http://localhost:3001/mcp` |
| API health | [http://localhost:3001/health](http://localhost:3001/health) |
| API readiness | [http://localhost:3001/ready](http://localhost:3001/ready) |

To run in the background and follow logs:

```bash
docker compose up --build -d
docker compose logs -f
```

To stop and remove the containers while preserving PostgreSQL data:

```bash
docker compose down
```

To also delete the local PostgreSQL volume:

```bash
docker compose down -v
```

The second command permanently deletes local users, OAuth grants, and transfer records.

### Toolchain

- Node.js 24
- pnpm 11.24.0 through Corepack
- Docker Desktop with Docker Compose
- PostgreSQL 17, normally provided by Compose

Enable the repository's pnpm version and install dependencies:

```bash
corepack enable
pnpm install
```

### Repository structure

```text
apps/
  api/       OAuth authorization server, MCP server, sessions, and transfer APIs
  web/       Next.js wallet, consent, and transfer-approval UI
  worker/    Background worker process
packages/
  db/        Drizzle schema, PostgreSQL client, and SQL migrations
  shared/    Shared scopes, network constants, and types
compose.yaml Local service orchestration
Dockerfile   Development and production build targets
```

### Local development workflows

The recommended full-stack workflow is:

```bash
docker compose up --build
```

Source directories are mounted into the development containers, and the API and web services watch for changes.

You can run workspace checks directly on the host after `pnpm install`:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Useful commands:

| Command | Purpose |
|---|---|
| `pnpm dev` | Run all workspace development processes without Compose. External PostgreSQL is still required. |
| `pnpm typecheck` | Type-check every workspace. |
| `pnpm test` | Run all automated tests. |
| `pnpm build` | Create production builds for every workspace. |
| `pnpm lint` | Run the repository's current static checks. |
| `pnpm db:generate` | Generate a Drizzle SQL migration from schema changes. |
| `pnpm db:migrate` | Apply pending migrations using `DATABASE_URL`. |

### Environment variables

| Variable | Used by | Secret | Description |
|---|---|---:|---|
| `WEB_URL` | API | No | Exact public origin of the browser application. |
| `API_URL` | API and web | No | Exact public origin of the API and OAuth issuer. |
| `DYNAMIC_ENVIRONMENT_ID` | API and web | No | Dynamic project environment identifier. |
| `MONAD_RPC_URL` | API and web | No | Monad testnet JSON-RPC endpoint. |
| `ZERION_API_URL` | API | No | Zerion API origin; defaults to `https://api.zerion.io`. |
| `ZERION_API_KEY` | API | Yes | Server-side API key for Monad testnet assets and balances. |
| `DATABASE_URL` | API, worker, migration | Yes | PostgreSQL connection string. Compose overrides it for containers. |
| `TOKEN_PEPPER` | API | Yes | Server-side pepper used when hashing OAuth tokens. Use at least 24 characters. |
| `PORT` | API | No | API listen port; defaults to `3001`. |

Never expose `ZERION_API_KEY`, `TOKEN_PEPPER`, or a production `DATABASE_URL` to browser code. The web application receives only public configuration at runtime.

### Database changes

1. Update `packages/db/src/schema.ts`.
2. Generate a migration:

   ```bash
   pnpm db:generate
   ```

3. Inspect the generated SQL under `packages/db/drizzle/`. Do not apply a migration that unexpectedly recreates existing tables or drops data.
4. Apply it locally:

   ```bash
   pnpm db:migrate
   ```

Compose applies pending migrations automatically through the one-shot `migrate` service.

Commit the schema change, SQL migration, Drizzle snapshot, and journal update together.

### OAuth and MCP development rules

- Add a dedicated OAuth scope when a tool introduces a materially new permission.
- Never allow refresh tokens to expand scopes without a new authorization flow.
- Enforce scopes in the MCP tool handler even when a client normally hides unavailable tools.
- Keep transfer requests bound to the authenticated user, wallet, MCP client, recipient, amount, network, and expiry.
- Treat agent-created transfers as requests only; signing must remain an explicit browser action.
- Verify a confirmed transaction independently before marking a transfer successful.
- Never store Dynamic JWTs, private keys, seed phrases, or key shares.

Future consent UI can let users grant a subset of the scopes requested by an agent. It must never add scopes the client did not request, and broader access must require fresh consent.

### Testing changes

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

For changes touching OAuth, Dynamic, MCP tools, or transfers, also complete the relevant manual acceptance checks below.

### Manual acceptance checklist

1. `docker compose up --build` reports healthy `api` and `web` services.
2. Email OTP creates and displays one embedded EVM wallet.
3. Adding the MCP URL opens the correct authorization UI.
4. `wallet_get_address` returns the address displayed on the website.
5. Preparing a transfer returns an approval URL without moving funds.
6. Rejecting or allowing a request to expire leaves the wallet unchanged.
7. Approving a funded request produces the exact reviewed native MON transfer.
8. `wallet_get_transfer_status` reports the confirmed hash and explorer URL.
9. PostgreSQL contains public wallet/transfer data and hashed OAuth tokens, but no wallet secrets or Dynamic JWTs.

The real Dynamic email-OTP and transaction flows require a configured sandbox and cannot be fully exercised with placeholder credentials.

### Commit and pull-request guidance

- Keep commits focused and use an imperative or conventional commit subject.
- Include migrations with the code that depends on them.
- Document new environment variables in both `.env.example` and this README.
- Explain security-sensitive behavior and manual verification in the pull request.
- Do not commit `.env`, logs, dependencies, build output, database dumps, or credentials.

---

## Architecture

| Service | Local address | Responsibility |
|---|---|---|
| `web` | `http://localhost:3000` | Wallet dashboard, Dynamic authentication, OAuth consent, and transfer approval. |
| `api` | `http://localhost:3001` | OAuth authorization server, Dynamic session verification, Zerion asset adapter, MCP resource server, and transfer verification. |
| `worker` | Private | Background processing and connection checks. |
| `postgres` | `localhost:5432` | Users, public wallet data, OAuth state, hashed tokens, and transfer requests. |
| `migrate` | One-shot | Applies versioned SQL migrations before application services start. |

Dynamic owns the embedded-wallet custody and key-management layer. The API and worker receive only public wallet information and authenticated session claims. Zerion supplies Monad testnet fungible positions and available pricing metadata; its API key remains confined to the API service.

## Production deployment on Railway

Create one Railway project with PostgreSQL and three services built from this repository:

| Railway service | Docker target | Required configuration |
|---|---|---|
| Web | `web-production` | `API_URL`, `DYNAMIC_ENVIRONMENT_ID`, `MONAD_RPC_URL` |
| API | `api-production` | `API_URL`, `WEB_URL`, `DATABASE_URL`, `DYNAMIC_ENVIRONMENT_ID`, `MONAD_RPC_URL`, `ZERION_API_KEY`, `TOKEN_PEPPER`, `PORT` |
| Worker | `worker-production` | `DATABASE_URL` |

Run `pnpm db:migrate` as the API service's pre-deploy command. Give the web and API services public HTTPS domains, set `API_URL` and `WEB_URL` to those exact origins, and add the web origin to Dynamic's allowed origins.

Use the hosted HTTPS MCP URL for remote/cloud coding agents. Do not expose a local PostgreSQL port publicly.

## Security notes

- OAuth access and refresh tokens are stored as hashes.
- Dynamic JWTs are verified and not persisted.
- The API performs a fresh Dynamic profile lookup before accepting a wallet address.
- Transfer requests expire after 10 minutes and require owner authentication.
- The browser signs through Dynamic; the server never receives wallet key material.
- Confirmed transfers are checked against their immutable request before being recorded as successful.

## License

MCP Wallet is available under the [MIT License](LICENSE).
