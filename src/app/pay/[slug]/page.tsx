import { headers } from "next/headers";
import { getPool } from "@/lib/db";
import SupplierStep1Client from "./supplier-step1-client";

function normalizeUrlPrefix(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const slug = String(params?.slug ?? "").trim().toLowerCase();
  const preview = String(searchParams?.preview ?? "") === "1";

  if (!preview && slug) {
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT config_json FROM customer_configs WHERE slug = $1`,
        [slug]
      );

      const allowedPortalUrl = String(res.rows[0]?.config_json?.allowedPortalUrl ?? "").trim();
      if (allowedPortalUrl) {
        const headerStore = await headers();
        const referer = headerStore.get("referer") ?? "";
        const origin = headerStore.get("origin") ?? "";
        const allowedPrefix = normalizeUrlPrefix(allowedPortalUrl);
        const refererMatches = normalizeUrlPrefix(referer).startsWith(allowedPrefix);
        const originMatches = normalizeUrlPrefix(origin).startsWith(allowedPrefix);

        if (!refererMatches && !originMatches) {
          return (
            <div className="mx-auto max-w-3xl p-6">
              <div className="rounded-2xl border p-6">
                <div className="text-lg font-semibold">Access restricted</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  This supplier page can only be opened from the configured customer portal URL.
                </div>
              </div>
            </div>
          );
        }
      }
    } catch {
      // Fall back to the existing page behavior if config lookup fails.
    }
  }

  return <SupplierStep1Client customerSlug={slug} />;
}
