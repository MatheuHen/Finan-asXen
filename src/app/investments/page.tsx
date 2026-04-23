"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useProfile } from "@/hooks/auth/useProfile";
import { useHasMounted } from "@/hooks/useHasMounted";
import {
  useCreateInvestmentEntry,
  useDeleteInvestmentEntry,
  useInvestmentEntries,
  useUpdateInvestmentEntry,
} from "@/hooks/financial/useInvestmentEntries";
import { formatBRL } from "@/lib/currency";
import { formatDateOnly, formatDateOnlyBR, normalizeDateOnlyToISO, parseDateOnly } from "@/lib/date";
import { computeInvestmentDistribution, type InvestmentDistributionSlice } from "@/lib/investment-distribution";
import { formatPeriodHint, getPresetRange, startOfDay, type PeriodPreset } from "@/lib/period";
import type { DateRange } from "react-day-picker";

const INVESTMENT_FILTER_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Diário" },
  { value: "7d", label: "Semanal" },
  { value: "month", label: "Mensal" },
  { value: "year", label: "Anual" },
  { value: "custom", label: "Personalizado" },
];

const INVESTMENT_CATEGORY_OPTIONS = ["Ações", "Cripto", "Renda fixa", "Fundos", "Outros"] as const;
type InvestmentCategory = (typeof INVESTMENT_CATEGORY_OPTIONS)[number];

const INVESTMENT_CATEGORY_LABEL: Record<InvestmentCategory, string> = {
  "Ações": "Renda variável",
  "Cripto": "Cripto",
  "Renda fixa": "Renda fixa",
  "Fundos": "Fundos",
  "Outros": "Outros",
};

type DistributionSlice = InvestmentDistributionSlice;

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DistributionSlice; value?: unknown }>;
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

  const days = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (!Number.isFinite(days) || days <= 0) return null;
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: startOfDay(prevFrom), to: startOfDay(prevTo) };
}

function compareEntriesDesc(a: { date: string; created_at: string; id: string }, b: { date: string; created_at: string; id: string }) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id.localeCompare(b.id);
}

function formatEntryDateBR(dateISO: string) {
  const parsed = parseDateOnly(dateISO);
  return parsed ? formatDateOnlyBR(parsed) : dateISO;
}

type ChartGranularity = "day" | "week" | "month" | "year";

function getChartGranularity(preset: PeriodPreset, range: { from: Date; to: Date } | null): ChartGranularity {
  if (preset === "today" || preset === "7d") return "day";
  if (preset === "month") return "day";
  if (preset === "year") return "month";
  if (!range) return "day";
  const days = Math.floor((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  if (days <= 730) return "month";
  return "year";
}

function weekStartMonday(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff));
}

