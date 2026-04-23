 "use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  CalendarIcon,
  DollarSign,
  Lightbulb,
  PieChart,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { useTransactions } from "@/hooks/financial/useTransactions";
import { useFinancialSummary } from "@/hooks/financial/useFinancialSummary";
import { useFinancialTimeline } from "@/hooks/financial/useFinancialTimeline";
import { useUpcomingTransactions } from "@/hooks/financial/useUpcomingTransactions";
import { useCategories } from "@/hooks/financial/useCategories";
import { useProfile } from "@/hooks/auth/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/currency";
import { parseDateOnly } from "@/lib/date";
import { formatPeriodHint, getPresetRange, startOfDay, type PeriodPreset } from "@/lib/period";
import { FloatingMoneyIcon } from "@/components/ui/FloatingMoneyIcon";
import { IncomeExpenseBarChart } from "@/components/dashboard/IncomeExpenseBarChart";
import { ExpensesByCategoryChart } from "@/components/dashboard/ExpensesByCategoryChart";
import { MonthlyBalanceChart } from "@/components/dashboard/MonthlyBalanceChart";
import { buildEvolutionPoints } from "@/lib/financial-evolution";

const FinancialEvolutionChart = dynamic(
  () => import("@/components/dashboard/FinancialEvolutionChart").then((m) => m.FinancialEvolutionChart),
  {
    ssr: false,
    loading: () => <div className="h-[350px] w-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl"><Skeleton className="h-full w-full" /></div>,
  }
);

