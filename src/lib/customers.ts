import { getPool } from "@/lib/db";
import { getMockCustomerBySlug, getMockCustomers } from "@/lib/mock";

export type CustomerRecord = {
  slug: string;
  name: string;
  status: "Active" | "Inactive";
  updatedHuman?: string;
};

function toCustomerStatus(value: string | null | undefined): "Active" | "Inactive" {
  return String(value ?? "").toLowerCase() === "published" ? "Active" : "Inactive";
}

export async function getCustomersFromDbOrMock(): Promise<CustomerRecord[]> {
  try {
    const pool = getPool();
    const res = await pool.query(
      `
      SELECT slug, customer_name, status, updated_at
      FROM customer_configs
      ORDER BY updated_at DESC NULLS LAST, slug ASC
      `
    );

    if (res.rows.length > 0) {
      return res.rows.map((row) => ({
        slug: String(row.slug),
        name: String(row.customer_name || row.slug),
        status: toCustomerStatus(row.status),
      }));
    }
  } catch {
    // Fall back to mock data if DB is unavailable in local/dev scenarios.
  }

  return getMockCustomers().map((customer) => ({
    slug: customer.slug,
    name: customer.name,
    status: customer.status,
    updatedHuman: customer.updatedHuman,
  }));
}

export async function getCustomerBySlugFromDbOrMock(slug: string): Promise<CustomerRecord> {
  try {
    const pool = getPool();
    const res = await pool.query(
      `
      SELECT slug, customer_name, status
      FROM customer_configs
      WHERE slug = $1
      `,
      [slug]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        slug: String(row.slug),
        name: String(row.customer_name || row.slug),
        status: toCustomerStatus(row.status),
      };
    }
  } catch {
    // Fall back to mock data if DB is unavailable in local/dev scenarios.
  }

  return getMockCustomerBySlug(slug);
}
