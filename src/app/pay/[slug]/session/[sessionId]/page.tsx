"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type GatewayProvider = "SIMULATOR" | "CYBERSOURCE" | "PAYTABS";

type InteractionMetrics = {
  pageLoadedAt: number;
  mouseMoveCount: number;
  cursorDistancePx: number;
  maxCursorJumpPx: number;
  scrollCount: number;
  keyboardEventCount: number;
  clickCount: number;
  pointerDownCount: number;
  hoverTargetChanges: number;
  lastX: number | null;
  lastY: number | null;
  lastHoverSignature: string | null;
};

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

function fraudBadgeVariant(label?: string): "default" | "secondary" | "destructive" {
  if (label === "HIGH" || label === "CRITICAL") return "destructive";
  if (label === "MEDIUM") return "secondary";
  return "default";
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
  const [aiStatus, setAiStatus] = React.useState<"idle" | "generating" | "ready" | "error">("idle");
  const interactionRef = React.useRef<InteractionMetrics>({
    pageLoadedAt: Date.now(),
    mouseMoveCount: 0,
    cursorDistancePx: 0,
    maxCursorJumpPx: 0,
    scrollCount: 0,
    keyboardEventCount: 0,
    clickCount: 0,
    pointerDownCount: 0,
    hoverTargetChanges: 0,
    lastX: null,
    lastY: null,
    lastHoverSignature: null,
  });

  React.useEffect(() => {
    interactionRef.current = {
      pageLoadedAt: Date.now(),
      mouseMoveCount: 0,
      cursorDistancePx: 0,
      maxCursorJumpPx: 0,
      scrollCount: 0,
      keyboardEventCount: 0,
      clickCount: 0,
      pointerDownCount: 0,
      hoverTargetChanges: 0,
      lastX: null,
      lastY: null,
      lastHoverSignature: null,
    };

    function onMouseMove(event: MouseEvent) {
      const metrics = interactionRef.current;
      metrics.mouseMoveCount += 1;
      if (metrics.lastX != null && metrics.lastY != null) {
        const dx = event.clientX - metrics.lastX;
        const dy = event.clientY - metrics.lastY;
        const jump = Math.sqrt(dx * dx + dy * dy);
        metrics.cursorDistancePx += jump;
        metrics.maxCursorJumpPx = Math.max(metrics.maxCursorJumpPx, jump);
      }
      metrics.lastX = event.clientX;
      metrics.lastY = event.clientY;
    }

    function onScroll() {
      interactionRef.current.scrollCount += 1;
    }

    function onKeyDown() {
      interactionRef.current.keyboardEventCount += 1;
    }

    function onPointerDown() {
      interactionRef.current.pointerDownCount += 1;
    }

    function onClick() {
      interactionRef.current.clickCount += 1;
    }

    function onMouseOver(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const signature = [
        target.tagName,
        target.id || "",
        target.getAttribute("data-state") || "",
        target.getAttribute("role") || "",
      ].join(":");
      if (signature !== interactionRef.current.lastHoverSignature) {
        interactionRef.current.hoverTargetChanges += 1;
        interactionRef.current.lastHoverSignature = signature;
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("click", onClick);
    window.addEventListener("mouseover", onMouseOver);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("click", onClick);
      window.removeEventListener("mouseover", onMouseOver);
    };
  }, [sessionId]);

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

  async function generateFraudLlmSummary(nextSession: any) {
    if (typeof window === "undefined") return nextSession;

    const provider = localStorage.getItem("ai:provider") || "openai";
    const apiKey = localStorage.getItem("ai:apikey") || "";
    const fraud = nextSession?.metadata?.fraud;

    if (!apiKey.trim() || !fraud?.enabled) {
      return nextSession;
    }

    setAiStatus("generating");

    try {
      const summaryRes = await fetch("/api/ai/fraud-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          session: {
            id: nextSession.id,
            customerSlug: nextSession.customer_slug,
            supplierName: nextSession.supplier_name,
            supplierEmail: nextSession.supplier_email,
            amount: nextSession.amount,
            currency: nextSession.currency,
            status: nextSession.status,
            rfxId: nextSession.rfx_id,
            rfxNumber: nextSession.rfx_number,
          },
          fraud,
        }),
      });

      const summaryJson = await summaryRes.json();
      if (!summaryRes.ok) {
        throw new Error(summaryJson?.error ?? "Failed to generate fraud summary");
      }

      const persistRes = await fetch(`/api/payments/session/${nextSession.id}/fraud-llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: summaryJson.analysis,
          debug: summaryJson.debug ?? null,
        }),
      });
      const persistedJson = await persistRes.json();
      if (!persistRes.ok) {
        throw new Error(persistedJson?.error ?? "Failed to save fraud summary");
      }

      setAiStatus("ready");
      setSession(persistedJson);
      return persistedJson;
    } catch (e: any) {
      console.error("Fraud LLM summary failed", e);
      setAiStatus("error");
      return nextSession;
    }
  }

  React.useEffect(() => {
    if (!session?.metadata?.fraud?.enabled) return;
    if (session?.metadata?.fraud?.llm) return;

    let cancelled = false;

    (async () => {
      const enriched = await generateFraudLlmSummary(session);
      if (cancelled) return;
      if (enriched?.metadata?.fraud?.llm) {
        setSession(enriched);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.metadata?.fraud?.enabled, session?.metadata?.fraud?.llm]);

  async function decide(status: "APPROVED" | "DENIED") {
    setBusy(true);
    setErr("");
    try {
      const provider: GatewayProvider = config?.gatewaySettings?.provider ?? "SIMULATOR";
      const now = Date.now();
      const metrics = interactionRef.current;
      const behaviorMetrics = {
        pageLoadedAt: new Date(metrics.pageLoadedAt).toISOString(),
        decisionedAt: new Date(now).toISOString(),
        pageLoadToDecisionMs: now - metrics.pageLoadedAt,
        mouseMoveCount: metrics.mouseMoveCount,
        cursorDistancePx: Math.round(metrics.cursorDistancePx),
        maxCursorJumpPx: Math.round(metrics.maxCursorJumpPx),
        scrollCount: metrics.scrollCount,
        keyboardEventCount: metrics.keyboardEventCount,
        clickCount: metrics.clickCount + 1,
        pointerDownCount: metrics.pointerDownCount,
        hoverTargetChanges: metrics.hoverTargetChanges,
      };

      const res = await fetch(`/api/payments/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          provider,
          receivedNumber: `RCPT-${Math.floor(Math.random() * 1e8)}`,
          gatewayReference: `GW-${Math.floor(Math.random() * 1e8)}`,
          behaviorMetrics,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Update failed");
      const enrichedSession = await generateFraudLlmSummary(json);
      setSession(enrichedSession);

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
  const fraud = session?.metadata?.fraud;
  const fraudSignals = Array.isArray(fraud?.signals) ? fraud.signals : [];
  const fraudEnabled = Boolean(session?.metadata?.fraudSettings?.enabled || fraud?.enabled);
  const fraudLlm = fraud?.llm;

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

              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-medium">Fraud review</div>
                  {fraudEnabled ? (
                    <>
                      <Badge variant={fraudBadgeVariant(fraud?.label)} className="rounded-full">
                        {fraud?.label ?? "LOW"}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Score: <b>{fraud?.score ?? 0}</b>/100
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Recommendation: <b>{fraud?.recommendation ?? "APPROVE"}</b>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Fraud detection is disabled for this customer.
                    </div>
                  )}
                </div>

                {fraudEnabled ? (
                  <>
                    <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                      {fraud?.explanation ?? "No fraud explanation available yet."}
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                      {fraudLlm?.headline ? (
                        <div className="font-medium">{fraudLlm.headline}</div>
                      ) : null}
                      <div className={fraudLlm?.headline ? "mt-1" : ""}>
                        {fraudLlm?.summary ??
                          (aiStatus === "generating"
                            ? "Generating live AI fraud summary…"
                            : "Live AI fraud summary not available. Add the API key in AI Designer to enable it.")}
                      </div>
                      {fraudLlm?.recommendation ? (
                        <div className="mt-2 text-muted-foreground">
                          AI recommendation: <b>{fraudLlm.recommendation}</b>
                          {fraudLlm.confidence ? ` • Confidence: ${fraudLlm.confidence}` : ""}
                        </div>
                      ) : null}
                      {Array.isArray(fraudLlm?.topReasons) && fraudLlm.topReasons.length > 0 ? (
                        <div className="mt-2 text-muted-foreground">
                          {fraudLlm.topReasons.join(" • ")}
                        </div>
                      ) : null}
                    </div>

                    {fraudSignals.length > 0 ? (
                      <div className="grid gap-2">
                        {fraudSignals.map((signal: any) => (
                          <div key={signal.code} className="rounded-xl border p-3 text-sm">
                            <div className="font-medium">
                              {signal.code} <span className="text-muted-foreground">(+{signal.points})</span>
                            </div>
                            <div className="mt-1 text-muted-foreground">{signal.detail}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No suspicious signals have been detected so far.
                      </div>
                    )}

                    {fraud?.behaviorMetrics ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border p-3 text-sm">
                          <div className="text-xs text-muted-foreground">Decision time</div>
                          <div className="mt-1">
                            {fraud.behaviorMetrics.pageLoadToDecisionMs != null
                              ? `${fraud.behaviorMetrics.pageLoadToDecisionMs} ms`
                              : "Pending"}
                          </div>
                        </div>
                        <div className="rounded-xl border p-3 text-sm">
                          <div className="text-xs text-muted-foreground">Mouse movement</div>
                          <div className="mt-1">
                            {fraud.behaviorMetrics.mouseMoveCount ?? 0} moves / {fraud.behaviorMetrics.cursorDistancePx ?? 0}px
                          </div>
                        </div>
                        <div className="rounded-xl border p-3 text-sm">
                          <div className="text-xs text-muted-foreground">Scroll / keyboard</div>
                          <div className="mt-1">
                            {fraud.behaviorMetrics.scrollCount ?? 0} scrolls / {fraud.behaviorMetrics.keyboardEventCount ?? 0} keys
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
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
