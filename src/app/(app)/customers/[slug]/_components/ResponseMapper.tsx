"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

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
  label: string;
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
}: {
  title: string;
  isStatusFields?: boolean;
  sampleJson?: string;
  rows?: MappingRow[];
  onChange: (next: MappingRow[]) => void;
  compactMode: boolean;
  onCompactModeChange: (v: boolean) => void;
  prefixes?: Array<{ label: string; path: string }>;
}) {
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(
    rows[0]?.id ?? null
  );
  const [lastCopied, setLastCopied] = React.useState<string>("");

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
      label: "",
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
      </CardHeader>

      {/* Make the RIGHT panel wider */}
      <CardContent className="grid gap-4 items-start lg:grid-cols-[1.3fr_2fr]">
        {!isStatusFields && (
          <div className="w-full min-w-0 rounded-2xl border p-4">
            <div className="text-sm font-medium">Sample JSON</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Click a key to copy JSONPath. It will fill the <b>selected mapping row</b>.
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

            {lastCopied && (
              <div className="mt-3 rounded-xl border bg-muted px-3 py-2 text-xs">
                Last copied: <code className="font-mono">{lastCopied}</code>
              </div>
            )}
          </div>
        )}

        {/* Output panel (this was missing in your file) */}
        <div className="w-full min-w-0 self-start rounded-2xl border p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">
              {isStatusFields ? "Status Fields" : "Output Fields"}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={compactMode} onCheckedChange={onCompactModeChange} />
                <span className="text-sm text-muted-foreground">Compact</span>
              </div>

              {prefixes.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {prefixes.map((p) => (
      <Button
        key={p.path}
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={() => applyPathToSelectedRow(p.path)}
      >
        {p.label}
      </Button>
    ))}
  </div>
)}

              <Button variant="outline" className="rounded-xl" onClick={addRow}>
                + Add field
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              No mapping fields yet. Click <b>+ Add field</b>.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {rows.map((r, idx) => {
                    const selected = r.id === selectedRowId;

                    return (
                      <SortableRow
                        key={r.id}
                        id={r.id}
                        compact={compactMode}
                        selected={selected}
                        onSelect={() => setSelectedRowId(r.id)}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            Row {idx + 1} {selected ? "• selected" : ""}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRow(r.id);
                            }}
                          >
                            Delete
                          </Button>
                        </div>

                        <div className={compactMode ? "space-y-1.5" : "space-y-2"}>
                          <div className="grid gap-2 md:grid-cols-[1fr_1.8fr]">
                            <Input
                              placeholder="Display label"
                              className="rounded-xl w-full"
                              value={r.label}
                              onChange={(e) => updateRow(r.id, { label: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Input
                              placeholder="JSONPath"
                              className="rounded-xl w-full font-mono text-xs"
                              value={r.jsonPath}
                              onChange={(e) => updateRow(r.id, { jsonPath: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          <div className="grid gap-2 md:grid-cols-[180px_180px_1fr]">
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
                            
                          </div>
                        </div>
                      </SortableRow>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="text-xs text-muted-foreground">
            Tip: click a row to select it, then click a JSON key to fill its JSONPath.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}