import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useContractModuleStore } from "@/stores/contractModuleStore";

export const Route = createFileRoute("/app/rise-fall")({
  head: () => ({
    meta: [
      { title: "Rise & Fall — Coming Soon" },
      { name: "description", content: "Rise & Fall trading module is under development." },
    ],
  }),
  component: RiseFall,
});

function RiseFall() {
  const navigate = useNavigate();
  const setActiveContractModule = useContractModuleStore((state) => state.setActiveContractModule);

  const goToMatches = () => {
    setActiveContractModule("matches_differs");
    void navigate({ to: "/app/analysis" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4">
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">RISE &amp; FALL</h1>
        <p className="mt-6 text-xl font-semibold uppercase tracking-[0.2em] text-muted-foreground">COMING SOON</p>
        <p className="mt-6 text-base text-muted-foreground">
          The Rise &amp; Fall analysis engine is currently under development.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          A dedicated Rise &amp; Fall strategy engine, prediction system, manual trading interface,
          and automated trading system will be introduced in a future update.
        </p>

        <button
          type="button"
          onClick={goToMatches}
          className="mt-8 inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          BACK TO MATCHES &amp; DIFFERS
        </button>
      </section>
    </div>
  );
}
