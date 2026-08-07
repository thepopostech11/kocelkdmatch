import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/app/manual-trade")({
  head: () => ({
    meta: [
      { title: "Manual Trade — KOCEL DMATCH TOOL" },
      { name: "description", content: "Manual MATCHES trading interface for Deriv." },
      { property: "og:title", content: "Manual Trade — KOCEL DMATCH TOOL" },
      { property: "og:description", content: "Manual MATCHES trading interface for Deriv." },
    ],
  }),
  component: ManualTradePage,
});

function ManualTradePage() {
  return (
    <ComingSoon
      phase={3}
      title="Manual Trading Interface"
      icon={Activity}
      bullets={["Stake & duration control", "One-click MATCHES entry", "Live contract tracking"]}
    />
  );
}
