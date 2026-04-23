"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  BarChart3,
  CalendarIcon,
  Lightbulb,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ExpensesByCategoryChart } from "@/components/dashboard/ExpensesByCategoryChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/auth/useProfile";
import { useCategories } from "@/hooks/financial/useCategories";
import { useFinancialSummary } from "@/hooks/financial/useFinancialSummary";
import { useInvestmentEntries } from "@/hooks/financial/useInvestmentEntries";
import { useReserveEntries } from "@/hooks/financial/useReserveEntries";
import { useTransactions } from "@/hooks/financial/useTransactions";
import { useHasMounted } from "@/hooks/useHasMounted";
import { formatBRL } from "@/lib/currency";
import { formatDateOnly } from "@/lib/date";
import { buildEvolutionPoints } from "@/lib/financial-evolution";
import { computeInvestmentDistribution } from "@/lib/investment-distribution";
import { formatPeriodHint, getPresetRange, startOfDay, type PeriodPreset } from "@/lib/period";

type CompareBarPoint = {
  name: string;
  atual: number;
  anterior: number;
};

type GlobalEvolutionPoint = {
  rawDate: string;
  label: string;
  balance: number;
  patrimony: number;
  prevBalance?: number | null;
  prevPatrimony?: number | null;
};

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

function getPreviousRange(preset: PeriodPreset, range: { from: Date; to: Date }) {
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);

  if (preset === "today") {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
    const prev = startOfDay(d);
    return { from: prev, to: prev };
  }

  if (preset === "7d") {
    const prevTo = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
    const prevFrom = new Date(prevTo.getFullYear(), prevTo.getMonth(), prevTo.getDate() - 6);
    return { from: startOfDay(prevFrom), to: startOfDay(prevTo) };
  }

  if (preset === "month") {
    const prevMonthStart = new Date(from.getFullYear(), from.getMonth() - 1, 1);
    const prevMonthEnd = new Date(from.getFullYear(), from.getMonth(), 0);
    return { from: startOfDay(prevMonthStart), to: startOfDay(prevMonthEnd) };
  }

  if (preset === "year") {
    const y = from.getFullYear() - 1;
    return { from: startOfDay(new Date(y, 0, 1)), to: startOfDay(new Date(y, 11, 31)) };
  }

  const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (!Number.isFinite(days) || days <= 0) return null;
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return { from: startOfDay(prevFrom), to: startOfDay(prevTo) };
}

