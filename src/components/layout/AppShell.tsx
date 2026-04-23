"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { isAuthRoute } from "@/lib/auth-routes";

type AppShellProps = {
  children: ReactNode;
};

const Header = dynamic(() => import("@/components/layout/Header").then((m) => m.Header), { ssr: false });
const Sidebar = dynamic(() => import("@/components/layout/Sidebar").then((m) => m.Sidebar), { ssr: false });

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  
  if (isAuthRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[256px_1fr]">
      <Sidebar />
      <div className="relative flex flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-b from-[#eef2f7] via-[#f1f5f9] to-[#eef2f7] dark:from-[#0f172a] dark:via-[#0b1120] dark:to-[#020617]" />
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.22),transparent_60%)] dark:opacity-100 dark:bg-[radial-gradient(circle_at_18%_8%,rgba(56,189,248,0.22),transparent_45%)]" />
        </div>
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
