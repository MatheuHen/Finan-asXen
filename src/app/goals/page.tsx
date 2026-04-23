"use client";

import { useMemo, useState } from "react";
import { CalendarIcon, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatPeriodHint, getPresetRange, PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/period";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDateOnly } from "@/lib/date";
import { CountUp } from "@/components/ui/count-up";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from "@/hooks/financial/useGoals";
import type { GoalType, GoalWithProgress } from "@/services/financial/goals.service";

function typeLabel(t: GoalType) {
  if (t === "economy") return "Economia";
  if (t === "spending_limit") return "Limite de gasto";
  return "Dívida";
}

function statusBadgeClass(status: string) {
  if (status === "completed")
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200";
  if (status === "late")
    return "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/35 dark:bg-destructive/10 dark:text-rose-200";
  return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200";
}

function statusCardBorderClass(status: string) {
  if (status === "completed") return "border-emerald-500/30 dark:border-emerald-400/25";
  if (status === "late") return "border-rose-500/30 dark:border-rose-400/25";
  return "border-blue-500/30 dark:border-sky-400/25";
}

function formatBRLAnimated(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return formatBRL(Number(v.toFixed(2)));
}

function formatPercentAnimated(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return String(Math.round(v)) + "%";
}

export default function GoalsPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const r = getPresetRange("month");
    return r.from ? ({ from: r.from, to: r.to } as DateRange) : undefined;
  });

  const periodHint = formatPeriodHint(periodPreset, dateRange ?? {});

  const period = useMemo(() => ({ from: dateRange?.from, to: dateRange?.to }), [dateRange?.from, dateRange?.to]);
  const goals = useGoals(period);
  const { mutate: createGoal, isPending: isCreating } = useCreateGoal();
  const { mutate: updateGoal, isPending: isUpdating } = useUpdateGoal();
  const { mutate: deleteGoal, isPending: isDeleting } = useDeleteGoal();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<GoalWithProgress | null>(null);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [type, setType] = useState<GoalType>("economy");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isSaving = isCreating || isUpdating;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const goalCards = useMemo(() => {
    const list = goals.data ?? [];
    return list.map((g) => {
      const target = Number(g.target_amount ?? 0);
      const current = Number(g.current_amount ?? 0);
      const delta = target - current;
      const remaining = Math.max(0, delta);
      const over = Math.max(0, -delta);

      let daysText: string | null = null;
      if (g.end_date) {
        const end = parseDateOnly(g.end_date);
        if (end) {
          end.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((end.getTime() - today.getTime()) / 86400000);
          if (diffDays >= 0) daysText = "Restam " + diffDays + " dia(s)";
          else daysText = "Meta atrasada há " + Math.abs(diffDays) + " dia(s)";
        }
      }

      const remainingText = (() => {
        if (g.type === "spending_limit") {
          if (over > 0) return "Você ultrapassou o limite em " + formatBRL(over);
          return "Você ainda pode gastar " + formatBRL(remaining) + " aqui";
        }

        if (g.type === "debt") {
          if (g.status === "completed") return "Dívida quitada com sucesso";
          return "Faltam " + formatBRL(remaining) + " para quitar sua dívida";
        }

        if (g.status === "completed") return "Meta de economia concluída 🎉";
        return "Faltam " + formatBRL(remaining) + " para atingir sua meta de economia";
      })();

      return {
        ...g,
        target,
        current,
        remaining,
        over,
        daysText,
        remainingText,
        cardBorderClass: statusCardBorderClass(g.status),
        badgeClass: statusBadgeClass(g.status),
      };
    });
  }, [goals.data, today]);

  function openCreate() {
    setEditingGoal(null);
    setName("");
    setTargetAmount("");
    setType("economy");
    setStartDate("");
    setEndDate("");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(goal: GoalWithProgress) {
    setEditingGoal(goal);
    setName(goal.name ?? "");
    setTargetAmount(String(goal.target_amount ?? ""));
    setType(goal.type);
    setStartDate(goal.start_date ?? "");
    setEndDate(goal.end_date ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  function submitForm() {
    const trimmed = name.trim();
    const target = Number(targetAmount);
    if (!trimmed) {
      setFormError("Você precisa informar um nome para a meta.");
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      setFormError("Você precisa informar um valor alvo válido.");
      return;
    }

    const start = startDate ? new Date(startDate + "T00:00:00") : null;
    const end = endDate ? new Date(endDate + "T00:00:00") : null;
    if (start && end && start.getTime() > end.getTime()) {
      setFormError("A data de início não pode ser maior que a data de fim.");
      return;
    }

    setFormError(null);
    if (editingGoal) {
      updateGoal(
        { id: editingGoal.id, name: trimmed, target_amount: target, type, start_date: start, end_date: end },
        {
          onSuccess: () => setFormOpen(false),
          onError: (e) =>
            setFormError(e instanceof Error ? e.message : "Você não conseguiu atualizar sua meta. Tente novamente."),
        }
      );
      return;
    }

    createGoal(
      { name: trimmed, target_amount: target, type, start_date: start, end_date: end },
      {
        onSuccess: () => setFormOpen(false),
        onError: (e) =>
          setFormError(e instanceof Error ? e.message : "Você não conseguiu adicionar sua meta. Tente novamente."),
      }
    );
  }

  function confirmDelete(goal: GoalWithProgress) {
    setDeletingGoal(goal);
    setDeleteOpen(true);
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_15%,rgba(34,197,94,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_15%,rgba(34,197,94,0.2),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_75%_50%,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_75%_50%,rgba(56,189,248,0.2),transparent_55%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">Você acompanha suas metas</h2>
            <p className="text-slate-600 dark:text-white/70">Você acompanha seu progresso com suas movimentações.</p>
            <div className="text-sm text-slate-600 dark:text-white/60">Você está vendo: {periodHint}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreate} className="gap-2">
              <Plus className="size-4" />
              Adicionar
            </Button>

            <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white/70 p-2 shadow-[0_0_0_1px_rgba(59,130,246,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
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
                <SelectTrigger className="w-[220px] bg-white border-slate-200 text-slate-900 shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-white">
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

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Selecionar período"
                      className="bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                    >
                      <CalendarIcon className="size-4 opacity-80" />
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

      {goals.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Metas</CardTitle>
              <Target className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-2/5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Metas</CardTitle>
              <Target className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-2/5" />
            </CardContent>
          </Card>
        </div>
      ) : (goals.data?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Suas metas</CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Você ainda não criou metas. Clique em “Nova Meta” para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goalCards.map((g) => (
            <Card key={g.id} className={"overflow-hidden " + g.cardBorderClass}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{g.name}</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{typeLabel(g.type)}</span>
                    <span
                      className={
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                        g.badgeClass
                      }
                    >
                      {g.status === "completed" ? "Concluída" : g.status === "late" ? "Atrasada" : "Ativa"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Editar meta"
                    onClick={() => openEdit(g)}
                    disabled={isSaving || isDeleting}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Remover meta"
                    onClick={() => confirmDelete(g)}
                    disabled={isSaving || isDeleting}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Valor atual</div>
                    <div className="text-sm font-semibold">
                      <CountUp value={g.current} format={formatBRLAnimated} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Valor alvo</div>
                    <div className="text-sm font-semibold">{formatBRL(g.target)}</div>
                  </div>
                </div>

                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <div>{g.remainingText}</div>
                  {g.daysText && <div>{g.daysText}</div>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progresso</span>
                    <span className="font-medium text-foreground">
                      <CountUp value={g.percentage ?? 0} format={formatPercentAnimated} />
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, g.percentage ?? 0))}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Você ajusta sua meta" : "Você adiciona uma meta"}</DialogTitle>
            <DialogDescription>
              Você vê seu progresso somando suas movimentações do que você escolheu ver.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Nome</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reserva de emergência" />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Valor alvo</div>
              <Input
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Ex: 5000"
                inputMode="decimal"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Tipo</div>
              <Select value={type} onValueChange={(v) => setType(v as GoalType)}>
                <SelectTrigger>
                  <span className="flex flex-1 text-left">{typeLabel(type)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="economy">Economia</SelectItem>
                  <SelectItem value="spending_limit">Limite de gasto</SelectItem>
                  <SelectItem value="debt">Dívida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <div className="text-sm font-medium">Data início</div>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium">Data fim</div>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {formError && <div className="text-sm text-destructive">{formError}</div>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingGoal ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Remover meta</DialogTitle>
            <DialogDescription>
              Você quer remover a meta “{deletingGoal?.name ?? ""}”?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const id = deletingGoal?.id;
                if (!id) return;
                deleteGoal(id, { onSuccess: () => setDeleteOpen(false) });
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
