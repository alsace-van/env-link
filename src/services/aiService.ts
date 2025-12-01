// Centralisé : appels aux différents fournisseurs IA + statistiques d'usage

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

// ========================
// Appel générique multi-IA
// ========================

export async function callAI(params: CallAIParams): Promise<AIResponse> {
  const { provider, apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens = 4000 } = params;

  try {
    switch (provider) {
      case "gemini":
        return await callGemini(apiKey, prompt, { pdfBase64, imageBase64, imageMimeType, maxTokens });
      case "openai":
        return await callOpenAI(apiKey, prompt, { pdfBase64, imageBase64, imageMimeType, maxTokens });
      case "anthropic":
        return await callAnthropic(apiKey, prompt, { pdfBase64, imageBase64, imageMimeType, maxTokens });
      case "mistral":
        return await callMistral(apiKey, prompt, { pdfBase64, imageBase64, imageMimeType, maxTokens });
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
  { pdfBase64, imageBase64, imageMimeType, maxTokens }: ProviderExtraParams,
): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const parts: any[] = [{ text: prompt }];

  if (pdfBase64) {
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  }
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: imageMimeType || "image/jpeg", data: imageBase64 } });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
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
      model: "gpt-4o",
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
      model: "claude-3-5-sonnet-20241022",
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
  { pdfBase64, imageBase64, imageMimeType, maxTokens }: ProviderExtraParams,
): Promise<AIResponse> {
  // Actuellement, l'API chat Mistral ne gère pas directement les PDFs/images comme les autres.
  // On envoie donc uniquement le prompt texte.
  console.warn("Mistral : les paramètres PDF / image ne sont pas encore supportés côté client.");

  const messages: any[] = [{ role: "user", content: prompt }];

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
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
