import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AIProvider = "gemini" | "openai" | "anthropic" | "mistral";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  isConfigured: boolean;
  dailyLimit: number | null;
  warningThreshold: number;
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
    suggestedLimit: 1_000_000,
  },
  openai: {
    name: "OpenAI GPT-4o",
    description: "Payant par token",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Obtenir une clé",
    suggestedLimit: 100_000,
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

// Encodage simple pour ne pas stocker la clé en clair
// Note: Ce n'est pas du vrai chiffrement, juste de l'obfuscation
function encodeKey(key: string): string {
  return btoa(encodeURIComponent(key));
}

function decodeKey(encoded: string): string {
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return "";
  }
}

export function useAIConfig() {
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [warningThreshold, setWarningThreshold] = useState<number>(80);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Charger la config depuis Supabase au démarrage
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          // Pas connecté, utiliser localStorage
          loadFromLocalStorage();
          setIsLoading(false);
          return;
        }

        setUserId(user.id);

        // Charger depuis Supabase
        const { data, error } = await (supabase as any)
          .from("user_ai_config")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (data && !error) {
          // Config trouvée dans Supabase
          setProvider((data.provider as AIProvider) || "gemini");
          setApiKey(data.encrypted_api_key ? decodeKey(data.encrypted_api_key) : "");
          setDailyLimit(data.daily_limit || null);
          setWarningThreshold(data.warning_threshold || 80);

          // Synchroniser avec localStorage
          if (data.provider) localStorage.setItem(AI_PROVIDER_KEY, data.provider);
          if (data.encrypted_api_key) localStorage.setItem(AI_API_KEY, decodeKey(data.encrypted_api_key));
          if (data.daily_limit) localStorage.setItem(AI_DAILY_LIMIT_KEY, data.daily_limit.toString());
          if (data.warning_threshold) localStorage.setItem(AI_WARNING_THRESHOLD_KEY, data.warning_threshold.toString());
        } else {
          // Pas de config Supabase, essayer localStorage
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error("Erreur chargement config IA:", error);
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const loadFromLocalStorage = () => {
    const savedProvider = localStorage.getItem(AI_PROVIDER_KEY);
    const savedApiKey = localStorage.getItem(AI_API_KEY);
    const savedLimit = localStorage.getItem(AI_DAILY_LIMIT_KEY);
    const savedThreshold = localStorage.getItem(AI_WARNING_THRESHOLD_KEY);

    setProvider((savedProvider as AIProvider) || "gemini");
    setApiKey(savedApiKey || "");
    setDailyLimit(savedLimit ? parseInt(savedLimit) : null);
    setWarningThreshold(savedThreshold ? parseInt(savedThreshold) : 80);
  };

  // Écouter les changements de config (synchronisation entre composants)
  useEffect(() => {
    const handleConfigUpdate = () => {
      loadFromLocalStorage();
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
    async (newProvider: AIProvider, newApiKey: string, newDailyLimit?: number | null, newWarningThreshold?: number) => {
      // Sauvegarder dans localStorage (toujours)
      localStorage.setItem(AI_PROVIDER_KEY, newProvider);
      localStorage.setItem(AI_API_KEY, newApiKey);

      if (newDailyLimit !== undefined) {
        if (newDailyLimit === null) {
          localStorage.removeItem(AI_DAILY_LIMIT_KEY);
        } else {
          localStorage.setItem(AI_DAILY_LIMIT_KEY, newDailyLimit.toString());
        }
      }

      if (newWarningThreshold !== undefined) {
        localStorage.setItem(AI_WARNING_THRESHOLD_KEY, newWarningThreshold.toString());
      }

      // Mettre à jour l'état
      setProvider(newProvider);
      setApiKey(newApiKey);
      if (newDailyLimit !== undefined) setDailyLimit(newDailyLimit);
      if (newWarningThreshold !== undefined) setWarningThreshold(newWarningThreshold);

      // Sauvegarder dans Supabase si connecté
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const configData = {
            user_id: user.id,
            provider: newProvider,
            encrypted_api_key: newApiKey ? encodeKey(newApiKey) : null,
            daily_limit: newDailyLimit ?? null,
            warning_threshold: newWarningThreshold ?? 80,
            updated_at: new Date().toISOString(),
          };

          // Upsert (insert ou update)
          await (supabase as any).from("user_ai_config").upsert(configData, { onConflict: "user_id" });
        } catch (error) {
          console.error("Erreur sauvegarde config Supabase:", error);
          // La config est quand même dans localStorage
        }
      }

      window.dispatchEvent(new Event(AI_CONFIG_EVENT));
    },
    [],
  );

  const clearConfig = useCallback(async () => {
    // Nettoyer localStorage
    localStorage.removeItem(AI_PROVIDER_KEY);
    localStorage.removeItem(AI_API_KEY);
    localStorage.removeItem(AI_DAILY_LIMIT_KEY);
    localStorage.removeItem(AI_WARNING_THRESHOLD_KEY);

    // Réinitialiser l'état
    setProvider("gemini");
    setApiKey("");
    setDailyLimit(null);
    setWarningThreshold(80);

    // Supprimer de Supabase si connecté
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        await (supabase as any).from("user_ai_config").delete().eq("user_id", user.id);
      } catch (error) {
        console.error("Erreur suppression config Supabase:", error);
      }
    }

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
    isLoading,
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
