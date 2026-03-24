"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import ApiAccordion from "./ApiAccordion";

import StickyActions from "./StickyActions";
import ResponseMapper, { MappingRow } from "./ResponseMapper";

import { toast } from "sonner";

import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import AiDesignerCard from "./AiDesignerCard";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ApiEndpointConfig } from "@/lib/types";
import ParameterBuilder, { ParameterRow, seed as parameterSeed } from "./ParameterBuilder";
import { DEFAULT_FRAUD_SETTINGS, normalizeFraudSettings } from "@/lib/fraud-detection";
type Customer = {
  name: string;
  slug: string;
  status: "Active" | "Inactive";
};

type BrandingSettings = {
  logoDataUrl: string;
  accentColor: string;
  footerText: string;
};

type LocalCustomerRecord = {
  slug: string;
  name: string;
  status: "Active" | "Inactive";
};

const LOCAL_CUSTOMERS_KEY = "pg-customers";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readLocalCustomers(): LocalCustomerRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertLocalCustomer(customer: LocalCustomerRecord) {
  const next = readLocalCustomers().filter((entry) => entry.slug !== customer.slug);
  next.unshift(customer);
  localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(next));
}

function getDefaultBranding(): BrandingSettings {
  return {
    logoDataUrl: "",
    accentColor: "",
    footerText: "",
  };
}

