import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  buildFraudAssessment,
  normalizeBehaviorMetrics,
  normalizeFraudSettings,
  summarizeHistory,
} from "@/lib/fraud-detection";

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
    const behaviorMetrics = normalizeBehaviorMetrics(body.behaviorMetrics ?? {});

    const pool = getPool();
    const currentRes = await pool.query(`SELECT * FROM payment_sessions WHERE id = $1`, [id]);
    if (currentRes.rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const current = currentRes.rows[0];
    const configRes = await pool.query(
      `SELECT config_json FROM customer_configs WHERE slug = $1`,
      [current.customer_slug]
    );
    const publishedConfig = configRes.rows[0]?.config_json ?? {};
    const fraudSettings = normalizeFraudSettings(
      publishedConfig?.gatewaySettings?.fraudDetection
    );
    const existingMetadata =
      current.metadata && typeof current.metadata === "object" ? current.metadata : {};
    const nextMetadata = {
      ...existingMetadata,
      behaviorMetrics,
      fraudSettings,
    };

    const historyRes = await pool.query(
      `
      SELECT amount, currency, status, supplier_name, supplier_email, created_at
      FROM payment_sessions
      WHERE customer_slug = $1 AND id <> $2
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [current.customer_slug, id]
    );
    const nextSession = {
      ...current,
      status,
      provider,
      received_number: receivedNumber ?? current.received_number,
      gateway_reference: gatewayReference ?? current.gateway_reference,
      metadata: nextMetadata,
    };
    const historySummary = summarizeHistory(historyRes.rows, nextSession);
    const fraudAssessment = buildFraudAssessment({
      settings: fraudSettings,
      session: nextSession,
      behaviorMetrics,
      historySummary,
    });
    nextMetadata.fraud = fraudAssessment;

    await pool.query(
      `UPDATE payment_sessions
       SET status = $2,
           provider = $3,
           decided_at = NOW(),
           received_number = COALESCE($4, received_number),
           gateway_reference = COALESCE($5, gateway_reference),
           metadata = $6::jsonb
       WHERE id = $1`,
      [id, status, provider, receivedNumber, gatewayReference, JSON.stringify(nextMetadata)]
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
