import ScoreClient from "./ScoreClient";

interface ScorePageProps {
  params: { id: string };
}

export default function ScorePage({ params }: ScorePageProps) {
  return <ScoreClient matchId={params.id} />;
}
