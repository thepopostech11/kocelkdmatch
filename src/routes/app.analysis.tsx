import { createFileRoute } from "@tanstack/react-router";
import { LineChart } from "lucide-react";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/app/analysis")({
  head: () => ({
    meta: [
      { title: "Analysis — KOCEL DMATCH TOOL" },
      {
        name: "description",
        content: "AI MATCHES analysis workspace for Deriv volatility indices.",
      },
      { property: "og:title", content: "Analysis — KOCEL DMATCH TOOL" },
      { property: "og:description", content: "AI MATCHES analysis workspace for Deriv." },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  return (
    <ComingSoon
      phase={2}
      title="AI MATCHES Analysis Engine"
      icon={LineChart}
      bullets={["Digit distribution", "Prediction confidence", "Live tick statistics"]}
    />
  );
}
