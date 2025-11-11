import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TieredPrice {
  article_position: number;
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
    const { data, error} = await supabase
      .from("product_tiered_pricing")
      .select("min_quantity as article_position, prix_unitaire as discount_percent")
      .eq("product_id", productId)
      .order("min_quantity");

    if (!error && data) {
      setTiers(data);
    }
    setLoading(false);
  };

  const calculatePrice = (basePrice: number, quantity: number) => {
    if (tiers.length === 0) return basePrice;

    let totalPrice = 0;
    
    for (let position = 1; position <= quantity; position++) {
      // Trouver la remise applicable pour cette position
      const applicableTier = [...tiers]
        .reverse()
        .find((tier) => position >= tier.article_position);

      if (applicableTier) {
        totalPrice += basePrice * (1 - applicableTier.discount_percent / 100);
      } else {
        totalPrice += basePrice;
      }
    }

    return totalPrice / quantity;
  };

  const getApplicableTier = (quantity: number) => {
    return [...tiers]
      .reverse()
      .find((tier) => quantity >= tier.article_position);
  };

  const getNextTier = (quantity: number) => {
    return tiers.find((tier) => tier.article_position > quantity);
  };

  return {
    tiers,
    loading,
    calculatePrice,
    getApplicableTier,
    getNextTier,
  };
};
