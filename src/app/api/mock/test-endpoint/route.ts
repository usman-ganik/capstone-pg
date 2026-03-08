import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Simulate latency
  await new Promise((r) => setTimeout(r, 350));

  // A realistic sample payload for Step 1 mapping
  const sample = {
    tender: {
      number: body?.tenderRef ?? "RFQ-12345",
      description: "Supply of laptops for FY26",
    },
    fee: { amount: 500, currency: "INR" },
    supplier: { name: body?.supplierName ?? "Demo Supplier" },
    links: { rfq: "https://buyer.portal/rfq/RFQ-12345" },
  };

  return NextResponse.json(sample);
}