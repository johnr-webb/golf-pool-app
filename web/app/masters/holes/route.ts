import { NextResponse } from "next/server";

const URL = "https://www.masters.com/en_US/json/man/course/angc/holes.json";

export async function GET() {
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GolfPoolApp/1.0)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Masters holes returned ${res.status}` },
      { status: res.status },
    );
  }
  const json = await res.json();
  return NextResponse.json(json.holes ?? json);
}
