import { Pool } from "pg";

export async function ensureApiCallLogsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_call_logs (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      customer_slug TEXT,
      phase TEXT,
      endpoint_name TEXT,
      method TEXT,
      resolved_url TEXT,
      status_code INTEGER,
      ok BOOLEAN NOT NULL DEFAULT FALSE,
      duration_ms INTEGER,
      error_message TEXT,
      request_headers JSONB,
      request_body TEXT,
      response_body TEXT
    )
  `);
}

export async function insertApiCallLog(
  pool: Pool,
  row: {
    customerSlug?: string | null;
    phase?: string | null;
    endpointName?: string | null;
    method?: string | null;
    resolvedUrl?: string | null;
    statusCode?: number | null;
    ok: boolean;
    durationMs?: number | null;
    errorMessage?: string | null;
    requestHeaders?: string | null;
    requestBody?: string | null;
    responseBody?: string | null;
  }
) {
  await ensureApiCallLogsTable(pool);
  await pool.query(
    `
      INSERT INTO api_call_logs (
        customer_slug,
        phase,
        endpoint_name,
        method,
        resolved_url,
        status_code,
        ok,
        duration_ms,
        error_message,
        request_headers,
        request_body,
        response_body
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
    `,
    [
      row.customerSlug ?? null,
      row.phase ?? null,
      row.endpointName ?? null,
      row.method ?? null,
      row.resolvedUrl ?? null,
      row.statusCode ?? null,
      row.ok,
      row.durationMs ?? null,
      row.errorMessage ?? null,
      row.requestHeaders ?? null,
      row.requestBody ?? null,
      row.responseBody ?? null,
    ]
  );
}
