import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getMockCustomers } from "@/lib/mock";
import CustomersListClient from "./CustomersListClient";

export default async function CustomersPage() {
  const customersRaw = getMockCustomers();

// keep ONLY plain JSON fields
const customersPlain = customersRaw.map((c: any) => ({
  slug: String(c.slug),
  name: String(c.name),
  status: String(c.status ?? ""),
}));

// force-remove anything non-serializable (defensive)
const customers = JSON.parse(JSON.stringify(customersPlain));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage customer configurations and supplier pages.
            Draft names are loaded from localStorage on the client.
          </p>
        </div>
        <Button className="rounded-xl">+ New customer</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Search customers…" className="max-w-sm rounded-xl" />
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl">Status: All</Button>
          <Button variant="outline" className="rounded-xl">Sort: Updated</Button>
        </div>
      </div>

      
        <CustomersListClient initialCustomers={customers} />
      
    </div>
  );
}
