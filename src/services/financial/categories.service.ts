"use client";

import { getSupabaseBrowserClient } from "../supabase/client";

export type CategoryType = "income" | "expense";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  type: CategoryType;
  created_at: string;
  updated_at: string;
};

export type CreateCategoryDTO = {
  name: string;
  type: CategoryType;
  color?: string | null;
  icon?: string | null;
};

export type UpdateCategoryDTO = Partial<CreateCategoryDTO> & { id: string };

function toError(error: unknown): Error {
  if (error instanceof Error) {
    const message = String(error.message ?? "");
    const lower = message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return new Error("Você não conseguiu se conectar agora. Verifique sua internet e tente novamente.");
    }
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    if (code === "23505") return new Error("Você já possui uma categoria com esse nome");
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "Erro desconhecido");
    const lower = message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return new Error("Você não conseguiu se conectar agora. Verifique sua internet e tente novamente.");
    }
    if (message.toLowerCase().includes("duplicate key")) {
      return new Error("Você já possui uma categoria com esse nome");
    }
    return new Error(message);
  }
  return new Error(typeof error === "string" ? error : "Erro desconhecido");
}

function normalizeCategoryName(input: string) {
  const trimmed = input.trim();
  if (trimmed.length === 0) return "";
  const first = trimmed.slice(0, 1).toLocaleUpperCase("pt-BR");
  const rest = trimmed.slice(1).toLocaleLowerCase("pt-BR");
  return first + rest;
}

async function hasTransactionsWithCategory(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  categoryId: string
) {
  const { count, error } = await supabase
    .from("financial_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("category_id", categoryId);

  if (error) throw toError(error);
  return (count ?? 0) > 0;
}

async function hasCategoryName(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  name: string,
  ignoreId?: string
) {
  let q = supabase.from("categories").select("id").eq("user_id", userId).ilike("name", name).limit(1);
  if (ignoreId) q = q.neq("id", ignoreId);
  const { data, error } = await q;
  if (error) throw toError(error);
  return (data?.length ?? 0) > 0;
}

async function requireUserId() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Usuário não autenticado");
  return { supabase, userId: data.user.id };
}

export const categoriesService = {
  async getCategories() {
    const { supabase, userId } = await requireUserId();

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) throw toError(error);
    return (data ?? []) as Category[];
  },

  async hasTransactions(categoryId: string) {
    const { supabase, userId } = await requireUserId();
    return hasTransactionsWithCategory(supabase, userId, categoryId);
  },

  async createCategory(dto: CreateCategoryDTO) {
    const { supabase, userId } = await requireUserId();

    const name = normalizeCategoryName(dto.name);
    if (name.length === 0) throw new Error("Nome da categoria é obrigatório");
    if (await hasCategoryName(supabase, userId, name)) {
      throw new Error("Você já possui uma categoria com esse nome");
    }

    const payload = {
      user_id: userId,
      name,
      type: dto.type,
      color: dto.color ?? null,
      icon: dto.icon ?? null,
    };

    const { data, error } = await supabase.from("categories").insert(payload).select("*").single();
    if (error) throw toError(error);
    return data as Category;
  },

  async updateCategory(dto: UpdateCategoryDTO) {
    const { supabase, userId } = await requireUserId();

    const patch: Record<string, string | null> = {};
    if (typeof dto.name === "string") {
      const name = normalizeCategoryName(dto.name);
      if (name.length === 0) throw new Error("Nome da categoria é obrigatório");
      if (await hasCategoryName(supabase, userId, name, dto.id)) {
        throw new Error("Você já possui uma categoria com esse nome");
      }
      patch.name = name;
    }
    if (typeof dto.type === "string") patch.type = dto.type;
    if ("color" in dto) patch.color = dto.color ?? null;
    if ("icon" in dto) patch.icon = dto.icon ?? null;

    const { data, error } = await supabase
      .from("categories")
      .update(patch)
      .eq("id", dto.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw toError(error);
    return data as Category;
  },

  async deleteCategory(id: string) {
    const { supabase, userId } = await requireUserId();
    const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", userId);
    if (error) throw toError(error);
    return true;
  },

  async unlinkTransactionsAndDeleteCategory(id: string) {
    const { supabase, userId } = await requireUserId();

    const { error: unlinkError } = await supabase
      .from("financial_transactions")
      .update({ category_id: null })
      .eq("user_id", userId)
      .eq("category_id", id);

    if (unlinkError) throw toError(unlinkError);

    const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", userId);
    if (error) throw toError(error);
    return true;
  },
};
