"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Wallet,
  Tags,
  Target,
  PiggyBank,
  ShieldAlert,
  TrendingUp,
  Clock,
  BarChart3,
  Share2,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTE_META } from "@/lib/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard },
  { href: "/global", icon: Layers },
  { href: "/finances", icon: Wallet },
  { href: "/categories", icon: Tags },
  { href: "/goals", icon: Target },
  { href: "/savings", icon: PiggyBank },
  { href: "/emergency", icon: ShieldAlert },
  { href: "/investments", icon: TrendingUp },
  { href: "/life-cost", icon: Clock },
  { href: "/analytics", icon: BarChart3 },
  { href: "/shared", icon: Share2 },
  { href: "/settings", icon: Settings },
];

type SidebarProps = {
  variant?: "desktop" | "mobile";
  className?: string;
};

export function Sidebar({ variant = "desktop", className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "relative w-64 flex-col border-r border-slate-200 bg-white text-slate-900 shadow-[0_0_40px_-30px_rgba(59,130,246,0.25)] dark:border-white/10 dark:bg-gradient-to-b dark:from-[#0f172a] dark:via-[#0b1120] dark:to-[#020617] dark:text-white",
        variant === "desktop" ? "hidden md:flex" : "flex",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(59,130,246,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_25%_15%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_35%,rgba(99,102,241,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_80%_35%,rgba(139,92,246,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_90%,rgba(34,197,94,0.06),transparent_55%)] dark:bg-[radial-gradient(circle_at_55%_90%,rgba(34,197,94,0.1),transparent_55%)]" />
      </div>

      <div className="relative flex h-14 items-center border-b border-slate-200 px-6 dark:border-white/10">
        <Link href="/" prefetch={false} suppressHydrationWarning className="flex items-center gap-2 font-semibold tracking-tight text-slate-900 dark:text-white">
          <div className="size-6 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center font-bold text-xs shadow-[0_0_30px_-18px_rgba(59,130,246,0.45)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm dark:shadow-[0_0_30px_-14px_rgba(56,189,248,0.65)]">
            X
          </div>
          ControleDeVidaXen
        </Link>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="grid gap-1 px-4">
          {NAV_ITEMS.map((item) => {
            const meta = ROUTE_META[item.href];
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                suppressHydrationWarning
                title={meta?.description}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-[0_0_40px_-26px_rgba(59,130,246,0.55)] dark:bg-white/8 dark:text-white dark:ring-white/10 dark:shadow-[0_0_40px_-22px_rgba(56,189,248,0.75)]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/6 dark:hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 transition-all duration-200 group-hover:drop-shadow-[0_0_10px_rgba(56,189,248,0.55)]",
                    isActive
                      ? "text-blue-600 drop-shadow-[0_0_12px_rgba(59,130,246,0.35)] dark:text-sky-300 dark:drop-shadow-[0_0_12px_rgba(56,189,248,0.75)]"
                      : "text-slate-400 dark:text-white/60"
                  )}
                />
                {meta?.title ?? item.href}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
