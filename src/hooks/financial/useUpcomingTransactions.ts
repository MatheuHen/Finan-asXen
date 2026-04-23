import { useQuery } from "@tanstack/react-query"

import {
  transactionsService,
  type UpcomingTransactionsParams,
} from "@/services/financial/transactions.service"
import { normalizeRangeKey } from "@/lib/period"

export const UPCOMING_TRANSACTIONS_KEY = ["upcomingTransactions"]

export function useUpcomingTransactions(params: UpcomingTransactionsParams = {}) {
  const key = { ...normalizeRangeKey(params), days: typeof params.days === "number" ? params.days : null }
  return useQuery({
    queryKey: [...UPCOMING_TRANSACTIONS_KEY, key],
    queryFn: () => transactionsService.getUpcomingTransactions(params),
    retry: false,
    placeholderData: (prev) => prev,
  })
}
