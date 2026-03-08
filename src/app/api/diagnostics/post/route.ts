import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { url, headers, body } = await req.json();

  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: headers || { "Content-Type": "application/x-www-form-urlencoded" },
      body: body || "",
      redirect: "manual",
    });

    const text = await r.text();
    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      headers: Object.fromEntries(r.headers.entries()),
      bodyPreview: text.slice(0, 800),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e), code: e?.code }, { status: 500 });
  }
}