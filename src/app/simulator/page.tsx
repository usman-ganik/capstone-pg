"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";

type Provider = "SIMULATOR" | "CYBERSOURCE" | "PAYTABS";

function SimulatorPageInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const slug = sp.get("slug") ?? "";
  const sessionId = sp.get("session") ?? "";

  const [provider, setProvider] = React.useState<Provider>("SIMULATOR");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  async function decide(status: "APPROVED" | "DENIED") {
    setBusy(true);
    setMsg("");

    try {
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
      if (!res.ok) throw new Error(json?.error ?? "Failed");

      router.push(`/pay/${slug}/step5?session=${encodeURIComponent(sessionId)}`);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="text-lg font-semibold">Payment Gateway Simulator</div>
          <div className="text-sm text-muted-foreground">
            Session: <span className="font-mono">{sessionId || "—"}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Provider</div>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMULATOR">Payment Gateway simulator</SelectItem>
                <SelectItem value="CYBERSOURCE">CyberSource Secure Acceptance</SelectItem>
                <SelectItem value="PAYTABS">Paytabs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === "SIMULATOR" ? (
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-xl" disabled={busy || !sessionId || !slug} onClick={() => decide("APPROVED")}>
                {busy ? "Processing…" : "Approved"}
              </Button>
              <Button variant="destructive" className="rounded-xl" disabled={busy || !sessionId || !slug} onClick={() => decide("DENIED")}>
                {busy ? "Processing…" : "Denied"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              {provider} integration coming next. Use simulator for now.
            </div>
          )}

          {msg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {msg}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground">
            Loading simulator…
          </div>
        </div>
      }
    >
      <SimulatorPageInner />
    </Suspense>
  );
}
