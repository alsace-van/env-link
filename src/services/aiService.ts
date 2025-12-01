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
    let textResponse = "";

    switch (provider) {
      case "gemini":
        textResponse = await callGemini({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      case "openai":
        textResponse = await callOpenAI({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      case "anthropic":
        textResponse = await callAnthropic({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      case "mistral":
        textResponse = await callMistral({ apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature });
        break;
      default:
        return { success: false, error: `Fournisseur IA non supporté: ${provider}` };
    }

    if (!textResponse) {
      return { success: false, error: "Réponse vide de l'IA" };
    }

    return { success: true, text: textResponse };
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

async function callGemini(options: ProviderCallOptions): Promise<string> {
  const { apiKey, prompt, pdfBase64, imageBase64, imageMimeType, maxTokens, temperature } = options;

  const parts: any[] = [{ text: prompt }];

  if (pdfBase64) {
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  }
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error("Quota Gemini dépassé, réessayez plus tard");
    }
    throw new Error(`Erreur Gemini ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAI(options: ProviderCallOptions): Promise<string> {
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
  return result.choices?.[0]?.message?.content || "";
}

async function callAnthropic(options: ProviderCallOptions): Promise<string> {
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
  return result.content?.[0]?.text || "";
}

async function callMistral(options: ProviderCallOptions): Promise<string> {
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
  return result.choices?.[0]?.message?.content || "";
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
