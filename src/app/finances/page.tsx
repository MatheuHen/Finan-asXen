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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { formatBRL } from "@/lib/currency";
import { formatPeriodHint, type PeriodPreset } from "@/lib/period";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { TransactionForm, type TransactionFormValues } from "./components/TransactionForm";
import type { CreateTransactionDTO, UpdateTransactionDTO } from "@/services/financial/transactions.service";
import type { Transaction, TransactionStatus, TransactionType } from "@/services/financial/transactions.service";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  late: "Atrasado",
  cancelled: "Cancelado",
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
  items: Transaction[];
};

function groupTransactionsByDay(transactions: Transaction[]) {
  const statusRank: Record<TransactionStatus, number> = {
    late: 0,
    pending: 1,
    paid: 2,
    cancelled: 3,
  };

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

  return groups
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0))
    .map((d) => ({
      ...d,
      items: [...d.items].sort((a, b) => statusRank[a.status] - statusRank[b.status]),
    }));
}

type ToastItem = {
  id: string;
  title: string;
  description?: string;
};

function getErrorMessage(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message || "Erro desconhecido";
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Erro desconhecido");
  }
  return typeof error === "string" ? error : "Erro desconhecido";
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
  const [monthTabs, setMonthTabs] = useState<string[]>([initialMonthKey]);
  const [activeMonthKey, setActiveMonthKey] = useState<string>(initialMonthKey);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("custom");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(() =>
    rangeFromMonthKey(initialMonthKey)
  );

  useEffect(() => {
    try {
      const rawMonths = window.localStorage.getItem("finances_month_tabs_v1");
      const rawActive = window.localStorage.getItem("finances_active_month_v1");
      const parsed = rawMonths ? (JSON.parse(rawMonths) as unknown) : null;
      const months = Array.isArray(parsed)
        ? parsed.filter((x) => typeof x === "string" && /^\d{4}-\d{2}$/.test(x))
        : [];

      const merged = sortMonthKeysDesc(Array.from(new Set([initialMonthKey, ...months])));
      setMonthTabs(merged);

      const active =
        typeof rawActive === "string" && /^\d{4}-\d{2}$/.test(rawActive) ? rawActive : initialMonthKey;
      setActiveMonthKey(merged.includes(active) ? active : merged[0] ?? initialMonthKey);
    } catch {
      setMonthTabs([initialMonthKey]);
      setActiveMonthKey(initialMonthKey);
    }
  }, [initialMonthKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem("finances_month_tabs_v1", JSON.stringify(monthTabs));
    } catch {}
  }, [monthTabs]);

  useEffect(() => {
    try {
      window.localStorage.setItem("finances_active_month_v1", activeMonthKey);
    } catch {}
    setPeriodPreset("custom");
    setDateRange(rangeFromMonthKey(activeMonthKey));
  }, [activeMonthKey]);

  const { data: transactions, isLoading, error: listError } = useTransactions({
    from: dateRange.from,
    to: dateRange.to,
  });
  const summary = useFinancialSummary({ from: dateRange.from, to: dateRange.to });
  const upcoming = useUpcomingTransactions({ from: dateRange.from, to: dateRange.to });
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
                title: "Transação atualizada",
                description: "Alterações salvas com sucesso.",
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
              title: "Transação atualizada",
              description: "Alterações salvas com sucesso.",
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
          title: "Transação criada",
          description: "Lançamento registrado com sucesso.",
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
        title: "Já removida",
        description: "Esta transação já não está mais na lista.",
      });
      return;
    }
    deleteTransaction(deletingTransaction.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setDeletingTransaction(null);
        pushToast({
          title: "Transação excluída",
          description: "Registro removido com sucesso.",
        });
      },
    });
  };

  const filteredTransactions = useMemo(() => {
    const list = transactions ?? [];
    const q = search.trim().toLowerCase();

    return list.filter((t) => {
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
  }, [transactions, search, typeFilter, statusFilter, recurrenceFilter]);

  const groupedDays = useMemo(() => groupTransactionsByDay(filteredTransactions), [filteredTransactions]);

  const microcopy = useMemo(() => {
    if (upcoming.isLoading || upcoming.error) return null;
    const lateCount = upcoming.data?.late.length ?? 0;
    const upcomingCount = upcoming.data?.upcoming.length ?? 0;

    if (lateCount > 0) {
      return {
        tone: "danger" as const,
        text: "Você tem " + lateCount + " conta(s) atrasada(s) neste período.",
      };
    }
    if (upcomingCount > 0)
      return {
        tone: "warning" as const,
        text: "Você tem " + upcomingCount + " conta(s) próxima(s) do vencimento neste período.",
      };
    return { tone: "success" as const, text: "Tudo em dia. Nenhuma conta pendente." };
  }, [upcoming.isLoading, upcoming.error, upcoming.data]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim().length > 0) count++;
    if (typeFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (recurrenceFilter !== "all") count++;
    if (periodPreset !== "month") count++;
    return count;
  }, [search, typeFilter, statusFilter, recurrenceFilter, periodPreset]);

  const hasFilters =
    search.trim().length > 0 ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    recurrenceFilter !== "all";

  const sortedMonthTabs = useMemo(() => sortMonthKeysDesc(monthTabs), [monthTabs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestão Financeira</h2>
          <p className="text-muted-foreground">
            Controle entradas, saídas e acompanhe o seu saldo com clareza.
          </p>
          <div className="mt-2 text-sm text-muted-foreground">
            Exibindo dados de: {formatPeriodHint(periodPreset, dateRange)}
          </div>
          {microcopy && (
            <div
              className={
                microcopy.tone === "danger"
                  ? "mt-3 inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive"
                  : microcopy.tone === "warning"
                    ? "mt-3 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700"
                    : "mt-3 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700"
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
              >
                {formatMonthLabel(monthKey)}
              </Button>
            ))}

            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger render={<Button variant="outline" size="sm" type="button" />}>
                <CalendarIcon className="mr-2 size-4 opacity-60" />
                Novo mês
              </PopoverTrigger>
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
              <PopoverTrigger render={<Button variant="outline" size="sm" type="button" />}>
                <MoreHorizontal className="mr-2 size-4 opacity-60" />
                Ações
              </PopoverTrigger>
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
                    Excluir contas do mês
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
                    Excluir mês
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button onClick={() => handleOpenDialog()} />}>
            <Plus className="mr-2 size-4" />
            Nova Transação
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? "Editar Transação" : "Nova Transação"}
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
                  <div className="text-sm font-medium">Recorrência</div>
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
                            ? "Recorrentes"
                            : "Não recorrentes"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="recurring">Recorrentes</SelectItem>
                      <SelectItem value="nonRecurring">Não recorrentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>
          )}
          <div className="px-4 pb-3 text-sm text-muted-foreground">
            Mostrando {filteredTransactions.length} de {transactions?.length ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[56px]">Nº</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Carregando transações...
                </TableCell>
              </TableRow>
            ) : groupedDays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  {hasFilters ? "Nenhuma transação encontrada com os filtros atuais." : "Nenhuma transação encontrada."}
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                let seq = 1;
                return groupedDays.flatMap((day) => {
                  const incomeTotal = day.items
                    .filter((t) => t.type === "income")
                    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
                  const expenseTotal = day.items
                    .filter((t) => t.type === "expense")
                    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

                  const headerRow = (
                    <TableRow key={"day-" + day.dateKey} className="bg-muted/40">
                      <TableCell colSpan={6} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">
                            {day.label} ({day.items.length} item(ns))
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <ArrowUpRight className="size-3" /> Receitas: {formatBRL(incomeTotal)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <ArrowDownRight className="size-3" /> Despesas: {formatBRL(expenseTotal)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );

                  const itemRows = day.items.map((transaction) => {
                    const rowNumber = seq++;
                      const isRecurring = Boolean(
                        transaction.recurrence_source_id || transaction.is_recurring
                      );
                    const isVirtual = transaction.id.startsWith("virtual:");
                    const rowTone =
                      transaction.status === "late"
                        ? "bg-destructive/5"
                        : transaction.status === "pending"
                          ? "bg-amber-500/5"
                          : undefined;

                    return (
                      <TableRow key={transaction.id} className={rowTone}>
                        <TableCell className="text-muted-foreground tabular-nums">{rowNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{transaction.description || "Sem descrição"}</span>
                            {isRecurring && (
                              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Recorrente
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              transaction.type === "income"
                                ? "inline-flex items-center gap-1.5 text-emerald-600 font-medium"
                                : "inline-flex items-center gap-1.5 text-destructive font-medium"
                            }
                          >
                            {transaction.type === "income" ? (
                              <ArrowUpRight className="size-4" />
                            ) : (
                              <ArrowDownRight className="size-4" />
                            )}
                            {transaction.type === "income" ? "Receita" : "Despesa"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
                              getStatusBadgeClass(transaction.status)
                            }
                          >
                            {statusLabels[transaction.status] || transaction.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span
                            className={
                              transaction.type === "income" ? "text-emerald-600" : "text-destructive"
                            }
                          >
                            {formatBRL(Number(transaction.amount))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => handleOpenDialog(transaction)}
                              disabled={isVirtual}
                              title={isVirtual ? "Ocorrência prevista (não registrada no banco)" : "Editar"}
                            >
                              <Pencil className="size-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => handleDelete(transaction.id)}
                              disabled={isDeleting || isVirtual}
                              title={isVirtual ? "Ocorrência prevista (não registrada no banco)" : "Excluir"}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });

                  return [headerRow, ...itemRows];
                });
              })()
            )}
          </TableBody>
        </Table>
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
            <DialogTitle>Excluir transação</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. Confirme para remover a transação selecionada.
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
              {isDeleting ? "Excluindo..." : "Excluir"}
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
            <DialogTitle>Excluir todas as contas do mês</DialogTitle>
            <DialogDescription>
              Isso remove definitivamente todas as transações reais do mês selecionado. Ocorrências previstas
              (virtuais) não são salvas no banco.
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
            <div className="text-sm font-medium">Digite EXCLUIR para confirmar</div>
            <Input
              value={deleteMonthTransactionsConfirm}
              onChange={(e) => setDeleteMonthTransactionsConfirm(e.target.value)}
              placeholder="EXCLUIR"
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
                deleteMonthTransactionsConfirm.trim().toUpperCase() !== "EXCLUIR" ||
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
                        title: "Contas excluídas",
                        description: String(res.deletedCount) + " transação(ões) removida(s) deste mês.",
                      });
                    },
                  }
                );
              }}
            >
              {isDeletingInRange ? "Excluindo..." : "Excluir"}
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
            <DialogTitle>Excluir mês</DialogTitle>
            <DialogDescription>
              Isso remove apenas a aba do mês. Para apagar as contas do mês, use “Excluir contas do mês”.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">{formatMonthLabel(activeMonthKey)}</div>
            <div className="text-muted-foreground">Mês: {activeMonthKey}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Digite REMOVER para confirmar</div>
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
                  title: "Mês removido",
                  description: "A aba do mês foi removida com sucesso.",
                });
              }}
            >
              Excluir mês
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
