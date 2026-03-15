import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";

type PublishBody = {
  slug: string;
  customerName?: string;
  publishedBy?: string;
  config: any; // your full config json
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as PublishBody | null;

  if (!body?.slug || !body?.config) {
    return NextResponse.json(
      { error: "slug and config are required" },
      { status: 400 }
    );
  }

  const slug = String(body.slug).trim().toLowerCase();
  const customerName = body.customerName ? String(body.customerName).trim() : null;
  const publishedBy = body.publishedBy ? String(body.publishedBy).trim() : "Local user";

  const pool = getPool();

  const now = new Date();
  const existingRes = await pool.query(
    `SELECT config_json FROM customer_configs WHERE slug = $1`,
    [slug]
  );
  const existingConfig = existingRes.rowCount ? existingRes.rows[0]?.config_json ?? {} : {};
  const previousHistory = Array.isArray(existingConfig?.publishMeta?.history)
    ? existingConfig.publishMeta.history
    : [];
  const nextHistory = [
    {
      publishedAt: now.toISOString(),
      publishedBy,
    },
    ...previousHistory,
  ].slice(0, 20);
  const nextConfig = {
    ...body.config,
    publishMeta: {
      lastPublishedAt: now.toISOString(),
      lastPublishedBy: publishedBy,
      history: nextHistory,
    },
  };

  // UPSERT config; mark published
  await pool.query(
    `
    INSERT INTO customer_configs (slug, customer_name, status, config_json, published_at, updated_at)
    VALUES ($1, $2, 'published', $3::jsonb, $4, $4)
    ON CONFLICT (slug) DO UPDATE
      SET customer_name = EXCLUDED.customer_name,
          status = 'published',
          config_json = EXCLUDED.config_json,
          published_at = EXCLUDED.published_at,
          updated_at = EXCLUDED.updated_at
    `,
    [slug, customerName, JSON.stringify(nextConfig), now]
  );

  const userRes = await pool.query(
  `SELECT username FROM customer_api_users WHERE username = $1`,
  [slug]
);

let apiUsername = slug;
let apiPassword: string | null = null;

if (userRes.rowCount === 0) {
  apiPassword = crypto.randomBytes(12).toString("base64url"); // show once
  const hash = await bcrypt.hash(apiPassword, 10);

  await pool.query(
    `INSERT INTO customer_api_users (username, customer_slug, password_hash)
     VALUES ($1, $2, $3)`,
    [apiUsername, slug, hash]
  );
}


  const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

  // These are the URLs customers will use
  const portalUrl = `${baseUrl}/${slug}/payments`; // POST entry endpoint (portal posts form-data here)
  const supplierUrl = `${baseUrl}/pay/${slug}`;    // supplier GET page

  return NextResponse.json({
    slug,
    portalUrl,
    supplierUrl,
    publishedAt: now.toISOString(),
    publishedBy,
    publishHistory: nextHistory,
    apiUsername,
    apiPassword, // null if already existed
  });
}
