import { getPool } from "@/lib/db";
import { ensureApiCallLogsTable } from "@/lib/api-call-logs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function toISODateOnly(d?: string | null) {
  return d?.slice(0, 10) ?? "";
}

export default async function ApiCallsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pool = getPool();
  await ensureApiCallLogsTable(pool);

  const customer = (searchParams.customer as string) || "";
  const phase = (searchParams.phase as string) || "all";
  const endpoint = (searchParams.endpoint as string) || "";
  const status = (searchParams.status as string) || "all";
  const dateFrom = (searchParams.dateFrom as string) || "";
  const dateTo = (searchParams.dateTo as string) || "";

  const where: string[] = [];
  const values: Array<string | number | boolean> = [];

  if (customer.trim()) {
    values.push(`%${customer.trim()}%`);
    where.push(`COALESCE(customer_slug, '') ILIKE $${values.length}`);
  }
  if (phase !== "all") {
    values.push(phase);
    where.push(`COALESCE(phase, '') = $${values.length}`);
  }
  if (endpoint.trim()) {
    values.push(`%${endpoint.trim()}%`);
    where.push(`COALESCE(endpoint_name, '') ILIKE $${values.length}`);
  }
  if (status !== "all") {
    values.push(status === "ok");
    where.push(`ok = $${values.length}`);
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

  const rowsRes = await pool.query(
    `
      SELECT
        id,
        created_at,
        customer_slug,
        phase,
        endpoint_name,
        method,
        resolved_url,
        status_code,
        ok,
        duration_ms,
        error_message
      FROM api_call_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT 500
    `,
    values
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">API Calls</div>
        <div className="text-sm text-muted-foreground">
          Latest 500 proxy/API calls across config testing and runtime flows.
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
              <Input name="customer" defaultValue={customer} className="rounded-xl" placeholder="acme" />
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Phase</label>
              <select
                name="phase"
                defaultValue={phase}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="CONFIG_TEST">CONFIG_TEST</option>
                <option value="STEP1">STEP1</option>
                <option value="STEP5">STEP5</option>
                <option value="PAYMENTS_EXPORT">PAYMENTS_EXPORT</option>
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="ok">OK</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Endpoint</label>
              <Input name="endpoint" defaultValue={endpoint} className="rounded-xl" placeholder="Get RFQ" />
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
                href="/api-calls"
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
          <div className="font-semibold">Call Log</div>
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
                  <TableHead>Phase</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsRes.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{toISODateOnly(row.created_at?.toISOString?.() ?? String(row.created_at))}</TableCell>
                    <TableCell className="font-mono text-xs">{row.customer_slug ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.phase ?? "—"}</TableCell>
                    <TableCell>{row.endpoint_name ?? "—"}</TableCell>
                    <TableCell>{row.method ?? "—"}</TableCell>
                    <TableCell>{row.ok ? `OK${row.status_code ? ` (${row.status_code})` : ""}` : `Failed${row.status_code ? ` (${row.status_code})` : ""}`}</TableCell>
                    <TableCell>{row.duration_ms ? `${row.duration_ms}ms` : "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate font-mono text-xs">{row.resolved_url ?? "—"}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">{row.error_message ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {rowsRes.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-sm text-muted-foreground">
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
