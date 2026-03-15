"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ApiEndpointConfig } from "@/lib/types";
import type { MappingRow } from "@/app/(app)/customers/[slug]/_components/ResponseMapper";
import type { ParameterRow } from "@/app/(app)/customers/[slug]/_components/ParameterBuilder";

import { useRouter } from "next/navigation";

type DraftShape = {
  customerName?: string;
  customerNotes?: string;
  debugEnabled?: boolean;
  parameterRows: ParameterRow[];
  step1Apis: ApiEndpointConfig[];
  step1Mappings: MappingRow[];
  branding?: {
    logoDataUrl?: string;
    accentColor?: string;
    footerText?: string;
  };

  // ✅ new (optional for backward compatibility)
  gatewaySettings?: {
    provider?: "SIMULATOR" | "CYBERSOURCE" | "PAYTABS";
    cybersource?: {
      checkoutUrl?: string;
      profileId?: string;
      accessKey?: string;
      secretKey?: string;
    };
    paytabs?: {
      profileId?: string;
      serverKey?: string;
      region?: string;
    };

    ui?: {
      theme?: {
        primary?: string;
        background?: string;
        surface?: string;
        text?: string;
        muted?: string;
        radius?: number;
      };
      extraFields?: Array<{
        key: string;
        label: string;
        type: "text" | "number" | "email" | "date";
        required?: boolean;
        placeholder?: string;
      }>;
    };
  };
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

    const isPreview =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("preview") === "1";

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



function normalizeKey(label: string) {
    return (label || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function getValueByJsonPath(obj: any, path: string) {
    if (!obj || !path) return undefined;
    return debugJsonPath(obj, path).finalValue;
}
function previewValueFor(m: any) {
    // if you want: show jsonPath as placeholder
    return m.jsonPath ? `(${m.jsonPath})` : "(not mapped)";
}

function buildInitialFormValues(parameterRows: ParameterRow[] = []) {
    const init: Record<string, string> = {};

    for (const p of parameterRows) {
        if (p.enabled && p.source === "Form" && p.name) {
            init[p.name] = (p.defaultValue ?? "").toString();
        }
    }

    return init;
}

function ensureGatewayUi(gatewaySettings?: DraftShape["gatewaySettings"]) {
    const next = gatewaySettings ? structuredClone(gatewaySettings) : {};

    next.provider = next.provider ?? "SIMULATOR";
    next.cybersource = next.cybersource ?? {
        checkoutUrl: "",
        profileId: "",
        accessKey: "",
        secretKey: "",
    };
    next.paytabs = next.paytabs ?? {
        profileId: "",
        serverKey: "",
        region: "",
    };
    next.ui = next.ui ?? {
        theme: {
            primary: "#0ea5e9",
            background: "#ffffff",
            surface: "#ffffff",
            text: "#111827",
            muted: "#6b7280",
            radius: 16,
        },
        extraFields: [],
    };
    next.ui.theme = next.ui.theme ?? {
        primary: "#0ea5e9",
        background: "#ffffff",
        surface: "#ffffff",
        text: "#111827",
        muted: "#6b7280",
        radius: 16,
    };
    next.ui.extraFields = Array.isArray(next.ui.extraFields) ? next.ui.extraFields : [];

    return next as NonNullable<DraftShape["gatewaySettings"]>;
}

function normalizeDraftShape(draft: DraftShape): DraftShape {
    return {
        ...draft,
        gatewaySettings: ensureGatewayUi(draft.gatewaySettings),
    };
}

export default function SupplierStep1Client({ customerSlug }: { customerSlug: string }) {
    const search = useSearchParams();

    const [draft, setDraft] = React.useState<DraftShape | null>(null);
    const [status, setStatus] = React.useState<"loading" | "ready" | "missing">("loading");

    const [formValues, setFormValues] = React.useState<Record<string, string>>({});
    const [apiLoading, setApiLoading] = React.useState(false);
    const [apiError, setApiError] = React.useState<string>("");
    const [combinedResponse, setCombinedResponse] = React.useState<any>(null);

    const router = useRouter();
    const [paying, setPaying] = React.useState(false);

    const gatewayUi = draft?.gatewaySettings?.ui ?? { theme: {}, extraFields: [] };
    const extraFields = Array.isArray(gatewayUi.extraFields) ? gatewayUi.extraFields : [];
    const theme = draft?.gatewaySettings?.ui?.theme ?? {};
    const branding = draft?.branding ?? {};
    const debugEnabled = Boolean(draft?.debugEnabled);
    const accentColor = branding.accentColor || theme.primary || "#0ea5e9";
    const surfaceStyle: React.CSSProperties = {
        backgroundColor: theme.surface ?? "#ffffff",
        color: theme.text ?? "#111827",
        borderColor: accentColor ? `${accentColor}33` : undefined,
        borderRadius: theme.radius ?? 16,
    };
    const mutedStyle: React.CSSProperties = {
        color: theme.muted ?? "#6b7280",
    };
    const accentCardStyle: React.CSSProperties = {
        ...surfaceStyle,
        boxShadow: accentColor ? `0 1px 0 ${accentColor}22 inset` : undefined,
    };
    const inputStyle: React.CSSProperties = {
        backgroundColor: theme.background ?? "#ffffff",
        borderColor: accentColor ? `${accentColor}55` : undefined,
        color: theme.text ?? "#111827",
        borderRadius: theme.radius ?? 16,
    };
    const primaryButtonStyle: React.CSSProperties = {
        backgroundColor: accentColor,
        borderColor: accentColor,
        color: "#ffffff",
    };

    const isPreview =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("preview") === "1";

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
        const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
        setStatus("loading");
        setApiError("");

        (async () => {
            try {
                // ✅ 1) If preview mode, try local draft first
                if (isPreview) {
                    const raw = localStorage.getItem(`pg-config-draft:${customerSlug}`);
                    if (raw) {
                        const d = normalizeDraftShape(JSON.parse(raw));
                        setDraft(d);
                        setFormValues(buildInitialFormValues(d.parameterRows ?? []));
                        setStatus("ready");
                        return;
                    }
                }

                // ✅ 2) Otherwise, load published config from DB
                const config = normalizeDraftShape(await fetchPublishedConfig(customerSlug));
                setDraft(config);
                setFormValues(buildInitialFormValues(config.parameterRows ?? []));
                setStatus("ready");
            } catch (e: any) {
                setDraft(null);
                setFormValues({});
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

        if (isPreview) {
            setApiLoading(false);
            setApiError("");
            setCombinedResponse(null);
            return;
        }

        const apis = (draft.step1Apis ?? []).filter((a) => a.runInStep1 ?? true);
        if (apis.length === 0) {
            setCombinedResponse(null);
            setApiLoading(false);
            setApiError("No Step 1 APIs configured.");
            return;
        }

        let cancelled = false;

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

                    const resp = await fetch("/api/proxy/call", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            endpoint: resolved,
                            meta: {
                                customerSlug,
                                phase: "STEP1",
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
                            `${api.name}: HTTP ${resp.status} • ${payload?.error ?? "API call failed"}\n` +
                            `Resolved URL: ${resolved.url}\n` +
                            `Details: ${JSON.stringify(payload, null, 2).slice(0, 2000)}`
                        );
                    }

                    results.push(payload);
                }

                if (!cancelled) {
                    setCombinedResponse({ params: allParamValues, results });
                }
            } catch (e: any) {
                if (!cancelled) {
                    setApiError(e?.message ?? "Step 1 API call failed");
                }
            } finally {
                if (!cancelled) {
                    setApiLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // IMPORTANT: do not include formValues here unless you want to re-call APIs on typing
        // We call once on load. If you later want supplier-editable fields, add a "Refresh" button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, draft, isPreview, search]);

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

    const outputRows =
        mappings.length > 0
            ? mappings.map((m) => {
                if (!isPreview && combinedResponse) {
                    const p = normalizePath(m.jsonPath);
                    const v = getValueByJsonPath(combinedResponse, p);
                    return {
                        label: m.label,
                        jsonPath: p,
                        value: v ?? null,
                    };
                }

                return {
                    label: m.label,
                    jsonPath: normalizePath(m.jsonPath),
                    value: previewValueFor(m),
                };
            })
            : [];

    const rawFirstPath = mappings[0]?.jsonPath ?? null;
    const firstTest =
        combinedResponse && mappings[0]?.jsonPath
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
        <div
            style={{
                background: theme.background,
                color: theme.text,
                borderRadius: theme.radius ?? 16,
            }}
        >
            <div className="mx-auto max-w-4xl space-y-6 p-6">
                {(branding.logoDataUrl || draft.customerName) && (
                    <div className="flex items-center gap-4 rounded-2xl border px-5 py-4" style={accentCardStyle}>
                        {branding.logoDataUrl ? (
                            <img
                                src={branding.logoDataUrl}
                                alt={`${draft.customerName || customerSlug} logo`}
                                className="h-12 w-auto max-w-[160px] object-contain"
                            />
                        ) : null}
                        <div className="min-w-0">
                            <div className="text-lg font-semibold">{draft.customerName || customerSlug}</div>
                            {draft.customerNotes ? (
                                <div className="mt-1 text-sm" style={mutedStyle}>
                                    {draft.customerNotes}
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
                <div className="space-y-1">
                    <div className="text-2xl font-semibold">Tender Fee Payment</div>
                    <div className="text-sm" style={mutedStyle}>
                        Customer: <b>{customerSlug}</b>
                    </div>
                </div>

                {/* Show query params for transparency */}
                <Card className="rounded-2xl" style={accentCardStyle}>
                            <CardHeader>
                                <div className="font-semibold">Request Details</div>
                                <div className="text-sm" style={mutedStyle}>
                                    Values provided by the customer portal.
                                </div>
                            </CardHeader>

                            <CardContent className="grid gap-3 sm:grid-cols-2">
                                {queryParams.map((p) => (
                                    <div key={p.id} className="rounded-xl border p-3" style={surfaceStyle}>
                                        <div className="text-xs" style={mutedStyle}>{p.label || p.name}</div>
                                        <div className="mt-1 text-sm font-medium">{valuesFromQuery[p.name] || "—"}</div>
                                    </div>
                                ))}
                            </CardContent>
                </Card>
                {extraFields.length > 0 && (
                    <Card className="rounded-2xl" style={accentCardStyle}>
                                <CardHeader>
                                    <div className="font-semibold">Additional Fields</div>
                                    <div className="text-sm" style={mutedStyle}>
                                        Added via Preview / AI Designer
                                    </div>
                                </CardHeader>
                                <CardContent className="grid gap-3 sm:grid-cols-2">
                                    {extraFields.map((f: any) => (
                                        <div key={f.key} className="space-y-1">
                                            <div className="text-sm font-medium">
                                                {f.label} {!f.required ? <span style={mutedStyle}>(optional)</span> : null}
                                            </div>
                                            <Input
                                                className="rounded-xl"
                                                required={Boolean(f.required)}
                                                placeholder={f.placeholder ?? ""}
                                                style={inputStyle}
                                                value={formValues?.[f.key] ?? ""}
                                                onChange={(e) =>
                                                    setFormValues((prev: any) => ({ ...(prev ?? {}), [f.key]: e.target.value }))
                                                }
                                            />
                                        </div>
                                    ))}
                                </CardContent>
                    </Card>
                )}
                {/* Main output */}
                <Card className="rounded-2xl" style={accentCardStyle}>
                            <CardHeader>
                                <div className="font-semibold">Payment Required</div>
                                <div className="text-sm" style={mutedStyle}>
                                    Fields below are rendered from Step 1 API response using your mappings.
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {apiLoading && (
                                    <div className="rounded-xl border p-4 text-sm" style={surfaceStyle}>
                                        Calling Step 1 APIs…
                                    </div>
                                )}

                                {apiError && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                        {apiError}
                                    </div>
                                )}

                                {!apiLoading && !apiError && (isPreview || combinedResponse) && (
                                    <>
                                        {outputRows.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                                No mappings configured. Add Output Fields in the Response Mapper.
                                            </div>
                                        ) : (
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {outputRows.map((o, idx) => (
                                                    <div key={idx} className="rounded-xl border p-3" style={surfaceStyle}>
                                                        <div className="text-xs" style={mutedStyle}>{o.label}</div>
                                                        <div className="mt-1 text-sm font-medium">
                                                            {o.value == null || o.value === "" ? "—" : String(o.value)}
                                                        </div>
                                                        {debugEnabled ? (
                                                            <div className="mt-1 text-[11px] font-mono break-all" style={mutedStyle}>
                                                                {o.jsonPath}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {isPreview ? (
                                            <div className="rounded-xl border p-4 text-sm" style={{ ...surfaceStyle, ...mutedStyle }}>
                                                Preview mode: API calls are disabled. This view shows configured fields only.
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                <Button
                                                    className="rounded-xl"
                                                    style={primaryButtonStyle}
                                                    disabled={paying}
                                                    onClick={async () => {
                                                        setPaying(true);
                                                        try {
                                                            // choose amount/currency from your mapped outputs or API response
                                                            // simplest: pull from combinedResponse results[0] value + currency if available
                                                            const amount = debugJsonPath(combinedResponse, "$.results[0].dataList.rfx[0].rfxSetting.value").finalValue ?? null;
                                                            const currency = debugJsonPath(combinedResponse, "$.results[0].dataList.rfx[0].rfxSetting.valueCurrency").finalValue ?? null;

                                                            const step1Mapped: Record<string, any> = {};
                                                            for (const m of mappings) {
                                                                const stable = (m.key || "").trim() || normalizeKey(m.label || m.id);
                                                                const normalizedPath = normalizePath(m.jsonPath);
                                                                step1Mapped[stable] = getValueByJsonPath(combinedResponse, normalizedPath) ?? null;
                                                            }

                                                            const res = await fetch("/api/payments/session", {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({
                                                                    customerSlug,
                                                                    rfxId: allParamValues.rfxId,
                                                                    accountId: allParamValues.accountId,
                                                                    userId: allParamValues.userId,
                                                                    amount,
                                                                    currency,
                                                                    step1Mapped,
                                                                    metadata: { source: "supplier-step1" },
                                                                }),
                                                            });
                                                            const json = await res.json();
                                                            if (!res.ok) throw new Error(json?.error ?? "Failed to create session");

                                                            router.push(json.redirectUrl);
                                                        } catch (e) {
                                                            setPaying(false);
                                                            // show toast if you have it; otherwise set error state
                                                            setApiError((e as any)?.message ?? "Payment init failed");
                                                        }

                                                    }}
                                                >

                                                    {paying ? "Redirecting…" : "Pay Tender Fee"}
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
                                            </div>)}
                                    </>
                                )}
                            </CardContent>
                </Card>

                {/* Optional: hide form params for now (since you said capture from URL) */}
                {formParams.length > 0 && (
                    <Card className="rounded-2xl" style={accentCardStyle}>
                                <CardHeader>
                                    <div className="font-semibold">Additional Inputs (optional)</div>
                                    <div className="text-sm" style={mutedStyle}>
                                        Currently not used for auto-call. We can enable supplier editing later.
                                    </div>
                                </CardHeader>
                                <CardContent className="grid gap-3 sm:grid-cols-2">
                                    {formParams.map((p) => (
                                        <div key={p.id} className="space-y-1">
                                            <div className="text-sm font-medium">{p.label || p.name}</div>
                                            <Input
                                                value={formValues[p.name] ?? ""}
                                                style={inputStyle}
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
                {debugEnabled ? (
                    <details className="rounded-xl border p-4">
                        <summary className="cursor-pointer text-sm font-medium">Debug (combined response)</summary>
                        <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs">
                            {JSON.stringify({ rawFirstPath, firstTest, debugWalk }, null, 2)}
                        </pre>
                        <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs">
                            {combinedResponse ? JSON.stringify(combinedResponse, null, 2) : "—"}
                        </pre>
                    </details>
                ) : null}
                {branding.footerText ? (
                    <div className="border-t pt-4 text-center text-sm" style={{ ...mutedStyle, borderColor: `${accentColor}22` }}>
                        {branding.footerText}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
