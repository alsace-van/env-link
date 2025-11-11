-- Corriger les fonctions existantes pour définir le search_path
CREATE OR REPLACE FUNCTION public.get_latest_rti(p_project_id uuid)
 RETURNS TABLE(id uuid, form_data jsonb, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.form_data,
    r.status,
    r.created_at
  FROM rti_submissions r
  WHERE r.project_id = p_project_id
  ORDER BY r.created_at DESC
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_rti_by_status()
 RETURNS TABLE(status text, count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.status,
    COUNT(*)::BIGINT
  FROM rti_submissions r
  WHERE r.created_by = auth.uid()
  GROUP BY r.status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;