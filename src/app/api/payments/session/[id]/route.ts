import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pool = getPool();
  const r = await pool.query(`SELECT * FROM payment_sessions WHERE id = $1`, [params.id]);
  if (r.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(r.rows[0]);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json();

    const status = String(body.status || "").toUpperCase();
    const provider = String(body.provider || "SIMULATOR").toUpperCase();

    if (!["APPROVED", "DENIED"].includes(status)) {
      return NextResponse.json({ error: "status must be APPROVED or DENIED" }, { status: 400 });
    }

    const receivedNumber = body.receivedNumber ?? null;
    const gatewayReference = body.gatewayReference ?? null;

    const pool = getPool();
    await pool.query(
      `UPDATE payment_sessions
       SET status = $2,
           provider = $3,
           decided_at = NOW(),
           received_number = COALESCE($4, received_number),
           gateway_reference = COALESCE($5, gateway_reference)
       WHERE id = $1`,
      [id, status, provider, receivedNumber, gatewayReference]
    );

    const updated = await pool.query(`SELECT * FROM payment_sessions WHERE id = $1`, [id]);
    if (updated.rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json(updated.rows[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
