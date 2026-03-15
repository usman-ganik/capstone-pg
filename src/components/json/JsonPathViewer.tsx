"use client";

import * as React from "react";
import { JSONTree } from "react-json-tree";

type Props = {
  jsonText?: string;
  onJsonPathCopied?: (p: string) => void;
};

function toJsonPath(path: Array<string | number>) {
  if (!path || path.length === 0) return "$";

  // react-json-tree gives path from leaf->root, so we reverse later
  const ns = [...path].reverse();

  const parts = ns.map((k) => {
    if (typeof k === "number") return `[${k}]`;
    if (/^[A-Za-z_]\w*$/.test(k)) return `.${k}`;
    const escaped = String(k).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `["${escaped}"]`;
  });

  return "$" + parts.join("");
}

export default function JsonPathViewer({ jsonText, onJsonPathCopied }: Props) {
  const [copied, setCopied] = React.useState<string>("");

  let parsed: any = null;
  let parseError: string | null = null;

  if (jsonText?.trim()) {
    try {
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      parseError = e?.message ?? "Invalid JSON";
    }
  }

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // ignore; still show feedback
    }
    setCopied(path);
    onJsonPathCopied?.(path);
  }

  if (!jsonText?.trim()) {
    return (
      <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
        No sample JSON yet. Test an API to load a response.
      </div>
    );
  }

  if (parseError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Invalid JSON: {parseError}
      </div>
    );
  }

  const theme = {
    scheme: "default",
    base00: "transparent",
    base01: "transparent",
    base02: "transparent",
    base03: "#6b7280",
    base04: "#6b7280",
    base05: "#111827",
    base06: "#111827",
    base07: "#111827",
    base08: "#ef4444",
    base09: "#f59e0b",
    base0A: "#eab308",
    base0B: "#10b981",
    base0C: "#06b6d4",
    base0D: "#3b82f6",
    base0E: "#8b5cf6",
    base0F: "#111827",
  };

  return (
    <div className="space-y-2">
      {copied && (
        <div className="rounded-lg border bg-muted px-3 py-2 text-xs">
          Copied JSONPath: <code className="font-mono">{copied}</code>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border p-3 text-xs">
        <div className="min-w-max whitespace-nowrap">
          <JSONTree
            data={parsed}
            theme={theme as any}
            invertTheme={false}
            shouldExpandNodeInitially={(keyPath, data, level) => level < 2}
            labelRenderer={(keyPath) => {
              const p = toJsonPath(keyPath as any);
              return (
                <button
                  type="button"
                  className="whitespace-nowrap text-left hover:underline"
                  onClick={() => copy(p)}
                  title="Click to copy JSONPath"
                >
                  {String(keyPath[0])}
                </button>
              );
            }}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Tip: click a key name to copy its JSONPath.
      </div>
    </div>
  );
}
