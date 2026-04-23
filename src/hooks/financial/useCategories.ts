import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { categoriesService, type CreateCategoryDTO, type UpdateCategoryDTO } from "@/services/financial/categories.service";

const CATEGORIES_KEY = ["categories"] as const;

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => categoriesService.getCategories(),
  });
}

export function useCategoryUsage(categoryId?: string | null) {
  return useQuery({
    queryKey: [...CATEGORIES_KEY, "usage", categoryId ?? ""],
    queryFn: () => categoriesService.hasTransactions(categoryId as string),
    enabled: typeof categoryId === "string" && categoryId.length > 0,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCategoryDTO) => categoriesService.createCategory(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCategoryDTO) => categoriesService.updateCategory(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, unlink }: { id: string; unlink?: boolean }) => {
      return unlink ? categoriesService.unlinkTransactionsAndDeleteCategory(id) : categoriesService.deleteCategory(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}
