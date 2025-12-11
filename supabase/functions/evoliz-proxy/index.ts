// ============================================
// EDGE FUNCTION: evoliz-proxy
// Proxy pour les appels API Evoliz (évite CORS)
// Utilise OAuth avec Bearer Token
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EVOLIZ_BASE_URL = "https://www.evoliz.io";
const EVOLIZ_API_BASE = `${EVOLIZ_BASE_URL}/api/v1`;

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

interface LoginResponse {
  access_token: string;
  expires_at: string;
}

// Cache des tokens (clé = company_id, valeur = { token, expiresAt })
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

/**
 * Obtenir un access_token via OAuth
 * POST /api/login avec public_key et secret_key
 */
async function getAccessToken(public_key: string, secret_key: string, company_id: string): Promise<string> {
  // Vérifier le cache
  const cached = tokenCache.get(company_id);
  if (cached && cached.expiresAt > new Date()) {
    console.log("[evoliz-proxy] Token récupéré depuis le cache");
    return cached.token;
  }

  console.log("[evoliz-proxy] Demande d'un nouveau access_token...");

  const loginResponse = await fetch(`${EVOLIZ_BASE_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      public_key,
      secret_key,
    }),
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    console.error("[evoliz-proxy] Échec login:", loginResponse.status, errorText);

    let errorMessage = "Échec d'authentification Evoliz";
    if (loginResponse.status === 401) {
      errorMessage = "Identifiants invalides. Vérifiez vos clés API (public_key et secret_key).";
    } else if (loginResponse.status === 403) {
      errorMessage = "Accès refusé. Vérifiez les permissions de votre clé API.";
    }

    throw new Error(errorMessage);
  }

  const loginData: LoginResponse = await loginResponse.json();

  if (!loginData.access_token) {
    throw new Error("Pas de access_token dans la réponse");
  }

  // Mettre en cache (le token expire après ~20 minutes selon la doc)
  const expiresAt = loginData.expires_at ? new Date(loginData.expires_at) : new Date(Date.now() + 19 * 60 * 1000); // 19 minutes par défaut

  tokenCache.set(company_id, {
    token: loginData.access_token,
    expiresAt,
  });

  console.log("[evoliz-proxy] Access token obtenu, expire à:", expiresAt.toISOString());

  return loginData.access_token;
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Obtenir le Bearer Token via OAuth
    let accessToken: string;
    try {
      accessToken = await getAccessToken(public_key, secret_key, company_id);
    } catch (authError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentification échouée",
          message: authError instanceof Error ? authError.message : "Erreur d'authentification",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Headers avec Bearer Token
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Action: Test de connexion
    if (action === "test") {
      console.log("[evoliz-proxy] Test de connexion...");

      const testResponse = await fetch(`${EVOLIZ_API_BASE}/clients?per_page=1`, {
        method: "GET",
        headers,
      });

      if (testResponse.ok) {
        return new Response(JSON.stringify({ success: true, message: "Connexion Evoliz réussie" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const errorText = await testResponse.text();
        console.error("[evoliz-proxy] Échec test:", testResponse.status, errorText);

        // Si 401, invalider le cache et réessayer
        if (testResponse.status === 401) {
          tokenCache.delete(company_id);
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: "Échec de connexion à Evoliz",
            details: errorText,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Appel API standard
    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Endpoint manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Si 401, invalider le cache (token expiré)
    if (response.status === 401) {
      console.log("[evoliz-proxy] Token expiré, invalidation du cache");
      tokenCache.delete(company_id);
    }

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
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[evoliz-proxy] Succès ${method} ${endpoint}`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[evoliz-proxy] Erreur:", error);
    return new Response(
      JSON.stringify({
        error: "Erreur proxy",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
