import { createFileRoute } from "@tanstack/react-router";
import { AccountCard } from "@/components/account/AccountCard";
import { LiveAccountStatus } from "@/components/account/LiveAccountStatus";
import { SymbolControls } from "@/components/analysis/SymbolControls";
import { LiveCursor } from "@/components/analysis/LiveCursor";
import { DigitDashboard } from "@/components/analysis/DigitDashboard";
import { HeatMap } from "@/components/analysis/HeatMap";
import { FrequencyHistogram } from "@/components/analysis/FrequencyHistogram";
import { DigitRankingTable } from "@/components/analysis/DigitRankingTable";
import { LiveStatisticsPanel } from "@/components/analysis/LiveStatisticsPanel";
import { MarketQualityPanel } from "@/components/analysis/MarketQualityPanel";
import { PredictionPanel } from "@/components/analysis/PredictionPanel";
import { PredictionHistory } from "@/components/analysis/PredictionHistory";
import { StrategyPanel } from "@/components/analysis/StrategyPanel";
import { DiagnosticsPanel } from "@/components/analysis/DiagnosticsPanel";

export const Route = createFileRoute("/app/analysis")({
  head: () => ({
    meta: [
      { title: "AI MATCHES Analysis — KOCEL DMATCH TOOL" },
      {
        name: "description",
        content:
          "Real-time Deriv digit analysis: live tick stream, digit distribution, market quality and AI MATCHES predictions.",
      },
      { property: "og:title", content: "AI MATCHES Analysis — KOCEL DMATCH TOOL" },
      {
        property: "og:description",
        content: "Live Deriv digit analytics with a unified AI prediction engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-3 sm:p-4">
      <header>
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">AI MATCHES Analysis</h1>
        <p className="text-xs text-muted-foreground">
          Live Deriv tick stream · single rolling buffer · full statistical model suite
        </p>
      </header>

      <AccountCard />
      <SymbolControls />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <LiveCursor />
          <DigitDashboard />
          <PredictionPanel />
          <FrequencyHistogram />
          <LiveStatisticsPanel />
          <DigitRankingTable />
          <PredictionHistory />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <LiveAccountStatus />
          <MarketQualityPanel />
          <HeatMap />
          <StrategyPanel />
          <DiagnosticsPanel />
        </div>
      </div>
    </div>
  );
}
