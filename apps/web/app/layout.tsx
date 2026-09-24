import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { Providers } from "./providers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DUO",
  description: "A developer wallet that connects securely to your coding agent.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = {
    apiUrl: process.env.API_URL ?? "http://localhost:3001",
    ...(process.env.DYNAMIC_ENVIRONMENT_ID
      ? { dynamicEnvironmentId: process.env.DYNAMIC_ENVIRONMENT_ID }
      : {}),
    monadRpcUrl:
      process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  };

  return (
    <html lang="en">
      <body>
        <TooltipProvider>
          <Providers config={config}>{children}</Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
