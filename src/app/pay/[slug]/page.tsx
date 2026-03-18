"use client";

import { useParams } from "next/navigation";
import SupplierStep1Client from "./supplier-step1-client";

export default function Page() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  return <SupplierStep1Client customerSlug={slug} />;
}
