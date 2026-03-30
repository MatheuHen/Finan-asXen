import { getSupabaseBrowserClient } from "../supabase/client";
import { addMonthsClamped, formatDateOnly, parseDateOnly } from "@/lib/date";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "pending" | "paid" | "late" | "cancelled";
export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type RecurrenceUnit = "day" | "week" | "month" | "year";

export type Transaction = {
  id: string;
  user_id: string;
  category_id?: string | null;
  payment_method_id?: string | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description?: string | null;
  due_date: string;
  paid_date?: string | null;
  is_recurring?: boolean | null;
  recurrence_type?: RecurrenceType | null;
  recurrence_interval?: number | null;
  recurrence_unit?: RecurrenceUnit | null;
  recurrence_start_date?: string | null;
  recurrence_end_date?: string | null;
  recurrence_source_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTransactionDTO = Omit<
  Transaction,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export type UpdateTransactionDTO = Partial<CreateTransactionDTO> & { id: string };

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    if (code === "23503") {
      return new Error(
        "Seu usuário ainda não possui perfil (profiles). Faça logout/login e, se persistir, rode a migration de profiles no Supabase ou crie o profile do usuário."
      );
    }
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "Erro desconhecido");
    if (
      message.includes("violates foreign key constraint") &&
      message.includes("financial_transactions_user_id_fkey")
    ) {
      return new Error(
        "Seu usuário ainda não possui perfil (profiles). Faça logout/login e, se persistir, rode a migration de profiles no Supabase ou crie o profile do usuário."
      );
    }
    if (
      message.includes("Could not find the table") &&
      message.includes("financial_transactions")
    ) {
      return new Error(
        "Tabela financial_transactions não encontrada no Supabase. Rode as migrations/SQL no projeto Supabase e atualize o cache do schema."
      );
    }
    return new Error(message);
  }
  return new Error(typeof error === "string" ? error : "Erro desconhecido");
}

function isMissingColumnError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  return (
    message.includes("column") &&
    (message.includes("is_recurring") ||
      message.includes("recurrence_type") ||
      message.includes("recurrence_interval") ||
      message.includes("recurrence_unit") ||
      message.includes("recurrence_start_date") ||
      message.includes("recurrence_end_date") ||
      message.includes("recurrence_source_id"))
  );
}

type RecurrenceFields = {
  is_recurring?: boolean | null;
  recurrence_type?: RecurrenceType | null;
  recurrence_interval?: number | null;
  recurrence_unit?: RecurrenceUnit | null;
  recurrence_start_date?: string | null;
  recurrence_end_date?: string | null;
  due_date?: string | null;
  recurrence_source_id?: string | null;
};

function normalizeRecurrenceFields(input: RecurrenceFields) {
  const isRecurring = Boolean(input.is_recurring);

  if (!isRecurring) {
    return {
      is_recurring: false,
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_unit: null,
    } satisfies Required<
      Pick<
        RecurrenceFields,
        "is_recurring" | "recurrence_type" | "recurrence_interval" | "recurrence_unit"
      >
    >;
  }

  const rawType = input.recurrence_type;
  const type: RecurrenceType =
    rawType === "daily" ||
    rawType === "weekly" ||
    rawType === "monthly" ||
    rawType === "yearly" ||
    rawType === "custom"
      ? rawType
      : "monthly";
  if (type !== "custom") {
    return {
      is_recurring: true,
      recurrence_type: type,
      recurrence_interval: null,
      recurrence_unit: null,
    } satisfies Required<
      Pick<
        RecurrenceFields,
        "is_recurring" | "recurrence_type" | "recurrence_interval" | "recurrence_unit"
      >
    >;
  }

  const interval = Number(input.recurrence_interval);
  if (!Number.isFinite(interval) || interval < 1) {
    throw new Error("Informe um intervalo válido (>= 1) para recorrência personalizada.");
  }
  const unit = input.recurrence_unit;
  if (unit !== "day" && unit !== "week" && unit !== "month" && unit !== "year") {
    throw new Error("Selecione a unidade da recorrência personalizada.");
  }

  return {
    is_recurring: true,
    recurrence_type: "custom",
    recurrence_interval: Math.trunc(interval),
    recurrence_unit: unit,
  } satisfies Required<
    Pick<RecurrenceFields, "is_recurring" | "recurrence_type" | "recurrence_interval" | "recurrence_unit">
  >;
}

