import type { Pool } from "pg";

let ensured = false;

export async function ensurePaymentSessionsSchema(pool: Pool) {
  if (ensured) return;

  await pool.query(`
    ALTER TABLE payment_sessions
    ADD COLUMN IF NOT EXISTS rfx_number TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payment_sessions_rfx_number
    ON payment_sessions (rfx_number)
  `);

  ensured = true;
}
