"use client";

import * as React from "react";

export default function LocalDateTime({ value }: { value: string | Date | null | undefined }) {
  const isoValue =
    value instanceof Date ? value.toISOString() : typeof value === "string" ? value : "";

  const formatted = React.useMemo(() => {
    if (!isoValue) return "—";

    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }, [isoValue]);

  return <span>{formatted}</span>;
}
