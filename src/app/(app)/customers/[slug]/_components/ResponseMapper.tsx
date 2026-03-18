"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import JsonPathViewer from "@/components/json/JsonPathViewer";

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

export type OutputType = "String" | "Number" | "Boolean" | "Date" | "URL";
export type OutputFormat = "-" | "currency" | "date" | "datetime";

export type MappingRow = {
  id: string;
  key: string;
  label: string;
  display?: boolean;
  jsonPath: string;
  type: OutputType;
  format: OutputFormat;
  required: boolean;
};

const TYPE_OPTIONS: OutputType[] = ["String", "Number", "Boolean", "Date", "URL"];
const FORMAT_OPTIONS: OutputFormat[] = ["-", "currency", "date", "datetime"];

function uid() {
  return crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

function normalizeKey(label: string) {
  return (label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function applyPrefixToJsonPath(currentPath: string, prefixPath: string) {
  const nextPrefix = prefixPath.trim();
  const current = currentPath.trim();

  if (!current) return nextPrefix;
  if (current === "$") return nextPrefix;

  let suffix = current;

  if (current.startsWith("$.params")) {
    suffix = current.slice("$.params".length);
  } else {
    const resultsMatch = current.match(/^\$\.results\[\d+\]/);
    if (resultsMatch) {
      suffix = current.slice(resultsMatch[0].length);
    } else if (current.startsWith("$.root")) {
      suffix = current.slice("$.root".length);
    } else if (current.startsWith('$["root"]')) {
      suffix = current.slice('$["root"]'.length);
    } else if (current.startsWith("$['root']")) {
      suffix = current.slice("$['root']".length);
    } else if (current.startsWith("$.")) {
      suffix = current.slice(1);
    } else if (current.startsWith("$[")) {
      suffix = current.slice(1);
    } else if (current.startsWith("$")) {
      suffix = current.slice(1);
    }
  }

  if (!suffix) return nextPrefix;
  if (suffix.startsWith(".") || suffix.startsWith("[")) return `${nextPrefix}${suffix}`;
  return `${nextPrefix}.${suffix}`;
}

function SortableRow({
  id,
  compact,
  selected,
  onSelect,
  children,
}: {
  id: string;
  compact: boolean;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "w-full rounded-2xl border transition min-w-0",
        compact ? "p-3" : "p-4",
        selected ? "border-primary bg-muted/40" : "hover:bg-muted/20",
        isDragging ? "opacity-80 shadow-lg" : "",
      ].join(" ")}
      onClick={onSelect}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            className="cursor-grab rounded-lg border px-2 py-1 hover:bg-muted"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            ⠿
          </button>
          <span>Drag to reorder</span>
        </div>
      </div>

      {children}
    </div>
  );
}

export default function ResponseMapper({
  title,
  isStatusFields,
  sampleJson,
  rows = [],
  onChange,
  compactMode,
  onCompactModeChange,
  prefixes = [],
  quickPaths = [],
}: {
  title: string;
  isStatusFields?: boolean;
  sampleJson?: string;
  rows?: MappingRow[];
  onChange: (next: MappingRow[]) => void;
  compactMode: boolean;
  onCompactModeChange: (v: boolean) => void;
  prefixes?: Array<{ label: string; path: string }>;
  quickPaths?: Array<{ label: string; path: string }>;
}) {
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(
    rows[0]?.id ?? null
  );
  const [lastCopied, setLastCopied] = React.useState<string>("");
  const sampleObject = React.useMemo(() => {
    if (!sampleJson?.trim()) return null;
    try {
      return JSON.parse(sampleJson);
    } catch {
      return null;
    }
  }, [sampleJson]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  React.useEffect(() => {
    if (!rows.length) {
      setSelectedRowId(null);
      return;
    }
    if (!selectedRowId || !rows.some((r) => r.id === selectedRowId)) {
      setSelectedRowId(rows[0].id);
    }
  }, [rows, selectedRowId]);

  function addRow() {
    const newRow: MappingRow = {
      id: uid(),
      key: "",
      label: "",
      display: true,
      jsonPath: "",
      type: "String",
      format: "-",
      required: false,
    };
    onChange([...rows, newRow]);
    setSelectedRowId(newRow.id);
  }

  function deleteRow(id: string) {
    const next = rows.filter((r) => r.id !== id);
    onChange(next);
    if (selectedRowId === id) setSelectedRowId(next[0]?.id ?? null);
  }

  function updateRow(id: string, patch: Partial<MappingRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function applyPathToSelectedRow(path: string) {
    setLastCopied(path);
    const targetId = selectedRowId ?? rows[rows.length - 1]?.id;
    if (!targetId) return;
    onChange(rows.map((r) => (r.id === targetId ? { ...r, jsonPath: path } : r)));
  }

  function applyPrefixToSelectedRow(prefix: string) {
    const targetId = selectedRowId ?? rows[rows.length - 1]?.id;
    if (!targetId) return;
    onChange(
      rows.map((r) =>
        r.id === targetId
          ? { ...r, jsonPath: applyPrefixToJsonPath(r.jsonPath, prefix) }
          : r
      )
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(arrayMove(rows, oldIndex, newIndex));
  }

  const selectedIndex = rows.findIndex((r) => r.id === selectedRowId);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">
          {isStatusFields
            ? "Choose fields shown on the status page."
            : "Map API response nodes to UI output fields (JSONPath)."}
        </div>
        {!isStatusFields && (
          <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Step 1: click a field in Sample JSON to fill the selected row path.
            Step 2: use the root buttons if you need to switch that path to Params or a different API result.
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="w-full min-w-0 self-start rounded-2xl border p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">
              {isStatusFields ? "Status Fields" : "Output Fields"}
            </div>

            <div className="flex items-center gap-3">
              {prefixes.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {prefixes.map((p) => (
      <Button
        key={p.path}
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={() => applyPrefixToSelectedRow(p.path)}
      >
        {p.label === "Params" ? "Set root: Params" : `Set root: ${p.label}`}
      </Button>
    ))}
  </div>
)}

              <Button variant="outline" className="rounded-xl" onClick={addRow}>
                + Add field
              </Button>
            </div>
          </div>

          {quickPaths.length > 0 && (
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Step 1 stable keys
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Use these to map values already captured in Step 1, such as
                  <span className="font-mono"> $.step1.rfx_number</span>.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickPaths.map((item) => (
                  <Button
                    key={item.path}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => applyPathToSelectedRow(item.path)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              No mapping fields yet. Click <b>+ Add field</b>.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Display</th>
                    <th className="px-3 py-2">JSONPath</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const selected = r.id === selectedRowId;

                    return (
                      <tr
                        key={r.id}
                        className={selected ? "bg-muted/30" : ""}
                        onClick={() => setSelectedRowId(r.id)}
                      >
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            placeholder="Display label"
                            className="rounded-xl w-full"
                            value={r.label}
                            onChange={(e) => updateRow(r.id, { label: e.target.value })}
                            onBlur={(e) => {
                              if (r.key?.trim()) return;
                              updateRow(r.id, { key: normalizeKey(e.target.value) });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Stable key: <span className="font-mono">{(r.key || normalizeKey(r.label) || "—")}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex h-10 items-center">
                            <Checkbox
                              checked={r.display !== false}
                              onCheckedChange={(value) =>
                                updateRow(r.id, { display: Boolean(value) })
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            placeholder="JSONPath"
                            className="rounded-xl w-full font-mono text-xs"
                            value={r.jsonPath}
                            onChange={(e) => updateRow(r.id, { jsonPath: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            value={r.type}
                            onChange={(e) => updateRow(r.id, { type: e.target.value as any })}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              const shouldDelete = window.confirm(
                                `Delete mapping row ${idx + 1}${r.label ? ` (${r.label})` : ""}?`
                              );
                              if (!shouldDelete) return;
                              deleteRow(r.id);
                            }}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Tip: click a row to select it, then click a JSON key to fill its JSONPath.
          </div>
        </div>

        {!isStatusFields && (
          <div className="w-full min-w-0 rounded-2xl border p-4">
            <div className="text-sm font-medium">Sample JSON</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Click a key to replace the JSONPath of the <b>selected mapping row</b>. Then use the root buttons above if you need this path to point to Params or another API result.
            </div>

            {rows.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Selected row:{" "}
                <span className="font-medium">
                  #{selectedIndex >= 0 ? selectedIndex + 1 : "-"}
                </span>
              </div>
            )}

            <div className="mt-3">
              <JsonPathViewer jsonText={sampleJson} onJsonPathCopied={applyPathToSelectedRow} />
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
