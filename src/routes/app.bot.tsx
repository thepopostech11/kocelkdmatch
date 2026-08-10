import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/bot")({
  beforeLoad: () => {
    throw redirect({ to: "/bot", replace: true });
  },
});
