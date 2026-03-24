import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const llmAnalysis = body?.analysis;
    const llmDebug = body?.debug ?? null;

    if (!llmAnalysis || typeof llmAnalysis !== "object") {
      return NextResponse.json({ error: "analysis required" }, { status: 400 });
    }

    const pool = getPool();
    const currentRes = await pool.query(`SELECT * FROM payment_sessions WHERE id = $1`, [params.id]);
    if (currentRes.rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const current = currentRes.rows[0];
    const metadata =
      current.metadata && typeof current.metadata === "object" ? current.metadata : {};
    const fraud =
      metadata.fraud && typeof metadata.fraud === "object" ? metadata.fraud : {};

    const nextMetadata = {
      ...metadata,
      fraud: {
        ...fraud,
        llm: llmAnalysis,
        llmDebug,
      },
    };

    await pool.query(
      `UPDATE payment_sessions SET metadata = $2::jsonb WHERE id = $1`,
      [params.id, JSON.stringify(nextMetadata)]
    );

    const updated = await pool.query(`SELECT * FROM payment_sessions WHERE id = $1`, [params.id]);
    return NextResponse.json(updated.rows[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
