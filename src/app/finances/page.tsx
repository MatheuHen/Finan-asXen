"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarIcon,
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Pencil,
  SlidersHorizontal,
  Trash2,
  X,
  ArrowDown,
  ArrowUp,
  Clock,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { formatBRL } from "@/lib/currency";
import { formatPeriodHint, type PeriodPreset } from "@/lib/period";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import { 
  useTransactions, 
  useCreateTransaction, 
  useUpdateTransaction, 
  useDeleteTransaction,
  useDeleteTransactionsInRange
} from "@/hooks/financial/useTransactions";
import { useFinancialSummary } from "@/hooks/financial/useFinancialSummary";
import { useUpcomingTransactions } from "@/hooks/financial/useUpcomingTransactions";
import { useCategories } from "@/hooks/financial/useCategories";
import { useProfile } from "@/hooks/auth/useProfile";
import { TransactionForm, type TransactionFormValues } from "./components/TransactionForm";
import type {
  CreateTransactionDTO,
  RecurrenceType,
  RecurrenceUnit,
  UpdateTransactionDTO,
} from "@/services/financial/transactions.service";
import type { Transaction, TransactionStatus, TransactionType } from "@/services/financial/transactions.service";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  late: "Atrasado",
  cancelled: "Cancelado",
};

const recurrenceTypeLabel: Record<RecurrenceType, string> = {
  daily: "diária",
  weekly: "semanal",
  monthly: "mensal",
  yearly: "anual",
  custom: "personalizada",
};

const recurrenceUnitLabel: Record<RecurrenceUnit, string> = {
  day: "dia(s)",
  week: "semana(s)",
  month: "mês(es)",
  year: "ano(s)",
};

const typeFilterLabels: Record<"all" | TransactionType, string> = {
  all: "Todos",
  income: "Receitas",
  expense: "Despesas",
};

const statusFilterLabels: Record<"all" | TransactionStatus, string> = {
  all: "Todos",
  pending: "Pendente",
  paid: "Pago",
  late: "Atrasado",
  cancelled: "Cancelado",
};

function getStatusBadgeClass(status: TransactionStatus) {
  if (status === "paid") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  if (status === "pending") return "border-amber-500/20 bg-amber-500/10 text-amber-600";
  if (status === "late") return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function formatGroupLabel(dateString: string) {
  const date = parseDateOnly(dateString) ?? new Date(dateString);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startDate.getTime()) / 86400000);

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR");
}

function formatMonthLabel(monthKey: string) {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey;
  const d = new Date(y, m - 1, 1);
  const base = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return base.length > 0 ? base[0].toUpperCase() + base.slice(1) : base;
}

function monthKeyFromDate(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return String(y) + "-" + String(m).padStart(2, "0");
}

function rangeFromMonthKey(monthKey: string) {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from, to };
  }
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);
  return { from, to };
}