function normalizeRecurrenceRangeFields(input: RecurrenceFields) {
  const isRecurring = Boolean(input.is_recurring);
  if (!isRecurring) {
    return {
      recurrence_start_date: null,
      recurrence_end_date: null,
    } satisfies Required<Pick<RecurrenceFields, "recurrence_start_date" | "recurrence_end_date">>;
  }

  if (input.recurrence_source_id) {
    return {
      recurrence_start_date: null,
      recurrence_end_date: null,
    } satisfies Required<Pick<RecurrenceFields, "recurrence_start_date" | "recurrence_end_date">>;
  }

  const start = input.recurrence_start_date ?? input.due_date ?? null;
  const end = input.recurrence_end_date ?? null;
  if (!start || !end) {
    throw new Error("Selecione a data inicial e a data final da recorrência.");
  }
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (!startDate || !endDate) {
    throw new Error("Datas de recorrência inválidas.");
  }
  const s = dateOnly(startDate);
  const e = dateOnly(endDate);
  if (s.getTime() > e.getTime()) {
    throw new Error("A data final da recorrência deve ser maior ou igual à inicial.");
  }

  return {
    recurrence_start_date: formatDateOnly(s),
    recurrence_end_date: formatDateOnly(e),
  } satisfies Required<Pick<RecurrenceFields, "recurrence_start_date" | "recurrence_end_date">>;
}

type UserProfileRow = {
  id: string;
  name: string;
};

async function ensureUserProfile(supabase: ReturnType<typeof getSupabaseBrowserClient>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw toError(error);
  if (data?.id) return data as UserProfileRow;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw toError(userError);

  const name =
    typeof user?.user_metadata?.name === "string" && user.user_metadata.name.trim().length > 0
      ? user.user_metadata.name.trim()
      : typeof user?.email === "string" && user.email.trim().length > 0
        ? user.email.trim()
        : "Usuário";

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId, name })
    .select("id, name")
    .single();

  if (insertError) {
    console.error("[ensureUserProfile]", insertError);
    throw new Error(
      "Não foi possível criar o profile automaticamente (RLS). No Supabase, crie o profile do usuário ou adicione policy de INSERT em profiles para auth.uid() = id."
    );
  }

  return inserted as UserProfileRow;
}

async function requireUserId() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Usuário não autenticado");
  return { supabase, userId: data.user.id };
}

export type FinancialSummary = {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
};

export type FinancialSummaryParams = {
  from?: Date;
  to?: Date;
};

export type GetTransactionsParams = {
  from?: Date;
  to?: Date;
};

export type UpcomingTransactionsParams = {
  days?: number;
  from?: Date;
  to?: Date;
};

export type UpcomingTransactions = {
  upcoming: Transaction[];
  late: Transaction[];
};

export type MonthlyBalancePoint = {
  month: string;
  balance: number;
  accumulated: number;
};

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

