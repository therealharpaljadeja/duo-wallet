import {
  oauthClients,
  transferRequests,
  users,
  wallets,
  type Database,
} from "@mcp-wallet/db";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { Environment } from "./env.js";
import { registerTransferRoutes } from "./transfers.js";

const transferId = "00000000-0000-4000-8000-000000000001";
const walletAddress = "0x1111111111111111111111111111111111111111";

const environment: Environment = {
  API_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://unused",
  DYNAMIC_ENVIRONMENT_ID: "00000000-0000-4000-8000-000000000000",
  MONAD_RPC_URL: "https://testnet-rpc.monad.xyz",
  PORT: 3001,
  TOKEN_PEPPER: "test-token-pepper-at-least-24-characters",
  WEB_URL: "http://localhost:3000",
  ZERION_API_KEY: "test-zerion-key",
  ZERION_API_URL: "https://api.zerion.io",
};

function createClaimDatabase() {
  const state = { status: "pending_approval" };
  const result = () => ({
    transfer: {
      id: transferId,
      status: state.status,
      expiresAt: new Date(Date.now() + 60_000),
    },
    dynamicUserId: "dynamic-user-1",
    walletAddress,
    clientName: "Test client",
  });

  const database = {
    select() {
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: async () => [result()],
      };
      return query;
    },
    update() {
      let values: { status?: string } = {};
      const query = {
        set(nextValues: { status?: string }) {
          values = nextValues;
          return query;
        },
        where: () => query,
        async returning() {
          if (state.status !== "pending_approval") return [];
          state.status = values.status ?? state.status;
          return [{ id: transferId }];
        },
      };
      return query;
    },
  };

  return { database: database as unknown as Database, state };
}

function createTransferDatabase() {
  const captured: { transfer?: Record<string, unknown> } = {};
  const database = {
    insert(table: unknown) {
      const query = {
        values(values: Record<string, unknown>) {
          if (table === transferRequests) captured.transfer = values;
          return query;
        },
        onConflictDoUpdate: () => query,
        onConflictDoNothing: async () => [],
        async returning() {
          if (table === users) {
            return [{ id: "user-1", email: "owner@example.com" }];
          }
          if (table === wallets) {
            return [{ id: "wallet-1", address: walletAddress, chain: "EVM" }];
          }
          if (table === oauthClients) return [];
          return [{ id: transferId, expiresAt: new Date("2030-01-01T00:00:00.000Z") }];
        },
      };
      return query;
    },
  };
  return { captured, database: database as unknown as Database };
}

describe("transfer approval claims", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("allows only one of two concurrent claims to reserve a transfer", async () => {
    const app = Fastify();
    apps.push(app);
    const { database, state } = createClaimDatabase();
    await registerTransferRoutes(app, {
      db: database,
      environment,
      verifyDynamicToken: async () => ({
        dynamicUserId: "dynamic-user-1",
        email: "owner@example.com",
        wallet: { address: walletAddress },
      }),
    });

    const request = () =>
      app.inject({
        method: "POST",
        url: `/api/transfers/${transferId}/claim`,
        headers: { authorization: "Bearer dynamic-token" },
        payload: { wallet_address: walletAddress },
      });
    const responses = await Promise.all([request(), request()]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.statusCode === 200)?.json()).toEqual({
      status: "approval_in_progress",
    });
    expect(state.status).toBe("approval_in_progress");
  });
});

describe("web transfer creation", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates an immutable pending request for the authenticated wallet", async () => {
    const app = Fastify();
    apps.push(app);
    const { captured, database } = createTransferDatabase();
    await registerTransferRoutes(app, {
      db: database,
      environment,
      verifyDynamicToken: async () => ({
        dynamicUserId: "dynamic-user-1",
        email: "owner@example.com",
        wallet: { address: walletAddress },
      }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: "Bearer dynamic-token" },
      payload: {
        wallet_address: walletAddress,
        recipient_address: "0x2222222222222222222222222222222222222222",
        amount: "1.25",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: transferId,
      status: "pending_approval",
      amount: "1.25",
      symbol: "MON",
      approval_url: `http://localhost:3000/transfer/${transferId}`,
    });
    expect(captured.transfer).toMatchObject({
      userId: "user-1",
      walletId: "wallet-1",
      clientId: "duo-web",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountWei: "1250000000000000000",
    });
  });
});
