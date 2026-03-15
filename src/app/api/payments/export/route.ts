import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { authenticateBasic } from "@/lib/basicAuth";
import { insertApiCallLog } from "@/lib/api-call-logs";

export async function GET(req: Request) {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "200"), 1000);
  const auth = await authenticateBasic(req);
  if (!auth) {
    const pool = getPool();
    await insertApiCallLog(pool, {
      customerSlug: null,
      phase: "PAYMENTS_EXPORT",
      endpointName: "Payments export",
      method: "GET",
      resolvedUrl: url.toString(),
      statusCode: 401,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorMessage: "Unauthorized",
      requestHeaders: null,
      requestBody: null,
      responseBody: "Unauthorized",
    }).catch(() => {});
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="payments"' },
    });
  }

  const pool = getPool();
  const r = await pool.query(
    `SELECT
       id, customer_slug, rfx_id, account_id, user_id,
       supplier_name, supplier_email,
       amount, currency,
       status, provider,
       received_number, gateway_reference,
       created_at, decided_at
     FROM payment_sessions
     WHERE customer_slug = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [auth.customerSlug, limit]
  );

  await insertApiCallLog(pool, {
    customerSlug: auth.customerSlug,
    phase: "PAYMENTS_EXPORT",
    endpointName: "Payments export",
    method: "GET",
    resolvedUrl: url.toString(),
    statusCode: 200,
    ok: true,
    durationMs: Date.now() - startedAt,
    errorMessage: null,
    requestHeaders: null,
    requestBody: null,
    responseBody: JSON.stringify({
      customerSlug: auth.customerSlug,
      count: r.rowCount,
    }),
  }).catch(() => {});

  return NextResponse.json({
    customerSlug: auth.customerSlug,
    count: r.rowCount,
    rows: r.rows,
  });
}
