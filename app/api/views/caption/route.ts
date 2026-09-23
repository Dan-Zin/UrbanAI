import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "";
  let label = "";
  try {
    const body = (await req.json()) as { label?: unknown };
    label = typeof body.label === "string" ? body.label.slice(0, 80) : "";
  } catch {
    return NextResponse.json({ caption: "" });
  }
  if (!key || !label) return NextResponse.json({ caption: label });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        messages: [
          {
            role: "system",
            content:
              "Верни одну короткую русскую подпись для уже выбранного шаблона благоустройства. " +
              "Не меняй смысл, не описывай геометрию двора, не предлагай другие объекты. " +
              "Только текст подписи, без кавычек и пояснений.",
          },
          { role: "user", content: label },
        ],
      }),
    });
    if (!res.ok) return NextResponse.json({ caption: label });
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return NextResponse.json({ caption: text ? text.slice(0, 80) : label });
  } catch {
    return NextResponse.json({ caption: label });
  }
}
