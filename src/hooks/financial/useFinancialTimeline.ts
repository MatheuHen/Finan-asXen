import { useQuery } from "@tanstack/react-query";

import { transactionsService } from "@/services/financial/transactions.service";

export const FINANCIAL_TIMELINE_KEY = ["financialTimeline"];

export function useFinancialTimeline() {
  return useQuery({
    queryKey: FINANCIAL_TIMELINE_KEY,
    queryFn: () => transactionsService.getMonthlyBalanceTimeline(),
    retry: false,
  });
}

