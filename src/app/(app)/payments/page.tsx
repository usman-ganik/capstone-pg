import { getPool } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import LocalDateTime from "@/components/LocalDateTime";
import { ensurePaymentSessionsSchema } from "@/lib/payment-sessions-schema";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function pickMappedValue(values: Record<string, any> | null | undefined, candidates: string[]) {
  if (!values || typeof values !== "object") return null;
  for (const key of candidates) {
    const value = values[key];
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pool = getPool();
  await ensurePaymentSessionsSchema(pool);

  const customer = (searchParams.customer as string) || "all";
  const status = (searchParams.status as string) || "all";
  const rfx = (searchParams.rfx as string) || "";
  const supplier = (searchParams.supplier as string) || "";
  const dateFrom = (searchParams.dateFrom as string) || "";
  const dateTo = (searchParams.dateTo as string) || "";

  // build WHERE dynamically (parameterized)
  const where: string[] = [];
  const values: any[] = [];

  if (customer !== "all") {
    values.push(customer);
    where.push(`customer_slug = $${values.length}`);
  }
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
    where.push(`(supplier_name ILIKE $${values.length} OR supplier_email ILIKE $${values.length})`);
  }
  if (dateFrom) {
    values.push(`${dateFrom}T00:00:00.000Z`);
    where.push(`created_at >= $${values.length}::timestamptz`);
  }
  if (dateTo) {
    values.push(`${dateTo}T23:59:59.999Z`);
    where.push(`created_at <= $${values.length}::timestamptz`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const customersRes = await pool.query(
    `SELECT DISTINCT customer_slug FROM payment_sessions ORDER BY customer_slug ASC`
  );

  const rowsRes = await pool.query(
    `
    SELECT
      id, customer_slug, rfx_id, rfx_number,
      supplier_name, supplier_email,
      amount, currency,
      status, provider,
      received_number,
      created_at, decided_at, metadata
    FROM payment_sessions
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT 500
    `,
    values
  );

  const customers = customersRes.rows.map((r) => r.customer_slug);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Payment Sessions</div>
        <div className="text-sm text-muted-foreground">
          All payment sessions (latest 500).
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="font-semibold">Filters</div>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Customer</label>
              <Select name="customer" defaultValue={customer}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
  name="status"
  defaultValue={status}
  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
>
  <option value="all">All</option>
  <option value="PENDING">PENDING</option>
  <option value="APPROVED">APPROVED</option>
  <option value="DENIED">DENIED</option>
</select>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">RFX</label>
              <Input name="rfx" defaultValue={rfx} className="rounded-xl" placeholder="rfq_..." />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Supplier</label>
              <Input name="supplier" defaultValue={supplier} className="rounded-xl" placeholder="name or email" />
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-xl" />
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" name="dateTo" defaultValue={dateTo} className="rounded-xl" />
            </div>

            <div className="md:col-span-6 flex gap-2">
              <Button className="rounded-xl" type="submit">Apply</Button>
              <a
  href="/payments"
  className="inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm hover:bg-muted"
>
  Clear
</a>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="font-semibold">Transactions</div>
          <div className="text-sm text-muted-foreground">
            Showing {rowsRes.rowCount} row(s)
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>RFX</TableHead>
                  <TableHead>RFX Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Fraud</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Session ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsRes.rows.map((r) => (
                  <TableRow key={r.id}>
                    <>
                    <TableCell>
                      <LocalDateTime value={r.created_at?.toISOString?.() ?? String(r.created_at)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.customer_slug}</TableCell>
                    <TableCell className="font-mono text-xs">{r.rfx_id ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.rfx_number ?? pickMappedValue(r.metadata?.step1Mapped, [
                        "tender_number",
                        "tenderNumber",
                        "rfx_number",
                        "rfxNumber",
                        "event_number",
                        "eventNumber",
                      ]) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.supplier_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.supplier_email ?? ""}</div>
                    </TableCell>
                    <TableCell>{r.amount ?? "—"} {r.currency ?? ""}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{r.provider}</TableCell>
                    <TableCell>
                      {r.metadata?.fraud?.enabled
                        ? `${r.metadata.fraud.label ?? "LOW"} (${r.metadata.fraud.score ?? 0})`
                        : "Off"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.received_number ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    </>
                  </TableRow>
                ))}
                {rowsRes.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-sm text-muted-foreground">
                      No results
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
