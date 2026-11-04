import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const tokenUrl: string = body.oauthTokenUrl || body.tokenUrl;
    const clientId: string = body.oauthClientId || body.clientId;
    const clientSecret: string = body.oauthClientSecret || body.clientSecret;
    const grantTypeRaw: string = (body.oauthGrantType || body.grant_type || "client_credentials").trim();
    const grantType: string = grantTypeRaw || "client_credentials";
    const scope: string | undefined = body.oauthScope || body.scope;
    const audience: string | undefined = body.oauthAudience;
    const username: string | undefined = body.oauthUsername;
    const userPassword: string | undefined = body.oauthPassword;
    const refreshToken: string | undefined = body.oauthRefreshToken;
    const authCode: string | undefined = body.oauthCode;
    const redirectUri: string | undefined = body.oauthRedirectUri;

    // client_credentials strictly requires id + secret. Other grants tolerate
    // missing credentials (some providers authenticate out-of-band), so we only
    // hard-block on the missing piece that's impossible without it.
    if (!tokenUrl) {
      return NextResponse.json(
        { error: "Missing oauthTokenUrl" },
        { status: 400 }
      );
    }
    if (grantType === "client_credentials" && (!clientId || !clientSecret)) {
      return NextResponse.json(
        { error: "Missing clientId/clientSecret for client_credentials grant" },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(tokenUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid oauthTokenUrl", tokenUrl },
        { status: 400 }
      );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        {
          error: "Unsupported oauthTokenUrl protocol",
          tokenUrl,
          protocol: parsedUrl.protocol,
        },
        { status: 400 }
      );
    }

    // OAuth2 token endpoints typically expect x-www-form-urlencoded
    const form = new URLSearchParams();
    form.set("grant_type", grantType);
    if (clientId) form.set("client_id", clientId);
    if (clientSecret) form.set("client_secret", clientSecret);
    if (scope) form.set("scope", scope);
    if (audience) form.set("audience", audience);
    if (grantType === "password" && (username || userPassword)) {
      if (username) form.set("username", username);
      if (userPassword) form.set("password", userPassword);
    }
    if (grantType === "authorization_code" && authCode) {
      form.set("code", authCode);
      if (redirectUri) form.set("redirect_uri", redirectUri);
    }
    if (grantType === "refresh_token" && refreshToken) form.set("refresh_token", refreshToken);

    let r: Response;
    try {
      r = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString(),
        redirect: "manual",
      });
    } catch (e: any) {
      const c = e?.cause;
      return NextResponse.json(
        {
          error: "OAuth2 token network request failed",
          message: e?.message ?? "Token request failed",
          code: e?.code,
          tokenUrl,
          origin: parsedUrl.origin,
          protocol: parsedUrl.protocol,
          host: parsedUrl.host,
          hint:
            parsedUrl.protocol === "https:"
              ? "If this is ERR_SSL_PACKET_LENGTH_TOO_LONG, the remote endpoint may be speaking plain HTTP on an HTTPS URL/port, or may only be reachable from a private network/VPN."
              : "Confirm the token endpoint is reachable from the deployed environment.",
          cause: c
            ? {
                message: c.message,
                code: c.code,
                errno: c.errno,
                syscall: c.syscall,
              }
            : null,
        },
        { status: 502 }
      );
    }

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
        {
          error: "OAuth2 token failed",
          status: r.status,
          tokenUrl,
          origin: parsedUrl.origin,
          protocol: parsedUrl.protocol,
          details: payload,
        },
        { status: 400 }
      );
    }

    // Expecting access_token (also accept a `token` alias some gateways use)
    const accessToken = payload?.access_token ?? payload?.token;
    if (!accessToken) {
      return NextResponse.json(
        {
          error: "No access_token in response",
          tokenUrl,
          origin: parsedUrl.origin,
          protocol: parsedUrl.protocol,
          details: payload,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      token: accessToken,
      token_type: payload.token_type ?? "Bearer",
      expires_in: payload.expires_in,
      tokenUrl,
      raw: payload,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Token request failed",
        message: e?.message ?? "Unknown error",
        code: e?.code,
      },
      { status: 500 }
    );
  }
}
