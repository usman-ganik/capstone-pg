"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import LivePreview from "./LivePreview";
import ApiAccordion from "./ApiAccordion";
import GeneratePanel from "./GeneratePanel";

import StickyActions from "./StickyActions";
import ResponseMapper, { MappingRow } from "./ResponseMapper";

import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import * as React from "react";
import { ApiEndpointConfig } from "@/lib/types";
import ParameterBuilder, { ParameterRow, seed as parameterSeed } from "./ParameterBuilder";
type Customer = {
  name: string;
  slug: string;
  status: "Active" | "Inactive";
};

export default function ConfigStepper({ customer }: { customer: Customer }) {
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
} | null>(null);

const [step5Apis, setStep5Apis] = React.useState<ApiEndpointConfig[]>([]);
const [selectedStep5ApiId, setSelectedStep5ApiId] = React.useState<string | null>(null);
const [step5Mappings, setStep5Mappings] = React.useState<MappingRow[]>([]);

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

async function publishConfig() {
  setPublishing(true);
  try {
    // Build the config blob you want published
    const config = {
      customerName,
      customerNotes,
      parameterRows,
      step1Apis,
      step1Mappings,
      compactMode,
      // add more later (step5, etc.)
    };

    const res = await fetch("/api/config/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: customer.slug,
        customerName,
        config,
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Publish failed");

    setPublishInfo({
      supplierUrl: json.supplierUrl,
      portalUrl: json.portalUrl,
      publishedAt: json.publishedAt,
    });

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
    label: "Tender Number",
    jsonPath: "$.tender.number",
    type: "String",
    format: "-",
    required: true,
  },
  {
    id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10),
    label: "Fee Amount",
    jsonPath: "$.fee.amount",
    type: "Number",
    format: "currency",
    required: true,
  },
]);

const enabledParamNames = parameterRows
  .filter((p) => p.enabled && p.name.trim())
  .map((p) => p.name.trim());
  
const draftKey = React.useMemo(() => `pg-config-draft:${customer.slug}`, [customer.slug]);

const [savingDraft, setSavingDraft] = React.useState(false);
const [customerName, setCustomerName] = React.useState<string>(customer.name);
const [customerNotes, setCustomerNotes] = React.useState<string>("");

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
  const raw = localStorage.getItem(draftKey);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    if (d.parameterRows) setParameterRows(d.parameterRows);
    if (d.step1Apis) setStep1Apis(d.step1Apis);
    if (d.paramTestValues) setParamTestValues(d.paramTestValues);
    if (d.selectedStep1ApiId) setSelectedStep1ApiId(d.selectedStep1ApiId);
    if (d.step1Mappings) setStep1Mappings(d.step1Mappings);
    if (typeof d.compactMode === "boolean") setCompactMode(d.compactMode);
    if (d.step5Apis) setStep5Apis(d.step5Apis);
if (d.step5Mappings) setStep5Mappings(d.step5Mappings);
if (d.selectedStep5ApiId) setSelectedStep5ApiId(d.selectedStep5ApiId);
  } catch {}
}, [draftKey]);