async function fetchPublishedConfig(slug: string) {
  const res = await fetch(`/api/config/${slug}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? "Failed to load published config");
  }
  return json;
}

export default function ConfigStepper({ customer }: { customer: Customer }) {
  const router = useRouter();
  const isNewCustomer = customer.slug === "new";
  const [parameterRows, setParameterRows] = React.useState<ParameterRow[]>(parameterSeed);
  const [step1Apis, setStep1Apis] = React.useState<ApiEndpointConfig[]>([]);
  const [selectedStep1ApiId, setSelectedStep1ApiId] = React.useState<string | null>(null);

  
const selectedStep1Api = React.useMemo(
  () => step1Apis.find(a => a.id === selectedStep1ApiId) ?? step1Apis[0],
  [step1Apis, selectedStep1ApiId]
);
const [publishInfo, setPublishInfo] = React.useState<{
  supplierUrl: string;
  portalUrl: string;
  publishedAt: string;
  publishedBy: string;
  publishHistory: Array<{ publishedAt: string; publishedBy: string }>;
  apiUsername: string;
  apiPassword: string | null;
} | null>(null);
const [hasSavedDraft, setHasSavedDraft] = React.useState(false);
const [publisherName, setPublisherName] = React.useState<string>("Local user");

const [step5Apis, setStep5Apis] = React.useState<ApiEndpointConfig[]>([]);
const [selectedStep5ApiId, setSelectedStep5ApiId] = React.useState<string | null>(null);
const [step5Mappings, setStep5Mappings] = React.useState<MappingRow[]>([]);
const [step5Notes, setStep5Notes] = React.useState<{ success: string; error: string }>({
  success: "",
  error: "",
});
const [step1ButtonLabel, setStep1ButtonLabel] = React.useState<string>("Pay Tender Fee");
const [landingPageNote, setLandingPageNote] = React.useState<string>("");
const [landingPageSectionTitle, setLandingPageSectionTitle] = React.useState<string>("Payment Required");
const [allowedPortalUrl, setAllowedPortalUrl] = React.useState<string>("");

const selectedStep5Api = React.useMemo(
  () => step5Apis.find((a) => a.id === selectedStep5ApiId) ?? step5Apis[0],
  [step5Apis, selectedStep5ApiId]
);

const step5Prefixes = React.useMemo(() => {
  const enabledApis = (step5Apis ?? []).filter((a) => a.runInStep1 ?? true);
  return [
    { label: "Params", path: "$.params" },
    ...enabledApis.map((a, idx) => ({
      label: `API ${idx + 1}: ${a.name || "Unnamed"}`,
      path: `$.results[${idx}]`,
    })),
  ];
}, [step5Apis]);

const [publishing, setPublishing] = React.useState(false);
const [aiStatusReady, setAiStatusReady] = React.useState(false);

const [gatewaySettings, setGatewaySettings] = React.useState<any>(() =>
  ensureGatewayUi({
    provider: "SIMULATOR",
    cybersource: { checkoutUrl: "", profileId: "", accessKey: "", secretKey: "" },
    paytabs: { profileId: "", serverKey: "", region: "" },
    fraudDetection: DEFAULT_FRAUD_SETTINGS,
  })
);

function ensureGatewayUi(gs: any) {
  const next = gs ? structuredClone(gs) : {};
  next.provider = next.provider ?? "SIMULATOR";
  next.cybersource = next.cybersource ?? { checkoutUrl: "", profileId: "", accessKey: "", secretKey: "" };
  next.paytabs = next.paytabs ?? { profileId: "", serverKey: "", region: "" };
  next.fraudDetection = normalizeFraudSettings(next.fraudDetection);

  // ✅ add missing ui
  next.ui = next.ui ?? {
    theme: {
      primary: "#0ea5e9",
      link: "#0ea5e9",
      background: "#ffffff",
      surface: "#ffffff",
      text: "#111827",
      muted: "#6b7280",
      radius: 16,
    },
    extraFields: [],
  };

  // ensure sub-shapes
  next.ui.theme = next.ui.theme ?? {
    primary: "#0ea5e9",
    link: "#0ea5e9",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#111827",
    muted: "#6b7280",
    radius: 16,
  };
  next.ui.theme.link = next.ui.theme.link ?? next.ui.theme.primary ?? "#0ea5e9";
  next.ui.extraFields = Array.isArray(next.ui.extraFields) ? next.ui.extraFields : [];

  return next;
}

function applyUiPatch(patch: any) {
  const nextGatewaySettings = ensureGatewayUi(gatewaySettings);

  if (patch.theme) {
    nextGatewaySettings.ui.theme = { ...nextGatewaySettings.ui.theme, ...patch.theme };
  }

  if (Array.isArray(patch.removeFieldKeys) && patch.removeFieldKeys.length) {
    nextGatewaySettings.ui.extraFields = nextGatewaySettings.ui.extraFields.filter(
      (f: any) => !patch.removeFieldKeys.includes(f.key)
    );
  }

  if (Array.isArray(patch.addFields) && patch.addFields.length) {
    for (const f of patch.addFields) {
      if (!f?.key) continue;
      const exists = nextGatewaySettings.ui.extraFields.some((x: any) => x.key === f.key);
      if (!exists) nextGatewaySettings.ui.extraFields.push(f);
    }
  }

  setGatewaySettings(nextGatewaySettings);

  // Keep preview iframe in sync without requiring a manual draft save.
  setTimeout(() => {
    saveDraft(nextGatewaySettings);
    setPreviewRefreshKey((value) => value + 1);
  }, 0);
}

async function publishConfig() {
  setPublishing(true);
  try {
    const targetSlug = normalizeSlug(customerSlugInput || customer.slug);
    if (!targetSlug) {
      throw new Error("Customer slug is required");
    }

    // Build the config blob you want published
    const config = {
      customerSlug: targetSlug,
      customerName,
      customerNotes,
      allowedPortalUrl,
      debugEnabled,
      branding,
      parameterRows,
      step1Apis,
      step1Mappings,
      step1ButtonLabel,
      landingPageNote,
      landingPageSectionTitle,
      compactMode,
      gatewaySettings: ensureGatewayUi(gatewaySettings),
      // add more later (step5, etc.)
      step5Apis,
  step5Mappings,
  step5Notes,
  selectedStep5ApiId,
    };

    const res = await fetch("/api/config/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: targetSlug,
        customerName,
        publishedBy: publisherName,
        config,
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Publish failed");

    setPublishInfo({
      supplierUrl: json.supplierUrl,
  portalUrl: json.portalUrl,
  publishedAt: json.publishedAt,
  publishedBy: json.publishedBy ?? publisherName,
  publishHistory: Array.isArray(json.publishHistory) ? json.publishHistory : [],
  apiUsername: json.apiUsername,
  apiPassword: json.apiPassword ?? null,
    });
    setHasSavedDraft(false);

    toast.success("Published", { description: "URLs generated and config saved." });
  } catch (e: any) {
    toast.error("Publish failed", { description: e?.message ?? "Unknown error" });
  } finally {
    setPublishing(false);
  }
}

const [paramTestValues, setParamTestValues] = React.useState<Record<string, string>>(() => {
  const v: Record<string, string> = {};
  parameterRows.forEach(p => {
    if (p.enabled && p.name) v[p.name] = p.defaultValue ?? "";
  });
  return v;
});
const [compactMode, setCompactMode] = React.useState<boolean>(false);
const [step1Mappings, setStep1Mappings] = React.useState<MappingRow[]>([
  {
    id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10),
    key: "tender_number",
    label: "Tender Number",
    display: true,
    jsonPath: "$.tender.number",
    type: "String",
    format: "-",
    required: true,
  },
  
]);

const step1StableKeyPaths = React.useMemo(
  () =>
    (step1Mappings ?? [])
      .map((row) => {
        const stableKey = (row.key || "").trim() || normalizeKey(row.label || "");
        if (!stableKey) return null;
        return {
          label: `Step 1: ${stableKey}`,
          path: `$.step1.${stableKey}`,
        };
      })
      .filter(Boolean) as Array<{ label: string; path: string }>,
  [step1Mappings]
);

const enabledParamNames = parameterRows
  .filter((p) => p.enabled && p.name.trim())
  .map((p) => p.name.trim());

const previewQueryString = React.useMemo(() => {
  const params = new URLSearchParams({ preview: "1" });

  parameterRows
    .filter((p) => p.enabled && p.source === "Query" && p.name.trim())
    .forEach((p) => {
      const key = p.name.trim();
      const fallback =
        p.defaultValue?.trim() ||
        (key === "rfxId" ? "rfq_123" : key === "accountId" ? "1040" : key === "userId" ? "1" : `sample_${key}`);
      params.set(key, paramTestValues[key] || fallback);
    });

  return params.toString();
}, [parameterRows, paramTestValues]);

const draftKey = React.useMemo(() => `pg-config-draft:${customer.slug}`, [customer.slug]);
const [customerSlugInput, setCustomerSlugInput] = React.useState<string>(isNewCustomer ? "" : customer.slug);
const credentialsSlug = normalizeSlug(customerSlugInput || customer.slug);
const credentialsInfo = credentialsSlug
  ? {
      apiUsername: publishInfo?.apiUsername ?? credentialsSlug,
      apiPassword: publishInfo?.apiPassword ?? null,
    }
  : null;
const previewUrl = React.useMemo(
  () => `/pay/${customerSlugInput || customer.slug}?${previewQueryString}`,
  [customer.slug, customerSlugInput, previewQueryString]
);
const step1Url = React.useMemo(
  () => `${typeof window !== "undefined" ? window.location.origin : "https://app.domain"}/pay/${customerSlugInput || customer.slug}`,
  [customer.slug, customerSlugInput]
);
const step5Url = React.useMemo(
  () => `${typeof window !== "undefined" ? window.location.origin : "https://app.domain"}/pay/${customerSlugInput || customer.slug}/step5`,
  [customer.slug, customerSlugInput]
);
const quickLinks = React.useMemo(
  () => {
    const baseOrigin =
      typeof window !== "undefined" ? window.location.origin : "https://app.domain";
    const targetSlug = customerSlugInput || customer.slug;

    return [
      {
        label: "Supplier GET URL",
        value: publishInfo?.supplierUrl ?? step1Url,
        hint: publishInfo ? "Published landing page for suppliers." : "Current draft landing page URL.",
      },
      {
        label: "Portal POST URL",
        value:
          publishInfo?.portalUrl ??
          `${step1Url.replace(`/pay/${targetSlug}`, "")}/${targetSlug}/payments`,
        hint: publishInfo ? "Published portal endpoint for customer integrations." : "Will be finalized on publish.",
      },
      {
        label: "Result Page URL",
        value: step5Url,
        hint: "Return/result page route after payment.",
      },
      {
        label: "External Payments Page",
        value: `${baseOrigin}/external/payments/${targetSlug}`,
        hint: "Basic-auth protected external HTML payments report.",
      },
      {
        label: "Payments Export API",
        value: `${baseOrigin}/api/payments/export?limit=200`,
        hint: "Basic-auth protected JSON export for payment sessions.",
      },
    ];
  },
  [publishInfo, step1Url, step5Url, customer.slug, customerSlugInput]
);

const [savingDraft, setSavingDraft] = React.useState(false);
const [previewRefreshKey, setPreviewRefreshKey] = React.useState(0);
const [customerName, setCustomerName] = React.useState<string>(customer.name);
const [customerNotes, setCustomerNotes] = React.useState<string>("");
const [debugEnabled, setDebugEnabled] = React.useState(false);
const [branding, setBranding] = React.useState<BrandingSettings>(getDefaultBranding());

async function saveDraftWithFeedback() {
  setSavingDraft(true);
  try {
    saveDraft();
  } finally {
    // tiny delay so user sees the state even if instant
    setTimeout(() => setSavingDraft(false), 400);
  }
}

React.useEffect(() => {
  if (typeof window === "undefined") return;
  const savedPublisher = window.localStorage.getItem("pg-publisher-name");
  if (savedPublisher?.trim()) {
    setPublisherName(savedPublisher.trim());
  }
}, []);

React.useEffect(() => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("pg-publisher-name", publisherName.trim() || "Local user");
}, [publisherName]);

React.useEffect(() => {
  if (typeof window === "undefined") return;

  const syncAiStatus = () => {
    const apiKey = window.localStorage.getItem("ai:apikey") || "";
    setAiStatusReady(Boolean(apiKey.trim()));
  };

  syncAiStatus();
  window.addEventListener("focus", syncAiStatus);

  return () => {
    window.removeEventListener("focus", syncAiStatus);
  };
}, []);

React.useEffect(() => {
  function hydrateFromConfig(d: any) {
    if (!d || typeof d !== "object") return;
    if (typeof d.customerSlug === "string" && d.customerSlug.trim()) setCustomerSlugInput(d.customerSlug.trim());
    if (d.parameterRows) setParameterRows(d.parameterRows);
    if (d.step1Apis) setStep1Apis(d.step1Apis);
    if (d.paramTestValues) setParamTestValues(d.paramTestValues);
    if (d.selectedStep1ApiId) setSelectedStep1ApiId(d.selectedStep1ApiId);
    if (d.step1Mappings) setStep1Mappings(d.step1Mappings);
    if (typeof d.step1ButtonLabel === "string") setStep1ButtonLabel(d.step1ButtonLabel);
    if (typeof d.landingPageNote === "string") setLandingPageNote(d.landingPageNote);
    if (typeof d.landingPageSectionTitle === "string") setLandingPageSectionTitle(d.landingPageSectionTitle);
    if (typeof d.compactMode === "boolean") setCompactMode(d.compactMode);
    if (typeof d.customerName === "string") setCustomerName(d.customerName);
    if (typeof d.customerNotes === "string") setCustomerNotes(d.customerNotes);
    if (typeof d.allowedPortalUrl === "string") setAllowedPortalUrl(d.allowedPortalUrl);
    if (typeof d.debugEnabled === "boolean") setDebugEnabled(d.debugEnabled);
    if (d.branding) setBranding({ ...getDefaultBranding(), ...d.branding });
    if (d.step5Apis) setStep5Apis(d.step5Apis);
    if (d.step5Mappings) setStep5Mappings(d.step5Mappings);
    if (d.step5Notes) {
      setStep5Notes({
        success: typeof d.step5Notes.success === "string" ? d.step5Notes.success : "",
        error: typeof d.step5Notes.error === "string" ? d.step5Notes.error : "",
      });
    }
    if (d.selectedStep5ApiId) setSelectedStep5ApiId(d.selectedStep5ApiId);
    if (d.gatewaySettings) setGatewaySettings(ensureGatewayUi(d.gatewaySettings));
  }

  const raw = localStorage.getItem(draftKey);
  if (raw) {
    try {
      hydrateFromConfig(JSON.parse(raw));
      setHasSavedDraft(true);
      return;
    } catch {
      // fall through to published config
    }
  }

  if (customer.slug === "new") return;

  let cancelled = false;

  (async () => {
    try {
      const publishedPayload = await fetchPublishedConfig(customer.slug);
      if (!cancelled) {
        hydrateFromConfig(publishedPayload.config);
        setPublishInfo({
          supplierUrl: `${typeof window !== "undefined" ? window.location.origin : "https://app.domain"}/pay/${customer.slug}`,
          portalUrl: `${typeof window !== "undefined" ? window.location.origin : "https://app.domain"}/${customer.slug}/payments`,
          publishedAt: publishedPayload.publishedAt,
          publishedBy: publishedPayload.config?.publishMeta?.lastPublishedBy ?? "Local user",
          publishHistory: Array.isArray(publishedPayload.config?.publishMeta?.history)
            ? publishedPayload.config.publishMeta.history
            : [],
          apiUsername: customer.slug,
          apiPassword: null,
        });
      }
    } catch {
      // no published config yet; keep defaults
    }
  })();

  return () => {
    cancelled = true;
  };
}, [draftKey, customer.slug]);

function saveDraft(gatewaySettingsOverride?: any) {
  try {
    const targetSlug = normalizeSlug(customerSlugInput || customer.slug);
    if (!targetSlug) {
      toast.error("Customer slug is required");
      return false;
    }

    const safeGatewaySettings = ensureGatewayUi(gatewaySettingsOverride ?? gatewaySettings);
    const payload = {
      customerSlug: targetSlug,
      parameterRows,
      step1Apis,
      paramTestValues,
      selectedStep1ApiId,
      step1Mappings,
      step1ButtonLabel,
      landingPageNote,
      landingPageSectionTitle,
      compactMode,
      savedAt: new Date().toISOString(),
      customerName,
allowedPortalUrl,
customerNotes,
debugEnabled,
branding,
step5Apis,
step5Mappings,
step5Notes,
selectedStep5ApiId,
gatewaySettings: safeGatewaySettings,
    };
    localStorage.setItem(`pg-config-draft:${targetSlug}`, JSON.stringify(payload));
    upsertLocalCustomer({
      slug: targetSlug,
      name: customerName.trim() || targetSlug,
      status: "Inactive",
    });
    setHasSavedDraft(true);
    if (customer.slug === "new") {
      localStorage.removeItem(draftKey);
    }
    if (customer.slug !== targetSlug) {
      router.replace(`/customers/${targetSlug}`);
    }
    toast.success("Draft saved");
    return true;
  } catch (e: any) {
    toast.error("Failed to save draft", { description: e?.message ?? "Unknown error" });
    return false;
  }
}

function clearDraft() {
  const targetSlug = normalizeSlug(customerSlugInput || customer.slug);
  localStorage.removeItem(`pg-config-draft:${targetSlug}`);
  setHasSavedDraft(false);
}

async function resetCredentials() {
  setResettingCreds(true);
  try {
    const targetSlug = normalizeSlug(customerSlugInput || customer.slug);
    if (!targetSlug) throw new Error("Customer slug is required");

    const res = await fetch("/api/config/reset-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: targetSlug }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Reset failed");

    setPublishInfo((prev) => ({
      supplierUrl: prev?.supplierUrl ?? "",
      portalUrl: prev?.portalUrl ?? "",
      publishedAt: prev?.publishedAt ?? new Date().toISOString(),
      publishedBy: prev?.publishedBy ?? publisherName,
      publishHistory: prev?.publishHistory ?? [],
      apiUsername: json.apiUsername,
      apiPassword: json.apiPassword, // show once
    }));
  } finally {
    setResettingCreds(false);
  }
}

const [resettingCreds, setResettingCreds] = React.useState(false);

const step1Prefixes = React.useMemo(() => {
  const enabledApis = (step1Apis ?? []).filter((a) => a.runInStep1 ?? true);
  const apiPrefixes = enabledApis.map((a, idx) => ({
    label: `API ${idx + 1}: ${a.name || "Unnamed"}`,
    path: `$.results[${idx}]`,
  }));

  return [
    { label: "Params", path: "$.params" },
    ...apiPrefixes,
  ];
}, [step1Apis]);

  return (
     <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="min-w-0">
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="w-full justify-start rounded-2xl bg-muted p-1">
        <TabsTrigger value="details" className="rounded-xl">Details</TabsTrigger>
        <TabsTrigger value="params" className="rounded-xl">Parameters</TabsTrigger>
        <TabsTrigger value="step1" className="rounded-xl">Landing Page</TabsTrigger>
        <TabsTrigger value="preview" className="rounded-xl">Preview</TabsTrigger>
        <TabsTrigger value="simulation" className="rounded-xl">Simulator</TabsTrigger>
        <TabsTrigger value="step5" className="rounded-xl">Result Page (Optional)</TabsTrigger>
        <TabsTrigger value="publish" className="rounded-xl">Publish</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="mt-4 space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="font-semibold">Customer Profile</div>
            <div className="text-sm text-muted-foreground">
              Basic identity and routing.
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer name</label>
              <Input
  value={customerName}
  onChange={(e) => setCustomerName(e.target.value)}
  className="rounded-xl"
/>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input
  value={customerSlugInput}
  onChange={(e) => setCustomerSlugInput(e.target.value)}
  readOnly={!isNewCustomer}
  className="rounded-xl"
/>
              <div className="text-xs text-muted-foreground">
                {isNewCustomer
                  ? "Set this once when creating the customer. It will be used in URLs."
                  : `Used in URLs like /pay/${customer.slug}`}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
  placeholder="Optional notes…"
  value={customerNotes}
  onChange={(e) => setCustomerNotes(e.target.value)}
  className="rounded-xl"
/>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Allowed portal URL</label>
              <Input
  value={allowedPortalUrl}
  onChange={(e) => setAllowedPortalUrl(e.target.value)}
  className="rounded-xl"
  placeholder="https://customer.example.com"
/>
              <div className="text-xs text-muted-foreground">
                Optional. If set, the supplier landing page will only load when opened from this customer portal URL.
                Preview mode is still allowed.
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between rounded-2xl border p-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Supplier debug details</div>
                  <div className="text-xs text-muted-foreground">
                    Show JSONPath labels and the debug panel on the supplier page.
                  </div>
                </div>
                <Switch checked={debugEnabled} onCheckedChange={setDebugEnabled} />
              </div>
            </div>

            <div className="sm:col-span-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Fraud detection</div>
                  <div className="text-xs text-muted-foreground">
                    Customer-level risk screening for simulator payment sessions.
                  </div>
                </div>
                <Switch
                  checked={Boolean(gatewaySettings.fraudDetection?.enabled)}
                  onCheckedChange={(checked) =>
                    setGatewaySettings((prev: any) => ({
                      ...prev,
                      fraudDetection: normalizeFraudSettings({
                        ...prev?.fraudDetection,
                        enabled: checked,
                      }),
                    }))
                  }
                />
              </div>

              <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                AI status: {aiStatusReady ? "Ready" : "Not connected"}.
                {" "}Live fraud summaries reuse the same provider and API key saved in AI Designer for this browser.
              </div>

              {gatewaySettings.fraudDetection?.enabled ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sensitivity</label>
                    <Select
                      value={gatewaySettings.fraudDetection.sensitivity}
                      onValueChange={(value) =>
                        setGatewaySettings((prev: any) => ({
                          ...prev,
                          fraudDetection: normalizeFraudSettings({
                            ...prev?.fraudDetection,
                            sensitivity: value,
                          }),
                        }))
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fast-completion threshold (ms)</label>
                    <Input
                      className="rounded-xl"
                      inputMode="numeric"
                      value={String(gatewaySettings.fraudDetection.fastCompletionMs ?? "")}
                      onChange={(e) =>
                        setGatewaySettings((prev: any) => ({
                          ...prev,
                          fraudDetection: normalizeFraudSettings({
                            ...prev?.fraudDetection,
                            fastCompletionMs: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Suspicious-completion threshold (ms)</label>
                    <Input
                      className="rounded-xl"
                      inputMode="numeric"
                      value={String(gatewaySettings.fraudDetection.suspiciousCompletionMs ?? "")}
                      onChange={(e) =>
                        setGatewaySettings((prev: any) => ({
                          ...prev,
                          fraudDetection: normalizeFraudSettings({
                            ...prev?.fraudDetection,
                            suspiciousCompletionMs: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Review threshold</label>
                    <Input
                      className="rounded-xl"
                      inputMode="numeric"
                      value={String(gatewaySettings.fraudDetection.reviewThreshold ?? "")}
                      onChange={(e) =>
                        setGatewaySettings((prev: any) => ({
                          ...prev,
                          fraudDetection: normalizeFraudSettings({
                            ...prev?.fraudDetection,
                            reviewThreshold: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Critical threshold</label>
                    <Input
                      className="rounded-xl"
                      inputMode="numeric"
                      value={String(gatewaySettings.fraudDetection.blockThreshold ?? "")}
                      onChange={(e) =>
                        setGatewaySettings((prev: any) => ({
                          ...prev,
                          fraudDetection: normalizeFraudSettings({
                            ...prev?.fraudDetection,
                            blockThreshold: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="font-semibold">Branding (Optional)</div>
            <div className="text-sm text-muted-foreground">
              Logo, accent color, and footer text for branded templates.
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo</label>
              <Input
                type="file"
                accept="image/*"
                className="rounded-xl"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await fileToDataUrl(file);
                  setBranding((prev) => ({ ...prev, logoDataUrl: dataUrl }));
                }}
              />
              {branding.logoDataUrl && (
                <div className="rounded-xl border p-3">
                  <img src={branding.logoDataUrl} alt="Logo preview" className="h-10 w-auto object-contain" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary accent</label>
              <Input
                placeholder="#4F46E5"
                className="rounded-xl"
                value={branding.accentColor}
                onChange={(e) => setBranding((prev) => ({ ...prev, accentColor: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Footer text</label>
              <Input
                placeholder="Powered by …"
                className="rounded-xl"
                value={branding.footerText}
                onChange={(e) => setBranding((prev) => ({ ...prev, footerText: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {credentialsInfo && !isNewCustomer && (
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="font-semibold">External API Credentials</div>
              <div className="text-sm text-muted-foreground">
                Username identifies the customer. Password is shown only once.
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Username</div>
                <div className="font-mono text-sm">{credentialsInfo.apiUsername}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Password</div>
                <div className="text-sm">
                  {credentialsInfo.apiPassword ? (
                    <span className="font-mono">{credentialsInfo.apiPassword}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Not available (already created). Use “Reset password” to generate a new one.
                    </span>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                className="rounded-xl"
                disabled={resettingCreds}
                onClick={resetCredentials}
              >
                {resettingCreds ? "Resetting…" : "Reset password"}
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>

 <TabsContent value="params" className="mt-4 space-y-4">
  <ParameterBuilder rows={parameterRows} onChange={setParameterRows} />
      </TabsContent>

      <TabsContent value="step1" className="mt-4">
        <div className="space-y-4">
          <ApiAccordion
            title="Landing Page APIs"
            endpoints={step1Apis}
            onChange={setStep1Apis}
            onSelectForMapper={setSelectedStep1ApiId}
            customerSlug={customerSlugInput || customer.slug}
            phase="CONFIG_TEST"
            parameterNames={enabledParamNames}
            parameterValues={paramTestValues}
            onChangeParameterValues={setParamTestValues}
          />

          <ResponseMapper
            title="Landing Page Response Mapping"
            sampleJson={selectedStep1Api?.sampleResponseJson}
            rows={step1Mappings}
            onChange={setStep1Mappings}
            compactMode={compactMode}
            onCompactModeChange={setCompactMode}
            prefixes={step1Prefixes}
          />

          <Card className="rounded-2xl">
            <CardHeader>
              <div className="font-semibold">Landing Page Actions</div>
              <div className="text-sm text-muted-foreground">
                Configure the primary supplier action shown below the mapped payment fields.
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Section title</label>
                  <Input
                    value={landingPageSectionTitle}
                    onChange={(e) => setLandingPageSectionTitle(e.target.value)}
                    className="w-full max-w-sm rounded-xl"
                    placeholder="Payment Required"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Submit button label</label>
                  <Input
                    value={step1ButtonLabel}
                    onChange={(e) => setStep1ButtonLabel(e.target.value)}
                    className="w-full max-w-sm rounded-xl"
                    placeholder="Pay Tender Fee"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Landing page note</label>
                <Textarea
                  value={landingPageNote}
                  onChange={(e) => setLandingPageNote(e.target.value)}
                  className="max-w-2xl rounded-xl"
                  placeholder="Explain why the supplier landed on this page and what they should do next."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="preview" className="mt-4 space-y-4">
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
    {/* Left: Supplier preview */}
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-semibold">Supplier Page Preview</div>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            Open in new tab
          </a>
        </div>
        <div className="text-sm text-muted-foreground">
          Uses your current draft config (no publish needed).
        </div>
      </CardHeader>
      <CardContent>
        <iframe
          key={previewRefreshKey}
          className="h-[760px] w-full rounded-2xl border bg-background"
          src={previewUrl}
        />
      </CardContent>
    </Card>

    {/* Right: AI Designer */}
    <div className="space-y-4">
      <AiDesignerCard
        customerSlug={customer.slug}
        currentUi={gatewaySettings?.ui}
        onApplyPatch={applyUiPatch}
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="font-semibold">What AI can change</div>
          <div className="text-sm text-muted-foreground">
            Adds UI fields and adjusts theme colors in config (no code editing).
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>• Add/remove supplier form fields</div>
          <div>• Match theme colors from portal screenshot</div>
          <div>• Keep changes in draft until you Publish</div>
        </CardContent>
      </Card>
    </div>
  </div>
</TabsContent>

      <TabsContent value="simulation" className="mt-4 min-h-[34rem] space-y-4">
  <Card className="rounded-2xl">
    <CardHeader>
      <div className="font-semibold">Payment Provider</div>
      <div className="text-sm text-muted-foreground">
        Choose which provider experience suppliers will see.
      </div>
    </CardHeader>

    <CardContent className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Provider</label>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              value: "SIMULATOR",
              label: "Payment Gateway simulator",
              hint: "Approve / Deny test flow",
            },
            {
              value: "CYBERSOURCE",
              label: "CyberSource Secure Acceptance",
              hint: "Hosted CyberSource checkout",
            },
            {
              value: "PAYTABS",
              label: "Paytabs",
              hint: "Paytabs payment flow",
            },
          ].map((option) => {
            const isActive = gatewaySettings.provider === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setGatewaySettings((prev: any) => ({ ...prev, provider: option.value }))
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{option.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {gatewaySettings.provider === "CYBERSOURCE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium">Checkout URL</label>
            <Input
              className="rounded-xl"
              value={gatewaySettings.cybersource.checkoutUrl}
              onChange={(e) =>
                setGatewaySettings((p: any) => ({
                  ...p,
                  cybersource: { ...p.cybersource, checkoutUrl: e.target.value },
                }))
              }
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Profile ID</label>
            <Input
              className="rounded-xl"
              value={gatewaySettings.cybersource.profileId}
              onChange={(e) =>
                setGatewaySettings((p: any) => ({
                  ...p,
                  cybersource: { ...p.cybersource, profileId: e.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Access Key</label>
            <Input
              className="rounded-xl"
              value={gatewaySettings.cybersource.accessKey}
              onChange={(e) =>
                setGatewaySettings((p: any) => ({
                  ...p,
                  cybersource: { ...p.cybersource, accessKey: e.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium">Secret Key</label>
            <Input
              type="password"
              className="rounded-xl"
              value={gatewaySettings.cybersource.secretKey}
              onChange={(e) =>
                setGatewaySettings((p: any) => ({
                  ...p,
                  cybersource: { ...p.cybersource, secretKey: e.target.value },
                }))
              }
            />
          </div>
        </div>
      )}

      {gatewaySettings.provider === "PAYTABS" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Profile ID</label>
            <Input
              className="rounded-xl"
              value={gatewaySettings.paytabs.profileId}
              onChange={(e) =>
                setGatewaySettings((p: any) => ({
                  ...p,
                  paytabs: { ...p.paytabs, profileId: e.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Region</label>
            <Input
              className="rounded-xl"
              value={gatewaySettings.paytabs.region}
              onChange={(e) =>
                setGatewaySettings((p: any) => ({
                  ...p,
                  paytabs: { ...p.paytabs, region: e.target.value },
                }))
              }
              placeholder="KSA / UAE / ..."
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium">Server Key</label>
            <Input
              type="password"
              className="rounded-xl"
              value={gatewaySettings.paytabs.serverKey}
              onChange={(e) =>
                setGatewaySettings((p: any) => ({
                  ...p,
                  paytabs: { ...p.paytabs, serverKey: e.target.value },
                }))
              }
            />
          </div>
        </div>
      )}

      {gatewaySettings.provider === "SIMULATOR" && (
        <div className="space-y-4 rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">
            Simulator mode shows approve and deny actions before redirecting to the result page.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" disabled>
              Approved
            </Button>
            <Button variant="destructive" className="rounded-xl" disabled>
              Denied
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Preview only in the configurator. Real actions happen in the supplier payment flow.
          </div>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>

      <TabsContent value="step5" className="mt-4 space-y-4">
        <ApiAccordion
  title="Result Page APIs"
  endpoints={step5Apis}
  onChange={setStep5Apis}
  onSelectForMapper={setSelectedStep5ApiId}
  customerSlug={customerSlugInput || customer.slug}
  phase="CONFIG_TEST"
  parameterNames={enabledParamNames}
  parameterValues={paramTestValues}
  onChangeParameterValues={setParamTestValues}
/>
        <ResponseMapper
  title="Result Page Response Mapping"
  sampleJson={selectedStep5Api?.sampleResponseJson}
  rows={step5Mappings}
  onChange={setStep5Mappings}
  compactMode={compactMode}
  onCompactModeChange={setCompactMode}
  prefixes={step5Prefixes}
  quickPaths={step1StableKeyPaths}
/>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="font-semibold">Result Page Notes</div>
            <div className="text-sm text-muted-foreground">
              Optional helper text shown below the mapped output fields on the result page.
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Success note</label>
              <Textarea
                value={step5Notes.success}
                onChange={(e) =>
                  setStep5Notes((prev) => ({ ...prev, success: e.target.value }))
                }
                className="rounded-xl"
                placeholder="Shown when the result page loads successfully."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Error note</label>
              <Textarea
                value={step5Notes.error}
                onChange={(e) =>
                  setStep5Notes((prev) => ({ ...prev, error: e.target.value }))
                }
                className="rounded-xl"
                placeholder="Shown when result page execution fails."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="publish" className="mt-4 space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="font-semibold">Review & Publish</div>
            <div className="text-sm text-muted-foreground">
              Validate and publish this configuration.
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4 rounded-2xl border p-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Publish as</div>
                  <div className="text-xs text-muted-foreground">
                    Name shown in publish history for this browser.
                  </div>
                </div>
                <Input
                  value={publisherName}
                  onChange={(e) => setPublisherName(e.target.value)}
                  className="rounded-xl"
                  placeholder="Local user"
                />
                <div className="space-y-2 text-sm">
                  <div>✅ Customer details</div>
                  <div>✅ Parameters</div>
                  <div>{step1Apis.length > 0 ? "✅" : "⚠️"} Step 1 APIs configured</div>
                  <div>{step5Apis.length > 0 ? "✅" : "⚠️"} Step 5 APIs configured</div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border p-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Last published</div>
                  <div className="text-xs text-muted-foreground">
                    Latest published snapshot for this customer.
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Published at</div>
                  <div className="text-sm">
                    {publishInfo?.publishedAt
                      ? new Date(publishInfo.publishedAt).toLocaleString()
                      : "Not published yet"}
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Published by</div>
                  <div className="text-sm">{publishInfo?.publishedBy ?? "—"}</div>
                </div>
              </div>
            </div>

            <Card className="rounded-2xl border">
              <CardHeader>
                <div className="font-semibold">Publish history</div>
                <div className="text-sm text-muted-foreground">
                  Most recent publish events for this customer.
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {publishInfo?.publishHistory?.length ? (
                  publishInfo.publishHistory.map((entry, index) => (
                    <div
                      key={`${entry.publishedAt}-${index}`}
                      className="flex items-center justify-between rounded-xl border p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{entry.publishedBy || "Local user"}</div>
                        <div className="text-xs text-muted-foreground">
                          Published this config snapshot
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.publishedAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No publish history yet. Publish once and it will appear here.
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
</div>

<StickyActions
  customer={{ slug: customerSlugInput || customer.slug, status: customer.status }}
  quickLinks={quickLinks}
  published={Boolean(publishInfo) && !hasSavedDraft}
  onSaveDraft={saveDraftWithFeedback}
  savingDraft={savingDraft}
  onClearDraft={clearDraft}
  onPublish={publishConfig}
  publishing={publishing}
/>
  </div>
);
}
