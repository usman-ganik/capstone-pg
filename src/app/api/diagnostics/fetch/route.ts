import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  try {
    const r = await fetch(url, { method: "GET", cache: "no-store" });
    const text = await r.text();
    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      headers: Object.fromEntries(r.headers.entries()),
      bodyPreview: text.slice(0, 300),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e), code: e?.code },
      { status: 500 }
    );
  }
}