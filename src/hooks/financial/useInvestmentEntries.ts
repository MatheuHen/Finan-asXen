"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { normalizeRangeKey } from "@/lib/period";
import { investmentEntriesService, type InvestmentEntry } from "@/services/financial/investment-entries.service";

type InvestmentEntriesRangeKey = { from: string | null; to: string | null };

function isWithinRange(date: string, key: InvestmentEntriesRangeKey | undefined) {
  if (!key) return true;
  if (key.from && date < key.from) return false;
  if (key.to && date > key.to) return false;
  return true;
}

function compareEntriesDesc(a: Pick<InvestmentEntry, "date" | "created_at" | "id">, b: Pick<InvestmentEntry, "date" | "created_at" | "id">) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id.localeCompare(b.id);
}

function upsertForRange(list: InvestmentEntry[], entry: InvestmentEntry, key: InvestmentEntriesRangeKey | undefined) {
  const next = list.filter((e) => e.id !== entry.id);
  if (isWithinRange(entry.date, key)) next.push(entry);
  next.sort(compareEntriesDesc);
  return next;
}

function removeForRange(list: InvestmentEntry[], id: string) {
  return list.filter((e) => e.id !== id);
}

export function useInvestmentEntries(params: { from?: Date; to?: Date }, options?: { enabled?: boolean }) {
  const key = normalizeRangeKey(params);
  return useQuery({
    queryKey: ["investment_entries", key],
    queryFn: () => investmentEntriesService.getInvestmentEntries(params),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateInvestmentEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: investmentEntriesService.createInvestmentEntry,
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["investment_entries"] });
      const previous = qc.getQueriesData<InvestmentEntry[]>({ queryKey: ["investment_entries"] });
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const optimistic: InvestmentEntry = {
        id: optimisticId,
        user_id: "optimistic",
        category: variables.category,
        value: variables.value,
        current_value: variables.current_value ?? null,
        date: variables.date,
        created_at: new Date().toISOString(),
      };

      for (const [queryKey, data] of previous) {
        const rangeKey = (queryKey as unknown[])[1] as InvestmentEntriesRangeKey | undefined;
        qc.setQueryData<InvestmentEntry[]>(queryKey, upsertForRange((data ?? []) as InvestmentEntry[], optimistic, rangeKey));
      }

      return { previous, optimisticId };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      for (const [queryKey, data] of context.previous) qc.setQueryData(queryKey, data);
    },
    onSuccess: (created, _variables, context) => {
      if (!context) return;
      const queries = qc.getQueriesData<InvestmentEntry[]>({ queryKey: ["investment_entries"] });
      for (const [queryKey, data] of queries) {
        const rangeKey = (queryKey as unknown[])[1] as InvestmentEntriesRangeKey | undefined;
        const withoutOptimistic = (data ?? []).filter((e) => e.id !== context.optimisticId);
        qc.setQueryData<InvestmentEntry[]>(queryKey, upsertForRange(withoutOptimistic, created, rangeKey));
      }
      qc.invalidateQueries({ queryKey: ["investment_entries"] });
    },
  });
}

export function useUpdateInvestmentEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: investmentEntriesService.updateInvestmentEntry,
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ["investment_entries"] });
      const previous = qc.getQueriesData<InvestmentEntry[]>({ queryKey: ["investment_entries"] });
      for (const [queryKey, data] of previous) {
        const rangeKey = (queryKey as unknown[])[1] as InvestmentEntriesRangeKey | undefined;
        const current = (data ?? []) as InvestmentEntry[];
        const existing = current.find((e) => e.id === variables.id);
        const createdAt = existing?.created_at ?? new Date().toISOString();
        const optimistic: InvestmentEntry = {
          id: variables.id,
          user_id: existing?.user_id ?? "optimistic",
          category: variables.category,
          value: variables.value,
          current_value: variables.current_value ?? existing?.current_value ?? null,
          date: variables.date,
          created_at: createdAt,
        };
        qc.setQueryData<InvestmentEntry[]>(queryKey, upsertForRange(current, optimistic, rangeKey));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      for (const [queryKey, data] of context.previous) qc.setQueryData(queryKey, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investment_entries"] });
    },
  });
}

export function useDeleteInvestmentEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: investmentEntriesService.deleteInvestmentEntry,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["investment_entries"] });
      const previous = qc.getQueriesData<InvestmentEntry[]>({ queryKey: ["investment_entries"] });
      for (const [queryKey, data] of previous) {
        qc.setQueryData<InvestmentEntry[]>(queryKey, removeForRange((data ?? []) as InvestmentEntry[], id));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      for (const [queryKey, data] of context.previous) qc.setQueryData(queryKey, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investment_entries"] });
    },
  });
}
