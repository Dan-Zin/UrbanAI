"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquare,
  Plus,
  Trophy,
  User,
  Users,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHasHydrated, usePlatform, type RoleView } from "@/lib/platform-store";
import { LEVEL_LABELS } from "@/lib/domain";
import { levelFromPoints } from "@/lib/gamification";

const NAV = [
  { href: "/", label: "Главная", icon: Building2 },
  { href: "/map", label: "Карта", icon: MapIcon },
  { href: "/initiatives/new", label: "Подать", icon: Plus },
  { href: "/studio", label: "3D-студия", icon: Boxes },
  { href: "/rating", label: "Рейтинг", icon: Trophy },
  { href: "/community", label: "Сообщества", icon: Users },
  { href: "/dialogs", label: "Диалоги", icon: MessageSquare },
  { href: "/profile", label: "Профиль", icon: User },
  { href: "/admin", label: "Админка", icon: LayoutDashboard, admin: true },
];

const ROLES: { id: RoleView; label: string }[] = [
  { id: "citizen", label: "Житель" },
  { id: "admin_staff", label: "Сотрудник" },
  { id: "admin_head", label: "Руководитель" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHasHydrated();
  const roleView = usePlatform((s) => s.roleView);
  const setRoleView = usePlatform((s) => s.setRoleView);
  const user = usePlatform((s) => s.users.find((u) => u.id === s.currentUserId));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/40">
              <Building2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">Таганрог</div>
              <div className="text-[10px] text-muted-foreground">Благоустройство</div>
            </div>
          </Link>

          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {NAV.filter((n) => !n.admin || roleView !== "citizen").map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5 sm:flex">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleView(r.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px]",
                    roleView === r.id
                      ? "bg-emerald-500/25 text-emerald-300"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {hydrated && user && (
              <Link href="/profile" className="hidden items-center gap-2 sm:flex">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-emerald-950"
                  style={{ background: `hsl(${user.avatarHue} 70% 55%)` }}
                >
                  {user.name.slice(0, 1)}
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-medium">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {LEVEL_LABELS[levelFromPoints(user.points)]} · {user.points} б.
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-white/5 px-3 py-2 lg:hidden">
          {NAV.filter((n) => !n.admin || roleView !== "citizen").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-md px-2 py-1 text-[11px]",
                pathname === item.href
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
