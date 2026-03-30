import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  transactionsService,
  type CreateTransactionDTO,
  type GetTransactionsParams,
  type UpdateTransactionDTO,
} from "@/services/financial/transactions.service";
import { FINANCIAL_SUMMARY_KEY } from "@/hooks/financial/useFinancialSummary";
import { FINANCIAL_TIMELINE_KEY } from "@/hooks/financial/useFinancialTimeline";
import { UPCOMING_TRANSACTIONS_KEY } from "@/hooks/financial/useUpcomingTransactions";
import { normalizeRangeKey } from "@/lib/period";

const TRANSACTIONS_KEY = ["transactions"];

function logError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
}

let invalidateScheduled = false;

function scheduleInvalidateFinancialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  if (invalidateScheduled) return;
  invalidateScheduled = true;
  queueMicrotask(() => {
    invalidateScheduled = false;
    queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    queryClient.invalidateQueries({ queryKey: FINANCIAL_SUMMARY_KEY });
    queryClient.invalidateQueries({ queryKey: FINANCIAL_TIMELINE_KEY });
    queryClient.invalidateQueries({ queryKey: UPCOMING_TRANSACTIONS_KEY });
  });
}

export function useTransactions(params: GetTransactionsParams = {}) {
  const key = normalizeRangeKey(params);
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, key],
    queryFn: () => transactionsService.getTransactions(params),
    retry: false,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionDTO) => transactionsService.createTransaction(data),
    onSuccess: () => {
      scheduleInvalidateFinancialQueries(queryClient);
    },
    onError: (error) => logError("createTransaction", error),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTransactionDTO) => transactionsService.updateTransaction(data),
    onSuccess: () => {
      scheduleInvalidateFinancialQueries(queryClient);
    },
    onError: (error) => logError("updateTransaction", error),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transactionsService.deleteTransaction(id),
    onSuccess: () => {
      scheduleInvalidateFinancialQueries(queryClient);
    },
    onError: (error) => logError("deleteTransaction", error),
  });
}

export function useDeleteTransactionsInRange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { from: Date; to: Date }) => transactionsService.deleteTransactionsInRange(params),
    onSuccess: () => {
      scheduleInvalidateFinancialQueries(queryClient);
    },
    onError: (error) => logError("deleteTransactionsInRange", error),
  });
}
