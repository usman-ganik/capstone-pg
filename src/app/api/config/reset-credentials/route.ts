import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { slug?: string } | null;
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const pool = getPool();

  const apiUsername = slug;
  const apiPassword = crypto.randomBytes(12).toString("base64url"); // shown once
  const hash = await bcrypt.hash(apiPassword, 10);

  // Upsert user and replace password hash
  await pool.query(
    `
    INSERT INTO customer_api_users (username, customer_slug, password_hash)
    VALUES ($1, $2, $3)
    ON CONFLICT (username)
    DO UPDATE SET password_hash = EXCLUDED.password_hash
    `,
    [apiUsername, slug, hash]
  );

  return NextResponse.json({ apiUsername, apiPassword });
}