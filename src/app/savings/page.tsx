"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarIcon,
  Lightbulb,
  PiggyBank,
  Percent,
  Timer,
} from "lucide-react";
import { Bar, BarChart, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/auth/useProfile";
import { useCategories } from "@/hooks/financial/useCategories";
import { useFinancialSummary } from "@/hooks/financial/useFinancialSummary";
import { useTransactions } from "@/hooks/financial/useTransactions";
import { useHasMounted } from "@/hooks/useHasMounted";
import { formatBRL } from "@/lib/currency";
import { buildEvolutionPoints } from "@/lib/financial-evolution";
import { formatPeriodHint, getPresetRange, PERIOD_PRESET_LABELS, startOfDay, type PeriodPreset } from "@/lib/period";

type CategoryRow = {
  key: string;
  name: string;
  expense: number;
  percentOfExpenses: number | null;
};

type DistTooltipPayload = {
  payload?: CategoryRow;
  value?: unknown;
};

function DistributionTooltip({ active, payload }: { active?: boolean; payload?: DistTooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/85">
      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{p.name}</div>
      <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Você gastou: <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatBRL(p.expense)}</span>
        </div>
        {p.percentOfExpenses !== null && (
          <div>
            Participação:{" "}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {p.percentOfExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SavingsPage() {
  const mounted = useHasMounted();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });

  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  const summary = useFinancialSummary({ from: dateRange?.from, to: dateRange?.to });
  const transactions = useTransactions({ from: dateRange?.from, to: dateRange?.to });
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
    const pct = (economy / income) * 100;
    if (!Number.isFinite(pct)) return null;
    return Number(pct.toFixed(2));
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

  const comparison = useMemo(() => {
    if (economy === null || previousEconomy === null) return null;
    const delta = Number((economy - previousEconomy).toFixed(2));
    const pct =
      previousEconomy === 0
        ? null
        : Number((((economy - previousEconomy) / Math.abs(previousEconomy)) * 100).toFixed(2));
    if (!Number.isFinite(delta)) return null;
    if (pct !== null && !Number.isFinite(pct)) return { delta, pct: null };
    return { delta, pct };
  }, [economy, previousEconomy]);

  const economyHoursNarrative = useMemo(() => {
    if (economy === null) return null;
    if (economy > -10 && economy < 10) return null;
    if (!hourlyRate) return null;
    const hours = Math.abs(economy) / hourlyRate;
    if (!Number.isFinite(hours)) return null;
    const v = Number(hours.toFixed(2));
    const formatted = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (economy < 0) return `Isso custou ${formatted} horas da sua vida`;
    return `Você preservou ${formatted} horas da sua vida`;
  }, [economy, hourlyRate]);

  const economyHoursValue = useMemo(() => {
    if (!economyHoursNarrative) return null;
    if (economy === null) return null;
    if (!hourlyRate) return null;
    const hours = Math.abs(economy) / hourlyRate;
    if (!Number.isFinite(hours)) return null;
    return Number(hours.toFixed(2));
  }, [economyHoursNarrative, economy, hourlyRate]);

  const economyNarrative = useMemo(() => {
    if (economy === null) return null;
    if (economy > -10 && economy < 10) {
      return {
        text: "Você está no ponto de equilíbrio",
        tone: "neutral" as const,
      };
    }
    const abs = Math.abs(economy);
    if (economy < 0) {
      return {
        text: `Você gastou ${formatBRL(abs)} a mais do que ganhou`,
        tone: "negative" as const,
      };
    }
    return {
      text: `Você economizou ${formatBRL(abs)}`,
      tone: "positive" as const,
    };
  }, [economy]);

  const evolution = useMemo(() => {
    const list = transactions.data ?? [];
    const points = buildEvolutionPoints(list);
    if (points.length < 2) return null;
    return points.map((p) => {
      const [, m, d] = p.rawDate.split("-");
      const short = d && m ? `${d}/${m}` : p.rawDate;
      return {
        rawDate: p.rawDate,
        label: short,
        accumulated: p.accumulated,
      };
    });
  }, [transactions.data]);

  const evolutionStroke = useMemo(() => {
    if (!evolution || evolution.length === 0) return "rgba(34,197,94,0.9)";
    const last = evolution[evolution.length - 1]?.accumulated ?? 0;
    if (!Number.isFinite(last)) return "rgba(34,197,94,0.9)";
    return last >= 0 ? "rgba(34,197,94,0.9)" : "rgba(244,63,94,0.85)";
  }, [evolution]);

  const distribution = useMemo(() => {
    const catName = new Map<string, string>();
    for (const c of categories.data ?? []) catName.set(c.id, c.name);

    const expenseBy = new Map<string, number>();
    for (const t of transactions.data ?? []) {
      if (t.type !== "expense") continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const key = t.category_id ?? "uncategorized";
      expenseBy.set(key, (expenseBy.get(key) ?? 0) + amount);
    }

    const totalExpense = Array.from(expenseBy.values()).reduce((acc, v) => acc + v, 0);
    const rows = Array.from(expenseBy.entries()).map(([key, value]) => {
      const expense = Number(value.toFixed(2));
      const percentOfExpenses =
        totalExpense > 0 ? Number(((expense / totalExpense) * 100).toFixed(1)) : null;
      return {
        key,
        name: key === "uncategorized" ? "Sem categoria" : catName.get(key) ?? "Sem categoria",
        expense,
        percentOfExpenses: percentOfExpenses !== null && Number.isFinite(percentOfExpenses) ? percentOfExpenses : null,
      } satisfies CategoryRow;
    });

    rows.sort((a, b) => b.expense - a.expense);
    const top = rows.slice(0, 8);

    const topExpense = Array.from(expenseBy.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
    const topExpenseName =
      topExpense?.[0] === "uncategorized"
        ? "Sem categoria"
        : topExpense
          ? catName.get(topExpense[0]) ?? "Sem categoria"
          : null;

    const topExpenseValue = topExpense ? Number(topExpense[1].toFixed(2)) : 0;
    const topExpensePercent =
      totalExpense > 0 ? Number(((topExpenseValue / totalExpense) * 100).toFixed(1)) : null;

    return { rows: top, totalExpense, topExpenseName, topExpenseValue, topExpensePercent };
  }, [categories.data, transactions.data]);

  const insights = useMemo(() => {
    if (economy === null || summary.isLoading || summary.error) return [];
    const items: Array<{ key: string; tone: "positive" | "negative" | "info"; text: string }> = [];

    if (economy > -10 && economy < 10) {
      items.push({ key: "econ-breakeven", tone: "info", text: "Você está no ponto de equilíbrio aqui" });
    } else if (economy < 0) {
      items.push({
        key: "econ-negative",
        tone: "negative",
        text: `Você gastou ${formatBRL(Math.abs(economy))} a mais do que ganhou`,
      });
    } else {
      items.push({ key: "econ-positive", tone: "positive", text: `Você economizou ${formatBRL(Math.abs(economy))} aqui` });
    }

    if (savingRatePercent !== null) {
      if (savingRatePercent >= 30) {
        items.push({
          key: "rate-excellent",
          tone: "positive",
          text: `Você guardou bastante: ${savingRatePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% do que ganhou`,
        });
      } else if (savingRatePercent >= 20) {
        items.push({
          key: "rate-strong",
          tone: "positive",
          text: `Você está guardando bem: ${savingRatePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% do que ganhou`,
        });
      } else if (savingRatePercent > 0 && savingRatePercent < 10) {
        items.push({
          key: "rate-low",
          tone: "info",
          text: `Você está guardando pouco (${savingRatePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%). Pequenos ajustes podem fazer diferença.`,
        });
      }
    }

    if (comparison) {
      const abs = Math.abs(comparison.delta);
      if (abs >= 10) {
        items.push({
          key: "comparison",
          tone: comparison.delta > 0 ? "positive" : comparison.delta < 0 ? "negative" : "info",
          text: comparison.delta > 0 ? `Você melhorou em ${formatBRL(abs)} comparando com antes` : `Você piorou em ${formatBRL(abs)} comparando com antes`,
        });
      }
    }

    if (!categories.isLoading && !categories.error && distribution.topExpenseName && distribution.topExpenseValue > 0) {
      items.push({
        key: "top-expense",
        tone: distribution.topExpensePercent !== null && distribution.topExpensePercent >= 40 ? "negative" : "info",
        text:
          `Você mais gastou em: ${distribution.topExpenseName} (${formatBRL(distribution.topExpenseValue)})` +
          (distribution.topExpensePercent !== null ? ` • ${distribution.topExpensePercent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% das despesas` : ""),
      });
    }

    return items.slice(0, 4);
  }, [
    economy,
    savingRatePercent,
    comparison,
    summary.isLoading,
    summary.error,
    categories.isLoading,
    categories.error,
    distribution.topExpenseName,
    distribution.topExpenseValue,
    distribution.topExpensePercent,
  ]);

  const filterLabels: Record<PeriodPreset, string> = useMemo(() => {
    return {
      today: "Diário",
      "7d": "Semanal",
      "30d": PERIOD_PRESET_LABELS["30d"],
      month: "Mensal",
      year: "Anual",
      custom: "Personalizado",
    };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.22),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(56,189,248,0.2),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <h2 className="text-3xl font-semibold tracking-tight">Economias</h2>
          <p className="mt-2 text-slate-600 dark:text-white/70">Central de análise do que sobrou do que você ganhou.</p>
          <div className="mt-2 text-sm text-slate-600 dark:text-white/60">Você está vendo: {periodHint}</div>
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
                <span className="flex flex-1 text-left">{filterLabels[periodPreset]}</span>
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
                    Calendário
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
                    if (range?.from && range?.to) setIsCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Economia</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <PiggyBank className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={
                "text-3xl font-bold tracking-tight tabular-nums " +
                (economy !== null && economy > 10
                  ? "text-emerald-500"
                  : economy !== null && economy < -10
                    ? "text-destructive"
                    : "text-muted-foreground")
              }
            >
              {summary.isLoading ? <Skeleton className="h-9 w-36" /> : formatBRL(economy ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {economyNarrative ? economyNarrative.text : summary.isLoading ? "Carregando..." : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Horas de vida</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Timer className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums">
              {summary.isLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : economyHoursValue === null ? (
                "—"
              ) : (
                economyHoursValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.isLoading || economy === null
                ? "Carregando..."
                : !hourlyRate
                  ? "Defina seu valor/hora em Configurações para ver este indicador"
                  : economyHoursNarrative ?? ""}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Taxa de economia</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Percent className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums">
              {summary.isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : savingRatePercent === null ? (
                "—"
              ) : (
                savingRatePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Quanto sobrou do que você ganhou</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Comparação</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={
                "text-3xl font-bold tracking-tight tabular-nums " +
                (comparison
                  ? comparison.delta > 0
                    ? "text-emerald-500"
                    : comparison.delta < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                  : "")
              }
            >
              {summary.isLoading ? (
                <Skeleton className="h-9 w-36" />
              ) : !comparison ? (
                "—"
              ) : comparison.delta === 0 ? (
                formatBRL(0)
              ) : comparison.delta > 0 ? (
                "+" + formatBRL(Math.abs(comparison.delta))
              ) : (
                "-" + formatBRL(Math.abs(comparison.delta))
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.isLoading || !comparison
                ? "Comparando com antes"
                : comparison.pct === null
                  ? "Comparando com antes"
                  : `${Math.abs(comparison.pct).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% ${comparison.pct >= 0 ? "a mais" : "a menos"} vs anterior`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base">Evolução da economia</CardTitle>
              <p className="text-xs text-muted-foreground">Quanto foi sobrando ao longo do que você escolheu ver</p>
            </div>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {transactions.isLoading ? (
              <div className="h-[220px] rounded-2xl border bg-card/18 p-4">
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            ) : !evolution ? (
              <div className="rounded-2xl border bg-card/18 px-3 py-3 text-sm text-muted-foreground">
                Você ainda precisa de mais movimentações aqui para ver a evolução.
              </div>
            ) : (
              <div className="h-[220px] w-full min-w-0 rounded-2xl border bg-card/18 px-3 py-3">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                    <LineChart data={evolution} margin={{ top: 10, right: 14, left: 14, bottom: 6 }}>
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="currentColor" />
                      <YAxis hide domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]} />
                      <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" strokeWidth={1.5} />
                      <Tooltip
                        cursor={{ fill: "rgba(148,163,184,0.12)" }}
                        formatter={(value) => formatBRL(Number(value))}
                        labelFormatter={(label) => String(label)}
                      />
                      <Line
                        type="monotone"
                        dataKey="accumulated"
                        strokeWidth={3}
                        dot={false}
                        stroke={evolutionStroke}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: evolutionStroke }}
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Insights para você</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Lightbulb className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary.isLoading || categories.isLoading || transactions.isLoading) && (
              <>
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-4 w-2/3" />
              </>
            )}
            {!summary.isLoading && !transactions.isLoading && insights.length === 0 && (
              <div className="text-sm text-muted-foreground">Você ainda não tem insights suficientes aqui.</div>
            )}
            {!summary.isLoading && !transactions.isLoading && insights.length > 0 && (
              <div className="space-y-2">
                {insights.map((i) => (
                  <div
                    key={i.key}
                    className={
                      "rounded-2xl border px-3 py-2.5 text-sm " +
                      (i.tone === "positive"
                        ? "border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-400/10"
                        : i.tone === "negative"
                          ? "border-rose-500/20 bg-rose-500/5 dark:border-rose-400/20 dark:bg-rose-400/10"
                          : "border-blue-500/20 bg-blue-500/5 dark:border-sky-400/20 dark:bg-sky-400/10")
                    }
                  >
                    {i.text}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
            <p className="text-xs text-muted-foreground">Distribuição das suas despesas aqui</p>
          </div>
          <ArrowDownRight className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.isLoading || categories.isLoading ? (
            <div className="h-[260px] rounded-2xl border bg-card/18 p-4">
              <Skeleton className="h-4 w-1/3" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-10/12" />
              </div>
            </div>
          ) : distribution.rows.length === 0 ? (
            <div className="rounded-2xl border bg-card/18 px-3 py-3 text-sm text-muted-foreground">
              Registre despesas para ver a distribuição por categoria.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-[260px] w-full min-w-0 rounded-2xl border bg-card/18 px-3 py-3">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                    <BarChart data={distribution.rows} layout="vertical" margin={{ top: 6, right: 14, left: 18, bottom: 6 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} content={<DistributionTooltip />} />
                      <Bar dataKey="expense" radius={[10, 10, 10, 10]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                        {distribution.rows.map((r) => (
                          <Cell key={r.key} fill="rgba(244,63,94,0.85)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-5">Categoria</div>
                  <div className="col-span-4 text-right">Você gastou</div>
                  <div className="col-span-3 text-right">%</div>
                </div>
                <div className="mt-2 space-y-2">
                  {distribution.rows.map((r) => (
                    <div key={r.key} className="grid grid-cols-12 gap-2 text-sm items-center">
                      <div className="col-span-5 font-medium truncate">{r.name}</div>
                      <div className="col-span-4 text-right tabular-nums font-semibold text-destructive">
                        {formatBRL(r.expense)}
                      </div>
                      <div className="col-span-3 text-right tabular-nums text-muted-foreground">
                        {r.percentOfExpenses === null ? "—" : r.percentOfExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
