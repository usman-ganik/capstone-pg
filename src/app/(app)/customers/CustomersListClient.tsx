"use client";

import * as React from "react";
import Link from "next/link";

type Customer = {
  slug: string;
  name: string;
  status: string;
};

function getDraftName(slug: string): string | null {
  try {
    const raw = localStorage.getItem(`pg-config-draft:${slug}`);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return typeof d.customerName === "string" && d.customerName.trim()
      ? d.customerName.trim()
      : null;
  } catch {
    return null;
  }
}

export default function CustomersListClient({
  initialCustomers,
}: {
  initialCustomers: Customer[];
}) {
  const [customers, setCustomers] = React.useState<Customer[]>(initialCustomers);

  React.useEffect(() => {
    // Merge draft customerName into list
    setCustomers((prev) =>
      prev.map((c) => {
        const draftName = getDraftName(c.slug);
        return draftName ? { ...c, name: draftName } : c;
      })
    );
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {customers.map((c) => (
        <Link
          key={c.slug}
          href={`/customers/${c.slug}`}
          className="block rounded-2xl border p-4 hover:bg-muted/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.slug}</div>
            </div>
            <div className="text-xs text-muted-foreground">{c.status}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}