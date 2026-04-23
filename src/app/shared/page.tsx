"use client";

import { Share2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SharedPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.16),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(139,92,246,0.2),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <h2 className="text-3xl font-semibold tracking-tight">Você compartilha</h2>
          <p className="mt-2 text-slate-600 dark:text-white/70">Você vê e organiza seus números com outras pessoas.</p>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Você vê um resumo</CardTitle>
          <Share2 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Você vai ter gestão compartilhada aqui em breve.
        </CardContent>
      </Card>
    </div>
  );
}
