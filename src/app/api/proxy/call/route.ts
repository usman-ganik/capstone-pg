import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { insertApiCallLog } from "@/lib/api-call-logs";

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
  const start = Date.now();
  const pool = getPool();

  async function logCall(payload: {
    customerSlug?: string | null;
    phase?: string | null;
    endpointName?: string | null;
    method?: string | null;
    resolvedUrl?: string | null;
    statusCode?: number | null;
    ok: boolean;
    errorMessage?: string | null;
    requestHeaders?: Record<string, string> | null;
    requestBody?: string | null;
    responseBody?: string | null;
  }) {
    try {
      await insertApiCallLog(pool, {
        customerSlug: payload.customerSlug,
        phase: payload.phase,
        endpointName: payload.endpointName,
        method: payload.method,
        resolvedUrl: payload.resolvedUrl,
        statusCode: payload.statusCode,
        ok: payload.ok,
        durationMs: Date.now() - start,
        errorMessage: payload.errorMessage,
        requestHeaders: payload.requestHeaders
          ? JSON.stringify(payload.requestHeaders)
          : null,
        requestBody: payload.requestBody ?? null,
        responseBody: payload.responseBody ?? null,
      });
    } catch {
      // Logging should never break the proxy response.
    }
  }

  try {
    const { endpoint, meta } = await req.json();

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
        await logCall({
          customerSlug: meta?.customerSlug,
          phase: meta?.phase,
          endpointName: endpoint?.name ?? null,
          method: endpoint?.method ?? "GET",
          resolvedUrl: endpoint?.url ?? null,
          statusCode: tokenResp.status,
          ok: false,
          errorMessage: "OAuth2 token failed",
          requestHeaders: headers,
          requestBody: endpoint?.requestBodyJson ?? null,
          responseBody: tokenText,
        });
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
        await logCall({
          customerSlug: meta?.customerSlug,
          phase: meta?.phase,
          endpointName: endpoint?.name ?? null,
          method: endpoint?.method ?? "GET",
          resolvedUrl: endpoint?.url ?? null,
          statusCode: tokenResp.status,
          ok: false,
          errorMessage: "OAuth2 token missing access_token",
          requestHeaders: headers,
          requestBody: endpoint?.requestBodyJson ?? null,
          responseBody: tokenText,
        });
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
  await logCall({
    customerSlug: meta?.customerSlug,
    phase: meta?.phase,
    endpointName: endpoint?.name ?? null,
    method,
    resolvedUrl: url,
    ok: false,
    errorMessage: e?.message ?? "Upstream fetch failed",
    requestHeaders: headers,
    requestBody: endpoint?.requestBodyJson ?? null,
    responseBody: null,
  });
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
      await logCall({
        customerSlug: meta?.customerSlug,
        phase: meta?.phase,
        endpointName: endpoint?.name ?? null,
        method,
        resolvedUrl: url,
        statusCode: resp.status,
        ok: false,
        errorMessage: "Upstream API error",
        requestHeaders: headers,
        requestBody: endpoint?.requestBodyJson ?? null,
        responseBody: text,
      });
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
    await logCall({
      customerSlug: meta?.customerSlug,
      phase: meta?.phase,
      endpointName: endpoint?.name ?? null,
      method,
      resolvedUrl: url,
      statusCode: resp.status,
      ok: true,
      requestHeaders: headers,
      requestBody: endpoint?.requestBodyJson ?? null,
      responseBody: text,
    });
    return NextResponse.json(json ?? { raw: text });
  }  catch (e: any) {
  await logCall({
    customerSlug: null,
    phase: null,
    endpointName: null,
    method: null,
    resolvedUrl: null,
    ok: false,
    errorMessage: e?.message ?? "Proxy call failed",
    requestHeaders: null,
    requestBody: null,
    responseBody: null,
  });
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
