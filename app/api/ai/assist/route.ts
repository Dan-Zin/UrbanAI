import { NextResponse } from "next/server";
import { mockAssist } from "@/lib/ai-assist";
import { INITIATIVES } from "@/lib/seed";

export async function POST(req: Request) {
  const body = (await req.json()) as { description?: string; address?: string };
  const description = String(body.description ?? "");
  const address = String(body.address ?? "Таганрог");
  const similar = INITIATIVES.filter((i) =>
    i.title.toLowerCase().includes(description.slice(0, 12).toLowerCase())
  );
  return NextResponse.json(mockAssist(description, address, similar));
}
