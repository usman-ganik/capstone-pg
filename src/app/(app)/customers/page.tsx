import { Suspense } from "react";
import CustomersListClient from "./CustomersListClient";
import CustomersToolbarClient from "./CustomersToolbarClient";
import { getCustomersFromDbOrMock } from "@/lib/customers";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customersRaw = await getCustomersFromDbOrMock();

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
</div>

<Suspense fallback={<div className="h-10 rounded-xl border bg-muted/30" />}>
  <CustomersToolbarClient />
</Suspense>

      
        <Suspense
          fallback={
            <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
              Loading customers…
            </div>
          }
        >
          <CustomersListClient initialCustomers={customers} />
        </Suspense>
      
    </div>
  );
}
