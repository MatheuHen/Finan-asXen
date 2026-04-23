import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/auth/auth.service";

export function useSession() {
  const enabled =
    typeof window === "undefined"
      ? true
      : Object.keys(window.localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));

  return useQuery({
    queryKey: ["session"],
    queryFn: authService.getSession,
    retry: false,
    enabled,
    placeholderData: (prev) => prev,
  });
}
