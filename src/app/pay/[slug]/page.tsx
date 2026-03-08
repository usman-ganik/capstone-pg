"use client";

import { useParams } from "next/navigation";
import SupplierStep1Client from "./supplier-step1-client";

export default function Page() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  // TEMP debug (remove later)
  return (
    <div>
      <div style={{ padding: 8, fontSize: 12, color: "#666" }}>
        DEBUG slug: <b>{slug || "(empty)"}</b>
      </div>
      <SupplierStep1Client customerSlug={slug} />
    </div>
  );
}