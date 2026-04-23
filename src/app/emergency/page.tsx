"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/auth/useProfile";
import {
  useCreateReserveEntry,
  useDeleteReserveEntry,
  useMigrateLegacyReserveEntries,
  useReserveEntries,
  useUpdateReserveEntry,
} from "@/hooks/financial/useReserveEntries";
import { formatBRL } from "@/lib/currency";
import { formatDateOnly, formatDateOnlyBR, normalizeDateOnlyToISO, parseDateOnly } from "@/lib/date";
import { formatPeriodHint, getPresetRange, startOfDay, type PeriodPreset } from "@/lib/period";
import { useHasMounted } from "@/hooks/useHasMounted";
import type { DateRange } from "react-day-picker";

const RESERVE_ENTRIES_KEY = "reserve_entries_v1";
const RESERVE_FILTER_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Diário" },
  { value: "7d", label: "Semanal" },
  { value: "month", label: "Mensal" },
  { value: "year", label: "Anual" },
  { value: "custom", label: "Personalizado" },
];

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
  if (preset === "month") return "week";
  if (preset === "year") return "month";
  if (!range) return "day";
  const days = Math.floor((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  if (days <= 730) return "month";
  return "year";
}

function weekStartMonday(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff));
}

export default function EmergencyPage() {
  const mounted = useHasMounted();
  const profile = useProfile();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });
  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  const [entryValue, setEntryValue] = useState<number | null>(null);
  const [entryDateInput, setEntryDateInput] = useState(() => formatDateOnly(startOfDay(new Date())));
  const [entryMessage, setEntryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<number | null>(null);
  const [editingDateInput, setEditingDateInput] = useState("");
  const didAttemptLegacyMigrationRef = useRef(false);

  const createReserveEntry = useCreateReserveEntry();
  const updateReserveEntry = useUpdateReserveEntry();
  const deleteReserveEntry = useDeleteReserveEntry();
  const migrateLegacyReserveEntries = useMigrateLegacyReserveEntries();

  useEffect(() => {
    if (didAttemptLegacyMigrationRef.current) return;
    didAttemptLegacyMigrationRef.current = true;
    try {
      const raw = window.localStorage.getItem(RESERVE_ENTRIES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{ amount?: unknown; value?: unknown; date?: unknown }>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        window.localStorage.removeItem(RESERVE_ENTRIES_KEY);
        return;
      }
      const legacyEntries = parsed
        .map((item) => {
          const value = Number(item.value ?? item.amount ?? 0);
          const date = normalizeDateOnlyToISO(String(item.date ?? ""));
          if (!Number.isFinite(value) || value <= 0) return null;
          if (!date) return null;
          return { value: Number(value.toFixed(2)), date: date };
        })
        .filter((item): item is { value: number; date: string } => item !== null);

      if (legacyEntries.length === 0) {
        window.localStorage.removeItem(RESERVE_ENTRIES_KEY);
        return;
      }

      migrateLegacyReserveEntries
        .mutateAsync(legacyEntries)
        .then(() => {
          window.localStorage.removeItem(RESERVE_ENTRIES_KEY);
          setEntryMessage({ type: "success", text: "Histórico local migrado com sucesso." });
        })
        .catch(() => {
          setEntryMessage({
            type: "error",
            text: "Não foi possível migrar o histórico local agora. Tente novamente em instantes.",
          });
        });
    } catch {}
  }, [migrateLegacyReserveEntries]);

  const hourlyRate = useMemo(() => {
    const raw = profile.data?.hourly_rate;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [profile.data?.hourly_rate]);

  const reserveEntries = useReserveEntries({}, { enabled: true });

  const allEntries = useMemo(() => reserveEntries.data ?? [], [reserveEntries.data]);

  const allEntriesTotal = useMemo(() => {
    let total = 0;
    for (const entry of allEntries) total += Number(entry.value ?? 0);
    if (!Number.isFinite(total)) return 0;
    return Number(total.toFixed(2));
  }, [allEntries]);

  const totalGuardado = allEntriesTotal;

  const reserveHours = useMemo(() => {
    if (!hourlyRate) return null;
    const hours = totalGuardado / hourlyRate;
    if (!Number.isFinite(hours) || hours < 0) return null;
    return Number(hours.toFixed(2));
  }, [totalGuardado, hourlyRate]);

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

  const filteredEntries = useMemo(() => {
    if (!filterRange) return [];
    const fromKey = formatDateOnly(filterRange.from);
    const toKey = formatDateOnly(filterRange.to);
    return allEntries.filter((e) => e.date >= fromKey && e.date <= toKey);
  }, [allEntries, filterRange]);

  const previousEntries = useMemo(() => {
    if (!previousRange) return [];
    const fromKey = formatDateOnly(previousRange.from);
    const toKey = formatDateOnly(previousRange.to);
    return allEntries.filter((e) => e.date >= fromKey && e.date <= toKey);
  }, [allEntries, previousRange]);

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

  const reserveGrowth = useMemo(() => {
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
    const list = allEntries.slice().sort(compareEntriesDesc);
    return list.length > 0 ? list[0] : null;
  }, [allEntries]);

  const renderedEntries = useMemo(() => {
    const max = 200;
    const sorted = filteredEntries.slice().sort(compareEntriesDesc);
    if (sorted.length <= max) return { items: sorted, truncated: false, hiddenCount: 0 };
    const items = sorted.slice(0, max);
    return { items, truncated: true, hiddenCount: sorted.length - items.length };
  }, [filteredEntries]);

  const persistenceWarning = useMemo(() => {
    const candidates = [reserveEntries.error, profile.error]
      .filter((error): error is Error => error instanceof Error)
      .map((error) => error.message.trim())
      .filter((message) => message.length > 0);
    if (candidates.length === 0) return null;
    const unique = Array.from(new Set(candidates));
    return unique.slice(0, 2).join(" • ");
  }, [reserveEntries.error, profile.error]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(239,68,68,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(244,63,94,0.2),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(56,189,248,0.18),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <h2 className="text-3xl font-semibold tracking-tight">Reserva</h2>
          <p className="mt-2 text-slate-600 dark:text-white/70">Planeje sua segurança financeira com clareza.</p>
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
            <CardTitle className="text-base">Você guardou</CardTitle>
            <ShieldAlert className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {reserveEntries.isLoading || profile.isLoading ? (
                <Skeleton className="h-9 w-40" />
              ) : (
                formatBRL(totalGuardado)
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Horas de vida protegidas</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {reserveHours !== null
                    ? reserveHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "—"}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3">
                <div className="text-xs text-muted-foreground">Última vez que você guardou</div>
                <div className="mt-1 text-sm font-medium">
                  {latestEntry
                    ? `${formatBRL(latestEntry.value)} em ${formatEntryDateBR(latestEntry.date)}`
                    : "Você ainda não guardou nada"}
                </div>
              </div>
              <div className="rounded-2xl border bg-card/18 px-3 py-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Como ficou aqui</div>
                <div className="mt-1 text-sm font-medium">
                  {reserveGrowth
                    ? reserveGrowth.amount === 0
                      ? "Sua reserva não mudou aqui"
                      : reserveGrowth.amount > 0
                        ? `Sua reserva cresceu em ${formatBRL(Math.abs(reserveGrowth.amount))}${
                            reserveGrowth.percent !== null ? ` (+${reserveGrowth.percent.toFixed(2)}%)` : ""
                          } aqui`
                        : `Sua reserva diminuiu em ${formatBRL(Math.abs(reserveGrowth.amount))}${
                            reserveGrowth.percent !== null ? ` (−${Math.abs(reserveGrowth.percent).toFixed(2)}%)` : ""
                          } aqui`
                    : "Sem dados suficientes para comparar."}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {reserveGrowth
                    ? reserveGrowth.amount === 0
                      ? "Você ainda não guardou nada aqui"
                      : reserveGrowth.amount > 0
                        ? "Você aumentou sua segurança financeira"
                        : "Você utilizou parte da sua reserva"
                    : "Sem dados suficientes para comparar."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card/25 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">O que você guardou</CardTitle>
            <ShieldAlert className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative space-y-3 pb-16">
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
                    <span>{RESERVE_FILTER_OPTIONS.find((option) => option.value === periodPreset)?.label ?? "Personalizado"}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {RESERVE_FILTER_OPTIONS.map((option) => (
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
                {(reserveEntries.data ?? []).length === 0
                  ? "Você ainda não começou sua reserva"
                  : "Nada apareceu aqui. Tente mudar o filtro."}
              </div>
            )}

            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-sm font-medium text-foreground">Você adiciona na sua reserva</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 sm:items-end">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Valor (R$)</div>
                  <MoneyInput
                    placeholder="Ex: 200,00"
                    value={entryValue}
                    invalid={entryMessage?.type === "error" && entryMessage.text.toLowerCase().includes("valor")}
                    onValueChange={(v) => {
                      setEntryMessage(null);
                      setEntryValue(v);
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
                  disabled={createReserveEntry.isPending}
                  onClick={() => {
                    if (entryValue === null || !Number.isFinite(entryValue)) {
                      setEntryMessage({ type: "error", text: "Digite um valor válido." });
                      return;
                    }
                    if (entryValue <= 0) {
                      setEntryMessage({ type: "error", text: "Digite um valor maior que zero." });
                      return;
                    }
                    const dateISO = normalizeDateOnlyToISO(entryDateInput);
                    if (!dateISO) {
                      setEntryMessage({ type: "error", text: "Você precisa informar uma data válida (dd/mm/aaaa ou yyyy-mm-dd)." });
                      return;
                    }
                    createReserveEntry
                      .mutateAsync({ value: Number(entryValue.toFixed(2)), date: dateISO })
                      .then(() => {
                        setEntryValue(null);
                        setEntryDateInput(formatDateOnly(startOfDay(new Date())));
                        setEntryMessage({ type: "success", text: "Salvo com sucesso." });
                      })
                      .catch((err) => {
                        setEntryMessage({
                          type: "error",
                          text: err instanceof Error ? err.message : "Você não conseguiu adicionar na sua reserva. Tente novamente.",
                        });
                      });
                  }}
                >
                  {createReserveEntry.isPending ? "Salvando..." : "Adicionar"}
                </Button>
              </div>
              {entryMessage && (
                <div className={`mt-2 text-sm ${entryMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
                  {entryMessage.text}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-sm font-medium text-foreground">Quanto apareceu aqui</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(filteredPeriodTotal)}</div>
            </div>

            <div className="rounded-2xl border bg-card/18 px-3 py-3">
              <div className="text-sm font-medium text-foreground">Evolução</div>
              {chartSeries.length <= 1 ? (
                <div className="mt-2 text-sm text-muted-foreground">Você precisa de mais de um registro para ver a evolução.</div>
              ) : (
                <div className="mt-3 h-44 w-full min-w-0">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                      <LineChart data={chartSeries}>
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          fontSize={10}
                          tickFormatter={(v) => formatBRL(Number(v))}
                          width={56}
                        />
                        <Tooltip
                          formatter={(value) => formatBRL(Number(value))}
                          labelFormatter={(label) => String(label)}
                        />
                        <Line type="monotone" dataKey="accumulated" strokeWidth={2} dot={false} stroke="hsl(var(--primary))" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card/18">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40 rounded-t-2xl">
                <div className="col-span-4">Data</div>
                <div className="col-span-5">Valor</div>
                <div className="col-span-3 text-right">Ações</div>
              </div>
              <div className="max-h-[260px] overflow-auto divide-y">
                {renderedEntries.items.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    {(reserveEntries.data ?? []).length === 0 ? "Você ainda não começou sua reserva." : "Nada apareceu aqui com esse filtro."}
                  </div>
                ) : (
                  renderedEntries.items.map((e) => {
                    const isEditing = editingId === e.id;
                    return (
                      <div key={e.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                        <div className="col-span-4 text-muted-foreground">
                          {isEditing ? (
                            <Input type="date" value={editingDateInput} onChange={(ev) => setEditingDateInput(ev.currentTarget.value)} />
                          ) : (
                            formatEntryDateBR(e.date)
                          )}
                        </div>
                        <div className="col-span-5 font-medium tabular-nums">
                          {isEditing ? (
                            <MoneyInput value={editingValue} onValueChange={setEditingValue} placeholder="Ex: 200,00" />
                          ) : (
                            formatBRL(e.value)
                          )}
                        </div>
                        <div className="col-span-3 flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={updateReserveEntry.isPending}
                                onClick={() => {
                                  if (editingValue === null || !Number.isFinite(editingValue)) {
                                    setEntryMessage({ type: "error", text: "Digite um valor válido." });
                                    return;
                                  }
                                  if (editingValue <= 0) {
                                    setEntryMessage({ type: "error", text: "Digite um valor maior que zero." });
                                    return;
                                  }
                                  const dateISO = normalizeDateOnlyToISO(editingDateInput);
                                  if (!dateISO) {
                                    setEntryMessage({ type: "error", text: "Você precisa informar uma data válida (dd/mm/aaaa ou yyyy-mm-dd)." });
                                    return;
                                  }
                                  updateReserveEntry
                                    .mutateAsync({ id: e.id, value: Number(editingValue.toFixed(2)), date: dateISO })
                                    .then(() => {
                                      setEditingId(null);
                                      setEntryMessage({ type: "success", text: "Salvo com sucesso." });
                                    })
                                    .catch((err) => {
                                      setEntryMessage({
                                        type: "error",
                                        text: err instanceof Error ? err.message : "Você não conseguiu atualizar. Tente novamente.",
                                      });
                                    });
                                }}
                              >
                                {updateReserveEntry.isPending ? "Salvando..." : "Salvar"}
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
                                  setEditingValue(Number(e.value));
                                  setEditingDateInput(e.date);
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={deleteReserveEntry.isPending}
                                onClick={() => {
                                  if (!window.confirm("Remover este registro da reserva?")) return;
                                  deleteReserveEntry
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
                                {deleteReserveEntry.isPending ? "Removendo..." : "Remover"}
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
      </div>
    </div>
  );
}
