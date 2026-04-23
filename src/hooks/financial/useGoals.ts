import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeRangeKey } from "@/lib/period";
import {
  goalsService,
  type CreateGoalDTO,
  type GetGoalsParams,
  type UpdateGoalDTO,
} from "@/services/financial/goals.service";

export const GOALS_KEY = ["goals"];

export function useGoals(params: GetGoalsParams = {}) {
  const key = normalizeRangeKey(params);
  return useQuery({
    queryKey: [...GOALS_KEY, key],
    queryFn: () => goalsService.getGoals(params),
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoalDTO) => goalsService.createGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateGoalDTO) => goalsService.updateGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsService.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

