"use client";

import { getSupabaseBrowserClient } from "../supabase/client";

export type Profile = {
  id: string;
  name: string;
  avatar_url?: string | null;
  hourly_rate?: number | string | null;
  created_at: string;
  updated_at: string;
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

export const profileService = {
  async getProfile() {
    const { supabase, userId } = await requireUserId();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,avatar_url,hourly_rate,created_at,updated_at")
      .eq("id", userId)
      .single();

    if (error) throw toError(error);
    return data as Profile;
  },

  async updateHourlyRate(hourlyRate: number | null) {
    const { supabase, userId } = await requireUserId();
    const { data, error } = await supabase
      .from("profiles")
      .update({ hourly_rate: hourlyRate })
      .eq("id", userId)
      .select("id,name,avatar_url,hourly_rate,created_at,updated_at")
      .single();

    if (error) throw toError(error);
    return data as Profile;
  },
};
