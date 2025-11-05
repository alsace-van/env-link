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
```

---

### ✅ FICHIER 2 - Composant principal de gestion (CRÉER)

**Chemin :** `src/components/admin/ShippingFeesManager.tsx`

**Action :** ✅ **CRÉER** ce nouveau fichier

---

### ✅ FICHIER 3 - Modal création/modification frais (CRÉER)

**Chemin :** `src/components/admin/ShippingFeeDialog.tsx`

**Action :** ✅ **CRÉER** ce nouveau fichier

---

### ✅ FICHIER 4 - Modal assignation rapide (CRÉER)

**Chemin :** `src/components/admin/ShippingFeeAssignDialog.tsx`

**Action :** ✅ **CRÉER** ce nouveau fichier

---

### ✏️ FICHIER 5 - Page Admin (MODIFIER)

**Chemin :** `src/pages/Admin.tsx`

**Action :** ✏️ **MODIFIER** (ajouter onglet "Frais de port")

**Modifications :**
- Import du composant `ShippingFeesManager`
- Ajout d'un nouvel onglet `<TabsTrigger value="shipping">Frais de port</TabsTrigger>`
- Ajout du contenu `<TabsContent value="shipping"><ShippingFeesManager /></TabsContent>`

---

### ✏️ FICHIER 6 - Catalogue d'accessoires (MODIFIER)

**Chemin :** `src/components/AccessoriesCatalog.tsx`

**Action :** ✏️ **MODIFIER** (afficher les frais de port liés)

**Modifications :**
- Afficher dans le tableau si un accessoire a des frais de port
- Badge "📦 Frais: 250€" ou "🆓 Gratuit"

---

### ✏️ FICHIER 7 - Boutique (MODIFIER)

**Chemin :** `src/components/AccessoiresShopList.tsx`

**Action :** ✏️ **MODIFIER** (calcul et affichage automatique des frais)

**Modifications :**
- Charger les frais de port liés aux accessoires
- Calculer automatiquement selon quantité et type
- Afficher les frais sous les accessoires concernés
- Inclure dans le total

---

### ✏️ FICHIER 8 - Dépenses (MODIFIER)

**Chemin :** `src/components/DepensesAccessoires.tsx`

**Action :** ✏️ **MODIFIER** (afficher les frais de port)

**Modifications :**
- Charger les frais de port liés
- Afficher sous l'accessoire parent avec icône 📦
- Indication "(automatique)" si applicable
- Inclure dans les totaux

---

## 📊 Tableau Récapitulatif

| # | Fichier | Chemin | Action | Type |
|---|---------|--------|--------|------|
| 1 | Migration SQL | `supabase/migrations/20251105170000_add_shipping_fees.sql` | ✅ CRÉER | SQL |
| 2 | ShippingFeesManager | `src/components/admin/ShippingFeesManager.tsx` | ✅ CRÉER | React |
| 3 | ShippingFeeDialog | `src/components/admin/ShippingFeeDialog.tsx` | ✅ CRÉER | React |
| 4 | ShippingFeeAssignDialog | `src/components/admin/ShippingFeeAssignDialog.tsx` | ✅ CRÉER | React |
| 5 | Admin.tsx | `src/pages/Admin.tsx` | ✏️ MODIFIER | React |
| 6 | AccessoriesCatalog | `src/components/AccessoriesCatalog.tsx` | ✏️ MODIFIER | React |
| 7 | AccessoiresShopList | `src/components/AccessoiresShopList.tsx` | ✏️ MODIFIER | React |
| 8 | DepensesAccessoires | `src/components/DepensesAccessoires.tsx` | ✏️ MODIFIER | React |

---

## 🎯 Ordre d'installation recommandé

1. **FICHIER 1** - Migration SQL (base de données)
2. **FICHIER 2** - ShippingFeesManager (composant principal)
3. **FICHIER 3** - ShippingFeeDialog (création/modification)
4. **FICHIER 4** - ShippingFeeAssignDialog (assignation)
5. **FICHIER 5** - Admin.tsx (intégration dans l'admin)
6. **FICHIER 6** - AccessoriesCatalog (affichage catalogue)
7. **FICHIER 7** - AccessoiresShopList (calcul boutique)
8. **FICHIER 8** - DepensesAccessoires (affichage dépenses)

---

## 📦 Résumé
```
📁 Projet
├── 📁 supabase/migrations/
│   └── ✅ 20251105170000_add_shipping_fees.sql (CRÉER)
│
└── 📁 src/
    ├── 📁 components/
    │   ├── 📁 admin/
    │   │   ├── ✅ ShippingFeesManager.tsx (CRÉER)
    │   │   ├── ✅ ShippingFeeDialog.tsx (CRÉER)
    │   │   └── ✅ ShippingFeeAssignDialog.tsx (CRÉER)
    │   │
    │   ├── ✏️ AccessoriesCatalog.tsx (MODIFIER)
    │   ├── ✏️ AccessoiresShopList.tsx (MODIFIER)
    │   └── ✏️ DepensesAccessoires.tsx (MODIFIER)
    │
    └── 📁 pages/
        └── ✏️ Admin.tsx (MODIFIER)
