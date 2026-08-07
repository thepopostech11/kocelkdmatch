import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/app/bot")({
  head: () => ({
    meta: [
      { title: "Bot — KOCEL DMATCH TOOL" },
      { name: "description", content: "Autonomous AI MATCHES bot for Deriv trading." },
      { property: "og:title", content: "Bot — KOCEL DMATCH TOOL" },
      { property: "og:description", content: "Autonomous AI MATCHES bot for Deriv trading." },
    ],
  }),
  component: BotPage,
});

function BotPage() {
  return (
    <ComingSoon
      phase={4}
      title="AI MATCHES Bot"
      icon={Bot}
      bullets={["Strategy automation", "Risk management", "Session performance"]}
    />
  );
}
