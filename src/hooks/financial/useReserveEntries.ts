"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { normalizeRangeKey } from "@/lib/period";
import { reserveEntriesService, type ReserveEntry } from "@/services/financial/reserve-entries.service";

type ReserveEntriesRangeKey = { from: string | null; to: string | null };

function isWithinRange(date: string, key: ReserveEntriesRangeKey | undefined) {
  if (!key) return true;
  if (key.from && date < key.from) return false;
  if (key.to && date > key.to) return false;
  return true;
}

function compareEntriesDesc(a: Pick<ReserveEntry, "date" | "created_at" | "id">, b: Pick<ReserveEntry, "date" | "created_at" | "id">) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id.localeCompare(b.id);
}

function upsertForRange(list: ReserveEntry[], entry: ReserveEntry, key: ReserveEntriesRangeKey | undefined) {
  const next = list.filter((e) => e.id !== entry.id);
  if (isWithinRange(entry.date, key)) next.push(entry);
  next.sort(compareEntriesDesc);
  return next;
}

function removeForRange(list: ReserveEntry[], id: string) {
  return list.filter((e) => e.id !== id);
}

export function useReserveEntries(params: { from?: Date; to?: Date }, options?: { enabled?: boolean }) {
  const key = normalizeRangeKey(params);
  return useQuery({
    queryKey: ["reserve_entries", key],
    queryFn: () => reserveEntriesService.getReserveEntries(params),
    enabled: options?.enabled ?? true,
  });
}

export function useReserveEntriesValues() {
  return useQuery({
    queryKey: ["reserve_entries_values"],
    queryFn: () => reserveEntriesService.getReserveEntriesValues(),
  });
}

export function useCreateReserveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reserveEntriesService.createReserveEntry,
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["reserve_entries"] });
      const previous = qc.getQueriesData<ReserveEntry[]>({ queryKey: ["reserve_entries"] });
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const optimistic: ReserveEntry = {
        id: optimisticId,
        user_id: "optimistic",
        value: variables.value,
        date: variables.date,
        created_at: new Date().toISOString(),
      };

      for (const [queryKey, data] of previous) {
        const rangeKey = (queryKey as unknown[])[1] as ReserveEntriesRangeKey | undefined;
        qc.setQueryData<ReserveEntry[]>(
          queryKey,
          upsertForRange((data ?? []) as ReserveEntry[], optimistic, rangeKey)
        );
      }

      return { previous, optimisticId };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      for (const [queryKey, data] of context.previous) qc.setQueryData(queryKey, data);
    },
    onSuccess: (created, _variables, context) => {
      if (!context) return;
      const queries = qc.getQueriesData<ReserveEntry[]>({ queryKey: ["reserve_entries"] });
      for (const [queryKey, data] of queries) {
        const rangeKey = (queryKey as unknown[])[1] as ReserveEntriesRangeKey | undefined;
        const withoutOptimistic = (data ?? []).filter((e) => e.id !== context.optimisticId);
        qc.setQueryData<ReserveEntry[]>(queryKey, upsertForRange(withoutOptimistic, created, rangeKey));
      }
      qc.invalidateQueries({ queryKey: ["reserve_entries"] });
      qc.invalidateQueries({ queryKey: ["reserve_entries_values"] });
    },
  });
}

export function useUpdateReserveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reserveEntriesService.updateReserveEntry,
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["reserve_entries"] });
      const previous = qc.getQueriesData<ReserveEntry[]>({ queryKey: ["reserve_entries"] });
      for (const [queryKey, data] of previous) {
        const rangeKey = (queryKey as unknown[])[1] as ReserveEntriesRangeKey | undefined;
        const current = (data ?? []) as ReserveEntry[];
        const existing = current.find((e) => e.id === variables.id);
        const createdAt = existing?.created_at ?? new Date().toISOString();
        const optimistic: ReserveEntry = {
          id: variables.id,
          user_id: existing?.user_id ?? "optimistic",
          value: variables.value,
          date: variables.date,
          created_at: createdAt,
        };
        qc.setQueryData<ReserveEntry[]>(queryKey, upsertForRange(current, optimistic, rangeKey));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      for (const [queryKey, data] of context.previous) qc.setQueryData(queryKey, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reserve_entries"] });
      qc.invalidateQueries({ queryKey: ["reserve_entries_values"] });
    },
  });
}

export function useDeleteReserveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reserveEntriesService.deleteReserveEntry,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["reserve_entries"] });
      const previous = qc.getQueriesData<ReserveEntry[]>({ queryKey: ["reserve_entries"] });
      for (const [queryKey, data] of previous) {
        qc.setQueryData<ReserveEntry[]>(queryKey, removeForRange((data ?? []) as ReserveEntry[], id));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      for (const [queryKey, data] of context.previous) qc.setQueryData(queryKey, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reserve_entries"] });
      qc.invalidateQueries({ queryKey: ["reserve_entries_values"] });
    },
  });
}

export function useMigrateLegacyReserveEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reserveEntriesService.createReserveEntriesFromLegacy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reserve_entries"] });
      qc.invalidateQueries({ queryKey: ["reserve_entries_values"] });
    },
  });
}
