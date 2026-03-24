import { NextResponse } from "next/server";

type Provider = "openai" | "openrouter";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const provider: Provider = body.provider;
    const apiKey: string = body.apiKey;
    const fraud = body.fraud ?? {};
    const session = body.session ?? {};

    if (!provider || !apiKey) {
      return NextResponse.json({ error: "provider and apiKey required" }, { status: 400 });
    }

    if (!fraud || typeof fraud !== "object") {
      return NextResponse.json({ error: "fraud assessment required" }, { status: 400 });
    }

    const endpoint = provider === "openrouter" ? OPENROUTER_URL : OPENAI_URL;
    const model =
      provider === "openrouter"
        ? (body.model || "openai/gpt-4o-mini")
        : (body.model || "gpt-4o-mini");

    const system = `
You are a fraud-review assistant for a payment simulator.
Return ONLY valid JSON matching this schema:

{
  "analysis": {
    "headline": "short headline",
    "summary": "2-4 sentence analyst-style summary",
    "recommendation": "APPROVE|REVIEW|DENY",
    "topReasons": ["reason 1", "reason 2", "reason 3"],
    "confidence": "LOW|MEDIUM|HIGH"
  }
}

Rules:
- Ground your reasoning in the supplied fraud score, signals, timing, and transaction details.
- Do not invent signals that are not present in the input.
- If risk is low, say so clearly.
- Keep topReasons concise.
- Do not include markdown or commentary outside JSON.
`;

    const userContent = [
      {
        type: "text",
        text: `Transaction context:\n${JSON.stringify(session, null, 2)}`,
      },
      {
        type: "text",
        text: `Fraud assessment:\n${JSON.stringify(fraud, null, 2)}`,
      },
    ];

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
          Authorization: `Bearer ${apiKey}`,
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
    const analysis = parsed?.analysis;

    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json(
        { error: "LLM did not return valid fraud JSON", raw: String(content).slice(0, 1000) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      analysis,
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
