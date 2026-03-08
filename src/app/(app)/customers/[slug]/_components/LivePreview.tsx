"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ParameterRow } from "./ParameterBuilder";

export default function LivePreview({ rows }: { rows: ParameterRow[] }) {
  const enabled = rows.filter((r) => r.enabled);

  const queryParams = enabled.filter((r) => r.source === "Query");
  const formParams = enabled.filter((r) => r.source === "Form");

  // Local form state just for preview typing (not saving yet)
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    // Keep values for still-enabled params, drop the rest
    setFormValues((prev) => {
      const next: Record<string, string> = {};
      for (const r of formParams) {
        next[r.name] = prev[r.name] ?? r.defaultValue ?? "";
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.id}:${r.enabled}:${r.name}:${r.source}:${r.defaultValue}`).join("|")]);

  function labelFor(r: ParameterRow) {
    return r.label?.trim() || r.name || "(unnamed)";
  }

 return (
  <div className="space-y-4">
        <div className="font-semibold">Supplier Form Preview</div>
        <div className="text-sm text-muted-foreground">
          Updates live from your parameter table (enabled rows only).
        </div>

      <div className="space-y-4">
        {queryParams.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Query parameters (from URL)
            </div>

            {queryParams.map((r) => (
              <div key={r.id} className="space-y-1">
                <div className="text-sm font-medium">
                  {labelFor(r)}{" "}
                  <span className="text-xs text-muted-foreground">
                    (query) {r.required ? "• required" : ""}
                  </span>
                </div>
                <Input
                  readOnly
                  value={`${r.name || "param"} from URL`}
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>
        )}

        {formParams.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Form parameters (supplier input)
            </div>

            {formParams.map((r) => (
              <div key={r.id} className="space-y-1">
                <div className="text-sm font-medium">
                  {labelFor(r)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {r.required ? "• required" : "• optional"}
                  </span>
                </div>

                <Input
                  placeholder={r.type === "Email" ? "name@company.com" : "Enter value"}
                  value={formValues[r.name] ?? ""}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [r.name]: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>
        )}

        {enabled.length === 0 && (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No parameters enabled. Turn on at least one row to preview.
          </div>
        )}
      </div>
      </div>
  );
}