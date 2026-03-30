 "use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, CalendarIcon, DollarSign, PiggyBank, Wallet } from "lucide-react";
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
import { formatBRL } from "@/lib/currency";
import { parseDateOnly } from "@/lib/date";
import { formatPeriodHint, getPresetRange, PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/period";

function formatMonthLabel(monthKey: string) {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function DashboardPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });

  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  const summary = useFinancialSummary({ from: dateRange?.from, to: dateRange?.to });
  const transactions = useTransactions({ from: dateRange?.from, to: dateRange?.to });
  const upcoming = useUpcomingTransactions({ from: dateRange?.from, to: dateRange?.to });
  const timeline = useFinancialTimeline();

  const recentTransactions = useMemo(() => {
    const list = transactions.data ?? [];
    return list.slice(0, 6);
  }, [transactions.data]);

  const lateCount = upcoming.data?.late.length ?? 0;
  const upcomingList = upcoming.data?.upcoming ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
            <p className="text-muted-foreground">
              Acompanhe o resumo das suas finanças e metas.
            </p>
            <div className="text-sm text-muted-foreground">Exibindo dados de: {periodHint}</div>
          </div>

          <div className="flex items-center gap-2">
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
              <SelectTrigger className="w-[200px]">
                <span className="flex flex-1 text-left">{PERIOD_PRESET_LABELS[periodPreset]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger render={<Button variant="outline" size="icon" />}>
                <CalendarIcon className="size-4 opacity-60" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setPeriodPreset("custom");
                    setDateRange(range);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.isLoading ? "—" : formatBRL(summary.data?.balance ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Saldo calculado pelas transações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <ArrowUpRight className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {summary.isLoading ? "—" : formatBRL(summary.data?.incomeTotal ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de receitas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <ArrowDownRight className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {summary.isLoading ? "—" : formatBRL(summary.data?.expenseTotal ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de despesas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Economia</CardTitle>
            <PiggyBank className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R$ —</div>
            <p className="text-xs text-muted-foreground mt-1">Em breve: cálculo automático</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">📈 Evolução Financeira</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {timeline.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (timeline.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma transação suficiente para montar a evolução.</div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
                  <div className="col-span-5">Mês</div>
                  <div className="col-span-3 text-right">Saldo</div>
                  <div className="col-span-4 text-right">Acumulado</div>
                </div>
                <div className="max-h-[260px] overflow-auto divide-y">
                  {(timeline.data ?? []).map((p) => (
                    <div key={p.month} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
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
                          "col-span-4 text-right font-semibold " +
                          (p.accumulated >= 0 ? "text-emerald-500" : "text-destructive")
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

        <Card className="col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Transações Recentes</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {transactions.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma transação ainda.</div>
            ) : (
              <div className="divide-y rounded-lg border">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {t.description || (t.type === "income" ? "Receita" : "Despesa")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.type === "income" ? "Receita" : "Despesa"} • {t.status}
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

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Contas no período{lateCount > 0 ? ` • ${lateCount} atrasada(s)` : ""}
            </CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcoming.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : upcomingList.length === 0 && lateCount === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhuma conta a vencer ou atrasada no período.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {(upcoming.data?.late ?? []).slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-destructive/5">
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
                  <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
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
