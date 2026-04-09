import { NextRequest, NextResponse } from "next/server";

const MASTERS_BASE = "https://www.masters.com/en_US";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year: string }> },
) {
  const { year } = await params;
  const res = await fetch(
    `${MASTERS_BASE}/scores/feeds/${year}/scores.json`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GolfPoolApp/1.0)" },
      next: { revalidate: 30 },
    },
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: `Masters scores returned ${res.status}` },
      { status: res.status },
    );
  }
  const json = await res.json();
  return NextResponse.json(json.data ?? json);
}
