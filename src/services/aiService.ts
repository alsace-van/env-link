// Centralisé : appels aux différents fournisseurs IA + statistiques d'usage
// Les modèles sont configurables depuis l'admin (table app_settings)
// VERSION: 2.1 - Ajout getGeminiApiUrl() pour centraliser le modèle

import { supabase } from "@/integrations/supabase/client";

export type AIProvider = "gemini" | "openai" | "anthropic" | "mistral";

export interface CallAIParams {
  provider: AIProvider;
  apiKey: string;
  prompt: string;
  pdfBase64?: string; // pour les PDFs (notices, catalogues...)
  imageBase64?: string; // pour les images (carte grise, photos...)
  imageMimeType?: string; // ex: "image/jpeg", "image/png"
  maxTokens?: number;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
  tokensUsed?: number;
}

// ========================================
// MODÈLES PAR DÉFAUT (fallback si DB inaccessible)
// ========================================
const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  mistral: "mistral-small-latest",
};

// ========================================
// CACHE DES MODÈLES (évite les requêtes répétées)
// ========================================
let modelsCache: Record<AIProvider, string> | null = null;
let modelsCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère l'URL de l'API Gemini avec le modèle configuré dans l'admin
 * Utiliser cette fonction au lieu de hardcoder l'URL
 */
export async function getGeminiApiUrl(apiKey: string): Promise<string> {
  const model = await getModelForProvider("gemini");
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

/**
 * Récupère le nom du modèle Gemini configuré (pour affichage ou logs)
 */
export async function getGeminiModel(): Promise<string> {
  return await getModelForProvider("gemini");
}

/**
 * Récupère le modèle à utiliser pour un fournisseur donné
 * Utilise un cache pour éviter les requêtes répétées
 */
async function getModelForProvider(provider: AIProvider): Promise<string> {
  const now = Date.now();
  
  // Si le cache est valide, l'utiliser
  if (modelsCache && (now - modelsCacheTime) < CACHE_DURATION) {
    return modelsCache[provider] || DEFAULT_MODELS[provider];
  }

  try {
    const { data, error } = await (supabase as any)
      .from("app_settings")
      .select("key, value")
      .in("key", ["gemini_model", "openai_model", "anthropic_model", "mistral_model"]);

    if (error) {
      console.warn("Impossible de charger les modèles depuis la DB, utilisation des valeurs par défaut:", error);
      return DEFAULT_MODELS[provider];
    }

    // Construire le cache
    modelsCache = { ...DEFAULT_MODELS };
    data?.forEach((row: { key: string; value: string }) => {
      const providerKey = row.key.replace("_model", "") as AIProvider;
      if (providerKey in modelsCache!) {
        modelsCache![providerKey] = row.value;
      }
    });
    modelsCacheTime = now;

    return modelsCache[provider] || DEFAULT_MODELS[provider];
  } catch (e) {
    console.warn("Erreur lors du chargement des modèles:", e);
    return DEFAULT_MODELS[provider];
  }
}

/**
 * Force le rafraîchissement du cache des modèles
 * Utile après modification dans l'admin
 */
export function refreshModelsCache() {
  modelsCache = null;
  modelsCacheTime = 0;
}

/**
 * Récupère tous les modèles configurés (pour affichage)
 */
export async function getConfiguredModels(): Promise<Record<AIProvider, string>> {
  // Force refresh
  refreshModelsCache();
  
  // Charger chaque modèle pour remplir le cache
  await getModelForProvider("gemini");
  
  return modelsCache || DEFAULT_MODELS;
}

// ========================
// Appel générique multi-IA
// ========================

export async function callAI(params: CallAIParams): Promise<AIResponse> {
  const { provider, apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens = 4000 } = params;

  try {
    // Récupérer le modèle configuré pour ce fournisseur
    const model = await getModelForProvider(provider);
    console.log(`🤖 Appel ${provider} avec modèle: ${model}`);

    switch (provider) {
      case "gemini":
        return await callGemini(apiKey, prompt, model, { pdfBase64, imageBase64, imageMimeType, maxTokens });
      case "openai":
        return await callOpenAI(apiKey, prompt, model, { pdfBase64, imageBase64, imageMimeType, maxTokens });
      case "anthropic":
        return await callAnthropic(apiKey, prompt, model, { pdfBase64, imageBase64, imageMimeType, maxTokens });
      case "mistral":
        return await callMistral(apiKey, prompt, model, { pdfBase64, imageBase64, imageMimeType, maxTokens });
      default:
        return { success: false, error: "Fournisseur IA non supporté" };
    }
  } catch (error: any) {
    console.error("Erreur appel IA:", error);
    return { success: false, error: error?.message || "Erreur inconnue" };
  }
}

// ========================
// Fournisseur : Google Gemini
// ========================

interface ProviderExtraParams {
  pdfBase64?: string;
  imageBase64?: string;
  imageMimeType?: string;
  maxTokens?: number;
}

async function callGemini(
  apiKey: string,
  prompt: string,
  model: string,
  { pdfBase64, imageBase64, imageMimeType, maxTokens }: ProviderExtraParams,
): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  console.log(`🔗 Gemini URL: ${url.replace(apiKey, "API_KEY_HIDDEN")}`);
  console.log(`📝 Modèle utilisé: ${model}`);

  const parts: any[] = [{ text: prompt }];

  if (pdfBase64) {
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  }
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: imageMimeType || "image/jpeg", data: imageBase64 } });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });

    console.log(`📡 Gemini response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Gemini API error:", errorData);
      throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Gemini response reçue");
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

  if (!text) throw new Error("Pas de réponse du modèle");

  trackTokenUsage(tokensUsed);
  return { success: true, text, tokensUsed };
}

// ========================
// Fournisseur : OpenAI
// ========================

async function callOpenAI(
  apiKey: string,
  prompt: string,
  model: string,
  { pdfBase64, imageBase64, imageMimeType, maxTokens }: ProviderExtraParams,
): Promise<AIResponse> {
  const messages: any[] = [{ role: "user", content: prompt }];

  if (pdfBase64 || imageBase64) {
    const content: any[] = [{ type: "text", text: prompt }];
    if (pdfBase64) {
      content.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } });
    }
    if (imageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${imageMimeType || "image/jpeg"};base64,${imageBase64}` },
      });
    }
    messages[0].content = content;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content as string | undefined;
  const tokensUsed = data.usage?.total_tokens || 0;

  if (!text) throw new Error("Pas de réponse du modèle");

  trackTokenUsage(tokensUsed);
  return { success: true, text, tokensUsed };
}

