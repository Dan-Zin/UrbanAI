import type { CitizenLevel, AchievementDef, Initiative, User } from "./domain";

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_eye", title: "Первый глаз", condition: "Подана первая инициатива" },
  { id: "caring", title: "Неравнодушный", condition: "10 инициатив подано" },
  { id: "builder", title: "Строитель города", condition: "Инициатива переведена в «Выполнена»" },
  { id: "photographer", title: "Фотограф", condition: "Загружено 5 фото «после»" },
  { id: "ai_innovator", title: "ИИ-новатор", condition: "Использована 3D-визуализация" },
  { id: "team_player", title: "Командный игрок", condition: "50 комментариев оставлено" },
];

export function levelFromPoints(points: number): CitizenLevel {
  if (points >= 1000) return "voice";
  if (points >= 501) return "leader";
  if (points >= 201) return "oldtimer";
  if (points >= 51) return "active";
  return "novice";
}

export function levelProgress(points: number): { next: number; ratio: number } {
  const thresholds = [50, 200, 500, 1000, 2000];
  const next = thresholds.find((t) => points <= t) ?? 2000;
  const prev = [0, ...thresholds].filter((t) => t < next).at(-1) ?? 0;
  return { next, ratio: Math.min(1, (points - prev) / (next - prev)) };
}

export function unlockedAchievements(user: User, initiatives: Initiative[]): string[] {
  const mine = initiatives.filter((i) => i.authorId === user.id);
  const comments = initiatives.reduce(
    (n, i) => n + i.comments.filter((c) => c.authorId === user.id).length,
    0
  );
  const afterPhotos = initiatives.reduce(
    (n, i) => n + i.history.filter((h) => h.authorId === user.id && h.photoAfter).length,
    0
  );
  const next = new Set(user.achievements);
  if (mine.length >= 1) next.add("first_eye");
  if (mine.length >= 10) next.add("caring");
  if (mine.some((i) => i.status === "done")) next.add("builder");
  if (afterPhotos >= 5) next.add("photographer");
  if (mine.some((i) => i.visualization)) next.add("ai_innovator");
  if (comments >= 50) next.add("team_player");
  return [...next];
}

export function districtScore(initiatives: Initiative[]): {
  resolvedShare: number;
  avgDays: number;
  color: "red" | "yellow" | "green";
} {
  const done = initiatives.filter((i) => i.status === "done");
  const resolvedShare = initiatives.length ? done.length / initiatives.length : 1;
  const unresolvedShare = initiatives.length
    ? initiatives.filter((i) => i.status !== "done" && i.status !== "rejected").length /
      initiatives.length
    : 0;
  const avgDays =
    done.length === 0
      ? 0
      : done.reduce((s, i) => {
          const start = new Date(i.createdAt).getTime();
          const end = new Date(i.history.at(-1)?.at ?? i.createdAt).getTime();
          return s + (end - start) / 86400000;
        }, 0) / done.length;
  const color: "red" | "yellow" | "green" =
    unresolvedShare > 0.4 ? "red" : unresolvedShare > 0.2 ? "yellow" : "green";
  return { resolvedShare, avgDays, color };
}