function sortMonthKeysDesc(keys: string[]) {
  return [...keys].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

type DayGroup = {
  dateKey: string;
  label: string;
  items: (Transaction & { balance: number })[];
};

function groupTransactionsByDay(transactions: (Transaction & { balance: number })[]) {
  const map = new Map<string, DayGroup>();
  const groups: DayGroup[] = [];

  for (const t of transactions) {
    const dateKey = t.due_date;
    let day = map.get(dateKey);
    if (!day) {
      day = { dateKey, label: formatGroupLabel(dateKey), items: [] };
      map.set(dateKey, day);
      groups.push(day);
    }
    day.items.push(t);
  }

  return groups.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
}

type ToastItem = {
  id: string;
  title: string;
  description?: string;
};

function getErrorMessage(error: unknown) {
  if (!error) return null;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : typeof error === "string"
          ? error
          : "";
  if (message.trim().startsWith("Você")) return message;
  return "Você não conseguiu concluir isso. Tente novamente.";
}

export default function FinancesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [deleteMonthOpen, setDeleteMonthOpen] = useState(false);
  const [deleteMonthConfirm, setDeleteMonthConfirm] = useState("");
  const [deleteMonthTransactionsOpen, setDeleteMonthTransactionsOpen] = useState(false);
  const [deleteMonthTransactionsConfirm, setDeleteMonthTransactionsConfirm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [newDefaultDueDate, setNewDefaultDueDate] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionStatus>("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<"all" | "recurring" | "nonRecurring">(
    "all"
  );
  const initialMonthKey = monthKeyFromDate(new Date());
  const [monthTabs, setMonthTabs] = useState<string[]>(() => [initialMonthKey]);

  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => initialMonthKey);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const periodPreset: PeriodPreset = "month";
  const dateRange = useMemo(() => rangeFromMonthKey(activeMonthKey), [activeMonthKey]);

  useEffect(() => {
    try {
      const rawMonths = window.localStorage.getItem("finances_month_tabs_v1");
      const rawActive = window.localStorage.getItem("finances_active_month_v1");

      const parsed = rawMonths ? (JSON.parse(rawMonths) as unknown) : null;
      const months = Array.isArray(parsed)
        ? parsed.filter((x) => typeof x === "string" && /^\d{4}-\d{2}$/.test(x))
        : [];

      const merged = sortMonthKeysDesc(Array.from(new Set([initialMonthKey, ...months])));
      const nextTabs = merged.length > 0 ? merged : [initialMonthKey];
      setMonthTabs(nextTabs);

      const active =
        typeof rawActive === "string" && /^\d{4}-\d{2}$/.test(rawActive) ? rawActive : initialMonthKey;
      setActiveMonthKey(nextTabs.includes(active) ? active : nextTabs[0] ?? initialMonthKey);
    } catch {
    } finally {
      setStorageLoaded(true);
    }
  }, [initialMonthKey]);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      window.localStorage.setItem("finances_month_tabs_v1", JSON.stringify(monthTabs));
    } catch {}
  }, [monthTabs, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      window.localStorage.setItem("finances_active_month_v1", activeMonthKey);
    } catch {}
  }, [activeMonthKey, storageLoaded]);

  const { data: transactions, isLoading, error: listError } = useTransactions({
    from: dateRange.from,
    to: dateRange.to,
  });
  const summary = useFinancialSummary({ from: dateRange.from, to: dateRange.to });
  const upcoming = useUpcomingTransactions({ from: dateRange.from, to: dateRange.to });
  const categories = useCategories();
  const profile = useProfile();
  const {
    mutate: createTransaction,
    isPending: isCreating,
    error: createError,
    reset: resetCreateError,
  } = useCreateTransaction();
  const {
    mutate: updateTransaction,
    isPending: isUpdating,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateTransaction();
  const {
    mutate: deleteTransaction,
    isPending: isDeleting,
    error: deleteError,
    reset: resetDeleteError,
  } = useDeleteTransaction();
  const {
    mutate: deleteTransactionsInRange,
    isPending: isDeletingInRange,
    error: deleteInRangeError,
    reset: resetDeleteInRangeError,
  } = useDeleteTransactionsInRange();

  const categoryMetaById = useMemo(() => {
    const m = new Map<string, { name: string; color?: string | null }>();
    for (const c of categories.data ?? []) m.set(c.id, { name: c.name, color: c.color });
    return m;
  }, [categories.data]);

  const hourlyRate = useMemo(() => {
    const v = profile.data?.hourly_rate;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [profile.data?.hourly_rate]);

  const removeMonthTab = (monthKey: string) => {
    setMonthTabs((prev) => {
      const nextRaw = prev.filter((m) => m !== monthKey);
      const next = sortMonthKeysDesc(nextRaw.length > 0 ? nextRaw : [initialMonthKey]);
      const nextActive = monthKey === activeMonthKey ? (next[0] ?? initialMonthKey) : activeMonthKey;
      setActiveMonthKey(next.includes(nextActive) ? nextActive : next[0] ?? initialMonthKey);
      return next;
    });
  };

  const handleOpenDialog = (transaction?: Transaction) => {
    setEditingTransaction(transaction || null);
    resetCreateError();
    resetUpdateError();
    if (!transaction) {
      const today = new Date();
      const todayKey = monthKeyFromDate(today);
      const due = activeMonthKey === todayKey ? today : rangeFromMonthKey(activeMonthKey).from;
      setNewDefaultDueDate(due);
    } else {
      setNewDefaultDueDate(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTransaction(null);
    setNewDefaultDueDate(null);
  };

  const pushToast = (toast: Omit<ToastItem, "id">) => {
    const id = Date.now().toString() + "-" + Math.random().toString(16).slice(2);
    setToasts((prev) => [...prev, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };


  const onSubmit = (data: TransactionFormValues) => {
    const desc = (data.description ?? "").trim();
    if (data.amount === null || !Number.isFinite(data.amount)) return;
    const payload: CreateTransactionDTO = {
      amount: Number(data.amount),
      type: data.type,
      status: data.status,
      description: desc.length > 0 ? desc : null,
      category_id: data.category_id ?? null,
      due_date: formatDateOnly(data.due_date),
      is_recurring: data.is_recurring,
      recurrence_type: data.recurrence_type,
      recurrence_interval: data.recurrence_interval,
      recurrence_unit: data.recurrence_unit,
      recurrence_start_date: data.recurrence_start_date ? formatDateOnly(data.recurrence_start_date) : null,
      recurrence_end_date: data.recurrence_end_date ? formatDateOnly(data.recurrence_end_date) : null,
    };

    const isRecurring = Boolean(data.is_recurring);
    payload.is_recurring = isRecurring;
    if (!isRecurring) {
      payload.recurrence_type = null;
      payload.recurrence_interval = null;
      payload.recurrence_unit = null;
      payload.recurrence_start_date = null;
      payload.recurrence_end_date = null;
    } else {
      const type = data.recurrence_type ?? "monthly";
      payload.recurrence_type = type;
      if (type === "custom") {
        payload.recurrence_interval = data.recurrence_interval ?? null;
        payload.recurrence_unit = data.recurrence_unit ?? null;
      } else {
        payload.recurrence_interval = null;
        payload.recurrence_unit = null;
      }
    }

    if (editingTransaction) {
      const updatePayload: UpdateTransactionDTO = { id: editingTransaction.id, ...payload };
      if (editingTransaction.recurrence_source_id) {
        const rest: Partial<UpdateTransactionDTO> = { ...updatePayload };
        delete rest.id;
        delete rest.is_recurring;
        delete rest.recurrence_type;
        delete rest.recurrence_interval;
        delete rest.recurrence_unit;
        delete rest.recurrence_start_date;
        delete rest.recurrence_end_date;
        updateTransaction(
          { id: editingTransaction.id, ...rest },
          {
            onSuccess: () => {
              handleCloseDialog();
              pushToast({
                title: "Você salvou sua movimentação",
                description: "Você salvou suas mudanças.",
              });
            },
          }
        );
        return;
      }

      updateTransaction(
        updatePayload,
        {
          onSuccess: () => {
            handleCloseDialog();
            pushToast({
              title: "Você salvou sua movimentação",
              description: "Você salvou suas mudanças.",
            });
          },
        }
      );
      return;
    }

    createTransaction(payload, {
      onSuccess: () => {
        handleCloseDialog();
        pushToast({
          title: "Você adicionou uma movimentação",
          description: "Você adicionou sua movimentação.",
        });
      },
    });
  };

  const handleDelete = (id: string) => {
    resetDeleteError();
    const tx = (transactions ?? []).find((t) => t.id === id) ?? null;
    setDeletingTransaction(tx);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingTransaction) return;
    if (isDeleting) return;
    const stillExists = (transactions ?? []).some((t) => t.id === deletingTransaction.id);
    if (!stillExists) {
      setDeleteDialogOpen(false);
      setDeletingTransaction(null);
      pushToast({
        title: "Você já removeu isso",
        description: "Você não encontra mais essa movimentação na lista.",
      });
      return;
    }
    deleteTransaction(deletingTransaction.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setDeletingTransaction(null);
        pushToast({
          title: "Você removeu a movimentação",
          description: "Você removeu a movimentação.",
        });
      },
    });
  };

  const filteredTransactions = useMemo(() => {
    const list = transactions ?? [];
    const q = search.trim().toLowerCase();

    const filtered = list.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      const isRecurring = Boolean(t.recurrence_source_id || t.is_recurring);
      if (recurrenceFilter === "recurring" && !isRecurring) return false;
      if (recurrenceFilter === "nonRecurring" && isRecurring) return false;
      if (q) {
        const desc = (t.description ?? "").toLowerCase();
        if (!desc.includes(q)) return false;
      }
      return true;
    });

    // Ordenar do mais antigo para o mais novo para calcular o saldo acumulado
    const sorted = [...filtered].sort((a, b) => {
      if (a.due_date < b.due_date) return -1;
      if (a.due_date > b.due_date) return 1;
      return a.created_at < b.created_at ? -1 : 1;
    });

    const withBalance = sorted.reduce(
      (acc, t) => {
        const amount = Number(t.amount || 0);
        const nextBalance = acc.balance + (t.type === "income" ? amount : -amount);
        return {
          balance: nextBalance,
          items: [...acc.items, { ...t, balance: nextBalance }],
        };
      },
      { balance: 0, items: [] as Array<(typeof sorted)[number] & { balance: number }> }
    ).items;

    // Retornar do mais novo para o mais antigo (padrão de extrato)
    return withBalance.reverse();
  }, [transactions, search, typeFilter, statusFilter, recurrenceFilter]);

  const groupedDays = useMemo(() => groupTransactionsByDay(filteredTransactions), [filteredTransactions]);

  const microcopy = useMemo(() => {
    if (upcoming.isLoading || upcoming.error) return null;
    const lateCount = upcoming.data?.late.length ?? 0;
    const upcomingCount = upcoming.data?.upcoming.length ?? 0;

    if (lateCount > 0) {
      return {
        tone: "danger" as const,
        text: "Você tem " + lateCount + " conta(s) atrasada(s) aqui.",
      };
    }
    if (upcomingCount > 0)
      return {
        tone: "warning" as const,
        text: "Você tem " + upcomingCount + " conta(s) perto do vencimento aqui.",
      };
    return { tone: "success" as const, text: "Tudo em dia. Nenhuma conta pendente." };
  }, [upcoming.isLoading, upcoming.error, upcoming.data]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim().length > 0) count++;
    if (typeFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (recurrenceFilter !== "all") count++;
    return count;
  }, [search, typeFilter, statusFilter, recurrenceFilter]);

  const hasFilters =
    search.trim().length > 0 ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    recurrenceFilter !== "all";

  const sortedMonthTabs = useMemo(() => sortMonthKeysDesc(monthTabs), [monthTabs]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 shadow-sm dark:border-white/10 dark:from-[#050816] dark:via-[#11123a] dark:to-black dark:text-white dark:shadow-[0_30px_120px_-70px_rgba(0,0,0,0.85)]">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_22%_18%,rgba(59,130,246,0.14),transparent_55%)] dark:bg-[radial-gradient(circle_at_22%_18%,rgba(56,189,248,0.22),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_78%_48%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_48%,rgba(139,92,246,0.2),transparent_55%)]" />
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_55%_90%,rgba(34,197,94,0.08),transparent_60%)] dark:bg-[radial-gradient(circle_at_55%_90%,rgba(34,197,94,0.14),transparent_60%)]" />
          <div className="absolute inset-0 ring-1 ring-slate-200/70 dark:ring-white/10" />
        </div>
        <div className="relative flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Gestão Financeira</h2>
          <p className="mt-2 text-slate-600 dark:text-white/70">Controle entradas, saídas e acompanhe o seu saldo com clareza.</p>
          <div className="mt-2 text-sm text-slate-600 dark:text-white/60">
            Exibindo dados de: {formatPeriodHint(periodPreset, dateRange)}
          </div>
          {microcopy && (
            <div
              className={
                microcopy.tone === "danger"
                  ? "mt-3 inline-flex items-center rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-sm font-medium text-rose-700 dark:text-rose-200"
                  : microcopy.tone === "warning"
                    ? "mt-3 inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-200"
                    : "mt-3 inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-200"
              }
            >
              {microcopy.text}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            {sortedMonthTabs.map((monthKey) => (
              <Button
                key={monthKey}
                type="button"
                size="sm"
                variant={monthKey === activeMonthKey ? "secondary" : "outline"}
                onClick={() => setActiveMonthKey(monthKey)}
                className={
                  monthKey === activeMonthKey
                    ? "bg-blue-50 border-blue-200 text-blue-700 shadow-[0_0_40px_-28px_rgba(59,130,246,0.45)] dark:bg-white/10 dark:border-white/15 dark:text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                }
              >
                {formatMonthLabel(monthKey)}
              </Button>
            ))}

            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                  >
                    <CalendarIcon className="mr-2 size-4 opacity-60" />
                    Novo mês
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(d) => {
                    if (!d) return;
                    const mk = monthKeyFromDate(d);
                    setMonthTabs((prev) => sortMonthKeysDesc(Array.from(new Set([...prev, mk]))));
                    setActiveMonthKey(mk);
                    setMonthPickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                  >
                    <MoreHorizontal className="mr-2 size-4 opacity-60" />
                    Ações
                  </Button>
                }
              />
              <PopoverContent className="w-[260px] p-2" align="start">
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => {
                      resetDeleteInRangeError();
                      setDeleteMonthTransactionsConfirm("");
                      setDeleteMonthTransactionsOpen(true);
                    }}
                  >
                    Remover contas do mês
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setDeleteMonthConfirm("");
                      setDeleteMonthOpen(true);
                    }}
                  >
                    Remover mês
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger
            render={
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-blue-600/10 border-blue-200 text-blue-700 hover:bg-blue-600/15 dark:bg-sky-500/15 dark:border-sky-400/25 dark:text-white dark:hover:bg-sky-500/20"
              >
                <Plus className="mr-2 size-4" />
                Adicionar
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? "Editar" : "Adicionar"}
              </DialogTitle>
            </DialogHeader>
            {(createError || updateError) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getErrorMessage(createError) || getErrorMessage(updateError)}
              </div>
            )}
            <TransactionForm 
              initialData={editingTransaction} 
              onSubmit={onSubmit} 
              isSubmitting={isCreating || isUpdating} 
              defaultDueDate={newDefaultDueDate ?? undefined}
            />
          </DialogContent>
        </Dialog>
        </div>
      </section>

      {(listError || deleteError || deleteInRangeError || summary.error) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
          <div>
            {getErrorMessage(listError) ||
              getErrorMessage(deleteError) ||
              getErrorMessage(deleteInRangeError) ||
              getErrorMessage(summary.error)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetDeleteError();
              resetDeleteInRangeError();
              window.location.reload();
            }}
          >
            Recarregar
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.isLoading ? "—" : formatBRL(summary.data?.balance ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{formatMonthLabel(activeMonthKey)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {summary.isLoading ? "—" : formatBRL(summary.data?.incomeTotal ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{formatMonthLabel(activeMonthKey)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {summary.isLoading ? "—" : formatBRL(summary.data?.expenseTotal ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{formatMonthLabel(activeMonthKey)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky top-14 z-20">
        <div className="rounded-md border bg-background shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFiltersOpen((v) => !v)}
                className="gap-2"
              >
                <SlidersHorizontal className="size-4" />
                Filtros
              </Button>
              <div className="text-sm text-muted-foreground">
                {activeFiltersCount > 0
                  ? activeFiltersCount + " filtro(s) ativo(s)"
                  : "Nenhum filtro aplicado"}
              </div>
            </div>

            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setRecurrenceFilter("all");
                }}
              >
                Limpar
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="px-4 pb-4">
              <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-4">
                  <div className="text-sm font-medium">Buscar</div>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por descrição..."
                  />
                </div>

                <div className="lg:col-span-2">
                  <div className="text-sm font-medium">Tipo</div>
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => setTypeFilter(v as "all" | TransactionType)}
                  >
                    <SelectTrigger>
                      <span className="flex flex-1 text-left">{typeFilterLabels[typeFilter]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="income">Receitas</SelectItem>
                      <SelectItem value="expense">Despesas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2">
                  <div className="text-sm font-medium">Status</div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as "all" | TransactionStatus)}
                  >
                    <SelectTrigger>
                      <span className="flex flex-1 text-left">{statusFilterLabels[statusFilter]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="late">Atrasado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2">
                  <div className="text-sm font-medium">Repetição</div>
                  <Select
                    value={recurrenceFilter}
                    onValueChange={(v) =>
                      setRecurrenceFilter(v as "all" | "recurring" | "nonRecurring")
                    }
                  >
                    <SelectTrigger>
                      <span className="flex flex-1 text-left">
                        {recurrenceFilter === "all"
                          ? "Todas"
                          : recurrenceFilter === "recurring"
                            ? "Com repetição"
                            : "Sem repetição"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="recurring">Com repetição</SelectItem>
                      <SelectItem value="nonRecurring">Sem repetição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>
          )}
          <div className="px-4 pb-3 text-sm text-muted-foreground">
            Você está vendo {filteredTransactions.length} de {transactions?.length ?? 0}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
            <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p>Você está carregando suas movimentações...</p>
          </div>
        ) : groupedDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4 bg-card rounded-2xl border border-dashed">
            <Receipt className="size-12 opacity-20" />
            <p className="text-lg font-medium">{hasFilters ? "Você não viu nada com esses filtros." : "Você ainda não adicionou nenhuma movimentação"}</p>
            {!hasFilters && <p className="text-sm opacity-70">Você pode começar adicionando uma entrada ou uma saída</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedDays.map((day) => {
              const incomeTotal = day.items
                .filter((t) => t.type === "income")
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);
              const expenseTotal = day.items
                .filter((t) => t.type === "expense")
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);

              return (
                <div key={day.dateKey} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between border-b pb-2 px-2">
                    <span className="text-sm font-semibold text-muted-foreground">{day.label}</span>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      {incomeTotal > 0 && (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <ArrowUp className="size-3" />
                          {formatBRL(incomeTotal)}
                        </span>
                      )}
                      {expenseTotal > 0 && (
                        <span className="text-destructive flex items-center gap-1">
                          <ArrowDown className="size-3" />
                          {formatBRL(expenseTotal)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {day.items.map((transaction) => {
                      const isRecurring = Boolean(
                        transaction.recurrence_source_id || transaction.is_recurring
                      );
                      const isVirtual = transaction.id.startsWith("virtual:");
                      const recurrenceType = (transaction.recurrence_type as RecurrenceType | null) ?? null;
                      const recurrenceInterval =
                        Number.isFinite(transaction.recurrence_interval) && Number(transaction.recurrence_interval) >= 1
                          ? Math.trunc(Number(transaction.recurrence_interval))
                          : 1;
                      const recurrenceUnit = (transaction.recurrence_unit as RecurrenceUnit | null) ?? null;
                      const recurrenceText =
                        recurrenceType === "custom"
                          ? `Você repete a cada ${recurrenceInterval} ${recurrenceUnit ? recurrenceUnitLabel[recurrenceUnit] : "unidade"}`
                          : recurrenceType
                            ? `Você repete ${recurrenceTypeLabel[recurrenceType]}`
                            : transaction.recurrence_source_id
                              ? "Você está vendo uma conta repetida"
                              : null;

                      return (
                        <div
                          key={transaction.id}
                          className="group relative flex items-center justify-between p-3 rounded-2xl hover:bg-muted/50 transition-all duration-200"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div
                              className={`flex-shrink-0 size-10 rounded-full flex items-center justify-center ${
                                transaction.type === "income"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {transaction.type === "income" ? (
                                <ArrowUpRight className="size-5" />
                              ) : (
                                <ArrowDownRight className="size-5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">
                                  {transaction.description || "Sem descrição"}
                                </p>
                                {isRecurring && (
                                  <Clock className="size-3 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                <span
                                  className={
                                    "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium " +
                                    getStatusBadgeClass(transaction.status)
                                  }
                                >
                                  {statusLabels[transaction.status] || transaction.status}
                                </span>
                                <span className="flex items-center gap-1 opacity-70">
                                  <span
                                    className="size-2.5 rounded-full border border-black/5 dark:border-white/10"
                                    style={{
                                      backgroundColor: transaction.category_id
                                        ? categoryMetaById.get(transaction.category_id)?.color ?? "transparent"
                                        : "transparent",
                                    }}
                                    aria-hidden
                                  />
                                  {transaction.category_id
                                    ? categoryMetaById.get(transaction.category_id)?.name ?? "Sem categoria"
                                    : "Sem categoria"}
                                </span>
                                {recurrenceText && (
                                  <span className="inline-flex items-center rounded-full border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-medium dark:border-white/15">
                                    {recurrenceText}
                                  </span>
                                )}
                                {transaction.recurrence_source_id && (
                                  <span className="inline-flex items-center rounded-full border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-medium dark:border-white/15">
                                    origem: {transaction.recurrence_source_id.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                            <p
                              className={`font-semibold text-sm ${
                                transaction.type === "income"
                                  ? "text-emerald-600"
                                  : ""
                              }`}
                            >
                              {transaction.type === "income" ? "+" : "-"}
                              {formatBRL(Number(transaction.amount))}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-medium">
                              Você fica com: {formatBRL(transaction.balance)}
                            </p>
                            {transaction.type === "expense" && hourlyRate && (
                              <p className="text-[11px] text-muted-foreground">
                                Você gastou{" "}
                                {(
                                  Number(transaction.amount) / hourlyRate
                                ).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                h da sua vida aqui
                              </p>
                            )}
                          </div>

                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-lg shadow-sm border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleOpenDialog(transaction)}
                              disabled={isVirtual}
                              title={isVirtual ? "Você está vendo uma conta prevista" : "Você ajusta esta movimentação"}
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleDelete(transaction.id)}
                              disabled={isDeleting || isVirtual}
                              title={isVirtual ? "Você está vendo uma conta prevista" : "Você remove esta movimentação"}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeletingTransaction(null);
            resetDeleteError();
          } else {
            resetDeleteError();
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Remover movimentação</DialogTitle>
            <DialogDescription>
              Você pode remover esta movimentação. Confirme para continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">
              {deletingTransaction?.description || "Sem descrição"}
            </div>
            <div className="text-muted-foreground">
              {deletingTransaction
                ? (deletingTransaction.type === "income" ? "Receita" : "Despesa") +
                  " • " +
                  formatBRL(Number(deletingTransaction.amount))
                : "—"}
            </div>
          </div>

          {deleteError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(deleteError)}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingTransaction(null);
                resetDeleteError();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={!deletingTransaction || isDeleting}
            >
              {isDeleting ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteMonthTransactionsOpen}
        onOpenChange={(open) => {
          setDeleteMonthTransactionsOpen(open);
          if (!open) {
            setDeleteMonthTransactionsConfirm("");
            resetDeleteInRangeError();
          } else {
            resetDeleteInRangeError();
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Remover tudo deste mês</DialogTitle>
            <DialogDescription>
              Você vai remover todas as movimentações que registrou neste mês. Ocorrências previstas não entram aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">{formatMonthLabel(activeMonthKey)}</div>
            <div className="text-muted-foreground">
              Período:{" "}
              {dateRange.from ? formatDateOnly(dateRange.from) : "—"} até{" "}
              {dateRange.to ? formatDateOnly(dateRange.to) : "—"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Você digita REMOVER para confirmar</div>
            <Input
              value={deleteMonthTransactionsConfirm}
              onChange={(e) => setDeleteMonthTransactionsConfirm(e.target.value)}
              placeholder="REMOVER"
              autoComplete="off"
            />
          </div>

          {deleteInRangeError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(deleteInRangeError)}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteMonthTransactionsOpen(false);
                setDeleteMonthTransactionsConfirm("");
                resetDeleteInRangeError();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                isDeletingInRange ||
                deleteMonthTransactionsConfirm.trim().toUpperCase() !== "REMOVER" ||
                !dateRange.from ||
                !dateRange.to
              }
              onClick={() => {
                if (!dateRange.from || !dateRange.to) return;
                deleteTransactionsInRange(
                  { from: dateRange.from, to: dateRange.to },
                  {
                    onSuccess: (res) => {
                      setDeleteMonthTransactionsOpen(false);
                      setDeleteMonthTransactionsConfirm("");
                      pushToast({
                        title: "Você removeu tudo",
                        description: "Você removeu " + String(res.deletedCount) + " movimentação(ões) deste mês.",
                      });
                    },
                  }
                );
              }}
            >
              {isDeletingInRange ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteMonthOpen}
        onOpenChange={(open) => {
          setDeleteMonthOpen(open);
          if (!open) setDeleteMonthConfirm("");
        }}
      >
        <DialogContent className="sm:max-w-[460px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Remover mês</DialogTitle>
            <DialogDescription>
              Você remove apenas a aba do mês. Para remover as contas do mês, você usa “Remover contas do mês”.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">{formatMonthLabel(activeMonthKey)}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Você digita REMOVER para confirmar</div>
            <Input
              value={deleteMonthConfirm}
              onChange={(e) => setDeleteMonthConfirm(e.target.value)}
              placeholder="REMOVER"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteMonthOpen(false);
                setDeleteMonthConfirm("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMonthConfirm.trim().toUpperCase() !== "REMOVER"}
              onClick={() => {
                removeMonthTab(activeMonthKey);
                setDeleteMonthOpen(false);
                setDeleteMonthConfirm("");
                pushToast({
                  title: "Você removeu o mês",
                  description: "Você removeu a aba do mês com sucesso.",
                });
              }}
            >
              Remover mês
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border bg-background shadow-lg p-3 flex items-start gap-3"
            >
              <div className="mt-0.5 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.description && (
                  <div className="text-sm text-muted-foreground">{t.description}</div>
                )}
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
