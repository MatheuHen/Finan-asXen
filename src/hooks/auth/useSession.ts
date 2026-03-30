import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/auth/auth.service";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: authService.getSession,
  });
}
