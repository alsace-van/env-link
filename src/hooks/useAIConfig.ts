// hooks/useAIConfig.ts
// VERSION: 2.1 - Source unique: table user_ai_settings (Supabase)
// Fix: Ordre des hooks corrigé

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

// Clés localStorage pour le cache local uniquement (fallback hors connexion)
const AI_PROVIDER_KEY = "ai_provider";
const AI_API_KEY = "ai_api_key";
const AI_CONFIG_EVENT = "ai_config_updated";

// Mapping des providers vers les colonnes de la table user_ai_settings
const PROVIDER_KEY_COLUMNS: Record<AIProvider, string> = {
  gemini: "gemini_api_key",
  openai: "openai_api_key",
  anthropic: "anthropic_api_key",
  mistral: "mistral_api_key",
};

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

// Fonction helper pour charger depuis localStorage (définie hors du hook)
function getFromLocalStorage(): { provider: AIProvider; apiKey: string } {
  const savedProvider = localStorage.getItem(AI_PROVIDER_KEY);
  const savedApiKey = localStorage.getItem(AI_API_KEY);
  return {
    provider: (savedProvider as AIProvider) || "gemini",
    apiKey: savedApiKey || "",
  };
}

export function useAIConfig() {
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [warningThreshold, setWarningThreshold] = useState<number>(80);
  const [isLoading, setIsLoading] = useState(true);

  // Charger la config depuis Supabase (source unique)
  const loadConfig = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Pas connecté, utiliser le cache localStorage
        const cached = getFromLocalStorage();
        setProvider(cached.provider);
        setApiKey(cached.apiKey);
        setIsLoading(false);
        return;
      }

      // Charger depuis user_ai_settings (source unique)
      const { data, error } = await (supabase as any)
        .from("user_ai_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data && !error) {
        // Déterminer le provider par défaut
        const defaultProvider = (data.default_provider as AIProvider) || "gemini";
        setProvider(defaultProvider);

        // Récupérer la clé API du provider sélectionné
        const keyColumn = PROVIDER_KEY_COLUMNS[defaultProvider];
        const currentApiKey = data[keyColumn] || "";
        setApiKey(currentApiKey);

        // Mettre à jour le cache localStorage
        localStorage.setItem(AI_PROVIDER_KEY, defaultProvider);
        if (currentApiKey) {
          localStorage.setItem(AI_API_KEY, currentApiKey);
        }

        console.log(
          `✅ Config IA chargée depuis Supabase: ${defaultProvider}, clé: ${currentApiKey ? "configurée" : "non configurée"}`,
        );
      } else {
        // Pas de config Supabase, cache localStorage
        console.log("ℹ️ Pas de config IA dans Supabase, utilisation du cache local");
        const cached = getFromLocalStorage();
        setProvider(cached.provider);
        setApiKey(cached.apiKey);
      }
    } catch (error) {
      console.error("Erreur chargement config IA:", error);
      const cached = getFromLocalStorage();
      setProvider(cached.provider);
      setApiKey(cached.apiKey);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sauvegarder la config dans Supabase (source unique)
  const saveConfig = useCallback(
    async (newProvider: AIProvider, newApiKey: string, newDailyLimit?: number | null, newWarningThreshold?: number) => {
      // Mettre à jour l'état local immédiatement
      setProvider(newProvider);
      setApiKey(newApiKey);
      if (newDailyLimit !== undefined) setDailyLimit(newDailyLimit);
      if (newWarningThreshold !== undefined) setWarningThreshold(newWarningThreshold);

      // Mettre à jour le cache localStorage
      localStorage.setItem(AI_PROVIDER_KEY, newProvider);
      localStorage.setItem(AI_API_KEY, newApiKey);

      // Sauvegarder dans Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          // Vérifier si un enregistrement existe
          const { data: existing } = await (supabase as any)
            .from("user_ai_settings")
            .select("id")
            .eq("user_id", user.id)
            .single();

          const keyColumn = PROVIDER_KEY_COLUMNS[newProvider];

          const updateData: Record<string, any> = {
            default_provider: newProvider,
            [keyColumn]: newApiKey || null,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            // Mettre à jour
            const { error } = await (supabase as any)
              .from("user_ai_settings")
              .update(updateData)
              .eq("user_id", user.id);

            if (error) throw error;
          } else {
            // Créer
            const { error } = await (supabase as any).from("user_ai_settings").insert({
              user_id: user.id,
              ...updateData,
            });

            if (error) throw error;
          }

          console.log(`✅ Config IA sauvegardée dans Supabase: ${newProvider}`);
        } catch (error) {
          console.error("Erreur sauvegarde config IA Supabase:", error);
        }
      }

      // Notifier les autres composants
      window.dispatchEvent(new Event(AI_CONFIG_EVENT));
    },
    [],
  );

  // Supprimer la config
  const clearConfig = useCallback(async () => {
    // Nettoyer l'état local
    setProvider("gemini");
    setApiKey("");
    setDailyLimit(null);
    setWarningThreshold(80);

    // Nettoyer le cache localStorage
    localStorage.removeItem(AI_PROVIDER_KEY);
    localStorage.removeItem(AI_API_KEY);

    // Supprimer de Supabase
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        // Mettre à null les clés et le provider par défaut
        await (supabase as any)
          .from("user_ai_settings")
          .update({
            default_provider: null,
            gemini_api_key: null,
            openai_api_key: null,
            anthropic_api_key: null,
            mistral_api_key: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        console.log("✅ Config IA supprimée de Supabase");
      } catch (error) {
        console.error("Erreur suppression config IA Supabase:", error);
      }
    }

    // Notifier les autres composants
    window.dispatchEvent(new Event(AI_CONFIG_EVENT));
  }, []);

  // Charger au démarrage
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Écouter les changements de config (synchronisation entre composants)
  useEffect(() => {
    const handleConfigUpdate = () => {
      loadConfig();
    };

    window.addEventListener(AI_CONFIG_EVENT, handleConfigUpdate);
    window.addEventListener("storage", handleConfigUpdate);

    return () => {
      window.removeEventListener(AI_CONFIG_EVENT, handleConfigUpdate);
      window.removeEventListener("storage", handleConfigUpdate);
    };
  }, [loadConfig]);

  const isConfigured = !!apiKey;

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
    reloadConfig: loadConfig,
    providerInfo: AI_PROVIDERS[provider],
  };
}

// Fonction utilitaire pour récupérer la clé API directement (sans hook)
// Utilisée par les services comme documentIndexingService
export async function getAIApiKey(targetProvider: AIProvider = "gemini"): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Fallback localStorage
      const cached = getFromLocalStorage();
      if (cached.provider === targetProvider && cached.apiKey) {
        return cached.apiKey;
      }
      return null;
    }

    const keyColumn = PROVIDER_KEY_COLUMNS[targetProvider];

    const { data, error } = await (supabase as any)
      .from("user_ai_settings")
      .select(keyColumn)
      .eq("user_id", user.id)
      .single();

    if (data && !error) {
      return data[keyColumn] || null;
    }
  } catch (error) {
    console.error(`Erreur récupération clé API ${targetProvider}:`, error);
  }

  return null;
}
