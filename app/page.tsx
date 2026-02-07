import MatchCreationForm from "./components/MatchCreationForm";
import TodayMatches from "./components/TodayMatches";

export default function HomePage() {
  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          Clubstream
        </p>
        <h1 className="text-3xl font-semibold">Live Streaming</h1>
        <p className="text-slate-400">
          Create a match to start streaming on YouTube.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Step 1
          </div>
          <h2 className="mt-2 text-lg font-semibold">Create a match</h2>
          <p className="mt-2 text-sm text-slate-400">
            Pick your team, opponent, and start time. We prepare the stream and
            overlay for you.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Step 2
          </div>
          <h2 className="mt-2 text-lg font-semibold">Open Larix</h2>
          <p className="mt-2 text-sm text-slate-400">
            Tap the Larix launcher or scan the QR code. Your stream settings and
            overlay are already configured.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Step 3
          </div>
          <h2 className="mt-2 text-lg font-semibold">Go live and score</h2>
          <p className="mt-2 text-sm text-slate-400">
            Start streaming, then open scoring to update the live overlay in
            real time.
          </p>
        </div>
      </section>

      <MatchCreationForm />
      <TodayMatches />
    </main>
  );
}
