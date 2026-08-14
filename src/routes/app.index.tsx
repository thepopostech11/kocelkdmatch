import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6">
      <h1 className="text-2xl font-bold">KOCEL Trading</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose a contract module to continue.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => void navigate({ to: "/app/analysis" })}
          className="rounded-2xl border border-border bg-card p-6 text-left shadow-soft hover:shadow-md"
        >
          <h2 className="text-lg font-bold">MATCHES &amp; DIFFERS</h2>
          <p className="mt-2 text-sm text-muted-foreground">Existing DIGIT MATCH/DIFF analysis, manual trade and bot.</p>
        </button>

        <button
          onClick={() => void navigate({ to: "/app/rise-fall" })}
          className="rounded-2xl border border-border bg-card p-6 text-left shadow-soft hover:shadow-md"
        >
          <h2 className="text-lg font-bold">RISE &amp; FALL</h2>
          <p className="mt-2 text-sm text-muted-foreground">COMING SOON — This trading module is under development.</p>
        </button>
      </div>
    </div>
  );
}
