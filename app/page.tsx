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

      <MatchCreationForm />
      <TodayMatches />
    </main>
  );
}
