-- Table des types de frais de port
CREATE TABLE shipping_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'variable', 'free', 'pickup')),
  fixed_price DECIMAL(10,2), -- Pour type "fixed"
  description TEXT,
  message_pickup TEXT, -- Pour type "pickup"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des paliers de prix (pour type "variable")
CREATE TABLE shipping_fee_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipping_fee_id UUID REFERENCES shipping_fees(id) ON DELETE CASCADE,
  quantity_from INTEGER NOT NULL,
  quantity_to INTEGER, -- NULL = illimité (ex: "3+")
  total_price DECIMAL(10,2) NOT NULL, -- Prix TOTAL pour cette quantité
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table de liaison accessoire → frais de port
CREATE TABLE accessory_shipping_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accessory_id UUID REFERENCES accessories_catalog(id) ON DELETE CASCADE,
  shipping_fee_id UUID REFERENCES shipping_fees(id) ON DELETE CASCADE,
  visible_boutique BOOLEAN DEFAULT true,
  visible_depenses BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(accessory_id) -- Un accessoire ne peut avoir qu'un seul type de frais
);

-- Index pour performances
CREATE INDEX idx_shipping_fees_user ON shipping_fees(user_id);
CREATE INDEX idx_shipping_fee_tiers ON shipping_fee_tiers(shipping_fee_id);
CREATE INDEX idx_accessory_shipping ON accessory_shipping_fees(accessory_id);
CREATE INDEX idx_shipping_accessory ON accessory_shipping_fees(shipping_fee_id);

-- RLS Policies pour shipping_fees
ALTER TABLE shipping_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shipping fees"
  ON shipping_fees FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shipping fees"
  ON shipping_fees FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shipping fees"
  ON shipping_fees FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shipping fees"
  ON shipping_fees FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies pour shipping_fee_tiers
ALTER TABLE shipping_fee_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tiers of own fees"
  ON shipping_fee_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shipping_fees
      WHERE shipping_fees.id = shipping_fee_tiers.shipping_fee_id
      AND shipping_fees.user_id = auth.uid()
    )
  );

-- RLS Policies pour accessory_shipping_fees
ALTER TABLE accessory_shipping_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own accessory shipping"
  ON accessory_shipping_fees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM accessories_catalog
      WHERE accessories_catalog.id = accessory_shipping_fees.accessory_id
      AND accessories_catalog.user_id = auth.uid()
    )
  );

-- Fonction trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shipping_fees_updated_at BEFORE UPDATE
  ON shipping_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Commentaires pour documentation
COMMENT ON TABLE shipping_fees IS 'Types de frais de port configurables par utilisateur';
COMMENT ON COLUMN shipping_fees.type IS 'fixed=prix fixe, variable=selon quantité, free=gratuit, pickup=retrait atelier';
COMMENT ON TABLE shipping_fee_tiers IS 'Paliers de prix pour les frais variables';
COMMENT ON TABLE accessory_shipping_fees IS 'Liaison entre accessoires et frais de port';