export default function InvestmentsPage() {
  const profile = useProfile();
  const { theme } = useTheme();
  const mounted = useHasMounted();
  const createInvestmentEntry = useCreateInvestmentEntry();
  const updateInvestmentEntry = useUpdateInvestmentEntry();
  const deleteInvestmentEntry = useDeleteInvestmentEntry();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });
  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  const [entryCategory, setEntryCategory] = useState<InvestmentCategory | "">("");
  const [entryValue, setEntryValue] = useState<number | null>(null);
  const [entryCurrentValue, setEntryCurrentValue] = useState<number | null>(null);
  const [entryDateInput, setEntryDateInput] = useState(() => formatDateOnly(startOfDay(new Date())));
  const [entryMessage, setEntryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<InvestmentCategory | "">("");
  const [editingValue, setEditingValue] = useState<number | null>(null);
  const [editingCurrentValue, setEditingCurrentValue] = useState<number | null>(null);
  const [editingDateInput, setEditingDateInput] = useState("");

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

  const previousRange = useMemo(() => {
    if (!filterRange) return null;
    return getPreviousRange(periodPreset, filterRange);
  }, [filterRange, periodPreset]);

  const investments = useInvestmentEntries({}, { enabled: true });
  const allEntries = useMemo(() => investments.data ?? [], [investments.data]);

  const filteredEntries = useMemo(() => {
    if (!filterRange) return [];
    const fromKey = formatDateOnly(filterRange.from);
    const toKey = formatDateOnly(filterRange.to);
    return allEntries.filter((e) => e.date >= fromKey && e.date <= toKey);
  }, [allEntries, filterRange]);

  const investedTotal = useMemo(() => {
    let total = 0;
    for (const entry of filteredEntries) total += Number(entry.value ?? 0);
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [filteredEntries]);

  const currentTotal = useMemo(() => {
    let total = 0;
    for (const entry of filteredEntries) {
      const invested = Number(entry.value ?? 0);
      const current = entry.current_value === null || entry.current_value === undefined ? invested : Number(entry.current_value);
      total += Number.isFinite(current) ? current : invested;
    }
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [filteredEntries]);

  const profit = useMemo(() => {
    const diff = currentTotal - investedTotal;
    if (!Number.isFinite(diff)) return 0;
    return Number(diff.toFixed(2));
  }, [currentTotal, investedTotal]);

  const profitability = useMemo(() => {
    if (investedTotal <= 0) return null;
    const percent = (profit / investedTotal) * 100;
    if (!Number.isFinite(percent)) return null;
    return Number(percent.toFixed(2));
  }, [investedTotal, profit]);

  const hourlyRate = useMemo(() => {
    const raw = profile.data?.hourly_rate;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [profile.data?.hourly_rate]);

  const protectedHours = useMemo(() => {
    if (!hourlyRate) return null;
    const hours = currentTotal / hourlyRate;
    if (!Number.isFinite(hours) || hours < 0) return null;
    return Number(hours.toFixed(2));
  }, [currentTotal, hourlyRate]);

  const profitLifeHours = useMemo(() => {
    if (!hourlyRate) return null;
    if (!Number.isFinite(profit) || profit === 0) return null;
    const hours = profit / hourlyRate;
    if (!Number.isFinite(hours) || hours === 0) return null;
    return Number(hours.toFixed(2));
  }, [hourlyRate, profit]);

  const hasNoProfitVariation = useMemo(() => {
    if (investments.isLoading) return false;
    if (filteredEntries.length === 0) return false;
    return Number.isFinite(profit) && profit === 0;
  }, [filteredEntries.length, investments.isLoading, profit]);

  const previousEntries = useMemo(() => {
    if (!previousRange) return [];
    const fromKey = formatDateOnly(previousRange.from);
    const toKey = formatDateOnly(previousRange.to);
    return allEntries.filter((e) => e.date >= fromKey && e.date <= toKey);
  }, [allEntries, previousRange]);

  const previousCurrentTotal = useMemo(() => {
    let total = 0;
    for (const entry of previousEntries) {
      const invested = Number(entry.value ?? 0);
      const current = entry.current_value === null || entry.current_value === undefined ? invested : Number(entry.current_value);
      total += Number.isFinite(current) ? current : invested;
    }
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [previousEntries]);

  const currentTotalDeltaFromPrevious = useMemo(() => {
    if (!previousRange) return null;
    if (filteredEntries.length === 0 || previousEntries.length === 0) return null;
    const diff = currentTotal - previousCurrentTotal;
    if (!Number.isFinite(diff)) return null;
    return Number(diff.toFixed(2));
  }, [currentTotal, filteredEntries.length, previousCurrentTotal, previousEntries.length, previousRange]);

  const filteredPeriodTotal = useMemo(() => {
    let total = 0;
    for (const entry of filteredEntries) total += Number(entry.value ?? 0);
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [filteredEntries]);

  const previousPeriodTotal = useMemo(() => {
    let total = 0;
    for (const entry of previousEntries) total += Number(entry.value ?? 0);
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [previousEntries]);

  const growth = useMemo(() => {
    const diff = filteredPeriodTotal - previousPeriodTotal;
    if (!Number.isFinite(diff)) return null;
    if (previousPeriodTotal <= 0) {
      if (filteredPeriodTotal <= 0) return { amount: 0, percent: null };
      return { amount: Number(diff.toFixed(2)), percent: null };
    }
    const percent = (diff / previousPeriodTotal) * 100;
    if (!Number.isFinite(percent)) return { amount: Number(diff.toFixed(2)), percent: null };
    return { amount: Number(diff.toFixed(2)), percent: Number(percent.toFixed(2)) };
  }, [filteredPeriodTotal, previousPeriodTotal]);

  const latestEntry = useMemo(() => {
    const list = filteredEntries.slice().sort(compareEntriesDesc);
    return list.length > 0 ? list[0] : null;
  }, [filteredEntries]);

  const chartSeries = useMemo(() => {
    const granularity = getChartGranularity(periodPreset, filterRange);
    const totals = new Map<string, number>();

    for (const entry of filteredEntries) {
      const parsed = parseDateOnly(entry.date);
      if (!parsed) continue;

      let key = entry.date;
      if (granularity === "week") key = formatDateOnly(weekStartMonday(parsed));
      if (granularity === "month") key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      if (granularity === "year") key = String(parsed.getFullYear());

      totals.set(key, (totals.get(key) ?? 0) + Number(entry.value ?? 0));
    }

    const keys = Array.from(totals.keys()).sort();
    return keys.reduce(
      (state, key) => {
        const amount = Number(totals.get(key) ?? 0);
        const nextAcc = state.acc + (Number.isFinite(amount) ? amount : 0);

        let label = key;
        if (granularity === "day") label = formatEntryDateBR(key);
        if (granularity === "week") {
          const start = parseDateOnly(key);
          const end = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6) : null;
          label = start && end ? `${formatDateOnlyBR(start)} – ${formatDateOnlyBR(end)}` : key;
        }
        if (granularity === "month") {
          const start = parseDateOnly(`${key}-01`);
          label = start ? start.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) : key;
        }

        const point = { label, accumulated: Number.isFinite(nextAcc) ? Number(nextAcc.toFixed(2)) : 0 };
        return { acc: nextAcc, points: state.points.concat([point]) };
      },
      { acc: 0, points: [] as Array<{ label: string; accumulated: number }> }
    ).points;
  }, [filteredEntries, filterRange, periodPreset]);

  const renderedEntries = useMemo(() => {
    const max = 200;
    const sorted = filteredEntries.slice().sort(compareEntriesDesc);
    if (sorted.length <= max) return { items: sorted, truncated: false, hiddenCount: 0 };
    const items = sorted.slice(0, max);
    return { items, truncated: true, hiddenCount: sorted.length - items.length };
  }, [filteredEntries]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, { invested: number; current: number }>();
    for (const entry of filteredEntries) {
      const invested = Number(entry.value ?? 0);
      if (!Number.isFinite(invested) || invested <= 0) continue;
      const current =
        entry.current_value === null || entry.current_value === undefined ? invested : Number(entry.current_value);
      const safeCurrent = Number.isFinite(current) ? current : invested;
      const monthKey = String(entry.date ?? "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
      const prev = map.get(monthKey) ?? { invested: 0, current: 0 };
      map.set(monthKey, { invested: prev.invested + invested, current: prev.current + safeCurrent });
    }

    const keys = Array.from(map.keys()).sort().reverse();
    return keys.map((monthKey) => {
      const totals = map.get(monthKey) ?? { invested: 0, current: 0 };
      const invested = Number(Number(totals.invested).toFixed(2));
      const current = Number(Number(totals.current).toFixed(2));
      const profit = Number((current - invested).toFixed(2));
      const labelDate = parseDateOnly(`${monthKey}-01`);
      const label = labelDate ? labelDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase() : monthKey;
      return { monthKey, label, invested, current, profit };
    });
  }, [filteredEntries]);

  const distributionByCategory = useMemo(() => {
    return computeInvestmentDistribution(filteredEntries);
  }, [filteredEntries]);

  const distributionInsight = useMemo(() => {
    if (distributionByCategory.slices.length === 0 || !distributionByCategory.top) return null;
    if (distributionByCategory.top.percent > 60) {
      return {
        tone: "alert" as const,
        text: `Atenção: ${distributionByCategory.top.name} concentra ${distributionByCategory.top.percent.toFixed(1)}% dos seus investimentos.`,
      };
    }
    return { tone: "ok" as const, text: "Boa: seus investimentos estão bem distribuídos entre categorias." };
  }, [distributionByCategory.slices.length, distributionByCategory.top]);

  const distributionPalette =
    theme === "dark"
      ? ["#38bdf8", "#34d399", "#f472b6", "#a78bfa", "#fb7185", "#fbbf24", "#94a3b8"]
      : ["#2563eb", "#16a34a", "#db2777", "#7c3aed", "#dc2626", "#d97706", "#64748b"];

  const persistenceWarning = useMemo(() => {
    const candidates = [investments.error, profile.error]
      .filter((error): error is Error => error instanceof Error)
      .map((error) => error.message.trim())
      .filter((message) => message.length > 0);
    if (candidates.length === 0) return null;
    const unique = Array.from(new Set(candidates));
    return unique.slice(0, 2).join(" • ");
  }, [investments.error, profile.error]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(139,92,246,0.22),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(56,189,248,0.18),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <h2 className="text-3xl font-semibold tracking-tight">Investimentos</h2>
          <p className="mt-2 text-slate-600 dark:text-white/70">Visualize sua evolução e estratégia de longo prazo.</p>
        </div>
      </section>

      {persistenceWarning && (
        <Card className="rounded-3xl border-destructive/40 bg-destructive/5">
          <CardContent className="pt-5 text-sm text-destructive">
            Você não conseguiu salvar agora. Nada foi guardado. Detalhes: {persistenceWarning}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Investimentos</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Você colocou</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {investments.isLoading ? <Skeleton className="h-6 w-28" /> : formatBRL(investedTotal)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Hoje vale</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {investments.isLoading ? <Skeleton className="h-6 w-28" /> : formatBRL(currentTotal)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Você ganhou (ou perdeu)</div>
                <div
                  className={`mt-1 text-lg font-semibold tabular-nums ${
                    profit > 0 ? "text-emerald-600" : profit < 0 ? "text-destructive" : ""
                  }`}
                >
                  {investments.isLoading ? <Skeleton className="h-6 w-28" /> : formatBRL(profit)}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Você teve de retorno</div>
                <div
                  className={`mt-1 text-lg font-semibold tabular-nums ${
                    profitability !== null && profitability > 0
                      ? "text-emerald-600"
                      : profitability !== null && profitability < 0
                        ? "text-destructive"
                        : ""
                  }`}
                >
                  {investments.isLoading ? (
                    <Skeleton className="h-6 w-20" />
                  ) : profitability !== null ? (
                    profitability.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Horas de vida protegidas</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {protectedHours !== null
                    ? protectedHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "—"}
                </div>
              </div>
              {profitLifeHours !== null && (
                <div className="rounded-2xl border bg-card/18 px-3 py-3 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Tempo de vida (rendimento)</div>
                  <div
                    className={`mt-1 text-sm font-medium ${
                      profitLifeHours > 0 ? "text-emerald-600" : profitLifeHours < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {profitLifeHours > 0
                      ? `Seus investimentos renderam ${Math.abs(profitLifeHours).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} horas da sua vida`
                      : `Seus investimentos custaram ${Math.abs(profitLifeHours).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} horas da sua vida`}
                  </div>
                </div>
              )}
              {profitLifeHours === null && hasNoProfitVariation && (
                <div className="rounded-2xl border bg-card/18 px-3 py-3 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Tempo de vida (rendimento)</div>
                  <div className="mt-1 text-sm font-medium">Seus investimentos não mudaram aqui</div>
                </div>
              )}
              <div className="rounded-2xl border bg-card/18 px-3 py-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Último investimento registrado</div>
                <div className="mt-1 text-sm font-medium">
                  {latestEntry ? `${formatBRL(latestEntry.value)} em ${formatEntryDateBR(latestEntry.date)}` : "Você ainda não fez nenhum investimento"}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Como ficou aqui</div>
                <div className="mt-1 text-sm font-medium">
                  {growth
                    ? growth.amount === 0
                      ? "Seu investimento não mudou aqui"
                      : growth.amount > 0
                        ? `Seu investimento cresceu em ${formatBRL(Math.abs(growth.amount))}${
                            growth.percent !== null ? ` (+${growth.percent.toFixed(2)}%)` : ""
                          } aqui`
                        : `Seu investimento diminuiu em ${formatBRL(Math.abs(growth.amount))}${
                            growth.percent !== null ? ` (−${Math.abs(growth.percent).toFixed(2)}%)` : ""
                          } aqui`
                    : "Sem dados suficientes para comparar."}
                </div>
              </div>
              {currentTotalDeltaFromPrevious !== null && (
                <div className="rounded-2xl border bg-card/18 px-3 py-3 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Comparando com antes</div>
                  <div
                    className={`mt-1 text-sm font-medium ${
                      currentTotalDeltaFromPrevious > 0
                        ? "text-emerald-600"
                        : currentTotalDeltaFromPrevious < 0
                          ? "text-destructive"
                          : ""
                    }`}
                  >
                    {currentTotalDeltaFromPrevious === 0
                      ? "Seus investimentos não mudaram na comparação com antes"
                      : currentTotalDeltaFromPrevious > 0
                        ? `Seus investimentos cresceram ${formatBRL(Math.abs(currentTotalDeltaFromPrevious))} na comparação com antes`
                        : `Seus investimentos diminuíram ${formatBRL(Math.abs(currentTotalDeltaFromPrevious))} na comparação com antes`}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Histórico de investimentos</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="text-sm font-medium text-foreground">Filtro</div>
              <Select
                value={periodPreset}
                onValueChange={(value) => {
                  const preset = value as PeriodPreset;
                  setPeriodPreset(preset);
                  if (preset !== "custom") {
                    const r = getPresetRange(preset);
                    setDateRange(r.from && r.to ? ({ from: r.from, to: r.to } as DateRange) : undefined);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <span className="flex flex-1 items-center justify-between">
                    <span>{INVESTMENT_FILTER_OPTIONS.find((option) => option.value === periodPreset)?.label ?? "Personalizado"}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {periodPreset === "custom" ? (
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-start">{periodHint}</Button>} />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" selected={dateRange} onSelect={(r) => setDateRange(r ?? undefined)} initialFocus />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="text-xs text-muted-foreground">{periodHint}</div>
            )}

            {filteredEntries.length === 0 && (
              <div className="rounded-2xl border bg-card/18 px-3 py-3 text-sm text-muted-foreground">
                {(investments.data ?? []).length === 0 ? "Você ainda não fez nenhum investimento" : "Nada apareceu aqui. Tente mudar o filtro."}
              </div>
            )}

            {groupedByMonth.length > 0 && (
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-sm font-medium text-foreground">Você mês a mês</div>
                <div className="mt-2 space-y-3">
                  {groupedByMonth.map((group) => (
                    <div key={group.monthKey} className="rounded-2xl border bg-background/40 px-3 py-3">
                      <div className="text-xs font-semibold text-muted-foreground">{group.label}</div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <div className="text-[11px] text-muted-foreground">Você colocou</div>
                          <div className="text-sm font-medium tabular-nums">{formatBRL(group.invested)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted-foreground">Hoje vale</div>
                          <div className="text-sm font-medium tabular-nums">{formatBRL(group.current)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted-foreground">Você ganhou (ou perdeu)</div>
                          <div
                            className={`text-sm font-medium tabular-nums ${
                              group.profit > 0 ? "text-emerald-600" : group.profit < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {formatBRL(group.profit)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-sm font-medium text-foreground">Adicionar investimento</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-5 sm:items-end">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Categoria</div>
                  <Select
                    value={entryCategory}
                    onValueChange={(value) => {
                      setEntryMessage(null);
                      setEntryCategory(value as InvestmentCategory);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span className="flex flex-1 items-center justify-between">
                      <span>{entryCategory.length > 0 ? INVESTMENT_CATEGORY_LABEL[entryCategory as InvestmentCategory] : "Selecione"}</span>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {INVESTMENT_CATEGORY_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Valor (R$)</div>
                <MoneyInput
                  placeholder="Ex: 500,00"
                  value={entryValue}
                  invalid={entryMessage?.type === "error" && entryMessage.text.toLowerCase().includes("valor")}
                  onValueChange={(v) => {
                    setEntryMessage(null);
                    setEntryValue(v);
                  }}
                />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Hoje vale (opcional)</div>
                <MoneyInput
                  placeholder="Ex: 550,00"
                  value={entryCurrentValue}
                  invalid={entryMessage?.type === "error" && entryMessage.text.toLowerCase().includes("hoje vale")}
                  onValueChange={(v) => {
                    setEntryMessage(null);
                    setEntryCurrentValue(v);
                  }}
                />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Data</div>
                  <Input
                    type="date"
                    value={entryDateInput}
                    onChange={(e) => {
                      setEntryMessage(null);
                      setEntryDateInput(e.currentTarget.value);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  disabled={createInvestmentEntry.isPending}
                  onClick={() => {
                    if (entryCategory.trim().length === 0) {
                      setEntryMessage({ type: "error", text: "Você precisa selecionar uma categoria." });
                      return;
                    }
                    if (entryValue === null || !Number.isFinite(entryValue)) {
                      setEntryMessage({ type: "error", text: "Digite um valor válido." });
                      return;
                    }
                    if (entryValue <= 0) {
                      setEntryMessage({ type: "error", text: "Digite um valor maior que zero." });
                      return;
                    }
                    if (entryCurrentValue !== null && (!Number.isFinite(entryCurrentValue) || entryCurrentValue <= 0)) {
                      setEntryMessage({ type: "error", text: "Hoje vale: digite um valor válido ou deixe em branco." });
                      return;
                    }
                    const dateISO = normalizeDateOnlyToISO(entryDateInput);
                    if (!dateISO) {
                      setEntryMessage({ type: "error", text: "Você precisa informar uma data válida (dd/mm/aaaa ou yyyy-mm-dd)." });
                      return;
                    }
                    createInvestmentEntry
                      .mutateAsync({
                        category: entryCategory,
                        value: Number(entryValue.toFixed(2)),
                        current_value: entryCurrentValue === null ? null : Number(entryCurrentValue.toFixed(2)),
                        date: dateISO,
                      })
                      .then(() => {
                        setEntryCategory("");
                        setEntryValue(null);
                        setEntryCurrentValue(null);
                        setEntryDateInput(formatDateOnly(startOfDay(new Date())));
                        setEntryMessage({ type: "success", text: "Salvo com sucesso." });
                      })
                      .catch((err) => {
                        setEntryMessage({
                          type: "error",
                          text: err instanceof Error ? err.message : "Você não conseguiu adicionar seu investimento. Tente novamente.",
                        });
                      });
                  }}
                >
                  {createInvestmentEntry.isPending ? "Salvando..." : "Adicionar"}
                </Button>
              </div>
              {entryMessage && (
                <div className={`mt-2 text-sm ${entryMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
                  {entryMessage.text}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-sm font-medium text-foreground">Evolução</div>
              {chartSeries.length <= 1 ? (
                <div className="mt-2 text-sm text-muted-foreground">Registre mais de um investimento para visualizar a evolução.</div>
              ) : (
                <div className="mt-3 h-44 w-full min-w-0">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                      <LineChart data={chartSeries}>
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" />
                        <YAxis tickLine={false} axisLine={false} fontSize={10} tickFormatter={(v) => formatBRL(Number(v))} width={56} />
                        <Tooltip formatter={(value) => formatBRL(Number(value))} labelFormatter={(label) => String(label)} />
                        <Line type="monotone" dataKey="accumulated" strokeWidth={2} dot={false} stroke="hsl(var(--primary))" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card/18">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40 rounded-t-2xl">
                <div className="col-span-2">Data</div>
                <div className="col-span-3">Categoria</div>
                <div className="col-span-2">Investido</div>
                <div className="col-span-2">Atual</div>
                <div className="col-span-3 text-right">Ações</div>
              </div>
              <div className="max-h-[260px] overflow-auto divide-y">
                {renderedEntries.items.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    {(investments.data ?? []).length === 0 ? "Você ainda não fez nenhum investimento." : "Nada apareceu aqui com esse filtro."}
                  </div>
                ) : (
                  renderedEntries.items.map((e) => {
                    const isEditing = editingId === e.id;
                    const effectiveCurrent = e.current_value === null || e.current_value === undefined ? e.value : e.current_value;
                    return (
                      <div key={e.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                        <div className="col-span-2 text-muted-foreground">
                          {isEditing ? (
                            <Input type="date" value={editingDateInput} onChange={(ev) => setEditingDateInput(ev.currentTarget.value)} />
                          ) : (
                            formatEntryDateBR(e.date)
                          )}
                        </div>
                        <div className="col-span-3 font-medium">
                          {isEditing ? (
                            <Select value={editingCategory} onValueChange={(v) => setEditingCategory(v as InvestmentCategory)}>
                              <SelectTrigger className="w-full">
                                <span className="flex flex-1 items-center justify-between">
                                  <span>
                                    {editingCategory.length > 0
                                      ? INVESTMENT_CATEGORY_LABEL[editingCategory as InvestmentCategory]
                                      : "Selecione"}
                                  </span>
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {INVESTMENT_CATEGORY_OPTIONS.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {INVESTMENT_CATEGORY_LABEL[c]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            INVESTMENT_CATEGORY_LABEL[(e.category as InvestmentCategory) ?? "Outros"]
                          )}
                        </div>
                        <div className="col-span-2 font-medium tabular-nums">
                          {isEditing ? (
                            <MoneyInput value={editingValue} onValueChange={setEditingValue} placeholder="Ex: 500,00" />
                          ) : (
                            formatBRL(e.value)
                          )}
                        </div>
                        <div className="col-span-2 font-medium tabular-nums">
                          {isEditing ? (
                            <MoneyInput value={editingCurrentValue} onValueChange={setEditingCurrentValue} placeholder="Opcional" />
                          ) : (
                            <div className="space-y-0.5">
                              <div>{formatBRL(effectiveCurrent)}</div>
                              <div
                                className={`text-[11px] tabular-nums ${
                                  effectiveCurrent - e.value > 0
                                    ? "text-emerald-600"
                                    : effectiveCurrent - e.value < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {(() => {
                                  const diff = Number((effectiveCurrent - e.value).toFixed(2));
                                  const pct = e.value > 0 ? (diff / e.value) * 100 : null;
                                  const pctText = pct !== null && Number.isFinite(pct) ? ` (${pct.toFixed(2)}%)` : "";
                                  return `${formatBRL(diff)}${pctText}`;
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="col-span-3 flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={updateInvestmentEntry.isPending}
                                onClick={() => {
                                  if (editingCategory.trim().length === 0) {
                                    setEntryMessage({ type: "error", text: "Você precisa selecionar uma categoria." });
                                    return;
                                  }
                                  if (editingValue === null || !Number.isFinite(editingValue)) {
                                    setEntryMessage({ type: "error", text: "Digite um valor válido." });
                                    return;
                                  }
                                  if (editingValue <= 0) {
                                    setEntryMessage({ type: "error", text: "Digite um valor maior que zero." });
                                    return;
                                  }
                                  if (editingCurrentValue !== null && (!Number.isFinite(editingCurrentValue) || editingCurrentValue <= 0)) {
                                    setEntryMessage({ type: "error", text: "Hoje vale: digite um valor válido ou deixe em branco." });
                                    return;
                                  }
                                  const dateISO = normalizeDateOnlyToISO(editingDateInput);
                                  if (!dateISO) {
                                    setEntryMessage({ type: "error", text: "Você precisa informar uma data válida (dd/mm/aaaa ou yyyy-mm-dd)." });
                                    return;
                                  }
                                  updateInvestmentEntry.mutateAsync({
                                      id: e.id,
                                      category: editingCategory,
                                      value: Number(editingValue.toFixed(2)),
                                      current_value: editingCurrentValue === null ? null : Number(editingCurrentValue.toFixed(2)),
                                      date: dateISO,
                                    })
                                    .then(() => {
                                      setEditingId(null);
                                      setEntryMessage({ type: "success", text: "Salvo com sucesso." });
                                    })
                                    .catch((err) => {
                                      setEntryMessage({
                                        type: "error",
                                        text: err instanceof Error ? err.message : "Você não conseguiu salvar. Tente novamente.",
                                      });
                                    });
                                }}
                              >
                                {updateInvestmentEntry.isPending ? "Salvando..." : "Salvar"}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEntryMessage(null);
                                  setEditingId(e.id);
                                  setEditingCategory(e.category as InvestmentCategory);
                                  setEditingValue(Number(e.value));
                                  setEditingCurrentValue(
                                    e.current_value === null || e.current_value === undefined ? null : Number(e.current_value)
                                  );
                                  setEditingDateInput(e.date);
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={deleteInvestmentEntry.isPending}
                                onClick={() => {
                                  if (!window.confirm("Remover este investimento?")) return;
                                  deleteInvestmentEntry
                                    .mutateAsync(e.id)
                                    .then(() => {
                                      setEntryMessage({ type: "success", text: "Removido com sucesso." });
                                    })
                                    .catch((err) => {
                                      setEntryMessage({
                                        type: "error",
                                        text: err instanceof Error ? err.message : "Você não conseguiu remover. Tente novamente.",
                                      });
                                    });
                                }}
                              >
                                {deleteInvestmentEntry.isPending ? "Removendo..." : "Remover"}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {renderedEntries.truncated && (
              <div className="text-xs text-muted-foreground">
                Você está vendo os últimos {renderedEntries.items.length} registros deste filtro (mais {renderedEntries.hiddenCount} ocultos).
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Distribuição dos investimentos</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {distributionByCategory.slices.length === 0 ? (
              <div className="rounded-2xl border bg-card/18 px-3 py-3 text-sm text-muted-foreground">
                Registre investimentos para ver a distribuição por categoria.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-[240px] w-full min-w-0 rounded-2xl border bg-card/18 px-3 py-3">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                      <PieChart>
                        <Tooltip cursor={false} content={<DistributionTooltip />} />
                        <Pie
                          data={distributionByCategory.slices}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={92}
                          paddingAngle={2}
                          stroke={theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"}
                          isAnimationActive
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {distributionByCategory.slices.map((s, idx) => (
                            <Cell key={s.name + idx} fill={distributionPalette[idx % distributionPalette.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="rounded-2xl border bg-card/18 px-3 py-3">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                    <div className="col-span-5">Categoria</div>
                    <div className="col-span-4 text-right">Total</div>
                    <div className="col-span-3 text-right">%</div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {distributionByCategory.slices.map((s) => (
                      <div key={s.name} className="grid grid-cols-12 gap-2 text-sm items-center">
                        <div className="col-span-5 font-medium">{s.name}</div>
                        <div className="col-span-4 text-right tabular-nums">{formatBRL(s.value)}</div>
                        <div className="col-span-3 text-right tabular-nums text-muted-foreground">
                          {s.percent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {distributionInsight && (
              <div
                className={`rounded-2xl border px-3 py-3 text-sm ${
                  distributionInsight.tone === "alert"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {distributionInsight.text}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
