import { NextResponse } from "next/server";

async function safeText(resp: Response) {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

function tryJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { endpoint } = await req.json();

    // Parse headers JSON if provided
    let headers: Record<string, string> = {};
    if (endpoint.headersJson?.trim()) {
      headers = JSON.parse(endpoint.headersJson);
    }

    // If OAuth2, get token from your oauth route
    if (endpoint.authType === "OAuth2") {
      const tokenResp = await fetch(new URL("/api/oauth/token", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(endpoint),
      });

      const tokenText = await safeText(tokenResp);
      const tokenJson = tryJson(tokenText);

      if (!tokenResp.ok) {
        return NextResponse.json(
          {
            error: "OAuth2 token failed",
            tokenStatus: tokenResp.status,
            tokenBody: tokenJson ?? tokenText,
          },
          { status: 400 }
        );
      }

      const accessToken = tokenJson?.token;
      if (!accessToken) {
        return NextResponse.json(
          { error: "OAuth2 token missing access_token", tokenBody: tokenJson ?? tokenText },
          { status: 400 }
        );
      }

      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const method = endpoint.method || "GET";
    const url = endpoint.url;

    const fetchInit: RequestInit = {
      method,
      headers,
      redirect: "manual",
    };

    if (method === "POST") {
      fetchInit.body = endpoint.requestBodyJson ?? "";
      // If user didn't set content-type, assume JSON
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    }

    let resp: Response;
try {
  resp = await fetch(url, fetchInit);
} catch (e: any) {
  const cause = e?.cause;
  return NextResponse.json(
    {
      error: "Upstream fetch failed",
      resolvedUrl: url,
      message: e?.message,
      code: e?.code,
      errno: e?.errno,
      syscall: e?.syscall,
      cause: cause
        ? {
            message: cause?.message,
            code: cause?.code,
            errno: cause?.errno,
            syscall: cause?.syscall,
          }
        : null,
    },
    { status: 502 }
  );
}

    const text = await safeText(resp);
    const json = tryJson(text);

    if (!resp.ok) {
      return NextResponse.json(
        {
          error: "Upstream API error",
          status: resp.status,
          resolvedUrl: url,
          responseHeaders: Object.fromEntries(resp.headers.entries()),
          body: json ?? text ?? null,
        },
        { status: 400 }
      );
    }

    // Return JSON if possible else raw text
    return NextResponse.json(json ?? { raw: text });
  }  catch (e: any) {
  const cause = e?.cause;
  return NextResponse.json(
    {
      error: e?.message ?? "Proxy call failed",
      code: e?.code,
      errno: e?.errno,
      syscall: e?.syscall,
      cause: cause
        ? {
            message: cause?.message,
            code: cause?.code,
            errno: cause?.errno,
            syscall: cause?.syscall,
          }
        : null,
    },
    { status: 500 }
  );
}
}