import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Vérifier que l'utilisateur qui fait la requête est admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Non autorisé");
    }

    // Vérifier le rôle admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Accès refusé: privilèges administrateur requis");
    }

    const { email, password, display_name } = await req.json();

    // Input validation
    if (!email || typeof email !== 'string' || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error("Email invalide");
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new Error("Le mot de passe doit contenir au moins 6 caractères");
    }
    if (email.length > 255) {
      throw new Error("L'email est trop long");
    }
    if (display_name && (typeof display_name !== 'string' || display_name.length > 100)) {
      throw new Error("Le nom d'affichage est trop long");
    }

    // Créer l'utilisateur
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name || "",
      },
    });

    if (createError) throw createError;

    // Logger l'action
    await supabaseAdmin.from("admin_actions_log").insert({
      admin_id: user.id,
      action: "create_user",
      target_user_id: newUser.user.id,
      details: { email, display_name },
    });

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});