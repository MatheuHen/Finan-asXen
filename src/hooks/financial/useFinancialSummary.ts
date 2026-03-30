import { useQuery } from "@tanstack/react-query"

import {
  transactionsService,
  type FinancialSummaryParams,
} from "@/services/financial/transactions.service"
import { normalizeRangeKey } from "@/lib/period"

export const FINANCIAL_SUMMARY_KEY = ["financialSummary"]

export function useFinancialSummary(params: FinancialSummaryParams = {}) {
  const key = normalizeRangeKey(params)
  return useQuery({
    queryKey: [...FINANCIAL_SUMMARY_KEY, key],
    queryFn: () => transactionsService.getFinancialSummary(params),
    retry: false,
  })
}
