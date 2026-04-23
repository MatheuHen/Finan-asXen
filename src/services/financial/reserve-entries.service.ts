"use client";

import { getSupabaseBrowserClient } from "../supabase/client";
import { formatDateOnly, normalizeDateOnlyToISO } from "@/lib/date";

export type ReserveEntry = {
  id: string;
  user_id: string;
  value: number;
  date: string;
  created_at: string;
};

export type CreateReserveEntryDTO = {
  value: number;
  date: string;
};

export type UpdateReserveEntryDTO = {
  id: string;
  value: number;
  date: string;
};

export type GetReserveEntriesParams = {
  from?: Date;
  to?: Date;
};

type LegacyReserveEntry = {
  value: number;
  date: string;
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

function formatAmountKey(value: number) {
  return value.toFixed(2);
}

function normalizeLegacyEntry(entry: LegacyReserveEntry) {
  const value = Number(entry.value);
  const date = normalizeDateOnlyToISO(String(entry.date ?? ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  if (!date) return null;
  return { value: Number(value.toFixed(2)), date };
}

function buildEntryKey(entry: { date: string; value: number }) {
  return `${entry.date}|${formatAmountKey(entry.value)}`;
}

async function requireUserId() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Usuário não autenticado");
  return { supabase, userId: data.user.id };
}

export const reserveEntriesService = {
  async getReserveEntries(params: GetReserveEntriesParams) {
    const { supabase, userId } = await requireUserId();
    let q = supabase
      .from("reserve_entries")
      .select("id,user_id,value,date,created_at")
      .eq("user_id", userId);

    if (params.from) q = q.gte("date", formatDateOnly(params.from));
    if (params.to) q = q.lte("date", formatDateOnly(params.to));

    const { data, error } = await q.order("date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw toError(error);
    return (data ?? []) as ReserveEntry[];
  },

  async getReserveEntriesValues() {
    const { supabase, userId } = await requireUserId();
    const { data, error } = await supabase.from("reserve_entries").select("value").eq("user_id", userId);
    if (error) throw toError(error);
    const values = (data ?? []).map((r) => Number((r as { value?: unknown }).value ?? 0)).filter((n) => Number.isFinite(n));
    return values;
  },

  async createReserveEntry(dto: CreateReserveEntryDTO) {
    const { supabase, userId } = await requireUserId();
    const payload = { user_id: userId, value: dto.value, date: dto.date };
    const { data, error } = await supabase
      .from("reserve_entries")
      .insert(payload)
      .select("id,user_id,value,date,created_at")
      .single();
    if (error) throw toError(error);
    return data as ReserveEntry;
  },

  async createReserveEntriesFromLegacy(entries: Array<{ value: number; date: string }>) {
    if (entries.length === 0) return 0;
    const { supabase, userId } = await requireUserId();
    const normalized = entries
      .map((entry) => normalizeLegacyEntry(entry))
      .filter((entry): entry is { value: number; date: string } => entry !== null);
    if (normalized.length === 0) return 0;

    const sorted = normalized.slice().sort((a, b) => (a.date === b.date ? a.value - b.value : a.date.localeCompare(b.date)));
    const from = sorted[0]?.date;
    const to = sorted[sorted.length - 1]?.date;

    const { data: existingRows, error: existingError } = await supabase
      .from("reserve_entries")
      .select("date,value")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to);
    if (existingError) throw toError(existingError);

    const existingCounts = new Map<string, number>();
    for (const row of existingRows ?? []) {
      const normalizedRow = normalizeLegacyEntry({
        date: String((row as { date?: unknown }).date ?? ""),
        value: Number((row as { value?: unknown }).value ?? 0),
      });
      if (!normalizedRow) continue;
      const key = buildEntryKey(normalizedRow);
      existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
    }

    const pendingInsert: Array<{ user_id: string; value: number; date: string }> = [];
    for (const entry of sorted) {
      const key = buildEntryKey(entry);
      const remaining = existingCounts.get(key) ?? 0;
      if (remaining > 0) {
        existingCounts.set(key, remaining - 1);
        continue;
      }
      pendingInsert.push({ user_id: userId, value: entry.value, date: entry.date });
    }

    if (pendingInsert.length === 0) return 0;
    const { error } = await supabase.from("reserve_entries").insert(pendingInsert);
    if (error) throw toError(error);
    return pendingInsert.length;
  },

  async updateReserveEntry(dto: UpdateReserveEntryDTO) {
    const { supabase, userId } = await requireUserId();
    const { data, error } = await supabase
      .from("reserve_entries")
      .update({ value: dto.value, date: dto.date })
      .eq("id", dto.id)
      .eq("user_id", userId)
      .select("id,user_id,value,date,created_at")
      .single();
    if (error) throw toError(error);
    return data as ReserveEntry;
  },

  async deleteReserveEntry(id: string) {
    const { supabase, userId } = await requireUserId();
    const { error } = await supabase.from("reserve_entries").delete().eq("id", id).eq("user_id", userId);
    if (error) throw toError(error);
    return true;
  },
};
