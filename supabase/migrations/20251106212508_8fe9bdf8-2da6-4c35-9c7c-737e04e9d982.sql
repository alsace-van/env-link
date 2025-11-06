-- Create ai_usage table to track API usage
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_usage
CREATE POLICY "Users can view their own AI usage"
  ON public.ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI usage"
  ON public.ai_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create pdf_summaries_cache table
CREATE TABLE IF NOT EXISTS public.pdf_summaries_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID REFERENCES public.notices_database(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notice_id)
);

-- Enable RLS
ALTER TABLE public.pdf_summaries_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for pdf_summaries_cache
CREATE POLICY "Anyone can view cached summaries"
  ON public.pdf_summaries_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create cached summaries"
  ON public.pdf_summaries_cache
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create api_quotas table
CREATE TABLE IF NOT EXISTS public.api_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature TEXT NOT NULL,
  daily_count INTEGER NOT NULL DEFAULT 0,
  monthly_count INTEGER NOT NULL DEFAULT 0,
  monthly_tokens INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reset_month TEXT NOT NULL DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature)
);

-- Enable RLS
ALTER TABLE public.api_quotas ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_quotas
CREATE POLICY "Users can view their own quotas"
  ON public.api_quotas
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quotas"
  ON public.api_quotas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotas"
  ON public.api_quotas
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add columns to notices_database
ALTER TABLE public.notices_database 
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;

-- Create function to get user AI usage
CREATE OR REPLACE FUNCTION public.get_user_ai_usage(p_feature TEXT)
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
SET search_path = public
AS $$
DECLARE
  v_quota RECORD;
  v_is_admin BOOLEAN;
  v_daily_limit INTEGER;
  v_monthly_limit INTEGER;
BEGIN
  -- Check if user is admin
  v_is_admin := has_role(auth.uid(), 'admin'::app_role);
  
  -- Set limits based on role
  IF v_is_admin THEN
    v_daily_limit := -1; -- Unlimited
    v_monthly_limit := -1; -- Unlimited
  ELSE
    v_daily_limit := 5; -- Free plan: 5 per day
    v_monthly_limit := 150; -- Free plan: 150 per month
  END IF;
  
  -- Get or create quota record
  SELECT * INTO v_quota
  FROM api_quotas
  WHERE user_id = auth.uid() AND feature = p_feature;
  
  IF NOT FOUND THEN
    INSERT INTO api_quotas (user_id, feature, daily_count, monthly_count, monthly_tokens)
    VALUES (auth.uid(), p_feature, 0, 0, 0)
    RETURNING * INTO v_quota;
  ELSE
    -- Reset daily count if it's a new day
    IF v_quota.last_reset_date < CURRENT_DATE THEN
      UPDATE api_quotas
      SET daily_count = 0, last_reset_date = CURRENT_DATE, updated_at = now()
      WHERE user_id = auth.uid() AND feature = p_feature
      RETURNING * INTO v_quota;
    END IF;
    
    -- Reset monthly count if it's a new month
    IF v_quota.last_reset_month < TO_CHAR(CURRENT_DATE, 'YYYY-MM') THEN
      UPDATE api_quotas
      SET monthly_count = 0, monthly_tokens = 0, 
          last_reset_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
          updated_at = now()
      WHERE user_id = auth.uid() AND feature = p_feature
      RETURNING * INTO v_quota;
    END IF;
  END IF;
  
  -- Return usage data
  RETURN QUERY SELECT
    CASE WHEN v_is_admin THEN 'admin' ELSE 'free' END,
    v_quota.daily_count,
    v_quota.monthly_count,
    v_quota.monthly_tokens,
    v_daily_limit,
    v_monthly_limit,
    CASE WHEN v_daily_limit = -1 THEN -1 ELSE v_daily_limit - v_quota.daily_count END,
    CASE WHEN v_monthly_limit = -1 THEN -1 ELSE v_monthly_limit - v_quota.monthly_tokens END;
END;
$$;

-- Create function to increment API quota
CREATE OR REPLACE FUNCTION public.increment_api_quota(p_feature TEXT, p_tokens INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO api_quotas (user_id, feature, daily_count, monthly_count, monthly_tokens)
  VALUES (auth.uid(), p_feature, 1, 1, p_tokens)
  ON CONFLICT (user_id, feature)
  DO UPDATE SET
    daily_count = api_quotas.daily_count + 1,
    monthly_count = api_quotas.monthly_count + 1,
    monthly_tokens = api_quotas.monthly_tokens + p_tokens,
    updated_at = now();
END;
$$;