import { NextResponse } from "next/server";
import type { OAuthGrantType } from "@/lib/types";

type TokenRequest = {
  tokenUrl: string;
  grantType: OAuthGrantType;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;

  username?: string;
  password?: string;

  code?: string;
  redirectUri?: string;

  refreshToken?: string;

  // Optional: allow custom extra params for some providers
  extra?: Record<string, string>;
};

export async function POST(req: Request) {
  const body = (await req.json()) as TokenRequest;

  if (!body?.tokenUrl || !body?.grantType) {
    return NextResponse.json(
      { error: "tokenUrl and grantType are required" },
      { status: 400 }
    );
  }

  // Build x-www-form-urlencoded payload (standard for OAuth2 token endpoints)
  const form = new URLSearchParams();
  form.set("grant_type", body.grantType);

  if (body.scope) form.set("scope", body.scope);
  if (body.audience) form.set("audience", body.audience);

  // grant specific fields
  if (body.grantType === "client_credentials") {
    if (!body.clientId || !body.clientSecret) {
      return NextResponse.json(
        { error: "clientId and clientSecret required for client_credentials" },
        { status: 400 }
      );
    }
    // Most providers accept client_id/secret in body; some require Basic Auth.
    form.set("client_id", body.clientId);
    form.set("client_secret", body.clientSecret);
  }

  if (body.grantType === "password") {
    if (!body.clientId || !body.clientSecret || !body.username || !body.password) {
      return NextResponse.json(
        { error: "clientId, clientSecret, username, password required for password grant" },
        { status: 400 }
      );
    }
    form.set("client_id", body.clientId);
    form.set("client_secret", body.clientSecret);
    form.set("username", body.username);
    form.set("password", body.password);
  }

  if (body.grantType === "authorization_code") {
    if (!body.clientId || !body.clientSecret || !body.code || !body.redirectUri) {
      return NextResponse.json(
        { error: "clientId, clientSecret, code, redirectUri required for authorization_code" },
        { status: 400 }
      );
    }
    form.set("client_id", body.clientId);
    form.set("client_secret", body.clientSecret);
    form.set("code", body.code);
    form.set("redirect_uri", body.redirectUri);
  }

  if (body.grantType === "refresh_token") {
    if (!body.clientId || !body.clientSecret || !body.refreshToken) {
      return NextResponse.json(
        { error: "clientId, clientSecret, refreshToken required for refresh_token" },
        { status: 400 }
      );
    }
    form.set("client_id", body.clientId);
    form.set("client_secret", body.clientSecret);
    form.set("refresh_token", body.refreshToken);
  }

  if (body.extra) {
    for (const [k, v] of Object.entries(body.extra)) {
      if (v != null) form.set(k, String(v));
    }
  }

  try {
    const resp = await fetch(body.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    });
    console.log("OAUTH tokenUrl:", body.tokenUrl);
    const text = await resp.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: "Token request failed", status: resp.status, details: json },
        { status: 400 }
      );
    }

    // Expected: access_token, token_type, expires_in
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Token fetch error", message: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}