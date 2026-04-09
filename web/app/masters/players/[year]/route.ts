import { NextRequest, NextResponse } from "next/server";

const MASTERS_BASE = "https://www.masters.com/en_US";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year: string }> },
) {
  const { year } = await params;
  const res = await fetch(
    `${MASTERS_BASE}/cms/feeds/players/${year}/players.json`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GolfPoolApp/1.0)" },
      next: { revalidate: 3600 },
    },
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: `Masters players returned ${res.status}` },
      { status: res.status },
    );
  }
  const json = await res.json();
  const players = (json.players ?? []).filter(
    (p: { real_player?: boolean }) => p.real_player,
  );
  return NextResponse.json(players);
}
