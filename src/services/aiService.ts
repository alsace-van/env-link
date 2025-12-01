import { AIProvider } from "@/hooks/useAIConfig";

export interface AIRequestOptions {
  provider: AIProvider;
  apiKey: string;
  prompt: string;
  pdfBase64?: string;
  imageBase64?: string;
  imageMimeType?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
}

// Tracking de l'usage en localStorage
const USAGE_KEY = "ai_usage_stats";

interface UsageStats {
  totalTokens: number;
  totalRequests: number;
  todayTokens: number;
  todayRequests: number;
  lastResetDate: string;
  history: { date: string; tokens: number; requests: number }[];
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getUsageStats(): UsageStats {
  const saved = localStorage.getItem(USAGE_KEY);
  const today = getTodayDate();

  if (saved) {
    const stats: UsageStats = JSON.parse(saved);
    // Reset les compteurs du jour si c'est un nouveau jour
    if (stats.lastResetDate !== today) {
      // Sauvegarder l'historique du jour précédent
      if (stats.todayTokens > 0 || stats.todayRequests > 0) {
        stats.history = stats.history || [];
        stats.history.push({
          date: stats.lastResetDate,
          tokens: stats.todayTokens,
          requests: stats.todayRequests,
        });
        // Garder seulement les 30 derniers jours
        if (stats.history.length > 30) {
          stats.history = stats.history.slice(-30);
        }
      }
      stats.todayTokens = 0;
      stats.todayRequests = 0;
      stats.lastResetDate = today;
    }
    return stats;
  }

  return {
    totalTokens: 0,
    totalRequests: 0,
    todayTokens: 0,
    todayRequests: 0,
    lastResetDate: today,
    history: [],
  };
}

function saveUsageStats(stats: UsageStats): void {
  localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
}

export function trackUsage(tokens: number): void {
  const stats = getUsageStats();
  stats.totalTokens += tokens;
  stats.totalRequests += 1;
  stats.todayTokens += tokens;
  stats.todayRequests += 1;
  saveUsageStats(stats);
}

export function getAIUsageStats(): UsageStats {
  return getUsageStats();
}

export function resetAIUsageStats(): void {
  localStorage.removeItem(USAGE_KEY);
}

/**
 * Service centralisé pour les appels IA
 * Supporte : Gemini, OpenAI, Anthropic, Mistral
 */
export async function callAI(options: AIRequestOptions): Promise<AIResponse> {
  const {
    provider,
    apiKey,
    prompt,
    pdfBase64,
    imageBase64,
    imageMimeType = "image/jpeg",
    maxTokens = 16000,
    temperature = 0.1,
  } = options;

  if (!apiKey) {
    return { success: false, error: "Clé API non configurée" };
  }

  try {
    let result: ProviderResponse;

    switch (provider) {
      case "gemini":
        result = await callGemini({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      case "openai":
        result = await callOpenAI({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      case "anthropic":
        result = await callAnthropic({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      case "mistral":
        result = await callMistral({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      default:
        return { success: false, error: `Fournisseur IA non supporté: ${provider}` };
    }

    if (!result.text) {
      return { success: false, error: "Réponse vide de l'IA" };
    }

    // Tracker les tokens utilisés
    if (result.tokensUsed > 0) {
      trackUsage(result.tokensUsed);
    }

    return {
      success: true,
      text: result.text,
      tokensUsed: {
        input: 0, // On n'a pas le détail pour tous les providers
        output: 0,
        total: result.tokensUsed,
      },
    };
  } catch (error: any) {
    console.error(`Erreur ${provider}:`, error);
    return { success: false, error: error.message || "Erreur lors de l'appel IA" };
  }
}

interface ProviderCallOptions {
  apiKey: string;
  prompt: string;
  pdfBase64?: string;
  imageBase64?: string;
  imageMimeType: string;
  maxTokens: number;
  temperature: number;
}

interface ProviderResponse {
  text: string;
  tokensUsed: number;
}

async function callGemini(options: ProviderCallOptions): Promise<ProviderResponse> {
  const { apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature } = options;

  const parts: any[] = [{ text: prompt }];

  if (pdfBase64) {
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  }
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
  }

  // Utiliser gemini-2.5-flash (gratuit avec quota généreux)
  const model = "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error("Quota Gemini dépassé, réessayez plus tard");
    }
    throw new Error(`Erreur Gemini ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Récupérer les tokens utilisés
  const promptTokens = result.usageMetadata?.promptTokenCount || 0;
  const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

  return { text, tokensUsed: promptTokens + outputTokens };
}

async function callOpenAI(options: ProviderCallOptions): Promise<ProviderResponse> {
  const { apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature } = options;

  const content: any[] = [{ type: "text", text: prompt }];

  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
    });
  }
  if (pdfBase64) {
    // OpenAI ne supporte pas nativement les PDF, on l'envoie comme "image" (peut ne pas fonctionner)
    content.push({
      type: "image_url",
      image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Erreur OpenAI ${response.status}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";

  // Récupérer les tokens utilisés
  const promptTokens = result.usage?.prompt_tokens || 0;
  const outputTokens = result.usage?.completion_tokens || 0;

  return { text, tokensUsed: promptTokens + outputTokens };
}

async function callAnthropic(options: ProviderCallOptions): Promise<ProviderResponse> {
  const { apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens } = options;

  const content: any[] = [];

  if (pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
    });
  }
  if (imageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: imageMimeType, data: imageBase64 },
    });
  }
  content.push({ type: "text", text: prompt });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Erreur Anthropic ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "";

  // Récupérer les tokens utilisés
  const inputTokens = result.usage?.input_tokens || 0;
  const outputTokens = result.usage?.output_tokens || 0;

  return { text, tokensUsed: inputTokens + outputTokens };
}

async function callMistral(options: ProviderCallOptions): Promise<ProviderResponse> {
  const { apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature } = options;

  const content: any[] = [{ type: "text", text: prompt }];

  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
    });
  }
  if (pdfBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
    });
  }

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "pixtral-large-latest",
      messages: [{ role: "user", content }],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Erreur Mistral ${response.status}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";

  // Récupérer les tokens utilisés
  const promptTokens = result.usage?.prompt_tokens || 0;
  const outputTokens = result.usage?.completion_tokens || 0;

  return { text, tokensUsed: promptTokens + outputTokens };
}

/**
 * Utilitaire pour parser une réponse JSON de l'IA
 */
export function parseAIJsonResponse<T>(text: string): T | null {
  let jsonStr = text.trim();

  // Enlever les backticks markdown
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error("Erreur parsing JSON IA:", error);
    console.log("Réponse brute:", jsonStr.substring(0, 500));
    return null;
  }
}
