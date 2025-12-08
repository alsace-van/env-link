// ============================================
// useHourlyRate.ts
// Hook pour récupérer le taux horaire interne
// ============================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface HourlyRateData {
  hourly_rate_ttc: number;
  hourly_rate_ht: number;
  half_day_ttc: number;
  day_ttc: number;
}

export function useHourlyRate() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["hourly-rate"],
    queryFn: async (): Promise<HourlyRateData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const { data, error } = await (supabase as any)
        .from("transformer_settings")
        .select("hourly_rate_ttc")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const rate = data?.hourly_rate_ttc || 60;
      
      return {
        hourly_rate_ttc: rate,
        hourly_rate_ht: rate / 1.2,
        half_day_ttc: rate * 3.5,
        day_ttc: rate * 7,
      };
    },
  });

  return {
    hourlyRateTTC: data?.hourly_rate_ttc || 60,
    hourlyRateHT: data?.hourly_rate_ht || 50,
    halfDayTTC: data?.half_day_ttc || 210,
    dayTTC: data?.day_ttc || 420,
    isLoading,
    error,
    
    // Helper: calcul forfait suggéré à partir d'heures estimées
    calculateForfait: (estimatedHours: number) => {
      const rate = data?.hourly_rate_ttc || 60;
      return Math.round(estimatedHours * rate / 5) * 5; // Arrondi au 5€ près
    },
    
    // Helper: estimer heures à partir d'un forfait
    estimateHours: (forfaitTTC: number) => {
      const rate = data?.hourly_rate_ttc || 60;
      return Math.round((forfaitTTC / rate) * 2) / 2; // Arrondi à 0.5h près
    },
  };
}
