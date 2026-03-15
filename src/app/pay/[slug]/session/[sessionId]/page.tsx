"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type GatewayProvider = "SIMULATOR" | "CYBERSOURCE" | "PAYTABS";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function statusBadgeVariant(status?: string): "default" | "secondary" | "destructive" {
  if (status === "APPROVED") return "default";
  if (status === "DENIED") return "destructive";
  return "secondary";
}

export default function PaymentSessionPage() {
  const params = useParams<{ slug: string; sessionId: string }>();
  const router = useRouter();

  const slug = params.slug;
  const sessionId = params.sessionId;

  const [config, setConfig] = React.useState<any>(null);
  const [session, setSession] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const [configRes, sessionRes] = await Promise.all([
          fetch(`/api/config/${slug}`, { cache: "no-store" }),
          fetch(`/api/payments/session/${sessionId}`, { cache: "no-store" }),
        ]);

        const configJson = await configRes.json();
        if (!configRes.ok) throw new Error(configJson?.error ?? "Config load failed");
        setConfig(configJson.config);

        const sessionJson = await sessionRes.json();
        if (!sessionRes.ok) throw new Error(sessionJson?.error ?? "Session load failed");
        setSession(sessionJson);
      } catch (e: any) {
        setErr(e?.message ?? "Failed");
      }
    })();
  }, [slug, sessionId]);

  async function decide(status: "APPROVED" | "DENIED") {
    setBusy(true);
    setErr("");
    try {
      const provider: GatewayProvider = config?.gatewaySettings?.provider ?? "SIMULATOR";

      const res = await fetch(`/api/payments/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          provider,
          receivedNumber: `RCPT-${Math.floor(Math.random() * 1e8)}`,
          gatewayReference: `GW-${Math.floor(Math.random() * 1e8)}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Update failed");
      setSession(json);

      router.push(`/pay/${slug}/step5?session=${encodeURIComponent(sessionId)}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
      setBusy(false);
    }
  }

  const provider: GatewayProvider =
    (session?.provider as GatewayProvider | undefined) ??
    config?.gatewaySettings?.provider ??
    "SIMULATOR";

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="text-lg font-semibold">Payment Session</div>
          <div className="text-sm text-muted-foreground">
            Customer: <b>{slug}</b> • Session: <span className="font-mono">{sessionId}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!config && !session && !err && (
            <div className="rounded-xl border bg-muted p-4 text-sm">Loading…</div>
          )}

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {config && session && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
                <div>
                  Provider: <b>{provider}</b>
                </div>
                <Badge variant={statusBadgeVariant(session.status)} className="rounded-full">
                  {session.status}
                </Badge>
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <div className="text-sm font-medium">Session history</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Created</div>
                    <div className="mt-1">{formatDateTime(session.created_at)}</div>
                  </div>
                  <div className="rounded-xl border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Decision time</div>
                    <div className="mt-1">{formatDateTime(session.decided_at)}</div>
                  </div>
                  <div className="rounded-xl border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Receipt number</div>
                    <div className="mt-1 font-mono text-xs">{session.received_number ?? "—"}</div>
                  </div>
                  <div className="rounded-xl border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Gateway reference</div>
                    <div className="mt-1 font-mono text-xs">{session.gateway_reference ?? "—"}</div>
                  </div>
                </div>

                {session.metadata?.step1Mapped && Object.keys(session.metadata.step1Mapped).length > 0 && (
                  <details className="rounded-xl border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Step 1 mapped payload</summary>
                    <div className="mt-3 overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[420px] border-collapse text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Key</th>
                            <th className="px-3 py-2 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(session.metadata.step1Mapped).map(([key, value]) => (
                            <tr key={key} className="border-b last:border-b-0">
                              <td className="px-3 py-2 font-mono whitespace-nowrap">{key}</td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap">
                                {value == null || value === "" ? "—" : String(value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <details className="mt-3 rounded-xl border p-3">
                      <summary className="cursor-pointer text-xs font-medium">Raw JSON</summary>
                      <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs whitespace-pre">
                        {JSON.stringify(session.metadata.step1Mapped, null, 2)}
                      </pre>
                    </details>
                  </details>
                )}
              </div>

              {provider === "SIMULATOR" && (
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-xl" disabled={busy} onClick={() => decide("APPROVED")}>
                    {busy ? "Processing…" : "Approved"}
                  </Button>
                  <Button variant="destructive" className="rounded-xl" disabled={busy} onClick={() => decide("DENIED")}>
                    {busy ? "Processing…" : "Denied"}
                  </Button>
                </div>
              )}

              {provider === "CYBERSOURCE" && (
                <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                  CyberSource fields are configured in Customer → Simulation tab.
                  Next step: build Secure Acceptance form POST.
                </div>
              )}

              {provider === "PAYTABS" && (
                <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                  Paytabs fields are configured in Customer → Simulation tab.
                  Next step: create Paytabs payment request + redirect.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
