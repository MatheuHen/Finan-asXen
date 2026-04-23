"use client";

import { Moon, Sun } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useTheme, type ThemeMode } from "@/components/theme/ThemeProvider";
import { useHasMounted } from "@/hooks/useHasMounted";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const nextTheme = useMemo<ThemeMode>(() => (theme === "dark" ? "light" : "dark"), [theme]);
  const ariaLabel = mounted ? `Ativar tema ${nextTheme === "dark" ? "escuro" : "claro"}` : "Alternar tema";
  const title = mounted ? `Tema: ${theme === "dark" ? "escuro" : "claro"}` : "Tema";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 rounded-full text-muted-foreground hover:text-foreground"
      onClick={() => {
        const t = nextTheme;
        setTheme(t);
      }}
      aria-label={ariaLabel}
      title={title}
    >
      {mounted ? (theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />) : <span className="size-4" />}
    </Button>
  );
}
