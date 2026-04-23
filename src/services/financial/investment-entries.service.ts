"use client";

import { formatDateOnly } from "@/lib/date";
import { getSupabaseBrowserClient } from "../supabase/client";

export type InvestmentEntry = {
  id: string;
  user_id: string;
  category: string;
  value: number;
  current_value?: number | null;
  date: string;
  created_at: string;
};

export type CreateInvestmentEntryDTO = {
  category: string;
  value: number;
  current_value?: number | null;
  date: string;
};

export type UpdateInvestmentEntryDTO = {
  id: string;
  category: string;
  value: number;
  current_value?: number | null;
  date: string;
};

export type GetInvestmentEntriesParams = {
  from?: Date;
  to?: Date;
};

function toError(error: unknown): Error {
  if (error instanceof Error) {
    const message = String(error.message ?? "");
    const lower = message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return new Error("Você não conseguiu se conectar agora. Verifique sua internet e tente novamente.");
    }
    return error;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "Erro desconhecido");
    const lower = message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return new Error("Você não conseguiu se conectar agora. Verifique sua internet e tente novamente.");
    }
    return new Error(message);
  }
  return new Error(typeof error === "string" ? error : "Erro desconhecido");
}

async function requireUserId() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Usuário não autenticado");
  return { supabase, userId: data.user.id };
}

export const investmentEntriesService = {
  async getInvestmentEntries(params: GetInvestmentEntriesParams) {
    const { supabase, userId } = await requireUserId();
    let q = supabase
      .from("investment_entries")
      .select("id,user_id,category,value,current_value,date,created_at")
      .eq("user_id", userId);

    if (params.from) q = q.gte("date", formatDateOnly(params.from));
    if (params.to) q = q.lte("date", formatDateOnly(params.to));

    const { data, error } = await q.order("date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw toError(error);
    return (data ?? []) as InvestmentEntry[];
  },

  async createInvestmentEntry(dto: CreateInvestmentEntryDTO) {
    const { supabase, userId } = await requireUserId();
    const payload = {
      user_id: userId,
      category: dto.category,
      value: dto.value,
      current_value: dto.current_value ?? null,
      date: dto.date,
    };
    const { data, error } = await supabase
      .from("investment_entries")
      .insert(payload)
      .select("id,user_id,category,value,current_value,date,created_at")
      .single();
    if (error) throw toError(error);
    return data as InvestmentEntry;
  },

  async updateInvestmentEntry(dto: UpdateInvestmentEntryDTO) {
    const { supabase, userId } = await requireUserId();
    const { data, error } = await supabase
      .from("investment_entries")
      .update({ category: dto.category, value: dto.value, current_value: dto.current_value ?? null, date: dto.date })
      .eq("id", dto.id)
      .eq("user_id", userId)
      .select("id,user_id,category,value,current_value,date,created_at")
      .single();
    if (error) throw toError(error);
    return data as InvestmentEntry;
  },

  async deleteInvestmentEntry(id: string) {
    const { supabase, userId } = await requireUserId();
    const { error } = await supabase.from("investment_entries").delete().eq("id", id).eq("user_id", userId);
    if (error) throw toError(error);
    return true;
  },
};
