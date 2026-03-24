import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensurePaymentSessionsSchema } from "@/lib/payment-sessions-schema";
import bcrypt from "bcryptjs";

async function authCustomer(req: Request, slug: string) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return null;

  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const [username, password] = decoded.split(":");
  if (!username || !password) return null;

  // username identifies customer
  if (username !== slug) return null;

  const pool = getPool();
  const r = await pool.query(
    `SELECT password_hash FROM customer_api_users WHERE username = $1`,
    [username]
  );
  if (r.rowCount === 0) return null;

  const ok = await bcrypt.compare(password, r.rows[0].password_hash);
  return ok ? { username } : null;
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = String(params.slug || "").trim().toLowerCase();
  const authed = await authCustomer(req, slug);

  // ✅ This is what triggers the browser popup:
  if (!authed) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="payments"' },
    });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const rfx = url.searchParams.get("rfx") ?? "";
  const supplier = url.searchParams.get("supplier") ?? "";
  const dateFrom = url.searchParams.get("dateFrom") ?? "";
  const dateTo = url.searchParams.get("dateTo") ?? "";

  const where: string[] = [`customer_slug = $1`];
  const values: any[] = [slug];

  if (status !== "all") {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  if (rfx.trim()) {
    values.push(`%${rfx.trim()}%`);
    where.push(`(rfx_id ILIKE $${values.length} OR rfx_number ILIKE $${values.length})`);
  }
  if (supplier.trim()) {
    values.push(`%${supplier.trim()}%`);
    where.push(
      `(supplier_name ILIKE $${values.length} OR supplier_email ILIKE $${values.length})`
    );
  }
  if (dateFrom) {
    values.push(`${dateFrom}T00:00:00.000Z`);
    where.push(`created_at >= $${values.length}::timestamptz`);
  }
  if (dateTo) {
    values.push(`${dateTo}T23:59:59.999Z`);
    where.push(`created_at <= $${values.length}::timestamptz`);
  }

  const pool = getPool();
  await ensurePaymentSessionsSchema(pool);
  const rowsRes = await pool.query(
    `
    SELECT id, rfx_id, rfx_number, supplier_name, supplier_email, amount, currency,
           status, provider, received_number, created_at, decided_at, metadata
    FROM payment_sessions
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT 500
    `,
    values
  );

  const rowsHtml = rowsRes.rows
    .map((r: any) => {
      const created = r.created_at ? String(r.created_at).slice(0, 10) : "—";
      const amt = r.amount != null ? `${r.amount} ${r.currency ?? ""}` : "—";
      const fraud = r.metadata?.fraud;
      const fraudSummary = fraud?.enabled
        ? `${fraud.label ?? "LOW"} (${fraud.score ?? 0})`
        : "Off";
      return `
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:8px">${created}</td>
          <td style="padding:8px">${r.rfx_id ?? "—"}</td>
          <td style="padding:8px">${r.rfx_number ?? "—"}</td>
          <td style="padding:8px">
            <div>${r.supplier_name ?? "—"}</div>
            <div style="font-size:12px;opacity:.7">${r.supplier_email ?? ""}</div>
          </td>
          <td style="padding:8px">${amt}</td>
          <td style="padding:8px">${r.status}</td>
          <td style="padding:8px">${r.provider}</td>
          <td style="padding:8px">${fraudSummary}</td>
          <td style="padding:8px">${r.received_number ?? "—"}</td>
          <td style="padding:8px;font-family:monospace;font-size:12px">${r.id}</td>
        </tr>
      `;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Payments - ${slug}</title></head>
<body style="padding:24px;font-family:system-ui">
  <h2>Payments – ${slug}</h2>

  <form method="GET" style="display:grid;gap:8px;grid-template-columns:repeat(6,minmax(0,1fr));margin:12px 0">
    <div style="grid-column:span 2">
      <div style="font-size:12px;opacity:.7">Supplier</div>
      <input name="supplier" value="${supplier.replaceAll('"', "&quot;")}" style="width:100%;padding:8px" />
    </div>
    <div style="grid-column:span 2">
      <div style="font-size:12px;opacity:.7">RFX</div>
      <input name="rfx" value="${rfx.replaceAll('"', "&quot;")}" style="width:100%;padding:8px" />
    </div>
    <div>
      <div style="font-size:12px;opacity:.7">Status</div>
      <select name="status" style="width:100%;padding:8px">
        <option value="all" ${status === "all" ? "selected" : ""}>All</option>
        <option value="PENDING" ${status === "PENDING" ? "selected" : ""}>PENDING</option>
        <option value="APPROVED" ${status === "APPROVED" ? "selected" : ""}>APPROVED</option>
        <option value="DENIED" ${status === "DENIED" ? "selected" : ""}>DENIED</option>
      </select>
    </div>
    <div>
      <div style="font-size:12px;opacity:.7">From</div>
      <input type="date" name="dateFrom" value="${dateFrom}" style="width:100%;padding:8px" />
    </div>
    <div>
      <div style="font-size:12px;opacity:.7">To</div>
      <input type="date" name="dateTo" value="${dateTo}" style="width:100%;padding:8px" />
    </div>
    <div style="grid-column:span 6;display:flex;gap:8px">
      <button type="submit">Apply</button>
      <a href="/external/payments/${slug}">Clear</a>
    </div>
  </form>

  <div style="overflow:auto;border:1px solid #ddd">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="text-align:left;border-bottom:1px solid #ddd">
          <th style="padding:8px">Created</th>
          <th style="padding:8px">RFX</th>
          <th style="padding:8px">RFX Number</th>
          <th style="padding:8px">Supplier</th>
          <th style="padding:8px">Amount</th>
          <th style="padding:8px">Status</th>
          <th style="padding:8px">Provider</th>
          <th style="padding:8px">Fraud</th>
          <th style="padding:8px">Receipt</th>
          <th style="padding:8px">Session</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="10" style="padding:12px;opacity:.7">No results</td></tr>`}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
