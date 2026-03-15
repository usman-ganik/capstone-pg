import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";

export async function authenticateBasic(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return null;

  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const [username, password] = decoded.split(":");

  if (!username || !password) return null;

  const pool = getPool();
  const r = await pool.query(
    `SELECT username, customer_slug, password_hash FROM customer_api_users WHERE username = $1`,
    [username]
  );

  if (r.rowCount === 0) return null;

  const row = r.rows[0];
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;

  await pool.query(`UPDATE customer_api_users SET last_used_at = NOW() WHERE username = $1`, [username]);

  return { username: row.username, customerSlug: row.customer_slug };
}