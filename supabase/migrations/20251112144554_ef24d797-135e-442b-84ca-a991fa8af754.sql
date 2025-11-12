-- Ajouter le rôle admin à votre compte
INSERT INTO public.user_roles (user_id, role)
VALUES ('3348e4c7-e0f4-4e1c-bae4-625e44d2fb51', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';