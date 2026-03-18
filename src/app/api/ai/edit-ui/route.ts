import { NextResponse } from "next/server";

type Provider = "openai" | "openrouter";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function safeJsonParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const provider: Provider = body.provider;
    const apiKey: string = body.apiKey;
    const prompt: string = body.prompt || "";
    const currentUi = body.currentUi ?? {};
    const portalScreenshotDataUrl: string | null = body.portalScreenshotDataUrl ?? null;

    if (!provider || !apiKey) {
      return NextResponse.json({ error: "provider and apiKey required" }, { status: 400 });
    }
    if (!prompt.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const endpoint = provider === "openrouter" ? OPENROUTER_URL : OPENAI_URL;

    // Model choice: OpenRouter can use many; OpenAI can use a general one.
    // Keep it configurable later; for now use something typical.
    const model =
      provider === "openrouter"
        ? (body.model || "openai/gpt-4o-mini")
        : (body.model || "gpt-4o-mini");

    const system = `
You are a UI configuration assistant for a Next.js SaaS app.
Return ONLY valid JSON matching this schema:

{
  "patch": {
    "theme": { "primary": "#RRGGBB", "link": "#RRGGBB", "background": "#RRGGBB", "surface": "#RRGGBB", "text": "#RRGGBB", "muted": "#RRGGBB", "radius": 16 },
    "addFields": [ { "key":"vat_number", "label":"VAT Number", "type":"text|number|email|date", "required": false, "placeholder":"..." } ],
    "removeFieldKeys": ["..."],
    "notes": "short note"
  }
}

Rules:
- Keys must be lowercase snake_case.
- If screenshot is provided, infer a reasonable primary/link/background/surface/text/muted palette consistent with it.
- Only include fields needed; omit sections you do not change.
- Do not include markdown or commentary outside JSON.
`;

    // Messages; include screenshot if available (OpenAI-style image_url)
    const userContent: any[] = [
      { type: "text", text: `Current UI config:\n${JSON.stringify(currentUi, null, 2)}` },
      { type: "text", text: `User request:\n${prompt}` },
    ];

    if (portalScreenshotDataUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: portalScreenshotDataUrl },
      });
    }

    const payload = {
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    };

    let resp: Response;
let text: string;

try {
     resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

     text = await resp.text();
    } catch (e: any) {
  const c = e?.cause;
  return NextResponse.json(
    {
      error: "Upstream LLM fetch failed",
      message: e?.message,
      code: e?.code,
      cause: c
        ? { message: c.message, code: c.code, errno: c.errno, syscall: c.syscall }
        : null,
      hint:
        "If cause mentions CERT / SSL, it's usually Zscaler CA. If it mentions size/timeout, try without screenshot.",
    },
    { status: 502 }
  );
}
    const json = safeJsonParse(text);

    if (!resp.ok) {
      return NextResponse.json(
        { error: "LLM call failed", status: resp.status, details: json ?? { raw: text.slice(0, 1000) } },
        { status: 400 }
      );
    }
    

    const content =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.message?.content?.[0]?.text ??
      "";

    const parsed = typeof content === "string" ? safeJsonParse(content) : null;
    const patch = parsed?.patch;

    if (!patch || typeof patch !== "object") {
      return NextResponse.json(
        { error: "LLM did not return valid patch JSON", raw: String(content).slice(0, 1000) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      patch,
      debug: {
        provider,
        model,
        llmOutput: typeof content === "string" ? content : JSON.stringify(content),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
