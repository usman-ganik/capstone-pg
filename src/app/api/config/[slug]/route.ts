import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const slug = String(params.slug || "").trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "missing slug" }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query(
    `SELECT slug, customer_name, status, config_json, published_at, updated_at
     FROM customer_configs
     WHERE slug = $1`,
    [slug]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "config not found" }, { status: 404 });
  }

  const row = res.rows[0];
  return NextResponse.json({
    slug: row.slug,
    customerName: row.customer_name,
    status: row.status,
    config: row.config_json,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  });
}