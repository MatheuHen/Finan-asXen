"use client";

import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/auth/useLogout";
import { useSession } from "@/hooks/auth/useSession";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ROUTE_META } from "@/lib/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sidebar } from "./Sidebar";

export function Header() {
  const pathname = usePathname();
  const meta = ROUTE_META[pathname];
  const title = meta?.title || "AppControleDeVidaXen";
  
  const { data: session } = useSession();
  const { mutate: logout, isPending } = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center gap-4 border-b border-border bg-background/50 px-4 backdrop-blur-sm sm:px-6">
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger
            render={<Button variant="outline" size="icon" className="shrink-0 bg-background/20" />}
          >
            <Menu className="size-5" />
            <span className="sr-only">Você abre o menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar variant="mobile" />
          </SheetContent>
        </Sheet>
      </div>
      
      <div className="flex-1">
        <h1 className="text-lg font-semibold tracking-tight" title={meta?.description} suppressHydrationWarning>
          {title}
        </h1>
      </div>

      {session && (
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex text-sm text-muted-foreground">
            {session.user.email}
          </div>
          <ThemeToggle />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              logout();
              // Força o recarregamento do app ao sair
              window.location.href = "/login";
            }}
            disabled={isPending}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline-block">Você sai</span>
          </Button>
        </div>
      )}
    </header>
  );
}
