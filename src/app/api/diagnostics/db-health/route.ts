import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

// This is a diagnostic — never let Next prerender/cache it at build time.
export const dynamic = "force-dynamic";

const isProd = () => process.env.NODE_ENV === "production";

// Map a pg/network error to a safe, non-leaky classification. We deliberately
// do NOT echo err.message: it can contain the DB username, host:port, or DSN
// fragments. The operator gets enough to act without us leaking credentials.
function classify(err: any): { code: string | null; message: string } {
  const code: string | undefined = err?.code;
  switch (code) {
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "ECONNRESET":
    case "ETIMEDOUT":
    case "EHOSTUNREACH":
    case "ENETUNREACH":
    case "EAI_AGAIN":
      return { code, message: "database host unreachable or network error" };
    case "28P01": // invalid_password
    case "28000": // invalid_authorization_specification
      return { code, message: "authentication failed (bad credentials)" };
    case "3D000": // undefined_database
      return { code, message: "database does not exist" };
    case "53300": // too_many_connections
      return { code, message: "too many connections" };
    case "57P01": // admin_shutdown
    case "57P03": // cannot_connect_now
      return { code, message: "database rejecting connections" };
    default:
      return { code: code ?? null, message: "database connection error" };
  }
}

export async function GET(req: Request) {
  const prod = isProd();

  // Production: require the shared diagnostic token. If it isn't set (or the
  // request doesn't carry it), hide the endpoint entirely — 404 so the route
  // can't be discovered or probed anonymously.
  if (prod) {
    const required = process.env.DB_HEALTH_TOKEN || "";
    const header = req.headers.get("authorization") || "";
    const provided =
      header.replace(/^Bearer\s+/i, "") || req.headers.get("x-db-health-token") || "";
    if (!required || provided !== required) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  const dsn = process.env.DATABASE_URL || "";

  // If DATABASE_URL isn't set we can't use the pool — report that cleanly
  // (the pool constructor throws otherwise). Never echo the DSN.
  if (!dsn) {
    return NextResponse.json(
      {
        status: "no-database-url",
        hint: "DATABASE_URL is not configured in this deployment.",
      },
      { status: 503 }
    );
  }

  const started = Date.now();
  try {
    const pool = getPool();
    const res = await pool.query("SELECT 1 as ok");

    if (res?.rows?.[0]?.ok === 1) {
      return NextResponse.json({
        status: "ok",
        latencyMs: Date.now() - started,
      });
    }

    return NextResponse.json(
      { status: "unknown", latencyMs: Date.now() - started },
      { status: 503 }
    );
  } catch (err: any) {
    const { code, message } = classify(err);
    return NextResponse.json(
      {
        status: "error",
        code,
        message,
        latencyMs: Date.now() - started,
      },
      { status: 503 }
    );
  }
}
