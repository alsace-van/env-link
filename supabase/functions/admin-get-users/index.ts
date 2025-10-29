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

    // Récupérer tous les utilisateurs via l'API admin
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) throw listError;

    // Récupérer les rôles
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    // Récupérer les dernières connexions
    const { data: logins } = await supabaseAdmin
      .from("user_logins")
      .select("user_id, login_at")
      .order("login_at", { ascending: false });

    // Récupérer les statistiques des projets
    const { data: projectStats } = await supabaseAdmin
      .from("projects")
      .select("user_id");

    // Combiner les données
    const usersData = authUsers.users.map((authUser) => {
      const userRoles = roles?.filter((r) => r.user_id === authUser.id) || [];
      const lastLogin = logins?.find((l) => l.user_id === authUser.id);
      const projectCount = projectStats?.filter((p) => p.user_id === authUser.id).length || 0;

      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: lastLogin?.login_at || authUser.created_at,
        is_admin: userRoles.some((r) => r.role === "admin"),
        project_count: projectCount,
        display_name: authUser.user_metadata?.display_name || null,
      };
    });

    return new Response(
      JSON.stringify({ users: usersData }),
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