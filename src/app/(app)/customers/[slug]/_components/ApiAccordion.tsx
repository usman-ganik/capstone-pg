"use client";

import * as React from "react";
import type { ApiEndpointConfig, HttpMethod } from "@/lib/types";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { toast } from "sonner";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function uid() {
  return crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

function statusBadgeVariant(s?: ApiEndpointConfig["lastTestStatus"]) {
  if (s === "OK") return "default";
  if (s === "Failed") return "destructive";
  return "secondary";
}

function defaultEndpoint(): ApiEndpointConfig {
  return {
    id: uid(),
    name: "New API",
    method: "GET",
    url: "https://api.example.com/endpoint?x={{rfxId}}",
    authType: "None",
    headersJson: '{\n  "Content-Type": "application/json"\n}',
    lastTestStatus: "Not tested",
    runInStep1: true,
  };
}

function SortableWrapper({
  id,
  children,
}: {
  id: string;
  children: (handleProps: any) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleProps = {
    ...attributes,
    ...listeners,
    onClick: (e: any) => e.stopPropagation(),
  };

  

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-80" : ""}>
      {children(handleProps)}
    </div>
  );
}

export default function ApiAccordion({
  title,
  endpoints = [],
  onChange,
  onSelectForMapper,
  parameterNames = [],
  parameterValues = {},
  onChangeParameterValues,
}: {
  title: string;
  endpoints?: ApiEndpointConfig[];
  onChange: (next: ApiEndpointConfig[]) => void;
  onSelectForMapper: (id: string) => void;

  parameterNames?: string[];
  parameterValues?: Record<string, string>;
  onChangeParameterValues?: (v: Record<string, string>) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function updateEndpoint(id: string, patch: Partial<ApiEndpointConfig>) {
    onChange(endpoints.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function duplicateEndpoint(source: ApiEndpointConfig) {
    const copy: ApiEndpointConfig = {
      ...source,
      id: uid(),
      name: `${source.name || "API"} (copy)`,
      // reset runtime fields so it’s clearly a new one
      lastTestStatus: "Not tested",
      lastTestMessage: undefined,
      lastTestMs: undefined,
      sampleResponseJson: undefined,
      sampleCapturedAt: undefined,
    };

    onChange([...endpoints, copy]);
  }

  function addEndpoint() {
    onChange([...endpoints, defaultEndpoint()]);
  }

  function deleteEndpoint(id: string) {
    onChange(endpoints.filter((x) => x.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = endpoints.findIndex((x) => x.id === active.id);
    const newIndex = endpoints.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(arrayMove(endpoints, oldIndex, newIndex));
  }

  const [testingId, setTestingId] = React.useState<string | null>(null);
  function applyTemplate(input: string, values: Record<string, string>) {
    return (input ?? "").replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? "");
}
  async function testEndpoint(endpoint: ApiEndpointConfig) {
    setTestingId(endpoint.id);
    toast.message(`Testing: ${endpoint.name || "API"}`);
    const start = performance.now();
    try {
      // validate JSON
      if (endpoint.headersJson?.trim()) JSON.parse(endpoint.headersJson);
      if (endpoint.method === "POST" && endpoint.requestBodyJson?.trim())
        JSON.parse(endpoint.requestBodyJson);
      
      const resolved: ApiEndpointConfig = {
  ...endpoint,
  url: applyTemplate(endpoint.url, parameterValues),
  headersJson: applyTemplate(endpoint.headersJson ?? "", parameterValues),
  requestBodyJson: applyTemplate(endpoint.requestBodyJson ?? "", parameterValues),
};

      const resp = await fetch("/api/proxy/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: resolved }),
      });

      const ms = Math.round(performance.now() - start);
      
      // Read as text first so we can store something even if not JSON
      const text = await resp.text();
      let payload: any;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }

      if (!resp.ok) {
        // Save error payload into sampleResponseJson for debugging/mapping
        updateEndpoint(endpoint.id, {
          lastTestStatus: "Failed",
          sampleCapturedAt: new Date().toISOString(),
          lastTestMessage: payload?.error
            ? String(payload.error)
            : `HTTP ${resp.status} (see sample)`,
          lastTestMs: ms,
          sampleResponseJson: JSON.stringify(
            {
              __error: true,
              httpStatus: resp.status,
              endpoint: {
                name: endpoint.name,
                url: endpoint.url,
                method: endpoint.method,
                authType: endpoint.authType,
              },
              payload,
            },
            null,
            2
          ),
        });
        toast.error(`Test failed: ${endpoint.name || "API"}`, {
  description: "See Sample Response / Error sample for details",
});
setTestingId(null);
        return;
      }

      updateEndpoint(endpoint.id, {
        lastTestStatus: "OK",
        sampleCapturedAt: new Date().toISOString(),
        lastTestMessage: "Success",
        lastTestMs: ms,
        sampleResponseJson: JSON.stringify(payload, null, 2),
      });
    } catch (e: any) {
      const ms = Math.round(performance.now() - start);

      // Save thrown error too (e.g., invalid JSON in headers)
      updateEndpoint(endpoint.id, {
        lastTestStatus: "Failed",
        sampleCapturedAt: new Date().toISOString(),
        lastTestMessage: e?.message ?? "Test failed",
        lastTestMs: ms,
        sampleResponseJson: JSON.stringify(
          {
            __error: true,
            message: e?.message ?? "Test failed",
          },
          null,
          2
        ),
      });
    } finally {
  setTestingId(null);
}
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-base font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">
            Add endpoints, reorder them, toggle “Run in Step 1”, and test.
          </div>
        </div>
{onChangeParameterValues && parameterNames.length > 0 && (
  <div className="sm:col-span-2 space-y-2 rounded-2xl border p-4">
    <div className="text-sm font-medium">Test values (for templates)</div>
    <div className="grid gap-3 sm:grid-cols-2">
      {parameterNames.map((name) => (
        <div key={name} className="space-y-1">
          <div className="text-xs text-muted-foreground">{name}</div>
          <Input
            value={parameterValues[name] ?? ""}
            onChange={(e) =>
              onChangeParameterValues({ ...parameterValues, [name]: e.target.value })
            }
            className="rounded-xl"
          />
        </div>
      ))}
    </div>
  </div>
)}
        <Button onClick={addEndpoint} variant="outline" className="rounded-xl">
          + Add API
        </Button>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={endpoints.map((x) => x.id)}
            strategy={verticalListSortingStrategy}
          >
            <Accordion type="multiple" className="space-y-3">
              {endpoints.map((endpoint) => (
                <SortableWrapper key={endpoint.id} id={endpoint.id}>
                  {(handleProps) => (
                    <AccordionItem value={endpoint.id} className="rounded-2xl border px-3">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full items-center justify-between pr-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="cursor-grab rounded-lg border px-2 py-1 text-xs hover:bg-muted"
                              title="Drag to reorder"
                              {...handleProps}
                            >
                              ⠿
                            </button>

                            <div className="text-sm font-medium">
                              {endpoint.name || "Unnamed API"}
                            </div>

                            <label
                              className="ml-2 inline-flex items-center gap-2 text-xs text-muted-foreground"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={endpoint.runInStep1 ?? true}
                                onChange={(ev) =>
                                  updateEndpoint(endpoint.id, { runInStep1: ev.target.checked })
                                }
                              />
                              Run in Step 1
                            </label>

                            <Badge
                              variant={statusBadgeVariant(endpoint.lastTestStatus)}
                              className="rounded-full"
                            >
                              {endpoint.lastTestStatus ?? "Not tested"}
                              {endpoint.lastTestMs ? ` • ${endpoint.lastTestMs}ms` : ""}
                            </Badge>
                            {endpoint.sampleResponseJson && (
                              <Badge
                                variant={endpoint.lastTestStatus === "Failed" ? "destructive" : "secondary"}
                                className="rounded-full"
                              >
                                {endpoint.lastTestStatus === "Failed" ? "Error sample" : "Sample"}
                                {endpoint.sampleCapturedAt
                                  ? ` • ${new Date(endpoint.sampleCapturedAt).toLocaleString()}`
                                  : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="pb-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">API name</label>
                            <Input
                              value={endpoint.name}
                              onChange={(ev) =>
                                updateEndpoint(endpoint.id, { name: ev.target.value })
                              }
                              className="rounded-xl"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Method</label>
                            <Select
                              value={endpoint.method}
                              onValueChange={(v) =>
                                updateEndpoint(endpoint.id, { method: v as HttpMethod })
                              }
                            >
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium">URL</label>
                            <Input
                              value={endpoint.url}
                              onChange={(ev) =>
                                updateEndpoint(endpoint.id, { url: ev.target.value })
                              }
                              className="rounded-xl"
                            />
                            <div className="text-xs text-muted-foreground">
                              Templates: <code>{"{{rfxId}}"}</code>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Auth</label>
                            <Select
                              value={endpoint.authType}
                              onValueChange={(v) =>
                                updateEndpoint(endpoint.id, { authType: v as any })
                              }
                            >
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="None">None</SelectItem>
                                <SelectItem value="API Key">API Key</SelectItem>
                                <SelectItem value="OAuth2">OAuth2</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {endpoint.authType === "API Key" && (
                            <>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">API Key Header</label>
                                <Input
                                  value={endpoint.apiKeyHeaderName ?? ""}
                                  onChange={(ev) =>
                                    updateEndpoint(endpoint.id, {
                                      apiKeyHeaderName: ev.target.value,
                                    })
                                  }
                                  className="rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">API Key Value</label>
                                <Input
                                  type="password"
                                  value={endpoint.apiKeyValue ?? ""}
                                  onChange={(ev) =>
                                    updateEndpoint(endpoint.id, { apiKeyValue: ev.target.value })
                                  }
                                  className="rounded-xl"
                                />
                              </div>
                            </>
                          )}

                          {endpoint.authType === "OAuth2" && (
                            <>
                              <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium">Token URL</label>
                                <Input
                                  value={endpoint.oauthTokenUrl ?? ""}
                                  onChange={(ev) =>
                                    updateEndpoint(endpoint.id, { oauthTokenUrl: ev.target.value })
                                  }
                                  className="rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Client ID</label>
                                <Input
                                  value={endpoint.oauthClientId ?? ""}
                                  onChange={(ev) =>
                                    updateEndpoint(endpoint.id, { oauthClientId: ev.target.value })
                                  }
                                  className="rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Client Secret</label>
                                <Input
                                  type="password"
                                  value={endpoint.oauthClientSecret ?? ""}
                                  onChange={(ev) =>
                                    updateEndpoint(endpoint.id, {
                                      oauthClientSecret: ev.target.value,
                                    })
                                  }
                                  className="rounded-xl"
                                />
                              </div>
                            </>
                          )}

                          <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium">Headers (JSON)</label>
                            <Textarea
                              value={endpoint.headersJson ?? ""}
                              onChange={(ev) =>
                                updateEndpoint(endpoint.id, { headersJson: ev.target.value })
                              }
                              className="rounded-xl font-mono text-xs"
                              rows={6}
                            />
                          </div>

                          {endpoint.method === "POST" && (
                            <div className="space-y-2 sm:col-span-2">
                              <label className="text-sm font-medium">Request payload (JSON)</label>
                              <Textarea
                                value={endpoint.requestBodyJson ?? "{\n  \n}"}
                                onChange={(ev) =>
                                  updateEndpoint(endpoint.id, {
                                    requestBodyJson: ev.target.value,
                                  })
                                }
                                className="rounded-xl font-mono text-xs"
                                rows={8}
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <Button
  variant="outline"
  className="rounded-xl"
  onClick={() => testEndpoint(endpoint)}
  disabled={testingId === endpoint.id}
>
  {testingId === endpoint.id ? "Testing…" : "Test API"}
</Button>
<Button
  variant="outline"
  className="rounded-xl"
  onClick={() =>
    updateEndpoint(endpoint.id, {
      sampleResponseJson: endpoint.sampleResponseJson ?? "{\n  \n}",
      sampleCapturedAt: new Date().toISOString(),
      lastTestStatus: endpoint.lastTestStatus ?? "Not tested",
    })
  }
>
  Paste sample
</Button>
                            <Button
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => onSelectForMapper(endpoint.id)}
                            >
                              Use response in mapper
                            </Button>
                            <Button
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => duplicateEndpoint(endpoint)}
                            >
                              Duplicate
                            </Button>
                            <Button
                              variant="ghost"
                              className="rounded-xl text-red-600 hover:text-red-700"
                              onClick={() => deleteEndpoint(endpoint.id)}
                            >
                              Delete API
                            </Button>
                          </div>

                          {endpoint.sampleResponseJson !== undefined && (
  <div className="sm:col-span-2 space-y-2">
    <div className="text-sm font-medium">Sample Response (captured / pasted)</div>
    <Textarea
      value={endpoint.sampleResponseJson}
      onChange={(ev) =>
        updateEndpoint(endpoint.id, {
          sampleResponseJson: ev.target.value,
          sampleCapturedAt: new Date().toISOString(),
        })
      }
      className="rounded-xl font-mono text-xs"
      rows={10}
    />
  </div>
)}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </SortableWrapper>
              ))}

              {endpoints.length === 0 && (
                <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                  No APIs added yet. Click <b>+ Add API</b>.
                </div>
              )}
            </Accordion>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}