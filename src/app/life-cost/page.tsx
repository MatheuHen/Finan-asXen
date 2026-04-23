"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarIcon, Clock } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/hooks/financial/useCategories";
import { useTransactions } from "@/hooks/financial/useTransactions";
import { useGoals } from "@/hooks/financial/useGoals";
import { useProfile } from "@/hooks/auth/useProfile";
import { formatBRL } from "@/lib/currency";
import { formatPeriodHint, getPresetRange, PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/period";
import { parseDateOnly } from "@/lib/date";
import { getLucideIconByName } from "@/components/ui/icon-picker";
import { AutomaticInsightsCard } from "@/app/life-cost/components/AutomaticInsightsCard";
import { AlertsCard, type SmartAlert } from "@/app/life-cost/components/AlertsCard";
import { LifeCostCalculator } from "@/app/life-cost/components/LifeCostCalculator";

export default function LifeCostPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from && r.to ? { from: r.from, to: r.to } : undefined;
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const period = useMemo(() => {
    return { from: dateRange?.from, to: dateRange?.to };
  }, [dateRange]);

  const profile = useProfile();
  const categories = useCategories();
  const transactions = useTransactions(period);
  const goals = useGoals(period);
  const previousPeriod = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    const from = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
    const to = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
    const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const prevTo = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
    const prevFrom = new Date(prevTo.getFullYear(), prevTo.getMonth(), prevTo.getDate() - (spanDays - 1));
    return { from: prevFrom, to: prevTo };
  }, [dateRange]);
  const previousTransactions = useTransactions(previousPeriod ?? {}, { enabled: Boolean(previousPeriod) });

  const hourlyRate = useMemo(() => {
    const v = profile.data?.hourly_rate;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [profile.data?.hourly_rate]);

  const byCategory = useMemo(() => {
    if (!hourlyRate) return [];
    if (!transactions.data || !categories.data) return [];

    const catById = new Map(categories.data.map((c) => [c.id, c] as const));
    const sums = new Map<string, number>();

    for (const t of transactions.data) {
      if (t.type !== "expense") continue;
      if (!t.category_id) continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      sums.set(t.category_id, (sums.get(t.category_id) ?? 0) + amount);
    }

    const rows = Array.from(sums.entries())
      .map(([categoryId, total]) => {
        const cat = catById.get(categoryId);
        if (!cat) return null;
        const hours = total / hourlyRate;
        if (!Number.isFinite(hours) || hours <= 0) return null;
        return {
          id: categoryId,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          total,
          hours,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      color?: string | null;
      icon?: string | null;
      total: number;
      hours: number;
    }>;

    rows.sort((a, b) => b.hours - a.hours);
    return rows;
  }, [hourlyRate, transactions.data, categories.data]);

  const totals = useMemo(() => {
    if (!hourlyRate) return null;
    if (!transactions.data) return null;

    let totalExpense = 0;
    for (const t of transactions.data) {
      if (t.type !== "expense") continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      totalExpense += amount;
    }

    const hours = totalExpense / hourlyRate;
    if (!Number.isFinite(hours) || hours <= 0) return { totalExpense, hours: 0, days: 0 };
    const days = hours / 24;
    return { totalExpense, hours, days };
  }, [hourlyRate, transactions.data]);

  const previousTotals = useMemo(() => {
    if (!hourlyRate) return null;
    if (!previousPeriod) return null;
    if (!previousTransactions.data) return null;

    let totalExpense = 0;
    for (const t of previousTransactions.data) {
      if (t.type !== "expense") continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      totalExpense += amount;
    }

    const hours = totalExpense / hourlyRate;
    if (!Number.isFinite(hours) || hours <= 0) return { totalExpense, hours: 0 };
    return { totalExpense, hours };
  }, [hourlyRate, previousPeriod, previousTransactions.data]);

  const [workSchedule, setWorkSchedule] = useState<null | { hoursPerDay: number; hoursWeekly: number }>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem("work_schedule_v1");
        if (!raw) {
          setWorkSchedule(null);
          return;
        }
        const parsed = JSON.parse(raw) as { hoursPerDay?: unknown; hoursWeekly?: unknown };
        const hoursPerDay =
          typeof parsed.hoursPerDay === "number" ? parsed.hoursPerDay : Number(parsed.hoursPerDay);
        const hoursWeekly =
          typeof parsed.hoursWeekly === "number" ? parsed.hoursWeekly : Number(parsed.hoursWeekly);
        if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) {
          setWorkSchedule(null);
          return;
        }
        if (!Number.isFinite(hoursWeekly) || hoursWeekly <= 0) {
          setWorkSchedule(null);
          return;
        }
        setWorkSchedule({ hoursPerDay, hoursWeekly });
      } catch {
        setWorkSchedule(null);
      }
    };

    read();
    window.addEventListener("storage", read);
    window.addEventListener("work_schedule_updated", read as EventListener);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("work_schedule_updated", read as EventListener);
    };
  }, []);

  const effectiveWorkSchedule = useMemo(() => {
    if (workSchedule) return workSchedule;
    return { hoursPerDay: 8, hoursWeekly: 40 };
  }, [workSchedule]);

  const workTimeEquivalents = useMemo(() => {
    if (!totals || !Number.isFinite(totals.hours) || totals.hours <= 0) return null;
    const workDays = totals.hours / effectiveWorkSchedule.hoursPerDay;
    const workWeeks = totals.hours / effectiveWorkSchedule.hoursWeekly;
    if (!Number.isFinite(workDays) || workDays <= 0) return null;
    if (!Number.isFinite(workWeeks) || workWeeks <= 0) return null;
    return {
      days: Number(workDays.toFixed(2)),
      weeks: Number(workWeeks.toFixed(2)),
    };
  }, [totals, effectiveWorkSchedule]);

  const automaticInsights = useMemo(() => {
    if (!hourlyRate || !totals || !Number.isFinite(totals.hours) || totals.hours <= 0) return null;
    const roundedHours = Number(totals.hours.toFixed(2));
    if (!Number.isFinite(roundedHours) || roundedHours <= 0) return null;
    const hoursText = roundedHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const top = byCategory[0];
    const topHours = top && Number.isFinite(top.hours) && top.hours > 0 ? Number(top.hours.toFixed(2)) : null;
    const topImpact =
      top && topHours !== null
        ? `Maior impacto: ${top.name} (${topHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h)`
        : null;
    let periodComparison: string | null = null;
    if (previousTotals && previousTotals.hours > 0) {
      const variationPercent = ((totals.hours - previousTotals.hours) / previousTotals.hours) * 100;
      if (!Number.isFinite(variationPercent)) return null;
      const absVariationPercent = Number(Math.abs(variationPercent).toFixed(2));
      const variationText = absVariationPercent.toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      if (absVariationPercent < 0.1) {
        periodComparison = "Você gastou praticamente o mesmo que antes.";
      } else if (variationPercent > 0) {
        periodComparison = `Você gastou ${variationText}% a mais do que antes.`;
      } else {
        periodComparison = `Você gastou ${variationText}% a menos do que antes.`;
      }
    }
    const smartInsight =
      top && topHours !== null
        ? `Você perdeu ${topHours.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h da sua vida com ${top.name.toLowerCase()}.`
        : `Você gastou ${hoursText}h da sua vida aqui.`;
    return {
      periodSummary: `Você gastou ${hoursText} horas da sua vida aqui.`,
      topImpact,
      periodComparison,
      smartInsight,
    };
  }, [hourlyRate, totals, byCategory, previousTotals]);

  const smartAlerts = useMemo(() => {
    if (!hourlyRate || !totals || !Number.isFinite(totals.hours) || totals.hours <= 0) return [] as SmartAlert[];
    const candidates: Array<SmartAlert & { relevance: number }> = [];

    if (previousTotals && Number.isFinite(previousTotals.hours) && previousTotals.hours > 0) {
      const variationPercent = ((totals.hours - previousTotals.hours) / previousTotals.hours) * 100;
      if (Number.isFinite(variationPercent) && variationPercent >= 20) {
        candidates.push({
          id: "high-spending",
          title: "Você gastou mais",
          message: "Você já gastou mais que o normal aqui.",
          relevance: 80 + Math.min(30, variationPercent),
        });
      }
    }

    const top = byCategory[0];
    if (top && Number.isFinite(top.hours) && top.hours > 0) {
      const share = top.hours / totals.hours;
      if (Number.isFinite(share) && share >= 0.35) {
        candidates.push({
          id: "critical-category",
          title: "Você tem uma categoria que pesa mais",
          message: `Você está gastando grande parte da sua vida em ${top.name}.`,
          relevance: 70 + Math.min(25, share * 100),
        });
      }
    }

    if (goals.data && goals.data.length > 0) {
      const now = new Date();
      const atRiskGoal = goals.data
        .filter((g) => g.status === "active")
        .map((g) => {
          const target = Number(g.target_amount);
          const percentage = Number(g.percentage);
          if (!Number.isFinite(target) || target <= 0) return null;
          if (!Number.isFinite(percentage)) return null;
          const endDate = g.end_date ? parseDateOnly(g.end_date) : null;
          if (!endDate) return null;
          const startDate = g.start_date ? parseDateOnly(g.start_date) : period.from ?? null;
          if (!startDate) return null;
          const totalWindowMs = endDate.getTime() - startDate.getTime();
          if (!Number.isFinite(totalWindowMs) || totalWindowMs <= 0) return null;
          const elapsedMs = Math.min(Math.max(now.getTime() - startDate.getTime(), 0), totalWindowMs);
          const expectedPercent = (elapsedMs / totalWindowMs) * 100;
          if (!Number.isFinite(expectedPercent) || expectedPercent <= 0) return null;
          const gap = expectedPercent - percentage;
          if (!Number.isFinite(gap) || gap <= 15) return null;
          return {
            name: g.name,
            gap,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b?.gap ?? 0) - (a?.gap ?? 0))[0];

      if (atRiskGoal) {
        candidates.push({
          id: "goal-at-risk",
          title: "Você pode estourar sua meta",
          message: `Você pode não atingir a meta "${atRiskGoal.name}" aqui.`,
          relevance: 90 + Math.min(20, atRiskGoal.gap),
        });
      }
    }

    if (previousTotals && Number.isFinite(previousTotals.hours) && previousTotals.hours > 0 && period.from && period.to) {
      const rangeFrom = new Date(period.from.getFullYear(), period.from.getMonth(), period.from.getDate());
      const rangeTo = new Date(period.to.getFullYear(), period.to.getMonth(), period.to.getDate());
      const totalDays = Math.max(1, Math.round((rangeTo.getTime() - rangeFrom.getTime()) / 86400000) + 1);
      const today = new Date();
      const currentEnd = new Date(
        Math.min(today.getTime(), rangeTo.getTime())
      );
      const elapsedDays = Math.max(1, Math.round((currentEnd.getTime() - rangeFrom.getTime()) / 86400000) + 1);
      if (elapsedDays < totalDays && totals.hours > 0) {
        const projectedHours = (totals.hours / elapsedDays) * totalDays;
        if (Number.isFinite(projectedHours) && projectedHours > previousTotals.hours) {
          const extraHours = Number((projectedHours - previousTotals.hours).toFixed(2));
          if (Number.isFinite(extraHours) && extraHours > 0) {
            candidates.push({
              id: "negative-trend",
              title: "Você está indo pior",
              message: `Se continuar assim, você gastará ${extraHours.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} horas a mais do que antes.`,
              relevance: 75 + Math.min(25, extraHours),
            });
          }
        }
      }
    }

    return candidates
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3)
      .map((candidate) => ({ id: candidate.id, title: candidate.title, message: candidate.message }));
  }, [hourlyRate, totals, previousTotals, byCategory, goals.data, period.from, period.to]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_18%,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.18),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_55%,rgba(34,197,94,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_55%,rgba(34,197,94,0.14),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Horas de Vida</h2>
              <p className="mt-2 text-slate-600 dark:text-white/70">
                Veja quanto tempo de vida seus gastos representam por categoria.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={periodPreset}
                onValueChange={(v) => {
                  const preset = v as PeriodPreset;
                  setPeriodPreset(preset);
                  if (preset !== "custom") {
                    const r = getPresetRange(preset);
                    setDateRange(r.from && r.to ? { from: r.from, to: r.to } : undefined);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <span className="flex flex-1 items-center justify-between">
                    <span>{PERIOD_PRESET_LABELS[periodPreset]}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_PRESET_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="w-full sm:w-auto">
                      <CalendarIcon className="mr-2 size-4" />
                      {formatPeriodHint(periodPreset, { from: dateRange?.from, to: dateRange?.to })}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      setPeriodPreset("custom");
                      setDateRange(range);
                      if (range?.from && range?.to) setIsCalendarOpen(false);
                    }}
                    initialFocus
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </section>

      {!profile.isLoading && hourlyRate && totals && (
        <Card className="rounded-4xl border-rose-500/25 bg-gradient-to-br from-rose-50 via-white to-white shadow-sm dark:from-rose-500/10 dark:via-slate-950/20 dark:to-transparent dark:border-rose-400/20">
          <CardHeader>
            <CardTitle className="text-base">Você gastou</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-muted-foreground">Somando tudo o que você registrou</div>
            <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {formatBRL(totals.totalExpense)}
            </div>
            <div className="text-sm text-muted-foreground">
              Isso dá{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{totals.hours.toFixed(2)} horas</span>{" "}
              da sua vida
              <br />
              <span className="text-muted-foreground">
                (≈ {(workTimeEquivalents?.days ?? 0).toFixed(2)} dias de trabalho ou {(workTimeEquivalents?.weeks ?? 0).toFixed(2)} semanas de trabalho)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {!profile.isLoading && hourlyRate && (
        <LifeCostCalculator hourlyRate={hourlyRate} workSchedule={effectiveWorkSchedule} />
      )}

      {!profile.isLoading && hourlyRate && totals && (
        <AutomaticInsightsCard data={automaticInsights} isPreviousLoading={Boolean(previousPeriod && previousTransactions.isLoading)} />
      )}

      {!profile.isLoading && !goals.isLoading && (
        <AlertsCard alerts={smartAlerts} />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Impacto por categoria</CardTitle>
          <Clock className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.isLoading || categories.isLoading || transactions.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ) : !hourlyRate ? (
            <div className="text-sm text-muted-foreground">
              Defina seu valor/hora em{" "}
              <Link href="/settings" className="underline underline-offset-4">
                Configurações
              </Link>{" "}
              para ver o impacto em horas.
            </div>
          ) : byCategory.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Você ainda não tem despesas com categoria aqui.
            </div>
          ) : (
            <div className="space-y-2">
              {byCategory.map((c) => {
                const Icon = getLucideIconByName(c.icon);
                const hoursText = c.hours.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const color = (c.color ?? "").trim().length > 0 ? (c.color ?? "").trim() : "#94a3b8";

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-card/18 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full border border-black/5 dark:border-white/10"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      {Icon && (
                        <span className="shrink-0 text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">Você gastou: {formatBRL(c.total)}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">{hoursText}h</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
