import OverlayClient from "./OverlayClient";

interface OverlayPageProps {
  params: { id: string };
  searchParams?: { mode?: string; transparent?: string };
}

export default function OverlayPage({ params, searchParams }: OverlayPageProps) {
  const isLarixMode = searchParams?.mode === "larix";
  const transparent = searchParams?.transparent === "1" || isLarixMode;

  return (
    <OverlayClient
      matchId={params.id}
      transparent={transparent}
      autoLive={isLarixMode}
    />
  );
}
