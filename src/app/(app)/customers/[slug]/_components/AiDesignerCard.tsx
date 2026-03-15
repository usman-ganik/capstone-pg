"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Provider = "openai" | "openrouter";

export type UiPatch = {
  theme?: Partial<{
    primary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    radius: number;
  }>;
  addFields?: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "email" | "date";
    required?: boolean;
    placeholder?: string;
  }>;
  removeFieldKeys?: string[];
  notes?: string;
};

type DebugInfo = {
  provider?: string;
  model?: string;
  llmOutput?: string;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function AiDesignerCard({
  customerSlug,
  currentUi,
  onApplyPatch,
}: {
  customerSlug: string;
  currentUi: any; // current gatewaySettings.ui object
  onApplyPatch: (patch: UiPatch) => void;
}) {
  const [provider, setProvider] = React.useState<Provider>(() => {
    return (localStorage.getItem("ai:provider") as Provider) || "openai";
  });
  const [apiKey, setApiKey] = React.useState<string>(() => {
    return localStorage.getItem("ai:apikey") || "";
  });

  const [prompt, setPrompt] = React.useState<string>(
    "Add a new input field in the supplier page: VAT Number (optional)."
  );

  const [imgDataUrl, setImgDataUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lastPatch, setLastPatch] = React.useState<UiPatch | null>(null);
  const [lastDebug, setLastDebug] = React.useState<DebugInfo | null>(null);
  const [lastError, setLastError] = React.useState<string>("");

  React.useEffect(() => {
    localStorage.setItem("ai:provider", provider);
  }, [provider]);

  React.useEffect(() => {
    localStorage.setItem("ai:apikey", apiKey);
  }, [apiKey]);

  async function submit() {
    setBusy(true);
    setLastError("");
    try {
      const res = await fetch("/api/ai/edit-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          customerSlug,
          prompt,
          currentUi,
          portalScreenshotDataUrl: imgDataUrl, // optional
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        const details =
          typeof json?.details === "string"
            ? json.details
            : json?.details
              ? JSON.stringify(json.details, null, 2)
              : json?.raw ?? json?.message ?? "";
        throw new Error([json?.error ?? "AI request failed", details].filter(Boolean).join("\n\n"));
      }

      onApplyPatch(json.patch);
      setLastPatch(json.patch);
      setLastDebug(json.debug ?? null);
      console.log("AI patch:", json.patch);
      console.log("AI debug:", json.debug);
      toast.success("Applied AI changes", { description: json.patch?.notes || "" });
    } catch (e: any) {
      setLastPatch(null);
      setLastDebug(null);
      setLastError(e?.message ?? "Unknown error");
      toast.error("AI update failed", { description: e?.message ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="font-semibold">AI Designer</div>
        <div className="text-sm text-muted-foreground">
          Describe UI changes in plain English. Optionally upload a portal screenshot to match theme.
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Provider</div>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">API key (stored in browser only)</div>
            <Input
              type="password"
              className="rounded-xl"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Prompt</div>
          <Textarea
            className="rounded-xl"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder='Example: "Add a new input field called VAT Number (optional), and set primary color to teal based on screenshot."'
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Portal screenshot (optional)</div>
          <Input
            type="file"
            accept="image/*"
            className="rounded-xl"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const dataUrl = await fileToDataUrl(f);
              setImgDataUrl(dataUrl);
            }}
          />
          {imgDataUrl && (
            <div className="text-xs text-muted-foreground">
              Screenshot attached ✅
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 rounded-xl"
                onClick={() => setImgDataUrl(null)}
              >
                remove
              </Button>
            </div>
          )}
        </div>

        <Button className="rounded-xl" disabled={busy || !apiKey.trim()} onClick={submit}>
          {busy ? "Applying…" : "Apply changes"}
        </Button>

        {(lastPatch || lastError) && (
          <div className="rounded-2xl border p-4 space-y-3">
            <div className="text-sm font-medium">Last AI result</div>

            {lastError ? (
              <pre className="overflow-auto rounded-xl bg-red-50 p-3 text-xs text-red-700 whitespace-pre-wrap">
                {lastError}
              </pre>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  {lastPatch?.notes || "Patch applied."}
                </div>

                {lastPatch?.theme && Object.keys(lastPatch.theme).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Theme updates</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(lastPatch.theme).map(([key, value]) => (
                        <div key={key} className="rounded-xl border p-2 text-xs">
                          <div className="text-muted-foreground">{key}</div>
                          <div className="mt-1 font-mono">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lastPatch?.addFields && lastPatch.addFields.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Added fields</div>
                    <div className="space-y-2">
                      {lastPatch.addFields.map((field) => (
                        <div key={field.key} className="rounded-xl border p-2 text-xs">
                          <div className="font-medium">{field.label}</div>
                          <div className="text-muted-foreground">
                            key: {field.key} | type: {field.type} | required: {field.required ? "yes" : "no"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lastPatch?.removeFieldKeys && lastPatch.removeFieldKeys.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Removed field keys</div>
                    <div className="rounded-xl border p-2 text-xs font-mono">
                      {lastPatch.removeFieldKeys.join(", ")}
                    </div>
                  </div>
                )}

                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-xs font-medium">Raw patch JSON</summary>
                  <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs whitespace-pre-wrap">
                    {JSON.stringify(lastPatch, null, 2)}
                  </pre>
                </details>

                {lastDebug?.llmOutput && (
                  <details className="rounded-xl border p-3">
                    <summary className="cursor-pointer text-xs font-medium">
                      LLM output {lastDebug.model ? `(${lastDebug.model})` : ""}
                    </summary>
                    <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs whitespace-pre-wrap">
                      {lastDebug.llmOutput}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
