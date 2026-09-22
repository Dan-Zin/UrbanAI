import type { AssistResult, Category, Initiative, Priority } from "./domain";

const RULES: { test: RegExp; category: Category; priority: Priority }[] = [
  { test: /люк|провал|травм/, category: "housing", priority: "urgent" },
  { test: /фонар|свет|освещ|не горит|т[её]мн/, category: "lighting", priority: "high" },
  { test: /ям|асфальт|тротуар|бордюр|покрыт/, category: "roads", priority: "high" },
  { test: /мусор|урн|контейнер|свалк/, category: "waste", priority: "urgent" },
  { test: /площадк|горк|качел|детск/, category: "playground", priority: "high" },
  { test: /парков|газон.*машин|стихийн/, category: "parking", priority: "standard" },
  { test: /дерев|скам|клумб|озелен|набереж/, category: "green", priority: "standard" },
  { test: /труб|отоплен|водоканал|жкх/, category: "housing", priority: "high" },
];

function pickRule(text: string) {
  const t = text.toLowerCase();
  return RULES.find((r) => r.test.test(t));
}

export function mockAssist(
  description: string,
  address: string,
  similar: Initiative[]
): AssistResult {
  const text = description.trim();
  const rule = pickRule(text);
  const category = rule?.category ?? "other";
  const priority = rule?.priority ?? "standard";
  const enough = text.length >= 20 && /[а-яa-z]/i.test(text);
  const reformulated = enough
    ? `По адресу ${address}: ${text.replace(/\s+/g, " ").replace(/\.$/, "")}. Требуется реакция профильного подразделения.`
    : text;
  return {
    category,
    categoryConfidence: rule ? 0.86 : 0.54,
    reformulated,
    priority,
    isValid: enough,
    validationHint: enough
      ? null
      : "Добавьте, что именно не так и где это находится (хотя бы одно предложение).",
    similarIds: similar.slice(0, 3).map((i) => i.id),
    mock: true,
  };
}

export function similarInitiatives(
  description: string,
  districtId: string,
  items: Initiative[],
  excludeId?: string
): Initiative[] {
  const words = description
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter((w) => w.length > 3);
  return items
    .filter((i) => i.id !== excludeId)
    .map((i) => {
      const hay = `${i.title} ${i.description}`.toLowerCase();
      const score =
        (i.districtId === districtId ? 2 : 0) +
        words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
      return { i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.i);
}
