import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const tokenUrl: string = body.oauthTokenUrl || body.tokenUrl;
    const clientId: string = body.oauthClientId || body.clientId;
    const clientSecret: string = body.oauthClientSecret || body.clientSecret;
    const grantType: string = body.oauthGrantType || body.grant_type || "client_credentials";
    const scope: string | undefined = body.oauthScope || body.scope;

    if (!tokenUrl || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Missing oauthTokenUrl/clientId/clientSecret" },
        { status: 400 }
      );
    }

    // OAuth2 token endpoints typically expect x-www-form-urlencoded
    const form = new URLSearchParams();
    form.set("grant_type", grantType);
    form.set("client_id", clientId);
    form.set("client_secret", clientSecret);
    if (scope) form.set("scope", scope);

    const r = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString(),
      redirect: "manual",
    });

    const text = await r.text();

    // Try to parse JSON, otherwise return raw
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!r.ok) {
      return NextResponse.json(
        { error: "OAuth2 token failed", status: r.status, details: payload },
        { status: 400 }
      );
    }

    // Expecting access_token
    if (!payload?.token) {
      return NextResponse.json(
        { error: "No access_token in response", details: payload },
        { status: 400 }
      );
    }

    return NextResponse.json({
      token: payload.token,
      token_type: payload.token_type ?? "Bearer",
      expires_in: payload.expires_in,
      raw: payload,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Token request failed" },
      { status: 500 }
    );
  }
}