function enumerateDays(from: Date, to: Date) {
  const out: string[] = [];
  const start = startOfDay(from);
  const end = startOfDay(to);
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor.getTime() <= end.getTime()) {
    out.push(formatDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatShortBRDate(rawDate: string) {
  const [, m, d] = rawDate.split("-");
  if (!m || !d) return rawDate;
  return `${d}/${m}`;
}

function formatLongBRDate(rawDate: string) {
  const [y, m, d] = rawDate.split("-");
  if (!y || !m || !d) return rawDate;
  return `${d}/${m}/${y}`;
}

function EvolutionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: GlobalEvolutionPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/85">
      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{formatLongBRDate(p.rawDate)}</div>
      <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Saldo acumulado (agora):{" "}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatBRL(p.balance)}</span>
        </div>
        {typeof p.prevBalance === "number" && (
          <div>
            Saldo acumulado (antes):{" "}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatBRL(p.prevBalance)}</span>
          </div>
        )}
        <div>
          Patrimônio (agora):{" "}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatBRL(p.patrimony)}</span>
        </div>
        {typeof p.prevPatrimony === "number" && (
          <div>
            Patrimônio (antes):{" "}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatBRL(p.prevPatrimony)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function InvestmentsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { name: string; value: number; percent: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/85">
      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{p.name}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {formatBRL(p.value)} ({p.percent.toFixed(1)}%)
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const mounted = useHasMounted();
  const profile = useProfile();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });

  const filterRange = useMemo(() => {
    if (periodPreset !== "custom") {
      const r = getPresetRange(periodPreset);
      if (r.from && r.to) return { from: r.from, to: r.to };
      return null;
    }
    if (dateRange?.from && dateRange?.to) {
      const from = startOfDay(dateRange.from);
      const to = startOfDay(dateRange.to);
      if (from.getTime() > to.getTime()) return null;
      return { from, to };
    }
    return null;
  }, [periodPreset, dateRange]);

  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  const previousRange = useMemo(() => {
    if (!filterRange) return null;
    return getPreviousRange(periodPreset, filterRange);
  }, [filterRange, periodPreset]);

  const summary = useFinancialSummary(filterRange ? { from: filterRange.from, to: filterRange.to } : {});
  const previousSummary = useFinancialSummary(previousRange ? { from: previousRange.from, to: previousRange.to } : {});

  const transactions = useTransactions({ from: filterRange?.from, to: filterRange?.to });
  const previousTransactions = useTransactions(
    { from: previousRange?.from, to: previousRange?.to },
    { enabled: Boolean(previousRange) }
  );
  const categories = useCategories();

  const reserveEntries = useReserveEntries({ from: filterRange?.from, to: filterRange?.to }, { enabled: Boolean(filterRange) });
  const reservePreviousEntries = useReserveEntries({ from: previousRange?.from, to: previousRange?.to }, { enabled: Boolean(previousRange) });

  const investmentEntries = useInvestmentEntries({ from: filterRange?.from, to: filterRange?.to }, { enabled: Boolean(filterRange) });
  const investmentPreviousEntries = useInvestmentEntries({ from: previousRange?.from, to: previousRange?.to }, { enabled: Boolean(previousRange) });

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

  const previousEconomy = useMemo(() => {
    if (!previousRange) return null;
    if (previousSummary.isLoading || previousSummary.error) return null;
    const income = Number(previousSummary.data?.incomeTotal ?? 0);
    const expense = Number(previousSummary.data?.expenseTotal ?? 0);
    if (!Number.isFinite(income) || !Number.isFinite(expense)) return null;
    return Number((income - expense).toFixed(2));
  }, [previousRange, previousSummary.isLoading, previousSummary.error, previousSummary.data?.incomeTotal, previousSummary.data?.expenseTotal]);

  const economyDelta = useMemo(() => {
    if (!previousRange) return null;
    if (economy === null || previousEconomy === null) return null;
    const d = economy - previousEconomy;
    if (!Number.isFinite(d)) return null;
    return Number(d.toFixed(2));
  }, [previousRange, economy, previousEconomy]);

  const savingRatePercent = useMemo(() => {
    if (economy === null) return null;
    const income = Number(summary.data?.incomeTotal ?? 0);
    if (!Number.isFinite(income) || income <= 0) return null;
    const pct = (economy / income) * 100;
    if (!Number.isFinite(pct)) return null;
    return Number(pct.toFixed(2));
  }, [economy, summary.data?.incomeTotal]);

  const reserveTotal = useMemo(() => sumValues(reserveEntries.data), [reserveEntries.data]);
  const reservePrevTotal = useMemo(() => sumValues(reservePreviousEntries.data), [reservePreviousEntries.data]);

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

  const investmentPrevCurrentTotal = useMemo(() => {
    let total = 0;
    for (const e of investmentPreviousEntries.data ?? []) {
      const invested = Number(e.value ?? 0);
      if (!Number.isFinite(invested) || invested <= 0) continue;
      const current = e.current_value === null || e.current_value === undefined ? invested : Number(e.current_value);
      total += Number.isFinite(current) ? current : invested;
    }
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [investmentPreviousEntries.data]);

  const investmentsDeltaFromPrev = useMemo(() => {
    if (!previousRange) return null;
    const diff = investmentCurrentTotal - investmentPrevCurrentTotal;
    if (!Number.isFinite(diff)) return null;
    return Number(diff.toFixed(2));
  }, [investmentCurrentTotal, investmentPrevCurrentTotal, previousRange]);

  const balance = useMemo(() => {
    const b = Number(summary.data?.balance ?? 0);
    if (!Number.isFinite(b)) return 0;
    return Number(b.toFixed(2));
  }, [summary.data?.balance]);

  const prevBalance = useMemo(() => {
    if (!previousRange) return null;
    const b = Number(previousSummary.data?.balance ?? 0);
    if (!Number.isFinite(b)) return 0;
    return Number(b.toFixed(2));
  }, [previousRange, previousSummary.data?.balance]);

  const patrimonyTotal = useMemo(() => {
    const sum = balance + reserveTotal + investmentCurrentTotal;
    if (!Number.isFinite(sum)) return 0;
    return Number(sum.toFixed(2));
  }, [balance, reserveTotal, investmentCurrentTotal]);

  const prevPatrimonyTotal = useMemo(() => {
    if (!previousRange) return null;
    const prev = (prevBalance ?? 0) + reservePrevTotal + investmentPrevCurrentTotal;
    if (!Number.isFinite(prev)) return 0;
    return Number(prev.toFixed(2));
  }, [previousRange, prevBalance, reservePrevTotal, investmentPrevCurrentTotal]);

  const patrimonyDelta = useMemo(() => {
    if (!previousRange) return null;
    if (prevPatrimonyTotal === null) return null;
    const d = patrimonyTotal - prevPatrimonyTotal;
    if (!Number.isFinite(d)) return null;
    return Number(d.toFixed(2));
  }, [previousRange, patrimonyTotal, prevPatrimonyTotal]);

  const patrimonyLifeHours = useMemo(() => {
    if (!hourlyRate) return null;
    const h = patrimonyTotal / hourlyRate;
    if (!Number.isFinite(h) || h < 0) return null;
    return Number(h.toFixed(2));
  }, [hourlyRate, patrimonyTotal]);

  const evolutionCurrentSeries = useMemo(() => {
    if (!filterRange) return null;
    const txPoints = buildEvolutionPoints(transactions.data ?? []);
    const balanceByDate = new Map<string, number>();
    for (const p of txPoints) {
      balanceByDate.set(p.rawDate, Number.isFinite(p.accumulated) ? Number(p.accumulated.toFixed(2)) : 0);
    }

    const reserveByDate = new Map<string, number>();
    for (const r of reserveEntries.data ?? []) {
      const date = String((r as { date?: unknown }).date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const v = Number((r as { value?: unknown }).value ?? 0);
      if (!Number.isFinite(v)) continue;
      reserveByDate.set(date, (reserveByDate.get(date) ?? 0) + v);
    }

    const investByDate = new Map<string, number>();
    for (const e of investmentEntries.data ?? []) {
      const date = String((e as { date?: unknown }).date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const invested = Number((e as { value?: unknown }).value ?? 0);
      if (!Number.isFinite(invested) || invested <= 0) continue;
      const currentRaw = (e as { current_value?: unknown }).current_value;
      const current = currentRaw === null || currentRaw === undefined ? invested : Number(currentRaw);
      investByDate.set(date, (investByDate.get(date) ?? 0) + (Number.isFinite(current) ? current : invested));
    }

    const days = enumerateDays(filterRange.from, filterRange.to);
    const series = days.reduce(
      (state, rawDate) => {
        const nextBalance = balanceByDate.has(rawDate) ? (balanceByDate.get(rawDate) ?? state.balance) : state.balance;
        const nextReserve = state.reserve + (reserveByDate.get(rawDate) ?? 0);
        const nextInvest = state.invest + (investByDate.get(rawDate) ?? 0);
        const patrimony = nextBalance + nextReserve + nextInvest;
        const nextPoint: GlobalEvolutionPoint = {
          rawDate,
          label: formatShortBRDate(rawDate),
          balance: Number((Number.isFinite(nextBalance) ? nextBalance : 0).toFixed(2)),
          patrimony: Number((Number.isFinite(patrimony) ? patrimony : 0).toFixed(2)),
        };
        return {
          balance: nextBalance,
          reserve: nextReserve,
          invest: nextInvest,
          points: state.points.concat([nextPoint]),
        };
      },
      {
        balance: 0,
        reserve: 0,
        invest: 0,
        points: [] as Array<{ rawDate: string; label: string; balance: number; patrimony: number }>,
      }
    ).points;
    if (series.length < 2) return null;
    return series;
  }, [filterRange, transactions.data, reserveEntries.data, investmentEntries.data]);

  const evolutionPreviousSeries = useMemo(() => {
    if (!previousRange) return null;
    const txPoints = buildEvolutionPoints(previousTransactions.data ?? []);
    const balanceByDate = new Map<string, number>();
    for (const p of txPoints) {
      balanceByDate.set(p.rawDate, Number.isFinite(p.accumulated) ? Number(p.accumulated.toFixed(2)) : 0);
    }

    const reserveByDate = new Map<string, number>();
    for (const r of reservePreviousEntries.data ?? []) {
      const date = String((r as { date?: unknown }).date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const v = Number((r as { value?: unknown }).value ?? 0);
      if (!Number.isFinite(v)) continue;
      reserveByDate.set(date, (reserveByDate.get(date) ?? 0) + v);
    }

    const investByDate = new Map<string, number>();
    for (const e of investmentPreviousEntries.data ?? []) {
      const date = String((e as { date?: unknown }).date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const invested = Number((e as { value?: unknown }).value ?? 0);
      if (!Number.isFinite(invested) || invested <= 0) continue;
      const currentRaw = (e as { current_value?: unknown }).current_value;
      const current = currentRaw === null || currentRaw === undefined ? invested : Number(currentRaw);
      investByDate.set(date, (investByDate.get(date) ?? 0) + (Number.isFinite(current) ? current : invested));
    }

    const days = enumerateDays(previousRange.from, previousRange.to);
    const series = days.reduce(
      (state, rawDate) => {
        const nextBalance = balanceByDate.has(rawDate) ? (balanceByDate.get(rawDate) ?? state.balance) : state.balance;
        const nextReserve = state.reserve + (reserveByDate.get(rawDate) ?? 0);
        const nextInvest = state.invest + (investByDate.get(rawDate) ?? 0);
        const patrimony = nextBalance + nextReserve + nextInvest;
        const nextPoint: GlobalEvolutionPoint = {
          rawDate,
          label: formatShortBRDate(rawDate),
          balance: Number((Number.isFinite(nextBalance) ? nextBalance : 0).toFixed(2)),
          patrimony: Number((Number.isFinite(patrimony) ? patrimony : 0).toFixed(2)),
        };
        return {
          balance: nextBalance,
          reserve: nextReserve,
          invest: nextInvest,
          points: state.points.concat([nextPoint]),
        };
      },
      {
        balance: 0,
        reserve: 0,
        invest: 0,
        points: [] as Array<{ rawDate: string; label: string; balance: number; patrimony: number }>,
      }
    ).points;
    if (series.length < 2) return null;
    return series;
  }, [previousRange, previousTransactions.data, reservePreviousEntries.data, investmentPreviousEntries.data]);

  const evolutionSeries = useMemo(() => {
    if (!evolutionCurrentSeries) return null;
    if (!evolutionPreviousSeries) return evolutionCurrentSeries;

    const limit = Math.min(evolutionCurrentSeries.length, evolutionPreviousSeries.length);
    return evolutionCurrentSeries.map((p, idx) => {
      if (idx >= limit) return { ...p, prevBalance: null, prevPatrimony: null } satisfies GlobalEvolutionPoint;
      const prev = evolutionPreviousSeries[idx];
      return {
        ...p,
        prevBalance: typeof prev?.balance === "number" ? prev.balance : null,
        prevPatrimony: typeof prev?.patrimony === "number" ? prev.patrimony : null,
      } satisfies GlobalEvolutionPoint;
    });
  }, [evolutionCurrentSeries, evolutionPreviousSeries]);

  const evolutionHeadline = useMemo(() => {
    if (patrimonyDelta === null) return null;
    const abs = Math.abs(patrimonyDelta);
    if (abs < 10) return { tone: "info" as const, text: `Você ficou estável aqui (${formatBRL(patrimonyTotal)}).` };
    if (patrimonyDelta > 0) return { tone: "positive" as const, text: `Você cresceu ${formatBRL(abs)} aqui. Agora você tem ${formatBRL(patrimonyTotal)}.` };
    return { tone: "negative" as const, text: `Você caiu ${formatBRL(abs)} aqui. Agora você tem ${formatBRL(patrimonyTotal)}.` };
  }, [patrimonyDelta, patrimonyTotal]);

  const patrimonyPeaks = useMemo(() => {
    if (!evolutionCurrentSeries || evolutionCurrentSeries.length < 2) return null;
    let bestUp: { date: string; value: number } | null = null;
    let bestDown: { date: string; value: number } | null = null;
    for (let i = 1; i < evolutionCurrentSeries.length; i += 1) {
      const prev = evolutionCurrentSeries[i - 1];
      const cur = evolutionCurrentSeries[i];
      const delta = Number(cur.patrimony) - Number(prev.patrimony);
      if (!Number.isFinite(delta)) continue;
      if (!bestUp || delta > bestUp.value) bestUp = { date: cur.rawDate, value: Number(delta.toFixed(2)) };
      if (!bestDown || delta < bestDown.value) bestDown = { date: cur.rawDate, value: Number(delta.toFixed(2)) };
    }
    if (!bestUp || !bestDown) return null;
    return { up: bestUp, down: bestDown };
  }, [evolutionCurrentSeries]);

  const patrimonyProjection = useMemo(() => {
    if (!evolutionCurrentSeries || evolutionCurrentSeries.length < 3) return null;
    const last = evolutionCurrentSeries[evolutionCurrentSeries.length - 1];
    const diffs: number[] = [];
    for (let i = Math.max(1, evolutionCurrentSeries.length - 7); i < evolutionCurrentSeries.length; i += 1) {
      const prev = evolutionCurrentSeries[i - 1];
      const cur = evolutionCurrentSeries[i];
      const delta = Number(cur.patrimony) - Number(prev.patrimony);
      if (!Number.isFinite(delta)) continue;
      diffs.push(delta);
    }
    if (diffs.length === 0) return null;
    const avg = diffs.reduce((acc, v) => acc + v, 0) / diffs.length;
    if (!Number.isFinite(avg)) return null;
    const days = 7;
    const projected = Number(last.patrimony) + avg * days;
    if (!Number.isFinite(projected)) return null;
    return {
      avgDaily: Number(avg.toFixed(2)),
      days,
      projected: Number(projected.toFixed(2)),
    };
  }, [evolutionCurrentSeries]);

  const investmentsDistribution = useMemo(() => computeInvestmentDistribution(investmentEntries.data), [investmentEntries.data]);

  const compareBars = useMemo<CompareBarPoint[] | null>(() => {
    if (!previousRange) return null;
    if (summary.isLoading || summary.error || previousSummary.isLoading || previousSummary.error) return null;
    const income = Number(summary.data?.incomeTotal ?? 0);
    const expense = Number(summary.data?.expenseTotal ?? 0);
    const prevIncome = Number(previousSummary.data?.incomeTotal ?? 0);
    const prevExpense = Number(previousSummary.data?.expenseTotal ?? 0);
    const econ = Number((income - expense).toFixed(2));
    const prevEcon = Number((prevIncome - prevExpense).toFixed(2));
    if (![income, expense, prevIncome, prevExpense, econ, prevEcon].every((n) => Number.isFinite(n))) return null;
    return [
      { name: "Receitas", atual: Number(income.toFixed(2)), anterior: Number(prevIncome.toFixed(2)) },
      { name: "Despesas", atual: Number(expense.toFixed(2)), anterior: Number(prevExpense.toFixed(2)) },
      { name: "Economia", atual: econ, anterior: prevEcon },
    ];
  }, [
    previousRange,
    summary.isLoading,
    summary.error,
    summary.data?.incomeTotal,
    summary.data?.expenseTotal,
    previousSummary.isLoading,
    previousSummary.error,
    previousSummary.data?.incomeTotal,
    previousSummary.data?.expenseTotal,
  ]);

  const insights = useMemo(() => {
    const items: Array<{ key: string; tone: "positive" | "negative" | "info"; text: string; icon: "up" | "down" | "info" }> = [];
    if (economy !== null) {
      if (economy > 0 && (economyDelta ?? 0) >= 0) {
        items.push({ key: "improving", tone: "positive", icon: "up", text: "Você está melhorando financeiramente" });
      } else if (economy < 0) {
        items.push({ key: "negative", tone: "negative", icon: "down", text: "Você está gastando mais do que ganha" });
      }
    }

    if (previousRange && !summary.isLoading && !previousSummary.isLoading && !summary.error && !previousSummary.error) {
      const expense = Number(summary.data?.expenseTotal ?? 0);
      const prevExpense = Number(previousSummary.data?.expenseTotal ?? 0);
      if (Number.isFinite(expense) && Number.isFinite(prevExpense) && prevExpense > 0) {
        const pct = ((expense - prevExpense) / prevExpense) * 100;
        if (Number.isFinite(pct) && pct >= 10) {
          items.push({ key: "spending-up", tone: "negative", icon: "down", text: "Você está gastando mais do que antes" });
        }
      }
    }

    if (investmentsDeltaFromPrev !== null) {
      if (investmentsDeltaFromPrev > 0)
        items.push({ key: "invest-up", tone: "positive", icon: "up", text: "Você está vendo seus investimentos crescerem aqui" });
      else if (investmentsDeltaFromPrev < 0)
        items.push({ key: "invest-down", tone: "info", icon: "info", text: "Você está vendo seus investimentos caírem comparando com antes" });
    }

    if (savingRatePercent !== null && savingRatePercent >= 30) {
      items.push({ key: "high-saving", tone: "positive", icon: "up", text: "Você está guardando uma boa parte do que ganha" });
    }

    if (!summary.isLoading && !summary.error) {
      const income = Number(summary.data?.incomeTotal ?? 0);
      const expense = Number(summary.data?.expenseTotal ?? 0);
      if (Number.isFinite(income) && income > 0 && Number.isFinite(expense)) {
        const pct = (expense / income) * 100;
        if (Number.isFinite(pct) && pct >= 90) {
          items.push({ key: "cross-expense-economy", tone: "negative", icon: "down", text: "Você está gastando quase tudo o que ganha aqui" });
        }
      }
    }

    if (patrimonyTotal > 0) {
      const share = (investmentCurrentTotal / patrimonyTotal) * 100;
      if (Number.isFinite(share) && share >= 50) {
        items.push({ key: "cross-invest-patrimony", tone: "info", icon: "info", text: "Você tem uma boa parte do seu total em investimentos" });
      } else if (Number.isFinite(share) && share > 0 && share < 15) {
        items.push({ key: "cross-invest-low", tone: "info", icon: "info", text: "Você está com mais reserva e saldo do que investimentos agora" });
      }
    }

    return items.slice(0, 4);
  }, [
    economy,
    economyDelta,
    previousRange,
    summary.isLoading,
    summary.error,
    summary.data?.expenseTotal,
    summary.data?.incomeTotal,
    previousSummary.isLoading,
    previousSummary.error,
    previousSummary.data?.expenseTotal,
    investmentsDeltaFromPrev,
    savingRatePercent,
    patrimonyTotal,
    investmentCurrentTotal,
  ]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(59,130,246,0.14),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.2),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(139,92,246,0.2),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <h2 className="text-3xl font-semibold tracking-tight">Você entende seus números</h2>
          <p className="mt-2 text-slate-600 dark:text-white/70">Você usa esta tela para enxergar tendências com clareza</p>
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
                <span className="flex flex-1 text-left">
                  {periodPreset === "today"
                    ? "Diário"
                    : periodPreset === "7d"
                      ? "Semanal"
                      : periodPreset === "month"
                        ? "Mensal"
                        : periodPreset === "year"
                          ? "Anual"
                          : "Personalizado"}
                </span>
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
              {economy !== null && economy < 0 ? <TrendingDown className="size-4 text-muted-foreground" /> : <TrendingUp className="size-4 text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className={"text-3xl font-bold tracking-tight tabular-nums " + (economy !== null && economy < 0 ? "text-destructive" : "text-emerald-500")}>
              {summary.isLoading ? <Skeleton className="h-9 w-32" /> : formatBRL(economy ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {economyDelta === null
                ? "O que sobrou do que você ganhou"
                : `Comparando com antes: ${economyDelta >= 0 ? "+" : "-"}${formatBRL(Math.abs(economyDelta))}`}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Patrimônio</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <LineChartIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums">{summary.isLoading ? <Skeleton className="h-9 w-32" /> : formatBRL(patrimonyTotal)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {patrimonyDelta === null
                ? "Seu saldo + sua reserva + seus investimentos"
                : `Comparando com antes: ${patrimonyDelta >= 0 ? "+" : "-"}${formatBRL(Math.abs(patrimonyDelta))}`}
            </p>
            {patrimonyLifeHours !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {patrimonyLifeHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} horas da sua vida
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Despesas</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <PieChartIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-destructive">
              {summary.isLoading ? <Skeleton className="h-9 w-32" /> : formatBRL(summary.data?.expenseTotal ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">O que você gastou aqui</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Investimentos</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums">{investmentEntries.isLoading ? <Skeleton className="h-9 w-32" /> : formatBRL(investmentCurrentTotal)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {investmentInvestedTotal > 0
                ? investmentCurrentTotal - investmentInvestedTotal >= 0
                  ? `Você ganhou ${formatBRL(investmentCurrentTotal - investmentInvestedTotal)}`
                  : `Você perdeu ${formatBRL(Math.abs(investmentCurrentTotal - investmentInvestedTotal))}`
                : "Você ainda não tem investimentos aqui"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base">Evolução global</CardTitle>
              <p className="text-xs text-muted-foreground">Como seu saldo e seu patrimônio foram mudando aqui</p>
              {evolutionHeadline && (
                <div
                  className={
                    "mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium " +
                    (evolutionHeadline.tone === "positive"
                      ? "border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-400/10"
                      : evolutionHeadline.tone === "negative"
                        ? "border-rose-500/20 bg-rose-500/5 dark:border-rose-400/20 dark:bg-rose-400/10"
                        : "border-blue-500/20 bg-blue-500/5 dark:border-sky-400/20 dark:bg-sky-400/10")
                  }
                >
                  {evolutionHeadline.text}
                </div>
              )}
            </div>
            <LineChartIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(transactions.isLoading || reserveEntries.isLoading || investmentEntries.isLoading) ? (
              <div className="h-[260px] rounded-2xl border bg-card/18 p-4">
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            ) : !evolutionSeries ? (
              <div className="rounded-2xl border bg-card/18 px-3 py-3 text-sm text-muted-foreground">
                Adicione dados para ver seus gráficos.
              </div>
            ) : (
              <div className="h-[260px] w-full min-w-0 rounded-2xl border bg-card/18 px-3 py-3">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                    <LineChart data={evolutionSeries} margin={{ top: 10, right: 14, left: 14, bottom: 6 }}>
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="currentColor" />
                      <YAxis hide domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]} />
                      <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" strokeWidth={1.5} />
                      <Tooltip cursor={{ stroke: "rgba(148,163,184,0.35)", strokeWidth: 1 }} content={<EvolutionTooltip />} />
                      <Line type="monotone" dataKey="prevBalance" strokeWidth={1.5} dot={false} stroke="rgba(37,99,235,0.35)" strokeDasharray="6 6" />
                      <Line type="monotone" dataKey="prevPatrimony" strokeWidth={2} dot={false} stroke="rgba(34,197,94,0.35)" strokeDasharray="6 6" />
                      <Line type="monotone" dataKey="balance" strokeWidth={2.5} dot={false} stroke="rgba(37,99,235,0.9)" />
                      <Line type="monotone" dataKey="patrimony" strokeWidth={3} dot={false} stroke="rgba(34,197,94,0.9)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {patrimonyPeaks && (
              <div className="mt-3 grid gap-2 rounded-2xl border bg-card/18 px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">Maior alta</div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-emerald-500">{formatBRL(patrimonyPeaks.up.value)}</div>
                    <div className="text-xs text-muted-foreground">{formatLongBRDate(patrimonyPeaks.up.date)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">Maior queda</div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-destructive">{formatBRL(patrimonyPeaks.down.value)}</div>
                    <div className="text-xs text-muted-foreground">{formatLongBRDate(patrimonyPeaks.down.date)}</div>
                  </div>
                </div>
                {patrimonyProjection && (
                  <div className="mt-1 rounded-xl border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                    Tendência simples: média de{" "}
                    <span className={patrimonyProjection.avgDaily >= 0 ? "font-semibold text-emerald-500" : "font-semibold text-destructive"}>
                      {formatBRL(patrimonyProjection.avgDaily)}
                    </span>{" "}
                    por dia. Projeção em {patrimonyProjection.days} dias:{" "}
                    <span className="font-semibold tabular-nums text-foreground">{formatBRL(patrimonyProjection.projected)}</span>.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Insights</CardTitle>
            <div className="size-9 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
              <Lightbulb className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary.isLoading || investmentEntries.isLoading) && (
              <>
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-4 w-2/3" />
              </>
            )}
            {!summary.isLoading && insights.length === 0 && (
              <div className="text-sm text-muted-foreground">Você ainda não tem insights suficientes aqui.</div>
            )}
            {!summary.isLoading && insights.length > 0 && (
              <div className="space-y-2">
                {insights.map((i) => (
                  <div
                    key={i.key}
                    className={
                      "flex items-start gap-3 rounded-2xl border px-3 py-2.5 text-sm " +
                      (i.tone === "positive"
                        ? "border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-400/10"
                        : i.tone === "negative"
                          ? "border-rose-500/20 bg-rose-500/5 dark:border-rose-400/20 dark:bg-rose-400/10"
                          : "border-blue-500/20 bg-blue-500/5 dark:border-sky-400/20 dark:bg-sky-400/10")
                    }
                  >
                    <div className="mt-0.5 size-9 shrink-0 rounded-2xl border bg-background/40 backdrop-blur-md flex items-center justify-center">
                      {i.icon === "up" ? <TrendingUp className="size-4 text-muted-foreground" /> : i.icon === "down" ? <TrendingDown className="size-4 text-muted-foreground" /> : <Lightbulb className="size-4 text-muted-foreground" />}
                    </div>
                    <div>{i.text}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base">Despesas por categoria</CardTitle>
              <p className="text-xs text-muted-foreground">Onde você mais gastou aqui</p>
            </div>
            <PieChartIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {transactions.isLoading || categories.isLoading ? (
              <div className="h-[240px] rounded-2xl border bg-card/18 p-4">
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            ) : (
              <ExpensesByCategoryChart transactions={transactions.data ?? []} categories={categories.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base">Investimentos por categoria</CardTitle>
              <p className="text-xs text-muted-foreground">Onde você colocou seu dinheiro aqui</p>
            </div>
            <PieChartIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {investmentEntries.isLoading ? (
              <div className="h-[240px] rounded-2xl border bg-card/18 p-4">
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            ) : investmentsDistribution.slices.length === 0 ? (
              <div className="rounded-2xl border bg-card/18 px-3 py-3 text-sm text-muted-foreground">
                Você ainda não tem investimentos aqui.
              </div>
            ) : (
              <div className="h-[240px] w-full min-w-0 rounded-2xl border bg-card/18 px-3 py-3">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                    <PieChart>
                      <Tooltip cursor={false} content={<InvestmentsTooltip />} />
                      <Pie
                        data={investmentsDistribution.slices}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={2}
                        stroke="rgba(15,23,42,0.05)"
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {investmentsDistribution.slices.map((s, idx) => (
                          <Cell
                            key={s.name + idx}
                            fill={["#2563eb", "#16a34a", "#db2777", "#7c3aed", "#dc2626", "#d97706", "#64748b"][idx % 7]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base">Comparando com antes</CardTitle>
            <p className="text-xs text-muted-foreground">O que entrou, o que saiu e o que sobrou</p>
          </div>
          <BarChart3 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {compareBars === null ? (
            <div className="rounded-2xl border bg-card/18 px-3 py-3 text-sm text-muted-foreground">
              Você precisa escolher um intervalo para comparar com antes.
            </div>
          ) : (
            <div className="h-[240px] w-full min-w-0 rounded-2xl border bg-card/18 px-3 py-3">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                  <BarChart data={compareBars} margin={{ top: 10, right: 14, left: 14, bottom: 6 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="currentColor" />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "rgba(148,163,184,0.12)" }}
                      formatter={(value) => formatBRL(Number(value))}
                    />
                    <Bar dataKey="anterior" name="Você antes" fill="rgba(148,163,184,0.6)" radius={[10, 10, 10, 10]} />
                    <Bar dataKey="atual" name="Você agora" fill="rgba(37,99,235,0.9)" radius={[10, 10, 10, 10]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
