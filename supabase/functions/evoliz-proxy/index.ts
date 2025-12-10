// ============================================
// EDGE FUNCTION: evoliz-proxy
// Proxy pour les appels API Evoliz (évite CORS)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EVOLIZ_API_BASE = "https://www.evoliz.io/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProxyRequest {
  company_id: string;
  public_key: string;
  secret_key: string;
  endpoint?: string;
  method?: string;
  body?: any;
  action?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: ProxyRequest = await req.json();
    const { company_id, public_key, secret_key, endpoint, method = "GET", body, action } = requestData;

    // Validation
    if (!company_id || !public_key || !secret_key) {
      return new Response(
        JSON.stringify({ error: "Configuration manquante", message: "company_id, public_key et secret_key requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Générer le token Basic Auth
    const authToken = btoa(`${company_id}-${public_key}:${secret_key}`);
    const headers = {
      "Authorization": `Basic ${authToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Action: Test de connexion
    if (action === "test") {
      console.log("[evoliz-proxy] Test de connexion...");
      
      const testResponse = await fetch(`${EVOLIZ_API_BASE}/clients?per_page=1`, {
        method: "GET",
        headers,
      });

      if (testResponse.ok) {
        return new Response(
          JSON.stringify({ success: true, message: "Connexion Evoliz réussie" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorText = await testResponse.text();
        console.error("[evoliz-proxy] Échec test:", testResponse.status, errorText);
        
        let errorMessage = "Échec de connexion à Evoliz";
        if (testResponse.status === 401) {
          errorMessage = "Identifiants invalides. Vérifiez vos clés API.";
        } else if (testResponse.status === 403) {
          errorMessage = "Accès refusé. Vérifiez les permissions de votre clé API.";
        }
        
        return new Response(
          JSON.stringify({ success: false, message: errorMessage, details: errorText }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Appel API standard
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Endpoint manquant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `${EVOLIZ_API_BASE}${endpoint}`;
    console.log(`[evoliz-proxy] ${method} ${url}`);

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    // Essayer de parser en JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error(`[evoliz-proxy] Erreur ${response.status}:`, responseText);
      return new Response(
        JSON.stringify({
          error: `Erreur Evoliz ${response.status}`,
          message: responseData?.message || responseData?.error || "Erreur inconnue",
          data: responseData,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[evoliz-proxy] Succès ${method} ${endpoint}`);
    
    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[evoliz-proxy] Erreur:", error);
    return new Response(
      JSON.stringify({
        error: "Erreur proxy",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
