"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  
  // Se for página de login/registro, não exibe a sidebar e header da aplicação
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[256px_1fr]">
      <Sidebar />
      <div className="flex flex-col overflow-hidden bg-muted/30">
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
