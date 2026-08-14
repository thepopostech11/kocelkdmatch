import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6">
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <h1 className="text-2xl font-bold">RISE &amp; FALL</h1>
        <p className="mt-4 text-sm text-muted-foreground">COMING SOON</p>
        <p className="mt-6 text-sm text-muted-foreground">
          This trading module is currently under development and will be added in a future release.
        </p>
      </section>
    </div>
  );
}
