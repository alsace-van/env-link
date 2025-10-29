import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TieredPrice {
  min_quantity: number;
  discount_percent: number;
}

export const useTieredPricing = (productId: string | undefined) => {
  const [tiers, setTiers] = useState<TieredPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      loadTiers();
    }
  }, [productId]);

  const loadTiers = async () => {
    if (!productId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("product_tiered_pricing")
      .select("min_quantity, discount_percent")
      .eq("product_id", productId)
      .order("min_quantity");

    if (!error && data) {
      setTiers(data);
    }
    setLoading(false);
  };

  const calculatePrice = (basePrice: number, quantity: number) => {
    if (tiers.length === 0) return basePrice;

    // Trouver le palier applicable
    const applicableTier = [...tiers]
      .reverse()
      .find((tier) => quantity >= tier.min_quantity);

    if (applicableTier) {
      return basePrice * (1 - applicableTier.discount_percent / 100);
    }

    return basePrice;
  };

  const getApplicableTier = (quantity: number) => {
    return [...tiers]
      .reverse()
      .find((tier) => quantity >= tier.min_quantity);
  };

  const getNextTier = (quantity: number) => {
    return tiers.find((tier) => tier.min_quantity > quantity);
  };

  return {
    tiers,
    loading,
    calculatePrice,
    getApplicableTier,
    getNextTier,
  };
};