// ========================
// Fournisseur : Anthropic
// ========================

async function callAnthropic(
  apiKey: string,
  prompt: string,
  model: string,
  { pdfBase64, imageBase64, imageMimeType, maxTokens }: ProviderExtraParams,
): Promise<AIResponse> {
  const content: any[] = [{ type: "text", text: prompt }];

  if (pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
    });
  }
  if (imageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: imageMimeType || "image/jpeg", data: imageBase64 },
    });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 4000,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text as string | undefined;
  const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

  if (!text) throw new Error("Pas de réponse du modèle");

  trackTokenUsage(tokensUsed);
  return { success: true, text, tokensUsed };
}

// ========================
// Fournisseur : Mistral
// ========================

async function callMistral(
  apiKey: string,
  prompt: string,
  model: string,
  { pdfBase64, imageBase64, imageMimeType, maxTokens }: ProviderExtraParams,
): Promise<AIResponse> {
  // Actuellement, l'API chat Mistral ne gère pas directement les PDFs/images comme les autres.
  // On envoie donc uniquement le prompt texte.
  if (pdfBase64 || imageBase64) {
    console.warn("Mistral : les paramètres PDF / image ne sont pas encore supportés côté client.");
  }

  const messages: any[] = [{ role: "user", content: prompt }];

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `Mistral API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content as string | undefined;
  const tokensUsed = data.usage?.total_tokens || 0;

  if (!text) throw new Error("Pas de réponse du modèle");

  trackTokenUsage(tokensUsed);
  return { success: true, text, tokensUsed };
}

// ========================
// Parsing de réponses JSON
// ========================

export function parseAIJsonResponse<T = any>(text: string): T | null {
  try {
    // On essaie d'abord d'extraire un bloc ```json ... ``` si présent
    const fencedMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (fencedMatch) {
      return JSON.parse(fencedMatch[1]);
    }

    // Sinon, on cherche un premier objet JSON "brut"
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    // Dernier recours : tenter un JSON.parse direct
    return JSON.parse(text);
  } catch (e) {
    console.warn("Impossible de parser la réponse IA en JSON", e);
    return null;
  }
}

// ========================
// Statistiques d'usage locale
// ========================

const USAGE_KEY = "ai_usage_stats";
const USAGE_DATE_KEY = "ai_usage_date";

interface UsageStats {
  tokensUsed: number;
  requestCount: number;
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export function getAIUsageStats(): UsageStats {
  if (typeof window === "undefined") {
    return { tokensUsed: 0, requestCount: 0 };
  }

  const today = getTodayDateString();
  const savedDate = localStorage.getItem(USAGE_DATE_KEY);

  if (savedDate !== today) {
    resetAIUsageStats();
    return { tokensUsed: 0, requestCount: 0 };
  }

  const saved = localStorage.getItem(USAGE_KEY);
  if (!saved) {
    return { tokensUsed: 0, requestCount: 0 };
  }

  try {
    const parsed = JSON.parse(saved) as UsageStats;
    return {
      tokensUsed: parsed.tokensUsed || 0,
      requestCount: parsed.requestCount || 0,
    };
  } catch {
    return { tokensUsed: 0, requestCount: 0 };
  }
}

export function resetAIUsageStats() {
  if (typeof window === "undefined") return;

  const today = getTodayDateString();
  const emptyStats: UsageStats = { tokensUsed: 0, requestCount: 0 };

  localStorage.setItem(USAGE_KEY, JSON.stringify(emptyStats));
  localStorage.setItem(USAGE_DATE_KEY, today);
}

function trackTokenUsage(tokens: number) {
  if (typeof window === "undefined") return;

  const today = getTodayDateString();
  const savedDate = localStorage.getItem(USAGE_DATE_KEY);

  let stats: UsageStats = { tokensUsed: 0, requestCount: 0 };

  if (savedDate === today) {
    const saved = localStorage.getItem(USAGE_KEY);
    if (saved) {
      try {
        stats = JSON.parse(saved) as UsageStats;
      } catch {
        stats = { tokensUsed: 0, requestCount: 0 };
      }
    }
  }

  stats.tokensUsed += tokens;
  stats.requestCount += 1;

  localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
  localStorage.setItem(USAGE_DATE_KEY, today);
}