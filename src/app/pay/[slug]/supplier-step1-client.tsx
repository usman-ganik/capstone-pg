"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ApiEndpointConfig } from "@/lib/types";
import type { MappingRow } from "@/app/(app)/customers/[slug]/_components/ResponseMapper";
import type { ParameterRow } from "@/app/(app)/customers/[slug]/_components/ParameterBuilder";

type DraftShape = {
    parameterRows: ParameterRow[];
    step1Apis: ApiEndpointConfig[];
    step1Mappings: MappingRow[];
};

/*function getDraft(slug: string): DraftShape | null {
    const key = `pg-config-draft:${slug}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}*/

async function fetchPublishedConfig(slug: string) {
  const res = await fetch(`/api/config/${slug}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? "Failed to load config");
  return json.config;
}

function applyTemplate(input: string, values: Record<string, string>) {
    return (input ?? "").replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}

function normalizePath(p: string) {
  if (!p) return p;
  return p
    .trim()
    .replace(/\s+/g, "") // remove spaces/newlines inside JSONPath
    .replace(/(\$\.results\[\d+\])\.root\b/g, "$1")
    .replace(/(\$\.results\[\d+\])\["root"\]/g, "$1")
    .replace(/(\$\.results\[\d+\])\['root'\]/g, "$1")
    .replace(/^\$\.root\b/, "$");
}

function debugJsonPath(obj: any, path: string) {
  let p = path.trim();
  if (p.startsWith("$.")) p = p.slice(2);
  else if (p.startsWith("$")) p = p.slice(1);
  if (p && !p.startsWith(".") && !p.startsWith("[")) p = "." + p;

  const tokens: Array<string | number> = [];
  const re =
    /(?:\.([A-Za-z_]\w*))|(?:\[(\d+)\])|(?:\["([^"]+)"\])|(?:\['([^']+)'\])/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(p)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else if (m[2] !== undefined) tokens.push(Number(m[2]));
    else if (m[3] !== undefined) tokens.push(m[3]);
    else if (m[4] !== undefined) tokens.push(m[4]);
  }

  const steps: any[] = [];
  let cur: any = obj;

  for (const t of tokens) {
    const beforeType = Array.isArray(cur) ? "array" : typeof cur;
    const keysPreview =
      cur && typeof cur === "object"
        ? Array.isArray(cur)
          ? `len=${cur.length}`
          : Object.keys(cur).slice(0, 10)
        : null;

    const next = cur?.[t as any];

    steps.push({
      token: t,
      beforeType,
      keysPreview,
      exists: cur != null && Object.prototype.hasOwnProperty.call(cur, t as any),
      nextType: Array.isArray(next) ? "array" : typeof next,
      nextIsNull: next === null,
      nextIsUndefined: next === undefined,
    });

    cur = next;
    if (cur === undefined) break;
  }

  return { tokens, steps, finalValue: cur ?? null };
}

function getValueByJsonPath(obj: any, path: string) {
  if (!obj || !path) return undefined;
  return debugJsonPath(obj, path).finalValue;
}

export default function SupplierStep1Client({ customerSlug }: { customerSlug: string }) {
    const search = useSearchParams();

    const [draft, setDraft] = React.useState<DraftShape | null>(null);
    const [status, setStatus] = React.useState<"loading" | "ready" | "missing">("loading");

    const [formValues, setFormValues] = React.useState<Record<string, string>>({});
    const [apiLoading, setApiLoading] = React.useState(false);
    const [apiError, setApiError] = React.useState<string>("");
    const [combinedResponse, setCombinedResponse] = React.useState<any>(null);

    // 1) Load config (draft) from localStorage
   /* React.useEffect(() => {
        if (!customerSlug) return;

        setStatus("loading");
        const d = getDraft(customerSlug);

        if (!d) {
            setDraft(null);
            setStatus("missing");
            return;
        }

        setDraft(d);
        setStatus("ready");

        // init form defaults
        const init: Record<string, string> = {};
        for (const p of d.parameterRows ?? []) {
            if (p.enabled && p.source === "Form") init[p.name] = (p.defaultValue ?? "").toString();
        }
        setFormValues(init);
    }, [customerSlug]);*/

    React.useEffect(() => {
  if (!customerSlug) return;

  setStatus("loading");

  (async () => {
    try {
      const config = await fetchPublishedConfig(customerSlug);

      // config is what you saved from ConfigStepper
      setDraft(config);
      setStatus("ready");

      // init form defaults
      const init: Record<string, string> = {};
      for (const p of config.parameterRows ?? []) {
        if (p.enabled && p.source === "Form") init[p.name] = (p.defaultValue ?? "").toString();
      }
      setFormValues(init);
    } catch (e: any) {
      setDraft(null);
      setStatus("missing");
      setApiError(e?.message ?? "Config not found");
    }
  })();
}, [customerSlug]);

    // 2) Build parameter values from URL query + form defaults
    const enabledParams = (draft?.parameterRows ?? []).filter((p) => p.enabled);
    const queryParams = enabledParams.filter((p) => p.source === "Query");
    const formParams = enabledParams.filter((p) => p.source === "Form");

    const valuesFromQuery: Record<string, string> = {};
    for (const p of queryParams) valuesFromQuery[p.name] = search.get(p.name) ?? p.defaultValue ?? "";

    const allParamValues: Record<string, string> = { ...valuesFromQuery, ...formValues };

    // 3) Auto-call the Step 1 APIs in sequence once draft + query params are ready
    React.useEffect(() => {
        if (status !== "ready" || !draft) return;

        // ensure required query params exist (portal provided)
        for (const p of enabledParams) {
            const v = allParamValues[p.name];
            if (p.required && !String(v ?? "").trim()) {
                setApiError(`Missing required parameter: ${p.name}`);
                return;
            }
        }

        const apis = (draft.step1Apis ?? []).filter((a) => a.runInStep1 ?? true);
        if (apis.length === 0) {
            setApiError("No Step 1 APIs configured.");
            return;
        }

        // Call APIs sequentially
        (async () => {
            setApiError("");
            setCombinedResponse(null);
            setApiLoading(true);

            try {
                const results: any[] = [];

                for (const api of apis) {
                    const resolved: ApiEndpointConfig = {
                        ...api,
                        url: applyTemplate(api.url, allParamValues),
                        headersJson: applyTemplate(api.headersJson ?? "", allParamValues),
                        requestBodyJson: applyTemplate(api.requestBodyJson ?? "", allParamValues),
                    };

                    // inside the for-loop:
                    const resp = await fetch("/api/proxy/call", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ endpoint: resolved }),
                    });

                    const text = await resp.text();
                    let payload: any;
                    try {
                        payload = text ? JSON.parse(text) : null;
                    } catch {
                        payload = { raw: text };
                    }

                    if (!resp.ok) {
                        // Show the real reason + resolved URL so you can debug templates
                        throw new Error(
                            `${api.name}: HTTP ${resp.status} • ${payload?.error ?? "API call failed"}\n` +
                            `Resolved URL: ${resolved.url}\n` +
                            `Details: ${JSON.stringify(payload, null, 2).slice(0, 2000)}`
                        );
                    }

                    results.push(payload);

                }

                // Combined response so mapper can reference all API results
                const combined = { params: allParamValues, results };
                setCombinedResponse(combined);
                <details className="rounded-xl border p-4">
  <summary className="cursor-pointer text-sm font-medium">Debug mapping</summary>
  <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs">
{JSON.stringify(
  {
    mappingSourcePreview:
      combinedResponse?.results?.length === 1 ? "results[0]" : "combinedResponse",
    firstMapping: mappings?.[0],
    firstValue:
      mappings?.[0] && mappingSource
        ? getValueByJsonPath(mappingSource, mappings[0].jsonPath)
        : null,
  },
  null,
  2
)}
  </pre>
</details>
            } catch (e: any) {
                setApiError(e?.message ?? "Step 1 API call failed");
            } finally {
                setApiLoading(false);
            }
        })();

        // IMPORTANT: do not include formValues here unless you want to re-call APIs on typing
        // We call once on load. If you later want supplier-editable fields, add a "Refresh" button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, draft, search.toString()]);

    if (!customerSlug || status === "loading") {
        return (
            <div className="mx-auto max-w-3xl p-6">
                <Card className="rounded-2xl">
                    <CardHeader>
                        <div className="text-lg font-semibold">Loading…</div>
                        <div className="text-sm text-muted-foreground">
                            Preparing supplier page for <b>{customerSlug || "…"}</b>
                        </div>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (status === "missing" || !draft) {
        return (
            <div className="mx-auto max-w-3xl p-6">
                <Card className="rounded-2xl">
                    <CardHeader>
                        <div className="text-lg font-semibold">Configuration not found</div>
                        <div className="text-sm text-muted-foreground">
                            No draft/config exists for <b>{customerSlug}</b>. Save a draft in the Configurator first.
                        </div>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const mappings = draft.step1Mappings ?? [];

    // Compute mapped output fields from combinedResponse
    const mappingSource =
        combinedResponse?.results?.length === 1
            ? combinedResponse.results[0]      // use raw API response (matches mapper sample)
            : combinedResponse;                // multiple APIs: use combined wrapper


    // 1) Build output rows (use normalizePath + getValueByJsonPath)
const outputRows =
  combinedResponse && mappings.length
    ? mappings.map((m) => {
        const p = normalizePath(m.jsonPath);
        const v = getValueByJsonPath(combinedResponse, p);
        return {
          label: m.label,
          jsonPath: p,
          value: v ?? null,
        };
      })
    : [];
const rawFirstPath = mappings?.[0]?.jsonPath ?? null;
const firstTest =
  combinedResponse && mappings?.[0]?.jsonPath
    ? (() => {
        const p = normalizePath(mappings[0].jsonPath);
        return {
          jsonPath: p,
          value: getValueByJsonPath(combinedResponse, p) ?? null,
        };
      })()
    : null;

    const debugPath = firstTest?.jsonPath ?? null;
const debugWalk = combinedResponse && debugPath ? debugJsonPath(combinedResponse, debugPath) : null;

    return (
        <div className="mx-auto max-w-4xl p-6 space-y-6">
            <div className="space-y-1">
                <div className="text-2xl font-semibold">Tender Fee Payment</div>
                <div className="text-sm text-muted-foreground">
                    Customer: <b>{customerSlug}</b>
                </div>
            </div>

            {/* Show query params for transparency */}
            <Card className="rounded-2xl">
                <CardHeader>
                    <div className="font-semibold">Request Details</div>
                    <div className="text-sm text-muted-foreground">
                        Values provided by the customer portal.
                    </div>
                </CardHeader>

                <CardContent className="grid gap-3 sm:grid-cols-2">
                    {queryParams.map((p) => (
                        <div key={p.id} className="rounded-xl border p-3">
                            <div className="text-xs text-muted-foreground">{p.label || p.name}</div>
                            <div className="mt-1 text-sm font-medium">{valuesFromQuery[p.name] || "—"}</div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Main output */}
            <Card className="rounded-2xl">
                <CardHeader>
                    <div className="font-semibold">Payment Required</div>
                    <div className="text-sm text-muted-foreground">
                        Fields below are rendered from Step 1 API response using your mappings.
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {apiLoading && (
                        <div className="rounded-xl border bg-muted p-4 text-sm">
                            Calling Step 1 APIs…
                        </div>
                    )}

                    {apiError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {apiError}
                        </div>
                    )}

                    {!apiLoading && !apiError && combinedResponse && (
                        <>
                            {outputRows.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    No mappings configured. Add Output Fields in the Response Mapper.
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {outputRows.map((o, idx) => (
                                        <div key={idx} className="rounded-xl border p-3">
                                            <div className="text-xs text-muted-foreground">{o.label}</div>
                                            <div className="mt-1 text-sm font-medium">
                                                {o.value == null || o.value === "" ? "—" : String(o.value)}
                                            </div>
                                            <div className="mt-1 text-[11px] text-muted-foreground font-mono break-all">
          {o.jsonPath}
        </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button
                                    className="rounded-xl"
                                    onClick={() => alert("Next: create payment session + redirect to gateway")}
                                >
                                    Pay Tender Fee
                                </Button>

                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => {
                                        // re-run sequence manually if needed
                                        window.location.reload();
                                    }}
                                >
                                    Refresh
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Optional: hide form params for now (since you said capture from URL) */}
            {formParams.length > 0 && (
                <Card className="rounded-2xl">
                    <CardHeader>
                        <div className="font-semibold">Additional Inputs (optional)</div>
                        <div className="text-sm text-muted-foreground">
                            Currently not used for auto-call. We can enable supplier editing later.
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {formParams.map((p) => (
                            <div key={p.id} className="space-y-1">
                                <div className="text-sm font-medium">{p.label || p.name}</div>
                                <Input
                                    value={formValues[p.name] ?? ""}
                                    onChange={(e) =>
                                        setFormValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                                    }
                                    className="rounded-xl"
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Debug (optional) */}
            <details className="rounded-xl border p-4">
                <summary className="cursor-pointer text-sm font-medium">Debug (combined response)</summary>
                <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs">
{JSON.stringify({ rawFirstPath, firstTest, debugWalk }, null, 2)}
</pre>
                <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs">
                    {combinedResponse ? JSON.stringify(combinedResponse, null, 2) : "—"}
                </pre>
            </details>
        </div>
    );
}