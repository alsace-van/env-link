// ============================================
// EDGE FUNCTION: evoliz-sync-suppliers
// Synchronisation des fournisseurs avec Evoliz
// Utilise OAuth avec Bearer Token
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EVOLIZ_BASE_URL = "https://www.evoliz.io";
const EVOLIZ_API_BASE = `${EVOLIZ_BASE_URL}/api/v1`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SyncRequest {
  action: "import" | "export";
  userId: string;
}

interface EvolizCredentials {
  company_id: string;
  public_key: string;
  secret_key: string;
}

interface EvolizSupplier {
  supplierid: number;
  code?: string;
  name: string;
  legalform?: string;
  business_number?: string;
  activity_number?: string;
  vat_number?: string;
  address?: {
    addr?: string;
    addr2?: string;
    postcode?: string;
    town?: string;
    country?: {
      iso2?: string;
      label?: string;
    };
  };
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  comment?: string;
  enabled?: boolean;
}

// Cache des tokens
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

/**
 * Obtenir un access_token via OAuth
 */
async function getAccessToken(credentials: EvolizCredentials): Promise<string> {
  const cached = tokenCache.get(credentials.company_id);
  if (cached && cached.expiresAt > new Date()) {
    console.log("[evoliz-sync-suppliers] Token récupéré depuis le cache");
    return cached.token;
  }

  console.log("[evoliz-sync-suppliers] Demande d'un nouveau access_token...");

  const loginResponse = await fetch(`${EVOLIZ_BASE_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      public_key: credentials.public_key,
      secret_key: credentials.secret_key,
    }),
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    console.error("[evoliz-sync-suppliers] Échec login:", loginResponse.status, errorText);
    throw new Error("Échec d'authentification Evoliz");
  }

  const loginData = await loginResponse.json();

  if (!loginData.access_token) {
    throw new Error("Pas de access_token dans la réponse");
  }

  const expiresAt = loginData.expires_at 
    ? new Date(loginData.expires_at) 
    : new Date(Date.now() + 19 * 60 * 1000);

  tokenCache.set(credentials.company_id, {
    token: loginData.access_token,
    expiresAt,
  });

  return loginData.access_token;
}

/**
 * Récupérer tous les fournisseurs depuis Evoliz (avec pagination)
 */
async function fetchAllEvolizSuppliers(accessToken: string): Promise<EvolizSupplier[]> {
  const allSuppliers: EvolizSupplier[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`[evoliz-sync-suppliers] Récupération page ${page}...`);
    
    const response = await fetch(`${EVOLIZ_API_BASE}/suppliers?page=${page}&per_page=100`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[evoliz-sync-suppliers] Erreur fetch suppliers:", response.status, errorText);
      throw new Error(`Erreur Evoliz: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.data && Array.isArray(data.data)) {
      allSuppliers.push(...data.data);
      
      // Vérifier s'il y a plus de pages
      if (data.data.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`[evoliz-sync-suppliers] ${allSuppliers.length} fournisseurs récupérés`);
  return allSuppliers;
}

/**
 * Créer un fournisseur dans Evoliz
 */
async function createEvolizSupplier(accessToken: string, supplier: any): Promise<EvolizSupplier | null> {
  const evolizData = {
    name: supplier.name,
    code: supplier.code || undefined,
    legalform: supplier.legal_form || undefined,
    business_number: supplier.business_number || undefined,
    activity_number: supplier.activity_number || undefined,
    vat_number: supplier.vat_number || undefined,
    address: {
      addr: supplier.address_line1 || undefined,
      addr2: supplier.address_line2 || undefined,
      postcode: supplier.postcode || undefined,
      town: supplier.city || undefined,
      iso2: supplier.country_iso2 || "FR",
    },
    phone: supplier.phone || undefined,
    mobile: supplier.mobile || undefined,
    website: supplier.website || undefined,
    comment: supplier.comment || undefined,
  };

  const response = await fetch(`${EVOLIZ_API_BASE}/suppliers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(evolizData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[evoliz-sync-suppliers] Erreur création:", errorText);
    return null;
  }

  return await response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId }: SyncRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Créer le client Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les credentials Evoliz de l'utilisateur
    const { data: credentialsData, error: credentialsError } = await supabase
      .from("evoliz_credentials")
      .select("company_id, public_key, secret_key")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (credentialsError || !credentialsData) {
      return new Response(
        JSON.stringify({ error: "Credentials Evoliz non trouvés", details: credentialsError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtenir le token d'accès
    const accessToken = await getAccessToken(credentialsData as EvolizCredentials);

    if (action === "import") {
      // ========== IMPORT depuis Evoliz ==========
      console.log("[evoliz-sync-suppliers] Début import...");
      
      const evolizSuppliers = await fetchAllEvolizSuppliers(accessToken);
      let imported = 0;
      let updated = 0;

      for (const es of evolizSuppliers) {
        // Vérifier si ce fournisseur existe déjà (par evoliz_supplier_id)
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("user_id", userId)
          .eq("evoliz_supplier_id", es.supplierid)
          .single();

        const supplierData = {
          user_id: userId,
          evoliz_supplier_id: es.supplierid,
          code: es.code || null,
          name: es.name,
          legal_form: es.legalform || null,
          business_number: es.business_number || null,
          activity_number: es.activity_number || null,
          vat_number: es.vat_number || null,
          address_line1: es.address?.addr || null,
          address_line2: es.address?.addr2 || null,
          postcode: es.address?.postcode || null,
          city: es.address?.town || null,
          country_iso2: es.address?.country?.iso2 || "FR",
          country_label: es.address?.country?.label || "France",
          phone: es.phone || null,
          mobile: es.mobile || null,
          fax: es.fax || null,
          website: es.website || null,
          comment: es.comment || null,
          enabled: es.enabled !== false,
          last_synced_at: new Date().toISOString(),
        };

        if (existing) {
          // Mise à jour
          await supabase
            .from("suppliers")
            .update(supplierData)
            .eq("id", existing.id);
          updated++;
        } else {
          // Création
          await supabase
            .from("suppliers")
            .insert(supplierData);
          imported++;
        }
      }

      console.log(`[evoliz-sync-suppliers] Import terminé: ${imported} créés, ${updated} mis à jour`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          imported, 
          updated,
          total: evolizSuppliers.length,
          message: `${imported} fournisseurs importés, ${updated} mis à jour`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "export") {
      // ========== EXPORT vers Evoliz ==========
      console.log("[evoliz-sync-suppliers] Début export...");

      // Récupérer les fournisseurs locaux sans evoliz_supplier_id
      const { data: localSuppliers, error: localError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", userId)
        .is("evoliz_supplier_id", null);

      if (localError) {
        throw new Error(`Erreur récupération fournisseurs locaux: ${localError.message}`);
      }

      let exported = 0;
      const errors: string[] = [];

      for (const supplier of localSuppliers || []) {
        const created = await createEvolizSupplier(accessToken, supplier);
        
        if (created && created.supplierid) {
          // Mettre à jour l'ID Evoliz dans la base locale
          await supabase
            .from("suppliers")
            .update({ 
              evoliz_supplier_id: created.supplierid,
              last_synced_at: new Date().toISOString()
            })
            .eq("id", supplier.id);
          
          exported++;
        } else {
          errors.push(`Échec export: ${supplier.name}`);
        }
      }

      console.log(`[evoliz-sync-suppliers] Export terminé: ${exported} exportés`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          exported,
          errors: errors.length > 0 ? errors : undefined,
          message: `${exported} fournisseurs exportés vers Evoliz`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Action invalide. Utilisez 'import' ou 'export'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("[evoliz-sync-suppliers] Erreur:", error);
    return new Response(
      JSON.stringify({
        error: "Erreur synchronisation",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
