"use client";

import { getAuthToken, useOpenFundingOptions } from "@dynamic-labs/sdk-react-core";
import { MONAD_TESTNET } from "@mcp-wallet/shared";
import {
  AlertCircleIcon, ArrowLeftIcon, BotIcon, CheckCircle2Icon, CopyIcon,
  DownloadIcon, ExternalLinkIcon, HouseIcon, PlusIcon, RefreshCwIcon,
  SendIcon, WalletCardsIcon,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSetup } from "./agent-setup";
import { usePublicConfig } from "./providers";

type WalletView = "home" | "send" | "receive" | "agent";

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
  wallet: { address: string; chain: string; network: string; chain_id: number };
  portfolio: { total_value_usd: number | null; currency: "usd"; source: "zerion" };
  assets: WalletAsset[];
  error?: string;
}

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const priceFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 });

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
  if (error === "assets_indexing") return "Zerion is indexing this wallet. Try refreshing in a few seconds.";
  if (error === "assets_lookup_failed") return "Zerion did not return Monad testnet assets. Try refreshing.";
  if (error === "invalid_dynamic_session") return "Your wallet session has expired.";
  return "The wallet balance is temporarily unavailable.";
}

function WorkspaceHeading({ id, eyebrow, title, action }: { id: string; eyebrow?: string; title: string; action: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="grid gap-1.5">
        {eyebrow ? <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{eyebrow}</span> : null}
        <h1 id={id} className="text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function WalletWorkspace({ walletAddress, mcpUrl }: { walletAddress: string; mcpUrl: string }) {
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
  const balanceWei = useMemo(() => (nativeAsset ? BigInt(nativeAsset.amount_raw) : undefined), [nativeAsset]);

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
      const response = await fetch(`${apiUrl}/api/wallet?address=${encodeURIComponent(walletAddress)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => undefined)) as WalletResponse | undefined;
      if (!response.ok || !result) throw new Error(result?.error ?? "assets_lookup_failed");
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
      const response = await fetch(`${apiUrl}/api/transfers/activity?wallet_address=${encodeURIComponent(walletAddress)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => undefined)) as { has_activity?: boolean } | undefined;
      if (response.ok && typeof result?.has_activity === "boolean") setHasActivity(result.has_activity);
    } catch {
      // Keep setup available in the sidebar when activity cannot be determined.
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
    if (!addressPattern.test(normalizedRecipient)) return setSendError("Enter a complete EVM recipient address.");
    if (normalizedRecipient.toLowerCase() === walletAddress.toLowerCase()) return setSendError("The recipient cannot be your DUO wallet.");
    if (!amountWei || amountWei <= 0n) return setSendError("Enter a positive MON amount with no more than 18 decimals.");
    if (balanceWei !== undefined && amountWei > balanceWei) return setSendError("This amount is greater than your available balance.");
    const token = getAuthToken();
    if (!token) return setSendError("Your wallet session has expired. Sign in again.");

    setPreparing(true);
    try {
      const response = await fetch(`${apiUrl}/api/transfers`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress, recipient_address: normalizedRecipient, amount }),
      });
      const result = (await response.json().catch(() => undefined)) as { approval_url?: string; error?: string; message?: string } | undefined;
      if (!response.ok || !result?.approval_url) {
        throw new Error(result?.error === "recipient_is_sender" ? "The recipient cannot be your DUO wallet." : result?.message ?? "The transfer request could not be prepared.");
      }
      window.location.assign(result.approval_url);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The transfer request could not be prepared.");
      setPreparing(false);
    }
  }

  const backHome = (
    <Button variant="ghost" onClick={() => chooseView("home")}>
      <ArrowLeftIcon data-icon="inline-start" /> Back home
    </Button>
  );

  return (
    <section className="duo-wallet-shell dark min-h-[700px] overflow-hidden rounded-2xl border bg-background text-foreground shadow-2xl" aria-label="DUO wallet">
      <SidebarProvider className="min-h-0" style={{ minHeight: 700 }}>
        <Sidebar collapsible="none" className="w-16 md:w-52">
          <SidebarHeader>
            <div className="flex items-center gap-3 p-2">
              <Avatar size="lg"><AvatarFallback className="bg-primary text-primary-foreground">D</AvatarFallback></Avatar>
              <div className="hidden min-w-0 md:grid md:gap-0.5">
                <strong className="text-sm">DUO</strong>
                <code className="truncate text-xs text-muted-foreground">{shortAddress(walletAddress)}</code>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup><SidebarGroupContent><SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton isActive={view === "home"} tooltip="Home" onClick={() => chooseView("home")}>
                <HouseIcon /><span className="hidden md:inline">Home</span>
              </SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={view === "agent"} tooltip="Agent setup" onClick={() => chooseView("agent")}>
                <BotIcon /><span className="hidden md:inline">Agent setup</span>
              </SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu></SidebarGroupContent></SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2 p-2">
              <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <div className="hidden min-w-0 md:grid md:gap-0.5">
                <span className="text-[10px] tracking-wider text-muted-foreground uppercase">Network</span>
                <strong className="truncate text-xs">{MONAD_TESTNET.name}</strong>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0">
          <div className="mx-auto grid w-full max-w-5xl gap-8 p-5 md:p-8 lg:p-12">
            {view === "home" ? <section className="grid gap-8" aria-labelledby="home-title">
              <WorkspaceHeading id="home-title" title="Home" action={<Button variant="ghost" onClick={() => void loadAssets()} disabled={loadingAssets}>
                {loadingAssets ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
                {loadingAssets ? "Refreshing" : "Refresh"}
              </Button>} />

              <Card className="text-center">
                <CardHeader>
                  <CardTitle className="text-xs tracking-wider text-muted-foreground uppercase">Portfolio value</CardTitle>
                  <CardAction><Badge variant="outline">Zerion</Badge></CardAction>
                </CardHeader>
                <CardContent>{loadingAssets && assets === undefined
                  ? <Skeleton className="mx-auto h-14 w-44" />
                  : <strong className="text-5xl font-semibold tracking-tight md:text-6xl">{formatUsd(portfolioValueUsd) ?? "$0.00"}</strong>}
                </CardContent>
                <CardFooter className="justify-center text-xs text-muted-foreground">Fungible assets on {MONAD_TESTNET.name}</CardFooter>
              </Card>

              <div className="grid grid-cols-3 gap-3" aria-label="Wallet actions">
                <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => chooseView("send")}><SendIcon data-icon="inline-start" />Send</Button>
                <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => chooseView("receive")}><DownloadIcon data-icon="inline-start" />Receive</Button>
                <Button className="h-24 flex-col gap-2" variant="outline" onClick={openFundingOptions}><PlusIcon data-icon="inline-start" />Fund</Button>
              </div>

              <Tabs defaultValue="tokens">
                <div className="flex items-center justify-between gap-4">
                  <TabsList variant="line"><TabsTrigger value="tokens">Tokens</TabsTrigger></TabsList>
                  <Badge variant="outline"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />{MONAD_TESTNET.name}</Badge>
                </div>
                <TabsContent value="tokens">
                  {assetError ? <Alert variant="destructive">
                    <AlertCircleIcon /><AlertTitle>Assets unavailable</AlertTitle><AlertDescription>{assetErrorMessage(assetError)}</AlertDescription>
                    <AlertAction><Button variant="outline" size="sm" onClick={() => void loadAssets()}>Try again</Button></AlertAction>
                  </Alert> : <Card>
                    <CardHeader><CardTitle>Assets</CardTitle><CardDescription>Tokens held by this DUO wallet.</CardDescription></CardHeader>
                    <CardContent className="px-0"><Table>
                      <TableHeader><TableRow>
                        <TableHead className="pl-5">Asset</TableHead><TableHead>Balance</TableHead>
                        <TableHead className="hidden md:table-cell">Portfolio</TableHead><TableHead className="pr-5 text-right">Price</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>{loadingAssets && !assets ? [0, 1, 2].map((row) => <TableRow key={row}>
                        <TableCell className="pl-5"><Skeleton className="h-10 w-36" /></TableCell><TableCell><Skeleton className="h-10 w-24" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-14" /></TableCell><TableCell className="pr-5"><Skeleton className="ml-auto h-10 w-24" /></TableCell>
                      </TableRow>) : assets?.map((asset) => <TableRow key={asset.id}>
                        <TableCell className="pl-5"><div className="flex items-center gap-3">
                          <Avatar size="lg">{asset.icon_url ? <AvatarImage src={asset.icon_url} alt="" /> : null}<AvatarFallback>{asset.symbol.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                          <div className="grid gap-0.5"><strong>{asset.name}</strong><span className="text-xs text-muted-foreground">{asset.symbol}</span></div>
                        </div></TableCell>
                        <TableCell><div className="grid gap-0.5"><strong>{formatUsd(asset.value_usd) ?? "—"}</strong><span className="text-xs text-muted-foreground">{asset.amount} {asset.symbol}</span></div></TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{formatAllocation(asset.value_usd, portfolioValueUsd)}</TableCell>
                        <TableCell className="pr-5 text-right"><div className="grid gap-0.5"><strong>{formatPrice(asset.price_usd) ?? "—"}</strong>
                          {asset.change_1d !== null ? <span className={asset.change_1d < 0 ? "text-xs text-destructive" : "text-xs text-primary"}>{asset.change_1d >= 0 ? "▲" : "▼"} {Math.abs(asset.change_1d).toFixed(2)}%</span> : <span className="text-xs text-muted-foreground">Price unavailable</span>}
                        </div></TableCell>
                      </TableRow>)}</TableBody>
                    </Table></CardContent>
                    <CardFooter className="text-xs text-muted-foreground">Balances are indexed by Zerion on Monad Testnet.</CardFooter>
                  </Card>}
                </TabsContent>
              </Tabs>

              {hasActivity === false ? <Card>
                <CardHeader><CardTitle>Connect DUO to your agent</CardTitle><CardDescription>This wallet has no transfer activity yet. Install the MCP server so your agent can prepare requests for you to review.</CardDescription><CardAction><Badge variant="secondary">Next step</Badge></CardAction></CardHeader>
                <CardContent><AgentSetup mcpUrl={mcpUrl} /></CardContent>
                <CardFooter className="text-xs text-muted-foreground">This guide moves to Agent setup after your first transaction.</CardFooter>
              </Card> : null}
            </section> : null}

            {view === "send" ? <section className="grid gap-8" aria-labelledby="send-title">
              <WorkspaceHeading id="send-title" eyebrow="Transfer" title="Send MON" action={backHome} />
              <Card><form onSubmit={prepareSend}>
                <CardHeader><CardTitle>Transfer details</CardTitle><CardDescription>Send native MON on Monad Testnet.</CardDescription></CardHeader>
                <CardContent><FieldGroup>
                  <Field data-invalid={Boolean(sendError)}><FieldLabel htmlFor="recipient">Recipient address</FieldLabel>
                    <Input id="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} aria-invalid={Boolean(sendError)} />
                  </Field>
                  <Field data-invalid={Boolean(sendError)}><FieldLabel htmlFor="amount">Amount</FieldLabel>
                    <div className="relative"><Input id="amount" className="pr-16" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" aria-invalid={Boolean(sendError)} />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">MON</span>
                    </div>
                    <FieldDescription className="flex justify-between gap-3"><span>Available: {nativeAsset?.amount ?? "—"} MON</span><span>Network fee is additional</span></FieldDescription>
                    {sendError ? <FieldError>{sendError}</FieldError> : null}
                  </Field>
                  <Alert><CheckCircle2Icon /><AlertTitle>Human review stays in the loop</AlertTitle><AlertDescription>You will review the recipient and amount before DUO asks your wallet to sign.</AlertDescription></Alert>
                </FieldGroup></CardContent>
                <CardFooter><Button className="w-full" size="lg" disabled={preparing}>{preparing ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}{preparing ? "Preparing review" : "Review transfer"}</Button></CardFooter>
              </form></Card>
            </section> : null}

            {view === "receive" ? <section className="grid gap-8" aria-labelledby="receive-title">
              <WorkspaceHeading id="receive-title" eyebrow="Funding" title="Receive MON" action={backHome} />
              <Card className="text-center">
                <CardHeader><Avatar size="lg" className="mx-auto"><AvatarFallback className="bg-primary text-primary-foreground">D</AvatarFallback></Avatar><CardTitle>Your DUO address</CardTitle><CardDescription>Send MON on Monad Testnet to this address only.</CardDescription></CardHeader>
                <CardContent><code className="block break-all rounded-lg bg-muted p-4 text-sm">{walletAddress}</code></CardContent>
                <CardFooter className="justify-center gap-2"><Button onClick={copyAddress}><CopyIcon data-icon="inline-start" />{copied ? "Copied" : "Copy address"}</Button><Button variant="outline" onClick={openFundingOptions}><WalletCardsIcon data-icon="inline-start" />Funding options</Button></CardFooter>
              </Card>
              <Alert><AlertCircleIcon /><AlertTitle>Monad Testnet only</AlertTitle><AlertDescription>Assets sent on another network may not appear in DUO. Use test funds only.</AlertDescription></Alert>
              <a className={buttonVariants({ variant: "link" })} href={`${MONAD_TESTNET.blockExplorerUrl}/address/${walletAddress}`} target="_blank" rel="noreferrer">View address on explorer<ExternalLinkIcon data-icon="inline-end" /></a>
            </section> : null}

            {view === "agent" ? <section className="grid gap-8" aria-labelledby="agent-view-title">
              <WorkspaceHeading id="agent-view-title" eyebrow="Settings" title="Agent setup" action={backHome} />
              <Card><CardHeader><CardTitle>Install the DUO MCP server</CardTitle><CardDescription>Keep these instructions available whenever you connect a new agent.</CardDescription></CardHeader><CardContent><AgentSetup mcpUrl={mcpUrl} /></CardContent><CardFooter><Separator /></CardFooter></Card>
            </section> : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </section>
  );
}
