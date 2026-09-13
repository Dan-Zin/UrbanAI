import { NextResponse } from "next/server";
import {
  CATALOG_SYSTEM_PROMPT,
  mockGenerateObject,
  parseGeneratedPayload,
  type GeneratedObjectPayload,
} from "@/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = CATALOG_SYSTEM_PROMPT;

function extractText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  const chunks: string[] = [];
  const output = data.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = (item as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const c of content) {
          const rec = c as { type?: string; text?: string };
          if (typeof rec.text === "string") chunks.push(rec.text);
        }
      }
    }
  }
  const choices = data.choices as
    | { message?: { content?: string } }[]
    | undefined;
  if (choices?.[0]?.message?.content) return choices[0].message.content;
  return chunks.join("\n");
}

function parseModelJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return JSON.parse(cleaned);
}

class ProviderError extends Error {
  status: number;
  provider: string;
  constructor(provider: string, status: number, detail: string) {
    super(detail);
    this.provider = provider;
    this.status = status;
  }
}

function userContent(prompt: string, image: string | null) {
  const userText = image
    ? `По фото и описанию сделай объект для каталога городского благоустройства. Описание: ${prompt || "объект с фото"}`
    : `Сгенерируй объект для каталога: ${prompt}`;
  if (!image) return userText;
  return [
    { type: "text", text: userText },
    { type: "image_url", image_url: { url: image, detail: "high" } },
  ];
}

async function chatCompletions(
  url: string,
  key: string,
  extraHeaders: Record<string, string>,
  model: string,
  prompt: string,
  image: string | null
): Promise<GeneratedObjectPayload> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent(prompt, image) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
      if (typeof parsed.error === "string") detail = parsed.error;
      else if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* keep status */
    }
    throw new ProviderError(url, res.status, detail);
  }
  return parseGeneratedPayload(
    parseModelJson(extractText(JSON.parse(raw) as Record<string, unknown>)),
    prompt
  );
}

function openRouterKey() {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
    ""
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt?: unknown; image?: unknown };
    const prompt = String(body.prompt ?? "").slice(0, 500);
    const image =
      typeof body.image === "string" && body.image.startsWith("data:image")
        ? body.image
        : null;

    if (!prompt.trim() && !image) {
      return NextResponse.json(
        { error: "Нужно описание или фото" },
        { status: 400 }
      );
    }

    const orKey = openRouterKey();
    const xaiKey = process.env.XAI_API_KEY ?? "";

    if (orKey) {
      try {
        const payload = await chatCompletions(
          "https://openrouter.ai/api/v1/chat/completions",
          orKey,
          {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Urban AI",
          },
          "anthropic/claude-sonnet-4.5",
          prompt,
          image
        );
        return NextResponse.json({ ...payload, mock: false, provider: "openrouter" });
      } catch {
        /* try xAI, then mock */
      }
    }

    if (xaiKey) {
      try {
        const payload = await chatCompletions(
          "https://api.x.ai/v1/chat/completions",
          xaiKey,
          {},
          "grok-4.6",
          prompt,
          image
        );
        return NextResponse.json({ ...payload, mock: false, provider: "xai" });
      } catch (err) {
        const fallback = mockGenerateObject(prompt, !!image);
        const status = err instanceof ProviderError ? err.status : 0;
        fallback.message =
          status === 403
            ? orKey
              ? `${fallback.message} (OpenRouter не ответил, у xAI нет кредитов — макет)`
              : `Ключ xAI принят, но нет кредитов. Объект собран в макете.`
            : `${fallback.message} (нейросеть недоступна, использован макет)`;
        return NextResponse.json(fallback);
      }
    }

    return NextResponse.json(mockGenerateObject(prompt, !!image));
  } catch {
    return NextResponse.json(
      { error: "Не удалось обработать запрос" },
      { status: 400 }
    );
  }
}
