"use client";

import * as React from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";

type ParamSource = "Query" | "Form";
type ParamType = "String" | "Number" | "Email" | "Boolean" | "Date";

export type ParameterRow = {
  id: string;
  enabled: boolean;
  name: string;
  source: ParamSource;
  type: ParamType;
  required: boolean;
  defaultValue: string;
  label: string;
};

const TYPE_OPTIONS: ParamType[] = ["String", "Number", "Email", "Boolean", "Date"];
const SOURCE_OPTIONS: ParamSource[] = ["Query", "Form"];

function uid() {
  return crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export const seed: ParameterRow[] = [
  {
    id: uid(),
    enabled: true,
    name: "rfxRef",
    source: "Query",
    type: "String",
    required: true,
    defaultValue: "",
    label: "RFX Reference",
  },
  {
    id: uid(),
    enabled: true,
    name: "supplierName",
    source: "Form",
    type: "String",
    required: true,
    defaultValue: "",
    label: "Supplier Name",
  },
  {
    id: uid(),
    enabled: true,
    name: "email",
    source: "Form",
    type: "Email",
    required: false,
    defaultValue: "",
    label: "Email (optional)",
  },
];

export default function ParameterBuilder({
  rows,
  onChange,
}: {
  rows: ParameterRow[];
  onChange: (next: ParameterRow[]) => void;
}) {


  const errorsById = React.useMemo(() => {
    const errs: Record<string, { name?: string }> = {};
    const counts = new Map<string, number>();

    for (const r of rows) {
      const n = r.name.trim();
      if (n) counts.set(n, (counts.get(n) || 0) + 1);
    }

    for (const r of rows) {
      const n = r.name.trim();
      const e: { name?: string } = {};
      if (!n) e.name = "Name is required.";
      else if ((counts.get(n) || 0) > 1) e.name = "Name must be unique.";
      if (Object.keys(e).length) errs[r.id] = e;
    }
    return errs;
  }, [rows]);

  const hasErrors = Object.keys(errorsById).length > 0;

 function updateRow(id: string, patch: Partial<ParameterRow>) {
  onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

 function addRow() {
  onChange([
    ...rows,
    {
      id: uid(),
      enabled: true,
      name: "",
      source: "Form",
      type: "String",
      required: false,
      defaultValue: "",
      label: "",
    },
  ]);
}

 function deleteRow(id: string) {
  onChange(rows.filter((r) => r.id !== id));
}

  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">Parameter Builder</h3>
            <Badge variant="secondary" className="rounded-full">
              {enabledCount} enabled
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure query/form parameters for the supplier page. Edit inline.
          </p>
        </div>

        <Button onClick={addRow} variant="outline" className="rounded-xl">
          + Add parameter
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasErrors && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTitle>Fix validation errors</AlertTitle>
            <AlertDescription>
              Parameter names must be present and unique (highlighted below).
            </AlertDescription>
          </Alert>
        )}

       <div className="w-full overflow-x-auto rounded-2xl border">
  <Table className="w-max min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 whitespace-nowrap">On</TableHead>
                <TableHead className="min-w-[160px]">Name</TableHead>
                <TableHead className="min-w-[140px]">Source</TableHead>
                <TableHead className="min-w-[160px]">Type</TableHead>
                <TableHead className="w-20">Req</TableHead>
                <TableHead className="min-w-[180px]">Default</TableHead>
                <TableHead className="min-w-[180px]">Label (UI)</TableHead>
                <TableHead className="w-16 whitespace-nowrap" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((r) => {
                const err = errorsById[r.id];
                const nameHasError = Boolean(err?.name);

                return (
                  <TableRow key={r.id}>
                    <TableCell className="align-top">
                      <Checkbox
                        checked={r.enabled}
                        onCheckedChange={(v) =>
                          updateRow(r.id, { enabled: Boolean(v) })
                        }
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <Input
                        value={r.name}
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        placeholder="e.g. rfxRef"
                        className={[
                          "rounded-xl",
                          nameHasError ? "border-red-500 focus-visible:ring-red-500" : "",
                        ].join(" ")}
                      />
                      {nameHasError && (
                        <div className="mt-1 text-xs text-red-600">{err?.name}</div>
                      )}
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Stable key (no spaces). Example: <code>supplierName</code>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <Select
                        value={r.source}
                        onValueChange={(v) =>
                          updateRow(r.id, { source: v as ParamSource })
                        }
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Query = from URL, Form = user input
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <Select
                        value={r.type}
                        onValueChange={(v) => updateRow(r.id, { type: v as ParamType })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="align-top">
                      <Checkbox
                        checked={r.required}
                        onCheckedChange={(v) =>
                          updateRow(r.id, { required: Boolean(v) })
                        }
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <Input
                        value={r.defaultValue}
                        onChange={(e) =>
                          updateRow(r.id, { defaultValue: e.target.value })
                        }
                        placeholder={r.type === "Boolean" ? "true/false" : "optional"}
                        className="rounded-xl"
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <Input
                        value={r.label}
                        onChange={(e) => updateRow(r.id, { label: e.target.value })}
                        placeholder="What users see"
                        className="rounded-xl"
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => deleteRow(r.id)}
                        aria-label="Delete row"
                        title="Delete"
                      >
                        ✕
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {enabledCount} enabled • {rows.length} total
          </div>
          <div className="text-xs">
            Next we’ll wire this state into <b>Live Preview</b> so it updates automatically.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}