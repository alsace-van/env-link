-- Ajouter une colonne pour le mode de calcul des prix dégressifs (produits)
ALTER TABLE product_tiered_pricing
ADD COLUMN IF NOT EXISTS apply_to_all boolean DEFAULT true;

-- Ajouter une colonne pour le mode de calcul des prix dégressifs (accessoires)
ALTER TABLE accessory_tiered_pricing
ADD COLUMN IF NOT EXISTS apply_to_all boolean DEFAULT true;

-- Mettre à jour la fonction de calcul pour les produits
CREATE OR REPLACE FUNCTION calculate_tiered_price(
  p_product_id uuid,
  p_quantity integer,
  p_base_price numeric
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_discount_percent NUMERIC := 0;
  v_apply_to_all BOOLEAN := true;
  v_min_quantity INTEGER := 0;
BEGIN
  -- Trouver la plus grande réduction applicable
  SELECT discount_percent, apply_to_all, min_quantity 
  INTO v_discount_percent, v_apply_to_all, v_min_quantity
  FROM public.product_tiered_pricing
  WHERE product_id = p_product_id
    AND min_quantity <= p_quantity
  ORDER BY min_quantity DESC
  LIMIT 1;
  
  -- Appliquer la réduction
  IF v_discount_percent IS NOT NULL AND v_discount_percent > 0 THEN
    IF v_apply_to_all THEN
      -- Remise sur tous les articles
      RETURN p_base_price * (1 - v_discount_percent / 100);
    ELSE
      -- Remise uniquement sur les articles au-delà du minimum
      RETURN ((v_min_quantity * p_base_price) + 
              ((p_quantity - v_min_quantity) * p_base_price * (1 - v_discount_percent / 100))) 
             / p_quantity;
    END IF;
  END IF;
  
  RETURN p_base_price;
END;
$$;

-- Mettre à jour la fonction de calcul pour les accessoires
CREATE OR REPLACE FUNCTION calculate_accessory_tiered_price(
  p_accessory_id uuid,
  p_quantity integer,
  p_base_price numeric
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_discount_percent NUMERIC := 0;
  v_apply_to_all BOOLEAN := true;
  v_min_quantity INTEGER := 0;
BEGIN
  -- Trouver la plus grande réduction applicable
  SELECT discount_percent, apply_to_all, min_quantity 
  INTO v_discount_percent, v_apply_to_all, v_min_quantity
  FROM accessory_tiered_pricing
  WHERE accessory_id = p_accessory_id
    AND min_quantity <= p_quantity
  ORDER BY min_quantity DESC
  LIMIT 1;
  
  -- Appliquer la réduction
  IF v_discount_percent IS NOT NULL AND v_discount_percent > 0 THEN
    IF v_apply_to_all THEN
      -- Remise sur tous les articles
      RETURN p_base_price * (1 - v_discount_percent / 100);
    ELSE
      -- Remise uniquement sur les articles au-delà du minimum
      RETURN ((v_min_quantity * p_base_price) + 
              ((p_quantity - v_min_quantity) * p_base_price * (1 - v_discount_percent / 100))) 
             / p_quantity;
    END IF;
  END IF;
  
  RETURN p_base_price;
END;
$$;