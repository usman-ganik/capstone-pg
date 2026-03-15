"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CustomersToolbarClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const status = sp.get("status") ?? "all";
  const sort = sp.get("sort") ?? "updated";

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`/customers?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search customers…"
          className="max-w-sm rounded-xl"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q });
          }}
        />
        <Button variant="outline" className="rounded-xl" onClick={() => apply({ q })}>
          Search
        </Button>

        <Button
          variant="ghost"
          className="rounded-xl"
          onClick={() => {
            setQ("");
            router.push("/customers");
          }}
        >
          Clear
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => apply({ status: status === "all" ? "active" : "all" })}
        >
          Status: {status}
        </Button>

        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => apply({ sort: sort === "updated" ? "name" : "updated" })}
        >
          Sort: {sort}
        </Button>

        <Link href="/customers/new" className="inline-flex">
          <Button className="rounded-xl">+ New customer</Button>
        </Link>
      </div>
    </div>
  );
}