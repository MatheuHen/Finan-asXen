import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { profileService } from "@/services/auth/profile.service";

const PROFILE_KEY = ["profile"] as const;

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => profileService.getProfile(),
  });
}

export function useUpdateHourlyRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hourlyRate: number | null) => profileService.updateHourlyRate(hourlyRate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}
