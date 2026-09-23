import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getZerionMonadAssets,
  ZERION_MONAD_TESTNET_ID,
  ZerionRequestError,
} from "./zerion.js";

const walletAddress = "0x1111111111111111111111111111111111111111";

function position(input: {
  id: string;
  name: string;
  symbol: string;
  amount: string;
  amountRaw: string;
  decimals: number;
  address?: string | null;
  value?: number | null;
}) {
  return {
    type: "positions",
    id: input.id,
    attributes: {
      name: input.name,
      quantity: {
        int: input.amountRaw,
        decimals: input.decimals,
        numeric: input.amount,
      },
      value: input.value ?? null,
      price: input.value ?? null,
      changes: { percent_1d: 1.25 },
      fungible_info: {
        name: input.name,
        symbol: input.symbol,
        icon: { url: "https://cdn.example/token.png" },
        flags: { verified: true },
        implementations: [
          {
            chain_id: ZERION_MONAD_TESTNET_ID,
            decimals: input.decimals,
            address: input.address ?? null,
          },
        ],
      },
      flags: { displayable: true, is_trash: false },
    },
    relationships: {
      chain: {
        data: { type: "chains", id: ZERION_MONAD_TESTNET_ID },
      },
    },
  };
}

describe("Zerion Monad assets", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requests testnet positions and normalizes native and ERC-20 balances", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          links: { self: "https://api.zerion.io/v1/wallets/example/positions/", next: null },
          data: [
            position({
              id: "mon-position",
              name: "Monad",
              symbol: "MON",
              amount: "1.25",
              amountRaw: "1250000000000000000",
              decimals: 18,
              value: 2.5,
            }),
            position({
              id: "token-position",
              name: "Test USD",
              symbol: "TUSD",
              amount: "42",
              amountRaw: "42000000",
              decimals: 6,
              address: "0x2222222222222222222222222222222222222222",
              value: 42,
            }),
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await getZerionMonadAssets({
      apiUrl: "https://api.zerion.io",
      apiKey: "secret-key",
      walletAddress,
    });

    expect(result).toMatchObject({
      totalValueUsd: 44.5,
      assets: [
        { type: "native", symbol: "MON", amount_raw: "1250000000000000000" },
        {
          type: "erc20",
          symbol: "TUSD",
          contract_address: "0x2222222222222222222222222222222222222222",
        },
      ],
    });
    const [requestedUrl, request] = fetchMock.mock.calls[0]!;
    const url = new URL(String(requestedUrl));
    const headers = new Headers(request?.headers);
    expect(url.searchParams.get("filter[chain_ids]")).toBe("monad-test-v2");
    expect(url.searchParams.get("filter[positions]")).toBe("only_simple");
    expect(headers.get("x-env")).toBe("testnet");
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("secret-key:").toString("base64")}`,
    );
  });

  it("returns a zero native balance when Zerion reports no positions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ links: { next: null }, data: [] }), { status: 200 }),
    );

    await expect(
      getZerionMonadAssets({
        apiUrl: "https://api.zerion.io",
        apiKey: "secret-key",
        walletAddress,
      }),
    ).resolves.toMatchObject({
      totalValueUsd: null,
      assets: [{ type: "native", symbol: "MON", amount: "0", amount_raw: "0" }],
    });
  });

  it("reports wallets that Zerion is still indexing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 202 }));

    await expect(
      getZerionMonadAssets({
        apiUrl: "https://api.zerion.io",
        apiKey: "secret-key",
        walletAddress,
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ZerionRequestError>>({ status: 202 }));
  });
});
