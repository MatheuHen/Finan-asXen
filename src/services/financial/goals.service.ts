import { getSupabaseBrowserClient } from "../supabase/client";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { transactionsService, type Transaction } from "@/services/financial/transactions.service";

export type GoalType = "economy" | "spending_limit" | "debt";
export type GoalStatus = "active" | "completed" | "late";

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string;
  current_amount?: number;
  type: GoalType;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
};

export type GoalProgress = {
  current_amount: number;
  percentage: number;
  status: GoalStatus;
};

export type GoalWithProgress = Goal & GoalProgress;

export type GetGoalsParams = {
  from?: Date;
  to?: Date;
};

export type CreateGoalDTO = {
  name: string;
  target_amount: number;
  type: GoalType;
  start_date?: Date | null;
  end_date?: Date | null;
};

export type UpdateGoalDTO = Partial<CreateGoalDTO> & { id: string };

function toError(error: unknown) {
  if (error instanceof Error) {
    const message = String(error.message ?? "");
    const lower = message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return new Error("Você não conseguiu se conectar agora. Verifique sua internet e tente novamente.");
    }
    return error;
  }
  if (typeof error === "object" && error && "message" in error) {
    const msgValue = (error as { message?: unknown }).message;
    if (typeof msgValue === "string" && msgValue.trim().length > 0) {
      const message = msgValue;
      const lower = message.toLowerCase();
      if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
        return new Error("Você não conseguiu se conectar agora. Verifique sua internet e tente novamente.");
      }
      return new Error(message);
    }
    return new Error("Erro desconhecido");
  }
  return new Error("Erro desconhecido");
}

async function requireUserId() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw toError(error);
  const userId = data.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");
  return { supabase, userId };
}

async function ensureUserProfile(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string
) {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw toError(error);
  if (data?.id) return;

  const { error: insertError } = await supabase.from("profiles").insert({ id: userId, name: "Usuário" });
  if (insertError) throw toError(insertError);
}

function clamp01to100(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function dateKeyFromTransaction(t: Pick<Transaction, "status" | "paid_date" | "due_date">) {
  const raw = t.due_date;
  if (!raw) return null;
  return String(raw).split("T")[0];
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function intersectRange(
  base: { from?: Date; to?: Date },
  goal: { start?: Date; end?: Date }
) {
  const fromA = base.from;
  const toA = base.to;
  const fromB = goal.start;
  const toB = goal.end;

  const from = fromA && fromB ? maxDate(fromA, fromB) : fromA ?? fromB;
  const to = toA && toB ? minDate(toA, toB) : toA ?? toB;
  if (from && to && from.getTime() > to.getTime()) return null;
  return { from, to };
}

function computeGoalProgressFromTransactions(
  goal: Goal,
  transactions: Transaction[],
  params: GetGoalsParams = {}
): GoalProgress {
  const start = goal.start_date ? parseDateOnly(goal.start_date) : null;
  const end = goal.end_date ? parseDateOnly(goal.end_date) : null;
  const range = intersectRange(params, { start: start ?? undefined, end: end ?? undefined });

  const fromKey = range?.from ? formatDateOnly(range.from) : null;
  const toKey = range?.to ? formatDateOnly(range.to) : null;

  let total = 0;
  for (const t of transactions) {
    const key = dateKeyFromTransaction(t);
    if (!key) continue;
    if (fromKey && key < fromKey) continue;
    if (toKey && key > toKey) continue;

    const amount = Number((t as { amount?: unknown }).amount ?? 0);
    if (!Number.isFinite(amount)) continue;

    if (goal.type === "economy") {
      if (t.type === "income") total += amount;
      continue;
    }

    if (t.type === "expense") total += amount;
  }

  const target = Number(goal.target_amount ?? 0);
  const percentage = target > 0 ? clamp01to100((total / target) * 100) : 0;

  const nowKey = formatDateOnly(new Date());
  const endKey = goal.end_date ? String(goal.end_date).split("T")[0] : null;

  const status: GoalStatus =
    target > 0 && total >= target ? "completed" : endKey && nowKey > endKey ? "late" : "active";

  return { current_amount: total, percentage, status };
}

export const goalsService = {
  async getGoals(params: GetGoalsParams = {}) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw toError(error);
    const goals = (data ?? []) as Goal[];

    const tx = await transactionsService.getTransactions({ from: params.from, to: params.to });

    return goals.map((g) => {
      const progress = computeGoalProgressFromTransactions(g, tx, params);
      return { ...g, ...progress } satisfies GoalWithProgress;
    });
  },

  async createGoal(dto: CreateGoalDTO) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);

    const payload = {
      user_id: userId,
      name: dto.name,
      target_amount: dto.target_amount,
      type: dto.type,
      start_date: dto.start_date ? formatDateOnly(dto.start_date) : null,
      end_date: dto.end_date ? formatDateOnly(dto.end_date) : null,
      status: "active",
    };

    const { data, error } = await supabase.from("goals").insert(payload).select("*").single();
    if (error) throw toError(error);
    return data as Goal;
  },

  async updateGoal(dto: UpdateGoalDTO) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);

    const patch: Record<string, string | number | null> = {};
    if (typeof dto.name === "string") patch.name = dto.name;
    if (typeof dto.target_amount === "number") patch.target_amount = dto.target_amount;
    if (typeof dto.type === "string") patch.type = dto.type;
    if ("start_date" in dto) patch.start_date = dto.start_date ? formatDateOnly(dto.start_date) : null;
    if ("end_date" in dto) patch.end_date = dto.end_date ? formatDateOnly(dto.end_date) : null;

    const { data, error } = await supabase
      .from("goals")
      .update(patch)
      .eq("id", dto.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw toError(error);
    return data as Goal;
  },

  async deleteGoal(id: string) {
    const { supabase, userId } = await requireUserId();
    await ensureUserProfile(supabase, userId);

    const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", userId);
    if (error) throw toError(error);
    return true;
  },

  async getGoalProgress(goal: Goal, params: GetGoalsParams = {}) {
    const tx = await transactionsService.getTransactions({ from: params.from, to: params.to });
    return computeGoalProgressFromTransactions(goal, tx, params);
  },
};
