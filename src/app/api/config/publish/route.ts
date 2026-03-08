import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

type PublishBody = {
  slug: string;
  customerName?: string;
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

  const pool = getPool();

  const now = new Date();

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
    [slug, customerName, JSON.stringify(body.config), now]
  );

  const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

  // These are the URLs customers will use
  const portalUrl = `${baseUrl}/${slug}/payments`; // POST entry endpoint (portal posts form-data here)
  const supplierUrl = `${baseUrl}/pay/${slug}`;    // supplier GET page

  return NextResponse.json({
    slug,
    portalUrl,
    supplierUrl,
    publishedAt: now.toISOString(),
  });
}