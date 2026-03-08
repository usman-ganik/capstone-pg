import ConfigStepper from "./_components/ConfigStepper";
import StickyActions from "./_components/StickyActions";
import { getMockCustomerBySlug } from "@/lib/mock";

export default async function CustomerConfiguratorPage({
  params,
}: {
  params: { slug: string };
}) {
  const customer = getMockCustomerBySlug(params.slug);

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

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ConfigStepper customer={customer} />
      </div>
    </div>
  );
}
