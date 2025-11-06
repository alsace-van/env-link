-- Ajouter les colonnes pour les résumés IA
ALTER TABLE public.notices_database
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;

-- Table pour tracker l'usage de l'IA par utilisateur
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature VARCHAR(50) NOT NULL, -- 'pdf_summary', 'ocr', etc.
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_estimate DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage(feature, created_at);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leur propre usage
CREATE POLICY "Users can view own AI usage"
  ON public.ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer des enregistrements d'usage (via Edge Function)
CREATE POLICY "Users can create own AI usage"
  ON public.ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Table pour le cache des résumés de PDF
CREATE TABLE IF NOT EXISTS public.pdf_summaries_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 du fichier
  summary TEXT NOT NULL,
  metadata JSONB,
  tokens_used INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accessed_count INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_cache_hash ON public.pdf_summaries_cache(pdf_hash);

ALTER TABLE public.pdf_summaries_cache ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire le cache
CREATE POLICY "Anyone can view PDF cache"
  ON public.pdf_summaries_cache FOR SELECT
  USING (true);

-- Seuls les services peuvent créer/modifier le cache (via Edge Function avec service_role)
CREATE POLICY "Service role can manage PDF cache"
  ON public.pdf_summaries_cache FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Table pour surveiller les quotas API
CREATE TABLE IF NOT EXISTS public.api_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- 'gemini', 'openai', etc.
  date DATE NOT NULL,
  requests_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost_estimate DECIMAL(10,2) DEFAULT 0,
  quota_limit INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(provider, date)
);

ALTER TABLE public.api_quotas ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent voir les quotas API
CREATE POLICY "Admins can view API quotas"
  ON public.api_quotas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Fonction pour obtenir l'usage IA d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_ai_usage(
  p_feature VARCHAR DEFAULT 'pdf_summary',
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  plan TEXT,
  today_count INTEGER,
  month_count INTEGER,
  month_tokens INTEGER,
  limit_per_day INTEGER,
  limit_per_month INTEGER,
  remaining_today INTEGER,
  remaining_month_tokens INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_plan TEXT;
  v_today_count INTEGER;
  v_month_count INTEGER;
  v_month_tokens INTEGER;
  v_limit_per_day INTEGER;
  v_limit_per_month INTEGER;
BEGIN
  -- Utiliser l'ID fourni ou l'utilisateur courant
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Obtenir le plan de l'utilisateur (par défaut 'free')
  SELECT COALESCE(subscription_plan, 'free')
  INTO v_plan
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Définir les limites selon le plan
  IF v_plan = 'pro' THEN
    v_limit_per_day := 50;
    v_limit_per_month := 1000000; -- tokens
  ELSIF v_plan = 'enterprise' THEN
    v_limit_per_day := -1; -- illimité
    v_limit_per_month := -1;
  ELSE
    v_limit_per_day := 5;
    v_limit_per_month := 100000; -- tokens
  END IF;
  
  -- Compter l'usage aujourd'hui
  SELECT COUNT(*)
  INTO v_today_count
  FROM public.ai_usage
  WHERE user_id = v_user_id
    AND feature = p_feature
    AND created_at >= CURRENT_DATE;
  
  -- Compter l'usage ce mois
  SELECT COUNT(*), COALESCE(SUM(tokens_used), 0)
  INTO v_month_count, v_month_tokens
  FROM public.ai_usage
  WHERE user_id = v_user_id
    AND feature = p_feature
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
  
  RETURN QUERY SELECT
    v_plan,
    v_today_count,
    v_month_count,
    v_month_tokens,
    v_limit_per_day,
    v_limit_per_month,
    CASE
      WHEN v_limit_per_day = -1 THEN -1
      ELSE GREATEST(0, v_limit_per_day - v_today_count)
    END,
    CASE
      WHEN v_limit_per_month = -1 THEN -1
      ELSE GREATEST(0, v_limit_per_month - v_month_tokens)
    END;
END;
$$;

-- Fonction pour incrémenter les quotas API
CREATE OR REPLACE FUNCTION public.increment_api_quota(
  p_provider VARCHAR,
  p_date DATE,
  p_tokens INTEGER,
  p_cost DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.api_quotas (provider, date, requests_count, tokens_used, cost_estimate)
  VALUES (p_provider, p_date, 1, p_tokens, p_cost)
  ON CONFLICT (provider, date)
  DO UPDATE SET
    requests_count = api_quotas.requests_count + 1,
    tokens_used = api_quotas.tokens_used + p_tokens,
    cost_estimate = api_quotas.cost_estimate + p_cost;
END;
$$;
