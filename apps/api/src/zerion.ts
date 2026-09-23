import { z } from "zod";

export const ZERION_MONAD_TESTNET_ID = "monad-test-v2";

const zerionPositionSchema = z.object({
  type: z.literal("positions"),
  id: z.string(),
  attributes: z.object({
    name: z.string(),
    quantity: z.object({
      int: z.string().regex(/^\d+$/),
      decimals: z.number().int().nonnegative(),
      numeric: z.string(),
    }),
    value: z.number().nullable().optional(),
    price: z.number().nullable().optional(),
    changes: z
      .object({ percent_1d: z.number().nullable().optional() })
      .nullable()
      .optional(),
    fungible_info: z.object({
      name: z.string(),
      symbol: z.string(),
      icon: z.object({ url: z.url().nullable().optional() }).nullable().optional(),
      flags: z.object({ verified: z.boolean().optional() }).optional(),
      implementations: z.array(
        z.object({
          chain_id: z.string(),
          decimals: z.number().int().nonnegative(),
          address: z.string().nullable().optional(),
        }),
      ),
    }),
    flags: z
      .object({
        displayable: z.boolean().optional(),
        is_trash: z.boolean().optional(),
      })
      .optional(),
  }),
  relationships: z.object({
    chain: z.object({
      data: z.object({ type: z.literal("chains"), id: z.string() }),
    }),
  }),
});

const zerionPositionsResponseSchema = z.object({
  links: z.object({ next: z.url().nullable().optional() }).passthrough(),
  data: z.array(zerionPositionSchema),
});

export interface ZerionAsset {
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

export class ZerionRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ZerionRequestError";
  }
}

function normalizePosition(
  position: z.infer<typeof zerionPositionSchema>,
): ZerionAsset | undefined {
  if (
    position.relationships.chain.data.id !== ZERION_MONAD_TESTNET_ID ||
    position.attributes.flags?.displayable === false ||
    position.attributes.flags?.is_trash === true
  ) {
    return undefined;
  }

  const implementation = position.attributes.fungible_info.implementations.find(
    (candidate) => candidate.chain_id === ZERION_MONAD_TESTNET_ID,
  );
  if (!implementation) return undefined;

  const contractAddress = implementation.address?.toLowerCase() ?? null;
  return {
    id: position.id,
    type: contractAddress ? "erc20" : "native",
    name: position.attributes.fungible_info.name || position.attributes.name,
    symbol: position.attributes.fungible_info.symbol,
    decimals: implementation.decimals,
    amount: position.attributes.quantity.numeric,
    amount_raw: position.attributes.quantity.int,
    contract_address: contractAddress,
    price_usd: position.attributes.price ?? null,
    value_usd: position.attributes.value ?? null,
    change_1d: position.attributes.changes?.percent_1d ?? null,
    icon_url: position.attributes.fungible_info.icon?.url ?? null,
    verified: position.attributes.fungible_info.flags?.verified ?? false,
  };
}

export async function getZerionMonadAssets(input: {
  apiUrl: string;
  apiKey: string;
  walletAddress: string;
}): Promise<{ assets: ZerionAsset[]; totalValueUsd: number | null }> {
  const url = new URL(
    `/v1/wallets/${encodeURIComponent(input.walletAddress)}/positions/`,
    input.apiUrl,
  );
  url.searchParams.set("currency", "usd");
  url.searchParams.set("filter[positions]", "only_simple");
  url.searchParams.set("filter[chain_ids]", ZERION_MONAD_TESTNET_ID);
  url.searchParams.set("filter[trash]", "only_non_trash");
  url.searchParams.set("sort", "-value");

  const authorization = Buffer.from(`${input.apiKey}:`, "utf8").toString("base64");
  const allowedOrigin = new URL(input.apiUrl).origin;
  const positions: z.infer<typeof zerionPositionSchema>[] = [];
  let nextUrl: URL | undefined = url;

  for (let page = 0; nextUrl && page < 10; page += 1) {
    if (nextUrl.origin !== allowedOrigin) {
      throw new ZerionRequestError("Zerion returned an unsafe pagination URL");
    }
    const response = await fetch(nextUrl, {
      headers: {
        accept: "application/json",
        authorization: `Basic ${authorization}`,
        "x-env": "testnet",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 202) {
      throw new ZerionRequestError("Zerion is still indexing this wallet", 202);
    }
    if (!response.ok) {
      throw new ZerionRequestError(
        `Zerion positions request failed with status ${response.status}`,
        response.status,
      );
    }

    const parsed = zerionPositionsResponseSchema.parse(await response.json());
    positions.push(...parsed.data);
    nextUrl = parsed.links.next ? new URL(parsed.links.next, nextUrl) : undefined;
  }
  if (nextUrl) {
    throw new ZerionRequestError("Zerion pagination exceeded the safety limit");
  }

  const assets = positions
    .map(normalizePosition)
    .filter((asset): asset is ZerionAsset => Boolean(asset))
    .sort((left, right) => {
      if (left.type !== right.type) return left.type === "native" ? -1 : 1;
      return (right.value_usd ?? -1) - (left.value_usd ?? -1);
    });

  if (!assets.some((asset) => asset.type === "native")) {
    assets.unshift({
      id: `${ZERION_MONAD_TESTNET_ID}:native`,
      type: "native",
      name: "Monad",
      symbol: "MON",
      decimals: 18,
      amount: "0",
      amount_raw: "0",
      contract_address: null,
      price_usd: null,
      value_usd: null,
      change_1d: null,
      icon_url: null,
      verified: true,
    });
  }

  const pricedAssets = assets.filter((asset) => asset.value_usd !== null);
  return {
    assets,
    totalValueUsd:
      pricedAssets.length > 0
        ? pricedAssets.reduce((total, asset) => total + (asset.value_usd ?? 0), 0)
        : null,
  };
}
