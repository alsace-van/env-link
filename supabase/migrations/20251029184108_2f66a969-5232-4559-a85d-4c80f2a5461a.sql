-- Ajouter les colonnes de promotion aux accessoires
ALTER TABLE accessories_catalog
ADD COLUMN IF NOT EXISTS promo_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS promo_price numeric,
ADD COLUMN IF NOT EXISTS promo_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS promo_end_date timestamp with time zone;

-- Créer la table de tarifs dégressifs pour les accessoires
CREATE TABLE IF NOT EXISTS accessory_tiered_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessory_id uuid NOT NULL REFERENCES accessories_catalog(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL CHECK (min_quantity > 0),
  discount_percent numeric NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_accessory_tiered_pricing_accessory_id 
ON accessory_tiered_pricing(accessory_id);

-- Trigger pour updated_at
CREATE TRIGGER update_accessory_tiered_pricing_updated_at
BEFORE UPDATE ON accessory_tiered_pricing
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS policies pour accessory_tiered_pricing
ALTER TABLE accessory_tiered_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tiered pricing for their accessories"
ON accessory_tiered_pricing FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM accessories_catalog
    WHERE accessories_catalog.id = accessory_tiered_pricing.accessory_id
    AND accessories_catalog.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tiered pricing for their accessories"
ON accessory_tiered_pricing FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM accessories_catalog
    WHERE accessories_catalog.id = accessory_tiered_pricing.accessory_id
    AND accessories_catalog.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tiered pricing of their accessories"
ON accessory_tiered_pricing FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM accessories_catalog
    WHERE accessories_catalog.id = accessory_tiered_pricing.accessory_id
    AND accessories_catalog.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tiered pricing of their accessories"
ON accessory_tiered_pricing FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM accessories_catalog
    WHERE accessories_catalog.id = accessory_tiered_pricing.accessory_id
    AND accessories_catalog.user_id = auth.uid()
  )
);

-- Fonction pour calculer le prix dégressif d'un accessoire
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
BEGIN
  -- Trouver la plus grande réduction applicable
  SELECT discount_percent INTO v_discount_percent
  FROM accessory_tiered_pricing
  WHERE accessory_id = p_accessory_id
    AND min_quantity <= p_quantity
  ORDER BY min_quantity DESC
  LIMIT 1;
  
  -- Appliquer la réduction
  IF v_discount_percent IS NOT NULL AND v_discount_percent > 0 THEN
    RETURN p_base_price * (1 - v_discount_percent / 100);
  END IF;
  
  RETURN p_base_price;
END;
$$;