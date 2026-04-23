"use client";

import { useMemo } from "react";
import { Layers } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/auth/useProfile";
import { useFinancialSummary } from "@/hooks/financial/useFinancialSummary";
import { useInvestmentEntries } from "@/hooks/financial/useInvestmentEntries";
import { useReserveEntries } from "@/hooks/financial/useReserveEntries";
import { formatBRL } from "@/lib/currency";

function sumValues(list: Array<{ value?: unknown }> | undefined) {
  let total = 0;
  for (const row of list ?? []) {
    const n = Number(row.value ?? 0);
    if (!Number.isFinite(n)) continue;
    total += n;
  }
  if (!Number.isFinite(total)) return 0;
  return Number(total.toFixed(2));
}

export default function GlobalDashboardPage() {
  const profile = useProfile();
  const financialSummary = useFinancialSummary();
  const reserveEntries = useReserveEntries({});
  const investmentEntries = useInvestmentEntries({});

  const hourlyRate = useMemo(() => {
    const raw = profile.data?.hourly_rate;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [profile.data?.hourly_rate]);

  const reserveTotal = useMemo(() => sumValues(reserveEntries.data), [reserveEntries.data]);

  const investmentInvestedTotal = useMemo(() => {
    let total = 0;
    for (const e of investmentEntries.data ?? []) {
      const n = Number(e.value ?? 0);
      if (!Number.isFinite(n) || n <= 0) continue;
      total += n;
    }
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [investmentEntries.data]);

  const investmentCurrentTotal = useMemo(() => {
    let total = 0;
    for (const e of investmentEntries.data ?? []) {
      const invested = Number(e.value ?? 0);
      if (!Number.isFinite(invested) || invested <= 0) continue;
      const current = e.current_value === null || e.current_value === undefined ? invested : Number(e.current_value);
      total += Number.isFinite(current) ? current : invested;
    }
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [investmentEntries.data]);

  const investmentProfit = useMemo(() => {
    const diff = investmentCurrentTotal - investmentInvestedTotal;
    if (!Number.isFinite(diff)) return 0;
    return Number(diff.toFixed(2));
  }, [investmentCurrentTotal, investmentInvestedTotal]);

  const investmentProfitability = useMemo(() => {
    if (investmentInvestedTotal <= 0) return null;
    const pct = (investmentProfit / investmentInvestedTotal) * 100;
    if (!Number.isFinite(pct)) return null;
    return Number(pct.toFixed(2));
  }, [investmentInvestedTotal, investmentProfit]);

  const balance = Number(financialSummary.data?.balance ?? 0);
  const safeBalance = Number.isFinite(balance) ? Number(balance.toFixed(2)) : 0;

  const patrimonyTotal = useMemo(() => {
    const sum = safeBalance + reserveTotal + investmentCurrentTotal;
    if (!Number.isFinite(sum)) return 0;
    return Number(sum.toFixed(2));
  }, [investmentCurrentTotal, reserveTotal, safeBalance]);

  const patrimonyLifeHours = useMemo(() => {
    if (!hourlyRate) return null;
    const hours = patrimonyTotal / hourlyRate;
    if (!Number.isFinite(hours) || hours < 0) return null;
    return Number(hours.toFixed(2));
  }, [hourlyRate, patrimonyTotal]);

  const reserveLifeHours = useMemo(() => {
    if (!hourlyRate) return null;
    const hours = reserveTotal / hourlyRate;
    if (!Number.isFinite(hours) || hours < 0) return null;
    return Number(hours.toFixed(2));
  }, [hourlyRate, reserveTotal]);

  const insights = useMemo(() => {
    const rows: Array<{ tone: "ok" | "alert" | "neutral"; text: string }> = [];
    if (safeBalance > 0) rows.push({ tone: "ok", text: "Você está acumulando patrimônio" });
    if (safeBalance < 0) rows.push({ tone: "alert", text: "Você está gastando mais do que ganha" });
    if (investmentProfit > 0) rows.push({ tone: "ok", text: "Você está vendo seus investimentos renderem" });
    if (investmentProfit < 0) rows.push({ tone: "alert", text: "Você está com seus investimentos abaixo do que colocou" });
    if (rows.length === 0) rows.push({ tone: "neutral", text: "Você ainda não tem insights suficientes aqui" });
    return rows.slice(0, 4);
  }, [investmentProfit, safeBalance]);

  const isLoading =
    profile.isLoading ||
    financialSummary.isLoading ||
    reserveEntries.isLoading ||
    investmentEntries.isLoading;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(139,92,246,0.22),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(56,189,248,0.18),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Visão geral</h2>
            <p className="mt-2 text-slate-600 dark:text-white/70">Veja tudo o que você já construiu.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Tudo o que você tem</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-semibold tracking-tight tabular-nums">
              {isLoading ? <Skeleton className="h-9 w-44" /> : formatBRL(patrimonyTotal)}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Você tem em saldo</div>
                <div
                  className={`mt-1 text-sm font-medium tabular-nums ${
                    safeBalance > 0 ? "text-emerald-600" : safeBalance < 0 ? "text-destructive" : ""
                  }`}
                >
                  {isLoading ? <Skeleton className="h-5 w-24" /> : formatBRL(safeBalance)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Sua reserva</div>
                <div className="mt-1 text-sm font-medium tabular-nums">
                  {isLoading ? <Skeleton className="h-5 w-24" /> : formatBRL(reserveTotal)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Quanto vale em investimentos</div>
                <div className="mt-1 text-sm font-medium tabular-nums">
                  {isLoading ? <Skeleton className="h-5 w-24" /> : formatBRL(investmentCurrentTotal)}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-xs text-muted-foreground">Isso dá (horas da sua vida)</div>
              <div className="mt-1 text-sm font-medium tabular-nums">
                {patrimonyLifeHours !== null
                  ? patrimonyLifeHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Insights</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((i, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border px-3 py-3 text-sm ${
                  i.tone === "ok"
                    ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : i.tone === "alert"
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-slate-200/70 bg-card/18 text-muted-foreground dark:border-white/10"
                }`}
              >
                {i.text}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Investimentos</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Você colocou</div>
                <div className="mt-1 text-sm font-medium tabular-nums">
                  {investmentEntries.isLoading ? <Skeleton className="h-5 w-24" /> : formatBRL(investmentInvestedTotal)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Hoje vale</div>
                <div className="mt-1 text-sm font-medium tabular-nums">
                  {investmentEntries.isLoading ? <Skeleton className="h-5 w-24" /> : formatBRL(investmentCurrentTotal)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Você ganhou (ou perdeu)</div>
                <div
                  className={`mt-1 text-sm font-medium tabular-nums ${
                    investmentProfit > 0 ? "text-emerald-600" : investmentProfit < 0 ? "text-destructive" : ""
                  }`}
                >
                  {investmentEntries.isLoading ? <Skeleton className="h-5 w-24" /> : formatBRL(investmentProfit)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Você teve de retorno</div>
                <div
                  className={`mt-1 text-sm font-medium tabular-nums ${
                    investmentProfitability !== null && investmentProfitability > 0
                      ? "text-emerald-600"
                      : investmentProfitability !== null && investmentProfitability < 0
                        ? "text-destructive"
                        : ""
                  }`}
                >
                  {investmentEntries.isLoading ? (
                    <Skeleton className="h-5 w-16" />
                  ) : investmentProfitability !== null ? (
                    investmentProfitability.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Reserva</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-xs text-muted-foreground">Você guardou</div>
              <div className="mt-1 text-sm font-medium tabular-nums">
                {reserveEntries.isLoading ? <Skeleton className="h-5 w-24" /> : formatBRL(reserveTotal)}
              </div>
            </div>
            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-xs text-muted-foreground">Você protegeu (horas)</div>
              <div className="mt-1 text-sm font-medium tabular-nums">
                {reserveLifeHours !== null
                  ? reserveLifeHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
