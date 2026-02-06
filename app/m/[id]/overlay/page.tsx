import OverlayClient from "./OverlayClient";

interface OverlayPageProps {
  params: { id: string };
  searchParams?: { mode?: string; transparent?: string };
}

export default function OverlayPage({ params, searchParams }: OverlayPageProps) {
  const transparent =
    searchParams?.transparent === "1" || searchParams?.mode === "larix";

  return <OverlayClient matchId={params.id} transparent={transparent} />;
}
