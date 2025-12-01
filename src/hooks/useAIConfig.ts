import { useState, useEffect, useCallback } from "react";

export type AIProvider = "gemini" | "openai" | "anthropic" | "mistral";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  isConfigured: boolean;
}

const AI_PROVIDER_KEY = "ai_provider";
const AI_API_KEY = "ai_api_key";
const AI_CONFIG_EVENT = "ai_config_updated";

export const AI_PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    description: "Gratuit avec quota généreux",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpText: "Obtenir une clé gratuite",
  },
  openai: {
    name: "OpenAI GPT-4o",
    description: "Payant par token",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Obtenir une clé",
  },
  anthropic: {
    name: "Anthropic Claude",
    description: "Payant par token",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/",
    helpText: "Obtenir une clé",
  },
  mistral: {
    name: "Mistral AI",
    description: "Français, tarifs compétitifs",
    placeholder: "...",
    helpUrl: "https://console.mistral.ai/",
    helpText: "Obtenir une clé",
  },
};

export function useAIConfig() {
  const [provider, setProvider] = useState<AIProvider>(() => {
    const saved = localStorage.getItem(AI_PROVIDER_KEY);
    return (saved as AIProvider) || "gemini";
  });

  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(AI_API_KEY) || "";
  });

  // Écouter les changements de config (synchronisation entre composants)
  useEffect(() => {
    const handleConfigUpdate = () => {
      const savedProvider = localStorage.getItem(AI_PROVIDER_KEY);
      const savedApiKey = localStorage.getItem(AI_API_KEY);
      setProvider((savedProvider as AIProvider) || "gemini");
      setApiKey(savedApiKey || "");
    };

    // Écouter l'événement custom
    window.addEventListener(AI_CONFIG_EVENT, handleConfigUpdate);

    // Écouter aussi les changements de localStorage (pour autres onglets)
    window.addEventListener("storage", handleConfigUpdate);

    return () => {
      window.removeEventListener(AI_CONFIG_EVENT, handleConfigUpdate);
      window.removeEventListener("storage", handleConfigUpdate);
    };
  }, []);

  const isConfigured = !!apiKey;

  const saveConfig = useCallback((newProvider: AIProvider, newApiKey: string) => {
    localStorage.setItem(AI_PROVIDER_KEY, newProvider);
    localStorage.setItem(AI_API_KEY, newApiKey);
    setProvider(newProvider);
    setApiKey(newApiKey);

    // Émettre un événement pour synchroniser tous les composants
    window.dispatchEvent(new Event(AI_CONFIG_EVENT));
  }, []);

  const clearConfig = useCallback(() => {
    localStorage.removeItem(AI_PROVIDER_KEY);
    localStorage.removeItem(AI_API_KEY);
    setProvider("gemini");
    setApiKey("");

    // Émettre un événement pour synchroniser tous les composants
    window.dispatchEvent(new Event(AI_CONFIG_EVENT));
  }, []);

  const config: AIConfig = {
    provider,
    apiKey,
    isConfigured,
  };

  return {
    config,
    provider,
    apiKey,
    isConfigured,
    setProvider,
    setApiKey,
    saveConfig,
    clearConfig,
    providerInfo: AI_PROVIDERS[provider],
  };
}
