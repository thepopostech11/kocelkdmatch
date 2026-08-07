import { createFileRoute } from "@tanstack/react-router";
import { DigitTape } from "@/components/trade/DigitTape";
import { EntryMonitor } from "@/components/trade/EntryMonitor";
import { OpenTradesPanel } from "@/components/trade/OpenTradesPanel";
import { TradeHistoryPanel } from "@/components/trade/TradeHistoryPanel";
import { TradeTicket } from "@/components/trade/TradeTicket";
import { LiveAccountStatus } from "@/components/account/LiveAccountStatus";
import { PredictionPanel } from "@/components/analysis/PredictionPanel";
import { SymbolControls } from "@/components/analysis/SymbolControls";

export const Route = createFileRoute("/app/manual-trade")({
  head: () => ({
    meta: [
      { title: "Manual Trade — KOCEL DMATCH TOOL" },
      {
        name: "description",
        content:
          "Place live Deriv MATCHES contracts with AI-seeded digits, live payout quotes and real-time contract tracking.",
      },
      { property: "og:title", content: "Manual Trade — KOCEL DMATCH TOOL" },
      {
        property: "og:description",
        content: "Live MATCHES order entry with real-time Deriv contract tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManualTradePage,
});

function ManualTradePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-3 sm:p-4">
      <header>
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">Manual MATCHES Trading</h1>
        <p className="text-xs text-muted-foreground">
          Live Deriv execution · real contracts on your selected account
        </p>
      </header>

      <SymbolControls />
      <DigitTape />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <TradeTicket />
          <EntryMonitor />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <PredictionPanel />
          <OpenTradesPanel />
          <LiveAccountStatus />
        </div>
      </div>

      <TradeHistoryPanel />
    </div>
  );
}
