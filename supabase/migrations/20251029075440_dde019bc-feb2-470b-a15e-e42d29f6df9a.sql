-- Table pour les messages administratifs
CREATE TABLE public.admin_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT check_recipient CHECK (
    (is_global = true AND recipient_id IS NULL) OR 
    (is_global = false AND recipient_id IS NOT NULL)
  )
);

-- Table pour le journal des actions admin
CREATE TABLE public.admin_actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour admin_messages
CREATE POLICY "Admins can view all messages"
  ON public.admin_messages
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own messages"
  ON public.admin_messages
  FOR SELECT
  USING (
    recipient_id = auth.uid() OR 
    (is_global = true)
  );

CREATE POLICY "Admins can create messages"
  ON public.admin_messages
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND sender_id = auth.uid());

CREATE POLICY "Users can update their own message read status"
  ON public.admin_messages
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- RLS Policies pour admin_actions_log
CREATE POLICY "Admins can view all actions"
  ON public.admin_actions_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create action logs"
  ON public.admin_actions_log
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

-- Ajouter un index pour les performances
CREATE INDEX idx_admin_messages_recipient ON public.admin_messages(recipient_id);
CREATE INDEX idx_admin_messages_global ON public.admin_messages(is_global) WHERE is_global = true;
CREATE INDEX idx_admin_actions_log_admin ON public.admin_actions_log(admin_id);
CREATE INDEX idx_user_logins_user_id ON public.user_logins(user_id, login_at DESC);