async function sanitizeRecurrenceData(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string
) {
  const resetCustom = {
    recurrence_type: "monthly" as const,
    recurrence_interval: null,
    recurrence_unit: null,
  };

  const resetAll = {
    recurrence_type: null,
    recurrence_interval: null,
    recurrence_unit: null,
  };

  const resetExtras = {
    recurrence_interval: null,
    recurrence_unit: null,
  };

  const { error: nonRecurringError } = await supabase
    .from("financial_transactions")
    .update(resetAll)
    .eq("user_id", userId)
    .eq("is_recurring", false)
    .not("recurrence_type", "is", null);
  if (nonRecurringError) throw toError(nonRecurringError);

  const { error: nullTypeError } = await supabase
    .from("financial_transactions")
    .update(resetExtras)
    .eq("user_id", userId)
    .is("recurrence_type", null)
    .or("recurrence_interval.not.is.null,recurrence_unit.not.is.null");
  if (nullTypeError) throw toError(nullTypeError);

  const { error: nonCustomExtrasError } = await supabase
    .from("financial_transactions")
    .update(resetExtras)
    .eq("user_id", userId)
    .neq("recurrence_type", "custom")
    .or("recurrence_interval.not.is.null,recurrence_unit.not.is.null");
  if (nonCustomExtrasError) throw toError(nonCustomExtrasError);

  const { error: customInvalidError } = await supabase
    .from("financial_transactions")
    .update(resetCustom)
    .eq("user_id", userId)
    .eq("recurrence_type", "custom")
    .or(
      "recurrence_interval.is.null,recurrence_interval.lt.1,recurrence_unit.is.null,recurrence_unit.not.in.(day,week,month,year)"
    );
  if (customInvalidError) throw toError(customInvalidError);
}

async function autoUpdateLateStatuses(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string
) {
  await sanitizeRecurrenceData(supabase, userId);
  const today = formatDateOnly(todayDateOnly());

  const { error } = await supabase
    .from("financial_transactions")
    .update({ status: "late" })
    .eq("user_id", userId)
    .eq("status", "pending")
    .lt("due_date", today);

  if (error) throw toError(error);
}

function buildRecurringOccurrencesInRange(
  template: Pick<
    Transaction,
    | "id"
    | "user_id"
    | "amount"
    | "type"
    | "description"
    | "category_id"
    | "payment_method_id"
    | "due_date"
    | "recurrence_type"
    | "recurrence_interval"
    | "recurrence_unit"
    | "recurrence_start_date"
    | "recurrence_end_date"
  >,
  from: Date,
  to: Date,
  maxOccurrences = 5000
) {
  const base = parseDateOnly(template.recurrence_start_date ?? template.due_date);
  if (!base) return [];

  const recurrenceType = (template.recurrence_type ?? "monthly") as RecurrenceType;

  const getStep = () => {
    if (recurrenceType === "daily") return { kind: "days" as const, value: 1 };
    if (recurrenceType === "weekly") return { kind: "days" as const, value: 7 };
    if (recurrenceType === "monthly") return { kind: "months" as const, value: 1 };
    if (recurrenceType === "yearly") return { kind: "months" as const, value: 12 };
    if (recurrenceType === "custom") {
      const interval = Number(template.recurrence_interval);
      const unit = template.recurrence_unit as RecurrenceUnit | null | undefined;
      if (!Number.isFinite(interval) || interval < 1 || !unit) return null;
      if (unit === "day") return { kind: "days" as const, value: Math.trunc(interval) };
      if (unit === "week") return { kind: "days" as const, value: Math.trunc(interval) * 7 };
      if (unit === "month") return { kind: "months" as const, value: Math.trunc(interval) };
      return { kind: "months" as const, value: Math.trunc(interval) * 12 };
    }
    return { kind: "months" as const, value: 1 };
  };

  const step = getStep();
  if (!step) return [];

  const fromDay = dateOnly(from);
  const toDay = dateOnly(to);

  const addStep = (d: Date) =>
    step.kind === "days"
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + step.value)
      : addMonthsClamped(d, step.value);

  let cursor = addStep(base);
  if (step.kind === "days") {
    const diffDays = Math.floor((fromDay.getTime() - cursor.getTime()) / 86400000);
    if (diffDays > 0) {
      const jumps = Math.floor(diffDays / step.value);
      if (jumps > 0) {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + jumps * step.value);
      }
    }
  }
  while (cursor < fromDay) cursor = addStep(cursor);

  const rows: Array<Partial<Transaction>> = [];
  while (cursor <= toDay) {
    if (rows.length >= maxOccurrences) {
      throw new Error(
        "Recorrência gera ocorrências demais para o período selecionado. Ajuste a data final da recorrência ou selecione um período menor."
      );
    }
    rows.push({
      user_id: template.user_id,
      category_id: template.category_id ?? null,
      payment_method_id: template.payment_method_id ?? null,
      amount: Number(template.amount),
      type: template.type,
      status: "pending",
      description: template.description ?? null,
      due_date: formatDateOnly(cursor),
      paid_date: null,
      is_recurring: false,
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_unit: null,
      recurrence_start_date: null,
      recurrence_end_date: null,
      recurrence_source_id: template.id,
    });
    cursor = addStep(cursor);
  }

  return rows;
}

