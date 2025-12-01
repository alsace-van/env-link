import { useState, useEffect, useCallback } from "react";

export type AIProvider = "gemini" | "openai" | "anthropic" | "mistral";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  isConfigured: boolean;
  dailyLimit: number | null; // null = pas de limite
  warningThreshold: number; // Pourcentage d'avertissement (ex: 80)
}

const AI_PROVIDER_KEY = "ai_provider";
const AI_API_KEY = "ai_api_key";
const AI_DAILY_LIMIT_KEY = "ai_daily_limit";
const AI_WARNING_THRESHOLD_KEY = "ai_warning_threshold";
const AI_CONFIG_EVENT = "ai_config_updated";

export const AI_PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    description: "Gratuit avec quota généreux",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpText: "Obtenir une clé gratuite",
    suggestedLimit: 1_000_000, // Suggestion : 1M tokens/jour
  },
  openai: {
    name: "OpenAI GPT-4o",
    description: "Payant par token",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Obtenir une clé",
    suggestedLimit: 100_000, // Suggestion : 100k tokens/jour
  },
  anthropic: {
    name: "Anthropic Claude",
    description: "Payant par token",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/",
    helpText: "Obtenir une clé",
    suggestedLimit: 100_000,
  },
  mistral: {
    name: "Mistral AI",
    description: "Français, tarifs compétitifs",
    placeholder: "...",
    helpUrl: "https://console.mistral.ai/",
    helpText: "Obtenir une clé",
    suggestedLimit: 500_000,
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

  const [dailyLimit, setDailyLimit] = useState<number | null>(() => {
    const saved = localStorage.getItem(AI_DAILY_LIMIT_KEY);
    return saved ? parseInt(saved) : null;
  });

  const [warningThreshold, setWarningThreshold] = useState<number>(() => {
    const saved = localStorage.getItem(AI_WARNING_THRESHOLD_KEY);
    return saved ? parseInt(saved) : 80;
  });

  // Écouter les changements de config (synchronisation entre composants)
  useEffect(() => {
    const handleConfigUpdate = () => {
      const savedProvider = localStorage.getItem(AI_PROVIDER_KEY);
      const savedApiKey = localStorage.getItem(AI_API_KEY);
      const savedLimit = localStorage.getItem(AI_DAILY_LIMIT_KEY);
      const savedThreshold = localStorage.getItem(AI_WARNING_THRESHOLD_KEY);

      setProvider((savedProvider as AIProvider) || "gemini");
      setApiKey(savedApiKey || "");
      setDailyLimit(savedLimit ? parseInt(savedLimit) : null);
      setWarningThreshold(savedThreshold ? parseInt(savedThreshold) : 80);
    };

    window.addEventListener(AI_CONFIG_EVENT, handleConfigUpdate);
    window.addEventListener("storage", handleConfigUpdate);

    return () => {
      window.removeEventListener(AI_CONFIG_EVENT, handleConfigUpdate);
      window.removeEventListener("storage", handleConfigUpdate);
    };
  }, []);

  const isConfigured = !!apiKey;

  const saveConfig = useCallback(
    (newProvider: AIProvider, newApiKey: string, newDailyLimit?: number | null, newWarningThreshold?: number) => {
      localStorage.setItem(AI_PROVIDER_KEY, newProvider);
      localStorage.setItem(AI_API_KEY, newApiKey);

      if (newDailyLimit !== undefined) {
        if (newDailyLimit === null) {
          localStorage.removeItem(AI_DAILY_LIMIT_KEY);
        } else {
          localStorage.setItem(AI_DAILY_LIMIT_KEY, newDailyLimit.toString());
        }
        setDailyLimit(newDailyLimit);
      }

      if (newWarningThreshold !== undefined) {
        localStorage.setItem(AI_WARNING_THRESHOLD_KEY, newWarningThreshold.toString());
        setWarningThreshold(newWarningThreshold);
      }

      setProvider(newProvider);
      setApiKey(newApiKey);

      window.dispatchEvent(new Event(AI_CONFIG_EVENT));
    },
    [],
  );

  const clearConfig = useCallback(() => {
    localStorage.removeItem(AI_PROVIDER_KEY);
    localStorage.removeItem(AI_API_KEY);
    localStorage.removeItem(AI_DAILY_LIMIT_KEY);
    localStorage.removeItem(AI_WARNING_THRESHOLD_KEY);
    setProvider("gemini");
    setApiKey("");
    setDailyLimit(null);
    setWarningThreshold(80);

    window.dispatchEvent(new Event(AI_CONFIG_EVENT));
  }, []);

  const config: AIConfig = {
    provider,
    apiKey,
    isConfigured,
    dailyLimit,
    warningThreshold,
  };

  return {
    config,
    provider,
    apiKey,
    isConfigured,
    dailyLimit,
    warningThreshold,
    setProvider,
    setApiKey,
    setDailyLimit,
    setWarningThreshold,
    saveConfig,
    clearConfig,
    providerInfo: AI_PROVIDERS[provider],
  };
}
