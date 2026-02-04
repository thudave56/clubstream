interface MatchPageProps {
  params: { id: string };
}

export default function MatchPage({ params }: MatchPageProps) {
  return (
    <main className="space-y-4">
      <a className="text-sm text-slate-400" href="/">
        ← Back to matches
      </a>
      <h1 className="text-2xl font-semibold">Match {params.id}</h1>
      <p className="text-slate-400">
        Match details, Larix launcher, and scoring controls will be available here once implemented.
      </p>
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        Placeholder for match metadata and status.
      </div>
    </main>
  );
}