function formatMonthLabel(monthKey: string) {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const metricCardClass =
  "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition-all duration-200 will-change-transform " +
  "dark:border-slate-700 dark:bg-slate-900/60 dark:text-white " +
  "hover:scale-[1.02] hover:border-slate-300 hover:shadow-[0_18px_70px_-55px_rgba(2,6,23,0.25)] " +
  "dark:hover:border-slate-600 dark:hover:shadow-[0_18px_70px_-55px_rgba(0,0,0,0.75)]";

const toneBalance = "border-blue-200 hover:border-blue-300 dark:border-sky-500/20 dark:hover:border-sky-400/35";
const toneIncome = "border-green-200 hover:border-green-300 dark:border-emerald-500/20 dark:hover:border-emerald-400/35";
const toneExpense = "border-red-200 hover:border-red-300 dark:border-rose-500/20 dark:hover:border-rose-400/35";
const toneSaving = "border-violet-200 hover:border-violet-300 dark:border-violet-500/20 dark:hover:border-violet-400/35";

const DASHBOARD_FILTER_LABELS: Record<PeriodPreset, string> = {
  today: "Diário",
  "7d": "Semanal",
  "30d": "Mensal",
  month: "Mensal",
  year: "Anual",
  custom: "Personalizado",
};

export default function DashboardPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });

  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  const summary = useFinancialSummary({ from: dateRange?.from, to: dateRange?.to });
  const transactions = useTransactions({ from: dateRange?.from, to: dateRange?.to });
  const upcoming = useUpcomingTransactions({ from: dateRange?.from, to: dateRange?.to });
  const timeline = useFinancialTimeline();
  const categories = useCategories();
  const profile = useProfile();

  const hourlyRate = useMemo(() => {
    const raw = profile.data?.hourly_rate;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [profile.data?.hourly_rate]);

  const economy = useMemo(() => {
    if (summary.isLoading || summary.error) return null;
    const income = Number(summary.data?.incomeTotal ?? 0);
    const expense = Number(summary.data?.expenseTotal ?? 0);
    if (!Number.isFinite(income) || !Number.isFinite(expense)) return null;
    return Number((income - expense).toFixed(2));
  }, [summary.isLoading, summary.error, summary.data?.incomeTotal, summary.data?.expenseTotal]);

  const savingRatePercent = useMemo(() => {
    if (economy === null) return null;
    const income = Number(summary.data?.incomeTotal ?? 0);
    if (!Number.isFinite(income) || income <= 0) return null;
    const rate = (economy / income) * 100;
    if (!Number.isFinite(rate)) return null;
    return Number(rate.toFixed(2));
  }, [economy, summary.data?.incomeTotal]);

  const previousRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    const from = startOfDay(dateRange.from);
    const to = startOfDay(dateRange.to);
    if (from.getTime() > to.getTime()) return null;
    const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const previousTo = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
    const previousFrom = new Date(previousTo.getFullYear(), previousTo.getMonth(), previousTo.getDate() - (days - 1));
    return { from: previousFrom, to: previousTo };
  }, [dateRange]);

  const previousSummary = useFinancialSummary({ from: previousRange?.from, to: previousRange?.to });

  const previousEconomy = useMemo(() => {
    if (!previousRange) return null;
    if (previousSummary.isLoading || previousSummary.error) return null;
    const income = Number(previousSummary.data?.incomeTotal ?? 0);
    const expense = Number(previousSummary.data?.expenseTotal ?? 0);
    if (!Number.isFinite(income) || !Number.isFinite(expense)) return null;
    return Number((income - expense).toFixed(2));
  }, [previousRange, previousSummary.isLoading, previousSummary.error, previousSummary.data?.incomeTotal, previousSummary.data?.expenseTotal]);

  const economyComparisonPercent = useMemo(() => {
    if (economy === null) return null;
    if (previousEconomy === null) return null;
    if (previousEconomy === 0) return null;
    const pct = ((economy - previousEconomy) / Math.abs(previousEconomy)) * 100;
    if (!Number.isFinite(pct)) return null;
    return Number(pct.toFixed(2));
  }, [economy, previousEconomy]);

  const economyNarrative = useMemo(() => {
    if (economy === null) return null;
    if (economy > -10 && economy < 10) {
      return {
        headline: "Você ficou no ponto de equilíbrio aqui (" + formatBRL(0) + ")",
        tone: "neutral" as const,
      };
    }
    const abs = Math.abs(economy);
    if (economy < 0) {
      return {
        headline: `Você perdeu ${formatBRL(abs)} aqui`,
        tone: "negative" as const,
      };
    }
    return {
      headline: `Você economizou ${formatBRL(abs)} aqui`,
      tone: "positive" as const,
    };
  }, [economy]);

  const economyHoursNarrative = useMemo(() => {
    if (economy === null) return null;
    if (economy > -10 && economy < 10) return null;
    if (!hourlyRate) return null;
    const abs = Math.abs(economy);
    const hours = abs / hourlyRate;
    if (!Number.isFinite(hours)) return null;
    const value = Number(hours.toFixed(2));
    if (economy < 0)
      return `Você gastou ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} horas da sua vida aqui`;
    return `Você preservou ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} horas da sua vida`;
  }, [economy, hourlyRate]);

  const economySmartMessage = useMemo(() => {
    if (economy === null) return null;
    if (economy > -10 && economy < 10) return null;
    if (economy < 0) return "Você está consumindo a sua economia aqui. Você pode revisar as categorias com maior impacto.";
    if (economy === 0) return "Você ficou no zero a zero aqui.";
    return "Você está mantendo um saldo positivo aqui. Isso melhora sua segurança financeira.";
  }, [economy]);

  const recentTransactions = useMemo(() => {
    const list = transactions.data ?? [];
    return list.slice(0, 6);
  }, [transactions.data]);

  const lateCount = upcoming.data?.late.length ?? 0;
  const upcomingList = upcoming.data?.upcoming ?? [];
  const microcopy = useMemo(() => {
    if (upcoming.isLoading || upcoming.error) return null;
    const late = upcoming.data?.late.length ?? 0;
    const upcomingCount = upcoming.data?.upcoming.length ?? 0;
    if (late > 0) {
      return { tone: "danger" as const, text: "Você tem " + late + " conta(s) vencida(s) aqui." };
    }
    if (upcomingCount > 0) {
      return {
        tone: "warning" as const,
        text: "Você tem " + upcomingCount + " conta(s) perto do vencimento aqui.",
      };
    }
    return null;
  }, [upcoming.isLoading, upcoming.error, upcoming.data]);

  const insights = useMemo(() => {
    const items: Array<{
      key: string;
      text: string;
      tone: "positive" | "negative" | "info";
      icon: "trending-up" | "trending-down" | "pie-chart" | "arrow-up" | "arrow-down";
    }> = [];

    const incomeTotal = summary.data?.incomeTotal ?? 0;
    const expenseTotal = summary.data?.expenseTotal ?? 0;
    if (!summary.isLoading && !summary.error && (incomeTotal > 0 || expenseTotal > 0)) {
      if (expenseTotal > incomeTotal) {
        items.push({
          key: "income-expense-negative",
          tone: "negative",
          icon: "trending-down",
          text: "Você gastou mais do que ganhou aqui",
        });
      } else if (incomeTotal > expenseTotal) {
        items.push({
          key: "income-expense-positive",
          tone: "positive",
          icon: "trending-up",
          text: "Você ficou no positivo aqui",
        });
      }
    }

    if (!transactions.isLoading && !categories.isLoading && !transactions.error && !categories.error) {
      const cats = categories.data ?? [];
      const catName = new Map<string, string>();
      for (const c of cats) catName.set(c.id, c.name);

      const sums = new Map<string, number>();
      for (const t of transactions.data ?? []) {
        if (t.type !== "expense") continue;
        const amount = Number(t.amount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const key = t.category_id ?? "uncategorized";
        sums.set(key, (sums.get(key) ?? 0) + amount);
      }

      let topKey: string | null = null;
      let topValue = 0;
      for (const [k, v] of sums.entries()) {
        if (v > topValue) {
          topKey = k;
          topValue = v;
        }
      }
      if (topKey && topValue > 0) {
        const name = topKey === "uncategorized" ? "Sem categoria" : catName.get(topKey) ?? "Sem categoria";
        items.push({
          key: "top-category",
          tone: "info",
          icon: "pie-chart",
          text: "Você teve seu maior gasto em " + name + " (" + formatBRL(topValue) + ")",
        });
      }

      const evo = buildEvolutionPoints(transactions.data ?? []);
      if (evo.length >= 2) {
        const first = evo[0]?.accumulated ?? 0;
        const last = evo[evo.length - 1]?.accumulated ?? 0;
        if (last < 0) {
          items.push({
            key: "evolution-negative",
            tone: "negative",
            icon: "arrow-down",
            text: "Você terminou no negativo aqui",
          });
        } else if (last > first) {
          items.push({
            key: "evolution-positive",
            tone: "positive",
            icon: "arrow-up",
            text: "Você está evoluindo no positivo aqui",
          });
        }
      }
    }

    return items;
  }, [
    summary.data,
    summary.isLoading,
    summary.error,
    transactions.data,
    transactions.isLoading,
    transactions.error,
    categories.data,
    categories.isLoading,
    categories.error,
  ]);

  return (
    <div className="space-y-6 relative">
      <div
        className="pointer-events-none absolute -inset-x-10 -top-16 -bottom-16 -z-10 opacity-80 dark:opacity-95"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#eef2f7] via-[#f1f5f9] to-[#eef2f7] dark:from-[#070a1c] dark:via-[#0b1224] dark:to-[#0f172a]" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_16%_14%,rgba(59,130,246,0.22),transparent_60%)] dark:opacity-100 dark:bg-[radial-gradient(circle_at_86%_22%,rgba(99,102,241,0.12),transparent_55%)]" />
      </div>
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_22%_18%,rgba(59,130,246,0.14),transparent_55%)] dark:bg-[radial-gradient(circle_at_22%_18%,rgba(56,189,248,0.22),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_48%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_48%,rgba(139,92,246,0.2),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_55%_90%,rgba(34,197,94,0.08),transparent_60%)] dark:bg-[radial-gradient(circle_at_55%_90%,rgba(34,197,94,0.14),transparent_60%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="absolute right-5 top-5 z-10">
          <FloatingMoneyIcon />
        </div>
        <div className="relative flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Seu período</h2>
            <p className="mt-2 text-slate-600 dark:text-white/70">Veja como você está neste período</p>
            <div className="mt-2 text-sm text-slate-600 dark:text-white/60">Você está vendo: {periodHint}</div>
            {microcopy && (
              <div
                className={
                  microcopy.tone === "danger"
                    ? "mt-3 inline-flex items-center rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-sm font-medium text-rose-700 dark:text-rose-200"
                    : "mt-3 inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-200"
                }
              >
                {microcopy.text}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
              <Select
                value={periodPreset}
                onValueChange={(v) => {
                  const preset = v as PeriodPreset;
                  setPeriodPreset(preset);
                  if (preset !== "custom") {
                    const r = getPresetRange(preset);
                    setDateRange(r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined);
                  }
                }}
              >
                <SelectTrigger className="w-[220px] bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10">
                  <span className="flex flex-1 text-left">{DASHBOARD_FILTER_LABELS[periodPreset]}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Diário</SelectItem>
                  <SelectItem value="7d">Semanal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="year">Anual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                    >
                      <CalendarIcon className="mr-2 size-4 opacity-60" />
                      Personalizado
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      setPeriodPreset("custom");
                      setDateRange(range);
                      if (range?.from && range?.to) {
                        setIsCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className={metricCardClass + " " + toneBalance + " animate-in fade-in slide-in-from-bottom-4 duration-500"}>
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.22),transparent_55%)]" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">Seu saldo no período</CardTitle>
            <div className="size-9 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-slate-900/60">
              <DollarSign className="size-4 text-blue-600 dark:text-sky-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-blue-600 dark:text-sky-400">
              {summary.isLoading ? <Skeleton className="h-9 w-36 bg-blue-200/35 dark:bg-sky-500/20" /> : formatBRL(summary.data?.balance ?? 0)}
            </div>
            <p className="text-xs text-slate-600 mt-1 dark:text-slate-300">Receitas menos despesas neste recorte</p>
          </CardContent>
        </Card>

        <Card className={metricCardClass + " " + toneIncome + " animate-in fade-in slide-in-from-bottom-4 duration-500"}>
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.24),transparent_55%)]" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">Receitas do período</CardTitle>
            <div className="size-9 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-slate-900/60">
              <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
              {summary.isLoading ? (
                <Skeleton className="h-9 w-36 bg-emerald-200/35 dark:bg-emerald-500/20" />
              ) : (
                formatBRL(summary.data?.incomeTotal ?? 0)
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1 dark:text-slate-300">Tudo o que entrou neste recorte</p>
          </CardContent>
        </Card>

        <Card className={metricCardClass + " " + toneExpense + " animate-in fade-in slide-in-from-bottom-4 duration-500"}>
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(244,63,94,0.24),transparent_55%)]" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">Despesas do período</CardTitle>
            <div className="size-9 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-slate-900/60">
              <ArrowDownRight className="size-4 text-rose-600 dark:text-rose-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
              {summary.isLoading ? (
                <Skeleton className="h-9 w-36 bg-rose-200/35 dark:bg-rose-500/20" />
              ) : (
                formatBRL(summary.data?.expenseTotal ?? 0)
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1 dark:text-slate-300">Tudo o que saiu neste recorte</p>
          </CardContent>
        </Card>

        <Card className={metricCardClass + " " + toneSaving + " animate-in fade-in slide-in-from-bottom-4 duration-500"}>
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(139,92,246,0.24),transparent_55%)]" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">Sua economia no período</CardTitle>
            <div className="size-9 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-slate-900/60">
              <PiggyBank className="size-4 text-slate-700 dark:text-slate-200" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={
                "text-3xl font-bold tracking-tight tabular-nums " +
                (economy !== null && economy > -10 && economy < 10
                  ? "text-blue-600 dark:text-sky-400"
                  : economy !== null && economy < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : economy !== null && economy > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-violet-700 dark:text-violet-300")
              }
            >
              {summary.isLoading ? (
                <Skeleton className="h-9 w-36 bg-violet-200/35 dark:bg-violet-500/20" />
              ) : (
                formatBRL(economy ?? 0)
              )}
            </div>
            <div className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {economyNarrative && <div className="font-medium">{economyNarrative.headline}</div>}
              {economyHoursNarrative && <div>{economyHoursNarrative}</div>}
              {savingRatePercent !== null && <div>Você guardou {savingRatePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% do que ganhou</div>}
              {economyComparisonPercent !== null && (
                <div>
                  Você guardou{" "}
                  {Math.abs(economyComparisonPercent).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  % {economyComparisonPercent >= 0 ? "a mais" : "a menos"} do que antes
                </div>
              )}
              {economySmartMessage && <div>{economySmartMessage}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base">Evolução no período</CardTitle>
              <p className="text-xs text-muted-foreground">Você vê como seu saldo muda dentro deste recorte</p>
            </div>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Wallet className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              {transactions.isLoading ? (
                <div className="h-[160px] rounded-2xl border bg-card/18 p-4">
                  <Skeleton className="h-4 w-1/3" />
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-11/12" />
                    <Skeleton className="h-3 w-10/12" />
                    <Skeleton className="h-3 w-9/12" />
                  </div>
                </div>
              ) : (
                <FinancialEvolutionChart transactions={transactions.data ?? []} />
              )}
            </div>
            {timeline.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (timeline.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">Você ainda não tem movimentações suficientes para ver a evolução.</div>
            ) : (
              <div className="rounded-2xl border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
                  <div className="col-span-5">Mês</div>
                  <div className="col-span-3 text-right">Saldo</div>
                  <div className="col-span-4 text-right">Acumulado</div>
                </div>
                <div className="max-h-[260px] overflow-auto divide-y">
                  {(timeline.data ?? []).map((p) => (
                    <div
                      key={p.month}
                      className="group grid grid-cols-12 gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/35"
                    >
                      <div className="col-span-5 font-medium">{formatMonthLabel(p.month)}</div>
                      <div
                        className={
                          "col-span-3 text-right font-semibold " +
                          (p.balance >= 0 ? "text-emerald-500" : "text-destructive")
                        }
                      >
                        {formatBRL(p.balance)}
                      </div>
                      <div
                        className={
                          "col-span-4 text-right font-semibold tabular-nums " +
                          (p.accumulated >= 0 ? "text-emerald-500" : "text-destructive") +
                          " group-hover:drop-shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                        }
                      >
                        {formatBRL(p.accumulated)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 rounded-3xl bg-card/35 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Você viu recentemente</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <DollarSign className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {transactions.isLoading ? (
              <div className="space-y-2 rounded-2xl border p-3">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-sm text-muted-foreground">Você ainda não adicionou nenhuma movimentação.</div>
            ) : (
              <div className="divide-y rounded-2xl border">
                {recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/35"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {t.description || (t.type === "income" ? "Receita" : "Despesa")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {"Você registrou " +
                          (t.type === "income" ? "uma receita" : "uma despesa") +
                          " e ela está " +
                          (t.status === "paid"
                            ? "paga"
                            : t.status === "pending"
                              ? "a pagar"
                              : t.status === "late"
                                ? "atrasada"
                                : t.status === "cancelled"
                                  ? "cancelada"
                                  : "com status indefinido")}
                      </div>
                    </div>
                    <div
                      className={
                        t.type === "income"
                          ? "text-sm font-semibold text-emerald-500"
                          : "text-sm font-semibold text-destructive"
                      }
                    >
                      {formatBRL(Number(t.amount))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="space-y-0.5">
            <CardTitle className="text-base">Receitas vs Despesas</CardTitle>
            <p className="text-xs text-muted-foreground">Comparação rápida do que você escolheu ver</p>
          </CardHeader>
          <CardContent>
            {transactions.isLoading ? (
              <div className="h-[200px] rounded-2xl border bg-card/18 p-4">
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            ) : (
              <IncomeExpenseBarChart transactions={transactions.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="space-y-0.5">
            <CardTitle className="text-base">Gastos por categoria</CardTitle>
            <p className="text-xs text-muted-foreground">Veja onde seu dinheiro está indo</p>
          </CardHeader>
          <CardContent>
            {transactions.isLoading || categories.isLoading ? (
              <div className="h-[220px] rounded-2xl border bg-card/18 p-4">
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            ) : (
              <ExpensesByCategoryChart
                transactions={transactions.data ?? []}
                categories={categories.data ?? []}
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="space-y-0.5">
            <CardTitle className="text-base">Comparação mensal</CardTitle>
            <p className="text-xs text-muted-foreground">Como seu saldo ficou mês a mês</p>
          </CardHeader>
          <CardContent>
            {transactions.isLoading ? (
              <div className="h-[200px] rounded-2xl border bg-card/18 p-4">
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            ) : (
              <MonthlyBalanceChart transactions={transactions.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {(transactions.isLoading || categories.isLoading) && (
        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Insights para você</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Lightbulb className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      )}

      {!transactions.isLoading && !categories.isLoading && insights.length > 0 && (
        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Insights para você</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Lightbulb className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((i) => {
                const base =
                  "flex items-start gap-3 rounded-2xl border px-3 py-2.5 bg-white/60 dark:bg-slate-950/20";
                const tone =
                  i.tone === "positive"
                    ? "border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-400/10"
                    : i.tone === "negative"
                      ? "border-rose-500/20 bg-rose-500/5 dark:border-rose-400/20 dark:bg-rose-400/10"
                      : "border-slate-500/20 bg-slate-500/5 dark:border-white/10 dark:bg-white/5";
                const iconWrap =
                  i.tone === "positive"
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-200"
                    : i.tone === "negative"
                      ? "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-200"
                      : "bg-slate-500/10 text-slate-700 dark:bg-white/8 dark:text-slate-200";

                const Icon =
                  i.icon === "trending-up"
                    ? TrendingUp
                    : i.icon === "trending-down"
                      ? TrendingDown
                      : i.icon === "pie-chart"
                        ? PieChart
                        : i.icon === "arrow-up"
                          ? ArrowUp
                          : ArrowDown;

                return (
                  <div key={i.key} className={base + " " + tone}>
                    <div className={"mt-0.5 size-9 shrink-0 rounded-2xl flex items-center justify-center " + iconWrap}>
                      <Icon className="size-4" />
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">{i.text}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-7 rounded-3xl bg-card/35 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Você tem contas aqui{lateCount > 0 ? ` • ${lateCount} vencida(s)` : ""}
            </CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Wallet className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {upcoming.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : upcomingList.length === 0 && lateCount === 0 ? (
              <div className="text-sm text-muted-foreground">
                Você não tem contas vencidas nem a vencer aqui.
              </div>
            ) : (
              <div className="divide-y rounded-2xl border">
                {(upcoming.data?.late ?? []).slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-destructive/5 transition-colors hover:bg-destructive/10">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {t.description || (t.type === "income" ? "Receita" : "Despesa")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Venceu em{" "}
                        {parseDateOnly(t.due_date)
                          ? (parseDateOnly(t.due_date) as Date).toLocaleDateString("pt-BR")
                          : t.due_date}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-destructive">
                      {formatBRL(Number(t.amount))}
                    </div>
                  </div>
                ))}

                {upcomingList.slice(0, 6).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/35"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {t.description || (t.type === "income" ? "Receita" : "Despesa")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vence em{" "}
                        {parseDateOnly(t.due_date)
                          ? (parseDateOnly(t.due_date) as Date).toLocaleDateString("pt-BR")
                          : t.due_date}
                      </div>
                    </div>
                    <div
                      className={
                        t.type === "income"
                          ? "text-sm font-semibold text-emerald-500"
                          : "text-sm font-semibold text-destructive"
                      }
                    >
                      {formatBRL(Number(t.amount))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
