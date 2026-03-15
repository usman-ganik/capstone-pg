import ConfigStepper from "./_components/ConfigStepper";
import { getCustomerBySlugFromDbOrMock } from "@/lib/customers";

export const dynamic = "force-dynamic";

export default async function CustomerConfiguratorPage({
  params,
}: {
  params: { slug: string };
}) {
  const customer =
    params.slug === "new"
      ? { name: "New Customer", slug: "new", status: "Inactive" as const, updatedHuman: "—" }
      : await getCustomerBySlugFromDbOrMock(params.slug);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Configure — {customer.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Define parameters, connect APIs, map fields, and publish pages.
        </p>
      </div>

      <div className="w-full min-w-0">
  <ConfigStepper customer={customer} />
</div>
    </div>
  );
}
