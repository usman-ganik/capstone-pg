import { NextResponse } from "next/server";
import type { ApiEndpointConfig } from "@/lib/types";

type ProxyRequest = {
  endpoint: ApiEndpointConfig;
};

export async function POST(req: Request) {
  const { endpoint } = (await req.json()) as ProxyRequest;

  if (!endpoint?.url || !endpoint?.method) {
    return NextResponse.json({ error: "endpoint.url and endpoint.method required" }, { status: 400 });
  }

  // Parse headers JSON
  let headersFromUi: Record<string, string> = {};
  try {
    headersFromUi = endpoint.headersJson?.trim() ? JSON.parse(endpoint.headersJson) : {};
  } catch (e: any) {
    return NextResponse.json({ error: "Invalid headersJson", message: e?.message }, { status: 400 });
  }

  const headers: Record<string, string> = {
    ...headersFromUi,
  };

  // Auth handling
  if (endpoint.authType === "API Key") {
    if (endpoint.apiKeyHeaderName && endpoint.apiKeyValue) {
      headers[endpoint.apiKeyHeaderName] = endpoint.apiKeyValue;
    }
  }

  if (endpoint.authType === "OAuth2") {
    // Fetch token via our server route
    const tokenResp = await fetch(new URL("/api/oauth/token", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        tokenUrl: endpoint.oauthTokenUrl,
        grantType: endpoint.oauthGrantType ?? "client_credentials",
        clientId: endpoint.oauthClientId,
        clientSecret: endpoint.oauthClientSecret,
        scope: endpoint.oauthScope,
        audience: endpoint.oauthAudience,
        username: endpoint.oauthUsername,
        password: endpoint.oauthPassword,
        code: endpoint.oauthCode,
        redirectUri: endpoint.oauthRedirectUri,
        refreshToken: endpoint.oauthRefreshToken,
      }),
    });

    const tokenJson = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok) {
      return NextResponse.json(
        { error: "OAuth2 token failed", details: tokenJson },
        { status: 400 }
      );
    }

    const accessToken = tokenJson.token;
    const tokenType = tokenJson.token_type ?? "Bearer";
    if (!accessToken) {
      return NextResponse.json(
        { error: "Token response missing access_token", details: tokenJson },
        { status: 400 }
      );
    }

    headers["Authorization"] = `${tokenType} ${accessToken}`;
  }

  // Request body (only for POST/PUT/PATCH typically)
  let body: string | undefined = undefined;
  if (endpoint.method !== "GET") {
    if (endpoint.requestBodyJson?.trim()) {
      try {
        JSON.parse(endpoint.requestBodyJson); // validate JSON
        body = endpoint.requestBodyJson;
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      } catch (e: any) {
        return NextResponse.json(
          { error: "Invalid requestBodyJson", message: e?.message },
          { status: 400 }
        );
      }
    }
  }

  try {
    const resp = await fetch(endpoint.url, {
      method: endpoint.method,
      headers,
      body,
      cache: "no-store",
    });

    const text = await resp.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: "API call failed", status: resp.status, details: json },
        { status: 400 }
      );
    }

    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { error: "API call error", message: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}