let didWarnAutoRecurrenceDisabled = false;

function warnAutoRecurrenceDisabled() {
  if (didWarnAutoRecurrenceDisabled) return;
  didWarnAutoRecurrenceDisabled = true;
  console.warn("Recorrência automática desativada; recorrências são exibidas por período sem gerar dados.");
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function virtualId(templateId: string, dueDate: string) {
  return "virtual:" + templateId + ":" + dueDate;
}

type RecurrenceTemplateRow = Pick<
  Transaction,
  | "id"
  | "user_id"
  | "amount"
  | "type"
  | "description"
  | "category_id"
  | "payment_method_id"
  | "due_date"
  | "recurrence_type"
  | "recurrence_interval"
  | "recurrence_unit"
  | "recurrence_start_date"
  | "recurrence_end_date"
>;

async function fetchRecurringTemplates(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string
) {
  const selectWithRange =
    "id,user_id,amount,type,description,category_id,payment_method_id,due_date,recurrence_type,recurrence_interval,recurrence_unit,recurrence_start_date,recurrence_end_date";
  const selectWithoutRange =
    "id,user_id,amount,type,description,category_id,payment_method_id,due_date,recurrence_type,recurrence_interval,recurrence_unit";

  const baseQuery = () =>
    supabase
      .from("financial_transactions")
      .select(selectWithRange)
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .is("recurrence_source_id", null);

  const { data, error } = await baseQuery();
  if (!error) return (data ?? []) as RecurrenceTemplateRow[];
  if (!isMissingColumnError(error)) throw toError(error);

  const { data: fallback, error: fallbackError } = await supabase
    .from("financial_transactions")
    .select(selectWithoutRange)
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .is("recurrence_source_id", null);

  if (fallbackError) throw toError(fallbackError);
  const rows = (fallback ?? []) as Array<
    Omit<RecurrenceTemplateRow, "recurrence_start_date" | "recurrence_end_date">
  >;
  return rows.map((t) => ({
    ...t,
    recurrence_start_date: null,
    recurrence_end_date: null,
  }));
}

function recurrenceRangeIntersection(
  template: RecurrenceTemplateRow,
  from: Date,
  to: Date
) {
  const startRaw = template.recurrence_start_date ?? template.due_date;
  const endRaw = template.recurrence_end_date ?? template.recurrence_start_date ?? template.due_date;
  const start = parseDateOnly(startRaw);
  const end = parseDateOnly(endRaw);
  if (!start || !end) return null;
  const s = dateOnly(start);
  const e = dateOnly(end);
  const rangeFrom = maxDate(dateOnly(from), s);
  const rangeTo = minDate(dateOnly(to), e);
  if (rangeFrom.getTime() > rangeTo.getTime()) return null;
  return { from: rangeFrom, to: rangeTo };
}

async function fetchMonthlyTransactionsView(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  from: Date,
  to: Date
) {
  const MAX_VIRTUAL_OCCURRENCES_PER_VIEW = 5000;
  const fromStr = formatDateOnly(dateOnly(from));
  const toStr = formatDateOnly(dateOnly(to));

  const { data: realRows, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("due_date", fromStr)
    .lte("due_date", toStr)
    .order("due_date", { ascending: false });

  if (error) throw toError(error);
  const real = (realRows ?? []) as Transaction[];

  const templates = await fetchRecurringTemplates(supabase, userId);
  const existingKeys = new Set<string>();
  for (const r of real) {
    if (r.recurrence_source_id) existingKeys.add(String(r.recurrence_source_id) + ":" + String(r.due_date));
  }

  const nowIso = new Date().toISOString();
  const virtual: Transaction[] = [];

  for (const t of templates) {
    const intersect = recurrenceRangeIntersection(t, from, to);
    if (!intersect) continue;
    const occ = buildRecurringOccurrencesInRange(t, intersect.from, intersect.to);
    for (const o of occ) {
      const dueDate = String(o.due_date ?? "");
      const key = String(t.id) + ":" + dueDate;
      if (!dueDate || existingKeys.has(key)) continue;
      if (virtual.length >= MAX_VIRTUAL_OCCURRENCES_PER_VIEW) {
        throw new Error(
          "Há recorrências demais para exibir no período selecionado. Ajuste a data final das recorrências ou selecione um período menor."
        );
      }
      virtual.push({
        id: virtualId(String(t.id), dueDate),
        user_id: userId,
        category_id: o.category_id ?? null,
        payment_method_id: o.payment_method_id ?? null,
        amount: Number(o.amount ?? 0),
        type: o.type as TransactionType,
        status: (o.status as TransactionStatus) ?? "pending",
        description: (o.description as string | null | undefined) ?? null,
        due_date: dueDate,
        paid_date: null,
        is_recurring: false,
        recurrence_type: null,
        recurrence_interval: null,
        recurrence_unit: null,
        recurrence_start_date: null,
        recurrence_end_date: null,
        recurrence_source_id: String(t.id),
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  const statusRank: Record<TransactionStatus, number> = {
    late: 0,
    pending: 1,
    paid: 2,
    cancelled: 3,
  };

  return [...real, ...virtual].sort((a, b) => {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? 1 : -1;
    return statusRank[a.status] - statusRank[b.status];
  });
}

export const transactionsService = {
  async getTransactions(params: GetTransactionsParams = {}) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);
    warnAutoRecurrenceDisabled();

    try {
      await autoUpdateLateStatuses(supabase, userId);
    } catch (e) {
      if (!isMissingColumnError(e)) throw e;
    }

    if (params.from && params.to) {
      return await fetchMonthlyTransactionsView(supabase, userId, params.from, params.to);
    }

    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: false });

    if (error) throw toError(error);
    return data as Transaction[];
  },

  async deleteTransactionsInRange(params: { from: Date; to: Date }) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);
    const fromStr = formatDateOnly(dateOnly(params.from));
    const toStr = formatDateOnly(dateOnly(params.to));
    if (fromStr > toStr) {
      throw new Error("Período inválido para exclusão.");
    }

    console.log("[DELETE RANGE]", { user_id: userId, from: fromStr, to: toStr });

    const { error, count } = await supabase
      .from("financial_transactions")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .gte("due_date", fromStr)
      .lte("due_date", toStr);

    if (error) throw toError(error);
    return { deletedCount: Number(count ?? 0) };
  },

  async getFinancialSummary(params: FinancialSummaryParams = {}) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);

    if (params.from && params.to) {
      const rows = await fetchMonthlyTransactionsView(supabase, userId, params.from, params.to);
      const incomeTotal = rows
        .filter((r) => r.type === "income")
        .reduce((acc, r) => acc + Number(r.amount || 0), 0);
      const expenseTotal = rows
        .filter((r) => r.type === "expense")
        .reduce((acc, r) => acc + Number(r.amount || 0), 0);

      return {
        incomeTotal,
        expenseTotal,
        balance: incomeTotal - expenseTotal,
      } satisfies FinancialSummary;
    }

    const { data, error } = await supabase
      .from("financial_transactions")
      .select("amount,type")
      .eq("user_id", userId);
    if (error) throw toError(error);

    const rows = (data ?? []) as Array<{ amount: number; type: TransactionType }>;

    const incomeTotal = rows
      .filter((r) => r.type === "income")
      .reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const expenseTotal = rows
      .filter((r) => r.type === "expense")
      .reduce((acc, r) => acc + Number(r.amount || 0), 0);

    return {
      incomeTotal,
      expenseTotal,
      balance: incomeTotal - expenseTotal,
    } satisfies FinancialSummary;
  },

  async getUpcomingTransactions(params: UpcomingTransactionsParams = {}) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);

    const today = todayDateOnly();
    const startDate = params.from ? dateOnly(params.from) : today;
    const endDate = params.to
      ? dateOnly(params.to)
      : typeof params.days === "number"
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + Math.max(0, params.days))
        : startDate;

    const start = formatDateOnly(startDate);
    const end = formatDateOnly(endDate);
    const upcomingStart = startDate > today ? startDate : today;
    const upcomingStartStr = formatDateOnly(upcomingStart);

    try {
      await autoUpdateLateStatuses(supabase, userId);
    } catch (e) {
      if (!isMissingColumnError(e)) throw e;
    }

    const view = await fetchMonthlyTransactionsView(supabase, userId, startDate, endDate);
    const late = view
      .filter((t) => t.status === "late" && t.due_date >= start && t.due_date <= end)
      .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
    const upcoming = view
      .filter(
        (t) =>
          t.due_date >= upcomingStartStr &&
          t.due_date <= end &&
          t.status !== "paid" &&
          t.status !== "cancelled"
      )
      .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

    return { upcoming, late } satisfies UpcomingTransactions;
  },

  async getMonthlyBalanceTimeline() {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);

    const { data, error } = await supabase
      .from("financial_transactions")
      .select("amount,type,due_date,recurrence_source_id")
      .eq("user_id", userId)
      .order("due_date", { ascending: true });

    if (error) throw toError(error);

    const rows = (data ?? []) as Array<{
      amount: number;
      type: TransactionType;
      due_date: string;
      recurrence_source_id?: string | null;
    }>;
    const map = new Map<string, number>();
    const existingKeys = new Set<string>();

    for (const r of rows) {
      const due = typeof r.due_date === "string" ? r.due_date : "";
      const month = due.length >= 7 ? due.slice(0, 7) : "—";
      const delta = r.type === "income" ? Number(r.amount || 0) : -Number(r.amount || 0);
      map.set(month, (map.get(month) ?? 0) + delta);
      if (r.recurrence_source_id) {
        existingKeys.add(String(r.recurrence_source_id) + ":" + due);
      }
    }

    const templates = await fetchRecurringTemplates(supabase, userId);
    for (const t of templates) {
      const startRaw = t.recurrence_start_date ?? t.due_date;
      const endRaw = t.recurrence_end_date ?? t.recurrence_start_date ?? t.due_date;
      const start = parseDateOnly(startRaw);
      const end = parseDateOnly(endRaw);
      if (!start || !end) continue;
      const s = dateOnly(start);
      const e = dateOnly(end);
      if (s.getTime() > e.getTime()) continue;

      const occ = buildRecurringOccurrencesInRange(t, s, e, 10001);
      if (occ.length > 10000) {
        throw new Error("Recorrência muito longa para montar a timeline. Ajuste o período final da recorrência.");
      }

      for (const o of occ) {
        const due = String(o.due_date ?? "");
        if (!due) continue;
        const key = String(t.id) + ":" + due;
        if (existingKeys.has(key)) continue;
        const month = due.length >= 7 ? due.slice(0, 7) : "—";
        const delta = t.type === "income" ? Number(t.amount || 0) : -Number(t.amount || 0);
        map.set(month, (map.get(month) ?? 0) + delta);
      }
    }

    const months = Array.from(map.entries())
      .filter(([month]) => month !== "—")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    let acc = 0;
    return months.map(([month, balance]) => {
      acc += balance;
      return { month, balance, accumulated: acc } satisfies MonthlyBalancePoint;
    });
  },

  async createTransaction(transaction: CreateTransactionDTO) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);
    const description =
      typeof transaction.description === "string" && transaction.description.trim().length > 0
        ? transaction.description.trim()
        : null;
    const paidDate =
      transaction.status === "paid" && !transaction.paid_date
        ? formatDateOnly(todayDateOnly())
        : transaction.paid_date ?? null;
    const recurrence = normalizeRecurrenceFields(transaction);
    const recurrenceRange = normalizeRecurrenceRangeFields(transaction);
    const payload = {
      ...transaction,
      ...recurrence,
      ...recurrenceRange,
      description,
      paid_date: paidDate,
      user_id: userId,
    };

    console.log("[createTransaction payload]", payload);
    console.log("[createTransaction recurrence]", {
      is_recurring: payload.is_recurring,
      recurrence_type: payload.recurrence_type,
      recurrence_interval: payload.recurrence_interval,
      recurrence_unit: payload.recurrence_unit,
      recurrence_start_date: payload.recurrence_start_date,
      recurrence_end_date: payload.recurrence_end_date,
    });

    const { data, error } = await supabase
      .from("financial_transactions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (isMissingColumnError(error)) {
        if (
          payload.is_recurring &&
          (payload.recurrence_start_date !== null || payload.recurrence_end_date !== null)
        ) {
          throw new Error(
            "Recorrência por período ainda não está habilitada no seu banco. Rode a migration que cria recurrence_start_date e recurrence_end_date e tente novamente."
          );
        }
        const rest = { ...(payload as Record<string, unknown>) };
        delete rest.recurrence_start_date;
        delete rest.recurrence_end_date;
        const { data: data2, error: error2 } = await supabase
          .from("financial_transactions")
          .insert(rest)
          .select()
          .single();
        if (error2) throw toError(error2);
        return data2 as Transaction;
      }
      throw toError(error);
    }
    return data as Transaction;
  },

  async updateTransaction(transaction: UpdateTransactionDTO) {
    const { supabase, userId } = await requireUserId();
    const { id, ...updates } = transaction;
    let normalizedUpdates: Partial<CreateTransactionDTO> = {
      ...updates,
      description:
        typeof updates.description === "string"
          ? updates.description.trim().length > 0
            ? updates.description.trim()
            : null
          : updates.description,
      paid_date:
        updates.status === "paid" && !updates.paid_date
          ? formatDateOnly(todayDateOnly())
          : updates.paid_date,
    };

    const touchesRecurrence =
      "is_recurring" in normalizedUpdates ||
      "recurrence_type" in normalizedUpdates ||
      "recurrence_interval" in normalizedUpdates ||
      "recurrence_unit" in normalizedUpdates ||
      "recurrence_start_date" in normalizedUpdates ||
      "recurrence_end_date" in normalizedUpdates;

    if (touchesRecurrence) {
      const recurrence = normalizeRecurrenceFields(normalizedUpdates);
      const recurrenceRange = normalizeRecurrenceRangeFields(normalizedUpdates);
      normalizedUpdates = { ...normalizedUpdates, ...recurrence, ...recurrenceRange };
    }

    const { data, error } = await supabase
      .from("financial_transactions")
      .update(normalizedUpdates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (isMissingColumnError(error)) {
        if (
          normalizedUpdates.is_recurring &&
          ("recurrence_start_date" in normalizedUpdates || "recurrence_end_date" in normalizedUpdates)
        ) {
          throw new Error(
            "Recorrência por período ainda não está habilitada no seu banco. Rode a migration que cria recurrence_start_date e recurrence_end_date e tente novamente."
          );
        }
        const rest = { ...(normalizedUpdates as Record<string, unknown>) };
        delete rest.recurrence_start_date;
        delete rest.recurrence_end_date;
        const { data: data2, error: error2 } = await supabase
          .from("financial_transactions")
          .update(rest)
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();
        if (error2) throw toError(error2);
        return data2 as Transaction;
      }
      throw toError(error);
    }
    return data as Transaction;
  },

  async deleteTransaction(id: string) {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw toError(userError);
    if (!user?.id) throw new Error("Usuário não autenticado");
    const userId = user.id;

    console.log("[DELETE SAFE]", id);
    console.log("[DELETE]", { id, user_id: userId });

    const { error, count } = await supabase
      .from("financial_transactions")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw toError(error);
    if (!count || count === 0) {
      console.warn("[DELETE IGNORADO] já removido ou não pertence ao usuário", id);
      return id;
    }
    return id;
  },
};
