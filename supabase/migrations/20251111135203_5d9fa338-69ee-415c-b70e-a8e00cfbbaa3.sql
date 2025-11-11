-- Create project_expenses table
CREATE TABLE IF NOT EXISTS public.project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  fournisseur TEXT,
  prix DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantite INTEGER NOT NULL DEFAULT 1,
  date_achat DATE,
  categorie TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create project_payment_transactions table
CREATE TABLE IF NOT EXISTS public.project_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  montant DECIMAL(10,2) NOT NULL,
  date_paiement DATE NOT NULL,
  mode_paiement TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create admin_messages table
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_global BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shop_welcome_config table
CREATE TABLE IF NOT EXISTS public.shop_welcome_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Bienvenue sur notre boutique',
  subtitle TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_welcome_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_expenses
CREATE POLICY "Users can view their own project expenses"
  ON public.project_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project expenses"
  ON public.project_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project expenses"
  ON public.project_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project expenses"
  ON public.project_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for project_payment_transactions
CREATE POLICY "Users can view their own payment transactions"
  ON public.project_payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payment transactions"
  ON public.project_payment_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment transactions"
  ON public.project_payment_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment transactions"
  ON public.project_payment_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for admin_messages
CREATE POLICY "Users can view their own messages or global messages"
  ON public.admin_messages FOR SELECT
  USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "Users can update their own messages"
  ON public.admin_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for shop_welcome_config
CREATE POLICY "Everyone can view active shop welcome config"
  ON public.shop_welcome_config FOR SELECT
  USING (is_active = true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON public.project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_user_id ON public.project_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_project_id ON public.project_payment_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.project_payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_user_id ON public.admin_messages(user_id);

-- Create update triggers
CREATE TRIGGER update_project_expenses_updated_at
  BEFORE UPDATE ON public.project_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.project_payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_messages_updated_at
  BEFORE UPDATE ON public.admin_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_welcome_config_updated_at
  BEFORE UPDATE ON public.shop_welcome_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();