function saveDraft() {
  try {
    const payload = {
      parameterRows,
      step1Apis,
      paramTestValues,
      selectedStep1ApiId,
      step1Mappings,
      compactMode,
      savedAt: new Date().toISOString(),
      customerName,
customerNotes,
step5Apis,
step5Mappings,
selectedStep5ApiId,
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
    toast.success("Draft saved");
  } catch (e: any) {
    toast.error("Failed to save draft", { description: e?.message ?? "Unknown error" });
  }
}

function clearDraft() {
  localStorage.removeItem(draftKey);
}

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
     <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div className="min-w-0">
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="w-full justify-start rounded-2xl bg-muted p-1">
        <TabsTrigger value="details" className="rounded-xl">Details</TabsTrigger>
        <TabsTrigger value="params" className="rounded-xl">Parameters</TabsTrigger>
        <TabsTrigger value="step1" className="rounded-xl">Step 1 Page</TabsTrigger>
        <TabsTrigger value="sim" className="rounded-xl">Simulator</TabsTrigger>
        <TabsTrigger value="step5" className="rounded-xl">Step 5 Page</TabsTrigger>
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
              <Input value={customer.slug} readOnly className="rounded-xl" />
              <div className="text-xs text-muted-foreground">
                Used in URLs like /pay/{customer.slug}
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
              <Input type="file" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary accent</label>
              <Input placeholder="#4F46E5" className="rounded-xl" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Footer text</label>
              <Input placeholder="Powered by …" className="rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

 <TabsContent value="params" className="mt-4 space-y-4">
  <ParameterBuilder rows={parameterRows} onChange={setParameterRows} />

  <Accordion type="single" collapsible defaultValue="preview">
    <AccordionItem value="preview" className="rounded-2xl border bg-background">
      <AccordionTrigger className="px-5 py-4 hover:no-underline">
        <div className="flex w-full items-center justify-between">
          <div className="text-sm font-semibold">Supplier Form Preview</div>
          <div className="text-xs text-muted-foreground">
            Click to {/** purely visual text */""}expand/collapse
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-5 pb-5">
        <LivePreview rows={parameterRows} />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</TabsContent>

      <TabsContent value="step1" className="mt-4 space-y-4">
        <ApiAccordion
  title="Input APIs"
  endpoints={step1Apis}
  onChange={setStep1Apis}
  onSelectForMapper={setSelectedStep1ApiId}
  parameterNames={enabledParamNames}
  parameterValues={paramTestValues}
  onChangeParameterValues={setParamTestValues}
/>

<ResponseMapper
  title="Response Mapping (Input → Output)"
  sampleJson={selectedStep1Api?.sampleResponseJson}
  rows={step1Mappings}
  onChange={setStep1Mappings}
  compactMode={compactMode}
  onCompactModeChange={setCompactMode}
  prefixes={step1Prefixes}
/>
{publishInfo && (
  <Card className="rounded-2xl">
    <CardHeader>
      <div className="font-semibold">Published URLs</div>
      <div className="text-sm text-muted-foreground">
        Published at {new Date(publishInfo.publishedAt).toLocaleString()}
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-medium">Portal POST URL</div>
        <div className="text-xs text-muted-foreground">
          Customer portal should POST form-data here.
        </div>
        <div className="rounded-xl border p-3 font-mono text-xs break-all">
          {publishInfo.portalUrl}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">Supplier GET URL</div>
        <div className="text-xs text-muted-foreground">
          Supplier entry page (redirect target).
        </div>
        <div className="rounded-xl border p-3 font-mono text-xs break-all">
          {publishInfo.supplierUrl}
        </div>
      </div>
    </CardContent>
  </Card>
)}
        <GeneratePanel
          title="Generate Step 1 Page"
          url={`https://app.domain/pay/${customer.slug}`}
        />
      </TabsContent>

      <TabsContent value="sim" className="mt-4 space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="font-semibold">Simulator Settings</div>
            <div className="text-sm text-muted-foreground">
              Configure callback behavior for demo/testing.
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <Input defaultValue="Manual accept/reject" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Callback URL</label>
              <Input readOnly value="https://app.domain/callback" className="rounded-xl" />
            </div>
          </CardContent>
        </Card>

        <GeneratePanel title="Preview Simulator" url="https://app.domain/gateway/{sessionId}" />
      </TabsContent>

      <TabsContent value="step5" className="mt-4 space-y-4">
        <ApiAccordion
  title="Step 5 APIs"
  endpoints={step5Apis}
  onChange={setStep5Apis}
  onSelectForMapper={setSelectedStep5ApiId}
  parameterNames={enabledParamNames}
  parameterValues={paramTestValues}
  onChangeParameterValues={setParamTestValues}
/>
        <ResponseMapper
  title="Step 5 Response Mapping"
  sampleJson={selectedStep5Api?.sampleResponseJson}
  rows={step5Mappings}
  onChange={setStep5Mappings}
  compactMode={compactMode}
  onCompactModeChange={setCompactMode}
  prefixes={step5Prefixes}
/>
        <GeneratePanel
          title="Generate Step 5 Page"
          url={`https://app.domain/status/${customer.slug}`}
        />
      </TabsContent>

      <TabsContent value="publish" className="mt-4 space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="font-semibold">Review & Publish</div>
            <div className="text-sm text-muted-foreground">
              Validate and publish this configuration.
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">✅ Customer details</div>
            <div className="text-sm">✅ Parameters</div>
            <div className="text-sm">⚠️ Step 1 API not tested</div>
            <div className="text-sm">✅ Step 5 URL generated</div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
</div>

    <StickyActions
  customer={{ slug: customer.slug, status: customer.status }}
  onSaveDraft={saveDraftWithFeedback}
  savingDraft={savingDraft}
  onClearDraft={clearDraft}
  onPublish={publishConfig}
  publishing={publishing}
/>
  </div>
);
}
