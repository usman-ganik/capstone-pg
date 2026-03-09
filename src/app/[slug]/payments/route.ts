import { NextResponse } from "next/server";

function getPublicBaseUrl(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`;
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const form = await req.formData();

  const q = new URLSearchParams();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") q.set(key, value);
  }

  const base = getPublicBaseUrl(req);
  const redirectUrl = new URL(`/pay/${params.slug}?${q.toString()}`, base);

  return NextResponse.redirect(redirectUrl.toString(), 302);
}