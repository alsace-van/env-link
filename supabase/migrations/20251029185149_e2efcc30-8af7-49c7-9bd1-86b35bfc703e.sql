-- Modifier la structure pour gérer les remises par position d'article
ALTER TABLE product_tiered_pricing
DROP COLUMN IF EXISTS apply_to_all;

ALTER TABLE product_tiered_pricing
RENAME COLUMN min_quantity TO article_position;

COMMENT ON COLUMN product_tiered_pricing.article_position IS 'Position de l''article (1 = premier, 2 = deuxième, etc.)';

-- Même chose pour les accessoires
ALTER TABLE accessory_tiered_pricing
DROP COLUMN IF EXISTS apply_to_all;

ALTER TABLE accessory_tiered_pricing
RENAME COLUMN min_quantity TO article_position;

COMMENT ON COLUMN accessory_tiered_pricing.article_position IS 'Position de l''article (1 = premier, 2 = deuxième, etc.)';

-- Nouvelle fonction de calcul pour les produits (prix moyen pondéré)
CREATE OR REPLACE FUNCTION calculate_tiered_price(
  p_product_id uuid,
  p_quantity integer,
  p_base_price numeric
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total_price NUMERIC := 0;
  v_position INTEGER;
  v_discount NUMERIC;
BEGIN
  -- Calculer le prix total en appliquant la remise pour chaque position
  FOR v_position IN 1..p_quantity LOOP
    -- Trouver la remise pour cette position (ou la plus proche si pas définie)
    SELECT discount_percent INTO v_discount
    FROM public.product_tiered_pricing
    WHERE product_id = p_product_id
      AND article_position <= v_position
    ORDER BY article_position DESC
    LIMIT 1;
    
    IF v_discount IS NOT NULL THEN
      v_total_price := v_total_price + (p_base_price * (1 - v_discount / 100));
    ELSE
      v_total_price := v_total_price + p_base_price;
    END IF;
  END LOOP;
  
  -- Retourner le prix moyen par article
  RETURN v_total_price / p_quantity;
END;
$$;

-- Nouvelle fonction de calcul pour les accessoires
CREATE OR REPLACE FUNCTION calculate_accessory_tiered_price(
  p_accessory_id uuid,
  p_quantity integer,
  p_base_price numeric
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total_price NUMERIC := 0;
  v_position INTEGER;
  v_discount NUMERIC;
BEGIN
  -- Calculer le prix total en appliquant la remise pour chaque position
  FOR v_position IN 1..p_quantity LOOP
    -- Trouver la remise pour cette position (ou la plus proche si pas définie)
    SELECT discount_percent INTO v_discount
    FROM accessory_tiered_pricing
    WHERE accessory_id = p_accessory_id
      AND article_position <= v_position
    ORDER BY article_position DESC
    LIMIT 1;
    
    IF v_discount IS NOT NULL THEN
      v_total_price := v_total_price + (p_base_price * (1 - v_discount / 100));
    ELSE
      v_total_price := v_total_price + p_base_price;
    END IF;
  END LOOP;
  
  -- Retourner le prix moyen par article
  RETURN v_total_price / p_quantity;
END;
$$;