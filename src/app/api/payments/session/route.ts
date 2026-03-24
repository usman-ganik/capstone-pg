import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensurePaymentSessionsSchema } from "@/lib/payment-sessions-schema";
import crypto from "node:crypto";
import {
  buildFraudAssessment,
  normalizeFraudSettings,
  summarizeHistory,
} from "@/lib/fraud-detection";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customerSlug = String(body.customerSlug || "").trim().toLowerCase();
    if (!customerSlug) {
      return NextResponse.json({ error: "customerSlug required" }, { status: 400 });
    }

    const pool = getPool();
    await ensurePaymentSessionsSchema(pool);
    const configRes = await pool.query(
      `SELECT config_json FROM customer_configs WHERE slug = $1`,
      [customerSlug]
    );

    if (configRes.rows.length === 0) {
      return NextResponse.json({ error: "published config not found" }, { status: 404 });
    }

    const publishedConfig = configRes.rows[0]?.config_json ?? {};
    const provider = String(publishedConfig?.gatewaySettings?.provider ?? "SIMULATOR").toUpperCase();
    const fraudSettings = normalizeFraudSettings(
      publishedConfig?.gatewaySettings?.fraudDetection
    );

    const id = crypto.randomUUID();
    const now = new Date();

    const metadata = {
      ...(body.metadata ?? {}),
      ...(body.step1Mapped ? { step1Mapped: body.step1Mapped } : {}),
    };

    const payload = {
      id,
      customer_slug: customerSlug,
      rfx_id: body.rfxId ?? null,
      rfx_number: body.rfxNumber ?? null,
      account_id: body.accountId ?? null,
      user_id: body.userId ?? null,
      supplier_name: body.supplierName ?? null,
      supplier_email: body.supplierEmail ?? null,
      amount: body.amount ?? null,
      currency: body.currency ?? null,
      status: "PENDING",
      provider,
      received_number: null,
      gateway_reference: null,
      created_at: now,
      metadata,
    };

    const historyRes = await pool.query(
      `
      SELECT amount, currency, status, supplier_name, supplier_email, created_at
      FROM payment_sessions
      WHERE customer_slug = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [customerSlug]
    );
    const historySummary = summarizeHistory(historyRes.rows, payload);
    const fraudAssessment = buildFraudAssessment({
      settings: fraudSettings,
      session: payload,
      behaviorMetrics: metadata?.behaviorMetrics,
      historySummary,
    });
    const metadataWithFraud = {
      ...metadata,
      fraud: fraudAssessment,
      fraudSettings,
    };

    await pool.query(
      `INSERT INTO payment_sessions
       (id, customer_slug, rfx_id, rfx_number, account_id, user_id, supplier_name, supplier_email,
        amount, currency, status, provider, received_number, gateway_reference, created_at, metadata)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)`,
      [
        payload.id,
        payload.customer_slug,
        payload.rfx_id,
        payload.rfx_number,
        payload.account_id,
        payload.user_id,
        payload.supplier_name,
        payload.supplier_email,
        payload.amount,
        payload.currency,
        payload.status,
        payload.provider,
        payload.received_number,
        payload.gateway_reference,
        payload.created_at,
        JSON.stringify(metadataWithFraud),
      ]
    );

    return NextResponse.json({
      sessionId: id,
      redirectUrl: `/pay/${customerSlug}/session/${id}`,
      provider,
      fraud: fraudAssessment,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
