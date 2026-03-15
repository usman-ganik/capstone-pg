"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Customer = {
  slug: string;
  name: string;
  status: string;
};

const LOCAL_CUSTOMERS_KEY = "pg-customers";

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

function getLocalCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry: any) => ({
      slug: String(entry.slug ?? ""),
      name: String(entry.name ?? entry.slug ?? ""),
      status: String(entry.status ?? "Inactive"),
    })).filter((entry: Customer) => entry.slug);
  } catch {
    return [];
  }
}

function matches(text: string, q: string) {
  return text.toLowerCase().includes(q.toLowerCase());
}

export default function CustomersListClient({
  initialCustomers,
}: {
  initialCustomers: Customer[];
}) {
  const sp = useSearchParams();

  const q = (sp.get("q") ?? "").trim();
  const status = (sp.get("status") ?? "all").trim().toLowerCase();
  const sort = (sp.get("sort") ?? "updated").trim().toLowerCase();
  const [localCustomers, setLocalCustomers] = React.useState<Customer[]>([]);

  React.useEffect(() => {
    setLocalCustomers(getLocalCustomers());
  }, []);

  // Merge draft name into initial list (client-only)
  const customersWithDraftNames = React.useMemo(() => {
    const mergedBase = [...initialCustomers];
    for (const localCustomer of localCustomers) {
      if (!mergedBase.some((entry) => entry.slug === localCustomer.slug)) {
        mergedBase.unshift(localCustomer);
      }
    }

    return mergedBase.map((c) => {
      const draftName = getDraftName(c.slug);
      return draftName ? { ...c, name: draftName } : c;
    });
    // initialCustomers is stable from server; draft names are read on client
  }, [initialCustomers, localCustomers]);

  // Apply filters/sort
  const filtered = React.useMemo(() => {
    let list = [...customersWithDraftNames];

    if (q) {
      list = list.filter(
        (c) => matches(c.slug, q) || matches(c.name, q)
      );
    }

    if (status !== "all") {
      list = list.filter((c) => (c.status ?? "").toLowerCase() === status);
    }

    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    // sort === "updated": keep original order (mock doesn't have updatedAt)

    return list;
  }, [customersWithDraftNames, q, status, sort]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((c) => (
        <Link
          key={c.slug}
          href={`/customers/${c.slug}`}
          className="block rounded-2xl border p-4 hover:bg-muted/30"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.slug}</div>
            </div>
            <div className="text-xs text-muted-foreground">{c.status}</div>
          </div>
        </Link>
      ))}

      {filtered.length === 0 && (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
          No customers match your filters.
        </div>
      )}
    </div>
  );
}
