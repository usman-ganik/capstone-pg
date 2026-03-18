"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

function debugJsonPath(obj: any, path: string) {
  // Reuse your working debugJsonPath implementation here
  // (you already have it in supplier step1; copy it)
  let p = path.trim();
  if (p.startsWith("$."))
    p = p.slice(2);
  else if (p.startsWith("$"))
    p = p.slice(1);
  if (p && !p.startsWith(".") && !p.startsWith("[")) p = "." + p;

  const tokens: Array<string | number> = [];
  const re = /(?:\.([A-Za-z_]\w*))|(?:\[(\d+)\])|(?:\["([^"]+)"\])|(?:\['([^']+)'\])/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(p)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else if (m[2] !== undefined) tokens.push(Number(m[2]));
    else if (m[3] !== undefined) tokens.push(m[3]);
    else if (m[4] !== undefined) tokens.push(m[4]);
  }

  let cur: any = obj;
  for (const t of tokens) {
    cur = cur?.[t as any];
    if (cur === undefined) break;
  }
  return { finalValue: cur ?? null };
}

function getByDotPath(values: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), values);
}

function applyTemplateDot(input: string, values: any) {
  return (input ?? "").replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const v = getByDotPath(values, key);
    return v == null ? "" : String(v);
  });
}

function isHttpUrl(value: unknown) {
  if (typeof value !== "string") return false;
  return /^https?:\/\//i.test(value.trim());
}


export default function Step5Page() {
  const params = useParams<{ slug: string }>();
  const sp = useSearchParams();

  const slug = params.slug;
  const sessionId = sp.get("session") ?? "";

  const [config, setConfig] = React.useState<any>(null);
  const [session, setSession] = React.useState<any>(null);
  const [combined, setCombined] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        if (!sessionId) {
          throw new Error("Missing session query parameter");
        }

        const cfgRes = await fetch(`/api/config/${slug}`, { cache: "no-store" });
        const cfgJson = await cfgRes.json();
        if (!cfgRes.ok) throw new Error(cfgJson?.error ?? "Config load failed");
        const cfg = cfgJson.config;
        setConfig(cfg);

        const sessRes = await fetch(`/api/payments/session/${sessionId}`, { cache: "no-store" });
        const sessJson = await sessRes.json();
        if (!sessRes.ok) throw new Error(sessJson?.error ?? "Session load failed");
        setSession(sessJson);

        // Run Step 5 APIs in sequence
        
        const apis = (cfg.step5Apis ?? []).filter((a: any) => a.runInStep1 ?? true);
        const results: any[] = [];
        const step1Mapped = sessJson?.metadata?.step1Mapped ?? {};
        const stepParams = {
          slug,
          sessionId,
          rfxId: sessJson?.rfx_id ?? "",
          accountId: sessJson?.account_id ?? "",
          userId: sessJson?.user_id ?? "",
        };
        const templateValues = {
          params: stepParams,
          session: sessJson,
          step1: step1Mapped,
        };

        for (const api of apis) {
          const resolvedApi = {
            ...api,
            url: applyTemplateDot(api.url, templateValues),
            headersJson: applyTemplateDot(api.headersJson ?? "", templateValues),
            requestBodyJson: applyTemplateDot(api.requestBodyJson ?? "", templateValues),
          };

          const resp = await fetch("/api/proxy/call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: resolvedApi,
              meta: {
                customerSlug: slug,
                phase: "STEP5",
              },
            }),
          });

          const text = await resp.text();
          let payload: any;
          try {
            payload = text ? JSON.parse(text) : null;
          } catch {
            payload = { raw: text };
          }

          if (!resp.ok) {
            throw new Error(
              `${api.name || "Step 5 API"} failed: ${payload?.error ?? "API failed"}\n` +
              `Resolved URL: ${resolvedApi.url}`
            );
          }

          results.push(payload);
        }

        // Build combined object for mapper
        const combinedObj = {
          params: stepParams,
          session: sessJson,
          step1: step1Mapped,
          results,
        };

        setCombined(combinedObj);
      } catch (e: any) {
        setErr(e?.message ?? "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, sessionId]);

  const mappings = config?.step5Mappings ?? [];
  const step5Notes = config?.step5Notes ?? { success: "", error: "" };
  const sessionStatus = String(session?.status ?? "").toUpperCase();
  const showSuccessNote = !loading && !err && sessionStatus === "APPROVED" && Boolean(step5Notes.success);
  const showErrorNote =
    (!loading && sessionStatus === "DENIED" && Boolean(step5Notes.error)) ||
    (Boolean(err) && Boolean(step5Notes.error));

  const outputRows: Array<{ label: string; type: string; value: unknown }> =
    combined && mappings.length
      ? mappings
          .filter((m: any) => m.display !== false)
          .map((m: any): { label: string; type: string; value: unknown } => ({
            label: m.label,
            type: m.type ?? "String",
            value: debugJsonPath(combined, m.jsonPath).finalValue,
          }))
      : [];

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="text-lg font-semibold">Result Page: Payment Result</div>
          <div className="text-sm text-muted-foreground">
            Customer: <b>{slug}</b> • Session: <span className="font-mono">{sessionId}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading && <div className="rounded-xl border bg-muted p-4 text-sm">Loading result page…</div>}
          {err && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}
          {showErrorNote ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {step5Notes.error}
            </div>
          ) : null}

          {!loading && !err && session && (
            <div className="rounded-xl border p-4 text-sm">
              Status: <b>{session.status}</b> • Provider: <b>{session.provider}</b>
            </div>
          )}

          {!loading && !err && combined && (
            <>
              {outputRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No result page mappings configured yet.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {outputRows.map((o: { label: string; type: string; value: unknown }, idx: number) => (
                      <div key={idx} className="rounded-xl border p-3">
                        <div className="text-xs text-muted-foreground">{o.label}</div>
                        <div className="mt-1 text-sm font-medium">
                          {o.value == null || o.value === "" ? (
                            "—"
                          ) : o.type === "URL" && isHttpUrl(o.value) ? (
                            <a
                              href={String(o.value)}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {String(o.value)}
                            </a>
                          ) : (
                            String(o.value)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {showSuccessNote ? (
                    <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      {step5Notes.success}
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
