export default function HomePage() {
  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Clubstream</p>
        <h1 className="text-3xl font-semibold">Match list</h1>
        <p className="text-slate-400">
          This dashboard will show upcoming, live, and completed matches once match creation is wired up.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold">Create match</h2>
        <p className="mt-2 text-slate-400">
          Match creation is coming soon. This form will reserve a stream and generate Larix links.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Team selection placeholder
          </div>
          <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Scheduling placeholder
          </div>
        </div>
      </section>
    </main>
  );
}
