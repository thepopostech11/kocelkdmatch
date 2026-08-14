import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useContractModuleStore } from "@/stores/contractModuleStore";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  const activeContractModule = useContractModuleStore((state) => state.activeContractModule);
  const setActiveContractModule = useContractModuleStore((state) => state.setActiveContractModule);

  const selectMatches = () => {
    setActiveContractModule("matches_differs");
    void navigate({ to: "/app/analysis" });
  };

  const selectRiseFall = () => {
    setActiveContractModule("rise_fall");
    void navigate({ to: "/app/rise-fall" });
  };

  const matchesActive = activeContractModule === "matches_differs";

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Contract modules</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">SELECT CONTRACT</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={selectMatches}
          className={[
            "min-h-[180px] rounded-2xl border p-6 text-left shadow-soft transition-all duration-200 hover:shadow-md",
            matchesActive
              ? "border-primary bg-primary/8 ring-2 ring-primary/30"
              : "border-border bg-card hover:border-primary/50",
          ].join(" ")}
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight sm:text-2xl">MATCHES &amp; DIFFERS</h2>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {matchesActive ? "ACTIVE" : "READY"}
              </span>
              {matchesActive && <span className="size-3 rounded-full bg-success animate-pulse" />}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={selectRiseFall}
          className="min-h-[180px] rounded-2xl border border-border bg-card p-6 text-left shadow-soft transition-all duration-200 hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight sm:text-2xl">RISE &amp; FALL</h2>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">COMING SOON</span>
              <span className="size-3 rounded-full bg-muted-foreground/40" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
