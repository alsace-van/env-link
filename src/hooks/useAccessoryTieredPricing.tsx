import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TieredPrice {
  min_quantity: number;
  discount_percent: number;
  apply_to_all?: boolean;
}

export const useAccessoryTieredPricing = (accessoryId: string | undefined) => {
  const [tiers, setTiers] = useState<TieredPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accessoryId) {
      loadTiers();
    }
  }, [accessoryId]);

  const loadTiers = async () => {
    if (!accessoryId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("accessory_tiered_pricing")
      .select("min_quantity, discount_percent, apply_to_all")
      .eq("accessory_id", accessoryId)
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
      if (applicableTier.apply_to_all ?? true) {
        // Remise sur tous les articles
        return basePrice * (1 - applicableTier.discount_percent / 100);
      } else {
        // Remise uniquement sur les articles au-delà du minimum
        const fullPriceItems = applicableTier.min_quantity;
        const discountedItems = quantity - fullPriceItems;
        const fullPriceTotal = fullPriceItems * basePrice;
        const discountedTotal = discountedItems * basePrice * (1 - applicableTier.discount_percent / 100);
        return (fullPriceTotal + discountedTotal) / quantity;
      }
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

  const checkPromoPrice = (accessory: any) => {
    if (!accessory.promo_active || !accessory.promo_price) return null;
    
    const now = new Date();
    const start = accessory.promo_start_date ? new Date(accessory.promo_start_date) : null;
    const end = accessory.promo_end_date ? new Date(accessory.promo_end_date) : null;
    
    if ((!start || now >= start) && (!end || now <= end)) {
      return accessory.promo_price;
    }
    
    return null;
  };

  return {
    tiers,
    loading,
    calculatePrice,
    getApplicableTier,
    getNextTier,
    checkPromoPrice,
  };
};
