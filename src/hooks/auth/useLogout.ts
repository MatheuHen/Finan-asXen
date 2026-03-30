import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth/auth.service";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.signOut,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
