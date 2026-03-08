import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const form = await req.formData();

  // Convert Form Data -> query string
  const q = new URLSearchParams();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") q.set(key, value);
  }

  // Redirect to the supplier Step 1 page (GET)
  const url = new URL(`/pay/${params.slug}?${q.toString()}`, req.url);
  return NextResponse.redirect(url.toString(), 302);
}