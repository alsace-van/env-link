-- Table des clients de la boutique
CREATE TABLE public.shop_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Type de client
  has_project_subscription BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Informations de facturation (obligatoires)
  company_name TEXT, -- Nom de société (optionnel pour particuliers)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Adresse de facturation
  billing_address TEXT NOT NULL,
  billing_postal_code TEXT NOT NULL,
  billing_city TEXT NOT NULL,
  billing_country TEXT NOT NULL DEFAULT 'France',
  
  -- Numéro de TVA intracommunautaire (optionnel)
  vat_number TEXT,
  
  -- Adresse de livraison (peut être différente de facturation)
  shipping_same_as_billing BOOLEAN NOT NULL DEFAULT TRUE,
  shipping_recipient_name TEXT, -- Nom du destinataire si différent
  shipping_address TEXT,
  shipping_postal_code TEXT,
  shipping_city TEXT,
  shipping_country TEXT,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_shop_customers_user_id ON public.shop_customers(user_id);
CREATE INDEX idx_shop_customers_email ON public.shop_customers(email);

-- Activer RLS
ALTER TABLE public.shop_customers ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
-- Les utilisateurs connectés peuvent voir leurs propres informations
CREATE POLICY "Users can view own customer data"
  ON public.shop_customers FOR SELECT
  USING (auth.uid() = user_id);

-- Les utilisateurs connectés peuvent créer leurs informations client
CREATE POLICY "Users can create own customer data"
  ON public.shop_customers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs connectés peuvent mettre à jour leurs informations
CREATE POLICY "Users can update own customer data"
  ON public.shop_customers FOR UPDATE
  USING (auth.uid() = user_id);

-- Les admins peuvent tout voir (à adapter selon tes besoins)
CREATE POLICY "Admins can view all customer data"
  ON public.shop_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('alsacevancreation@hotmail.com')
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_shop_customers_updated_at
  BEFORE UPDATE ON public.shop_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table des commandes
CREATE TABLE public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE, -- Numéro de commande unique
  customer_id UUID NOT NULL REFERENCES public.shop_customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Informations de la commande
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
  
  -- Informations de paiement
  payment_method TEXT,
  payment_id TEXT, -- ID de transaction Stripe
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Lien avec le projet (optionnel)
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  added_to_expenses BOOLEAN NOT NULL DEFAULT FALSE,
  expense_type TEXT CHECK (expense_type IN ('general', 'supplier')), -- Type de dépense si ajouté au projet
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX idx_shop_orders_customer_id ON public.shop_orders(customer_id);
CREATE INDEX idx_shop_orders_user_id ON public.shop_orders(user_id);
CREATE INDEX idx_shop_orders_project_id ON public.shop_orders(project_id);
CREATE INDEX idx_shop_orders_order_number ON public.shop_orders(order_number);
CREATE INDEX idx_shop_orders_status ON public.shop_orders(status);

-- Activer RLS
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les commandes
CREATE POLICY "Users can view own orders"
  ON public.shop_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.shop_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON public.shop_orders FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all orders"
  ON public.shop_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('alsacevancreation@hotmail.com')
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table des articles de commande (lignes de la commande)
CREATE TABLE public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE RESTRICT,
  
  -- Détails du produit au moment de la commande
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(10, 2) NOT NULL,
  
  -- Configuration (pour les kits custom et options)
  configuration JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_shop_order_items_order_id ON public.shop_order_items(order_id);
CREATE INDEX idx_shop_order_items_product_id ON public.shop_order_items(product_id);

-- RLS
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON public.shop_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_orders
      WHERE shop_orders.id = shop_order_items.order_id
      AND shop_orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own order items"
  ON public.shop_order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shop_orders
      WHERE shop_orders.id = shop_order_items.order_id
      AND shop_orders.user_id = auth.uid()
    )
  );

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all order items"
  ON public.shop_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN ('alsacevancreation@hotmail.com')
    )
  );

-- Fonction pour générer un numéro de commande unique
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Format: VPB-YYYYMMDD-XXXXX (VPB = Van Project Buddy)
    new_number := 'VPB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
    
    -- Vérifier si le numéro existe déjà
    SELECT COUNT(*) INTO exists_check FROM public.shop_orders WHERE order_number = new_number;
    
    -- Si le numéro n'existe pas, on sort de la boucle
    EXIT WHEN exists_check = 0;
  END LOOP;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
