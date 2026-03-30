"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
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
  { href: "/finances", icon: Wallet },
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
        "w-64 flex-col border-r border-border bg-card",
        variant === "desktop" ? "hidden md:flex" : "flex",
        className
      )}
    >
      <div className="flex h-14 items-center border-b border-border px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-primary">
          <div className="size-6 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
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
                title={meta?.description}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {meta?.title ?? item.href}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
