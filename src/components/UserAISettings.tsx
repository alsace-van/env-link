// components/UserAISettings.tsx
// VERSION: 2.0 - Synchronisation avec useAIConfig via événement ai_config_updated
// Source unique: table user_ai_settings (Supabase)

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Save, Check, ExternalLink, Sparkles, Bot, Cpu, Zap, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIProvider {
  id: string;
  name: string;
  description: string;
  keyField: string;
  placeholder: string;
  helpUrl: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Vision, transcription audio, analyse de documents",
    keyField: "gemini_api_key",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    icon: Sparkles,
    color: "text-blue-500",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4, DALL-E, Whisper",
    keyField: "openai_api_key",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    icon: Bot,
    color: "text-green-500",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.5, analyse avancée",
    keyField: "anthropic_api_key",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    icon: Cpu,
    color: "text-orange-500",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Modèles français performants",
    keyField: "mistral_api_key",
    placeholder: "...",
    helpUrl: "https://console.mistral.ai/api-keys",
    icon: Zap,
    color: "text-purple-500",
  },
];

const UserAISettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await (supabase as any)
        .from("user_ai_settings")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erreur chargement paramètres IA:", error);
      }

      if (data) {
        const loadedSettings: Record<string, string> = {};
        const loadedSavedKeys = new Set<string>();

        AI_PROVIDERS.forEach((provider) => {
          if (data[provider.keyField]) {
            loadedSettings[provider.keyField] = data[provider.keyField];
            loadedSavedKeys.add(provider.id);
          }
        });

        setSettings(loadedSettings);
        setSavedKeys(loadedSavedKeys);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKey = async (provider: AIProvider) => {
    const value = settings[provider.keyField];

    if (!value || value.trim() === "") {
      toast.error("Veuillez entrer une clé API");
      return;
    }

    setIsSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Utilisateur non connecté");
        return;
      }

      // Vérifier si un enregistrement existe déjà
      const { data: existing } = await (supabase as any)
        .from("user_ai_settings")
        .select("id, default_provider")
        .eq("user_id", userData.user.id)
        .single();

      // Si pas de default_provider, utiliser ce provider comme défaut
      const shouldSetDefault = !existing?.default_provider;

      if (existing) {
        // Mettre à jour
        const updateData: Record<string, any> = {
          [provider.keyField]: value.trim(),
          updated_at: new Date().toISOString(),
        };

        // Définir ce provider comme défaut si pas encore défini
        if (shouldSetDefault) {
          updateData.default_provider = provider.id;
        }

        const { error } = await (supabase as any)
          .from("user_ai_settings")
          .update(updateData)
          .eq("user_id", userData.user.id);

        if (error) throw error;
      } else {
        // Créer avec ce provider comme défaut
        const { error } = await (supabase as any).from("user_ai_settings").insert({
          user_id: userData.user.id,
          [provider.keyField]: value.trim(),
          default_provider: provider.id,
        });

        if (error) throw error;
      }

      // Mettre à jour le cache localStorage pour synchronisation immédiate
      if (shouldSetDefault || existing?.default_provider === provider.id) {
        localStorage.setItem("ai_provider", provider.id);
        localStorage.setItem("ai_api_key", value.trim());
      }

      // Notifier les autres composants (useAIConfig, chatbot, etc.)
      window.dispatchEvent(new Event("ai_config_updated"));

      setSavedKeys(new Set([...savedKeys, provider.id]));
      toast.success(`Clé ${provider.name} enregistrée !`);
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(`Erreur: ${error.message || "Impossible de sauvegarder"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async (provider: AIProvider) => {
    setIsSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Vérifier si c'était le provider par défaut
      const { data: existing } = await (supabase as any)
        .from("user_ai_settings")
        .select("default_provider")
        .eq("user_id", userData.user.id)
        .single();

      const updateData: Record<string, any> = {
        [provider.keyField]: null,
        updated_at: new Date().toISOString(),
      };

      // Si c'était le provider par défaut, le réinitialiser
      if (existing?.default_provider === provider.id) {
        updateData.default_provider = null;
        localStorage.removeItem("ai_provider");
        localStorage.removeItem("ai_api_key");
      }

      const { error } = await (supabase as any)
        .from("user_ai_settings")
        .update(updateData)
        .eq("user_id", userData.user.id);

      if (error) throw error;

      setSettings({ ...settings, [provider.keyField]: "" });
      const newSavedKeys = new Set(savedKeys);
      newSavedKeys.delete(provider.id);
      setSavedKeys(newSavedKeys);

      // Notifier les autres composants
      window.dispatchEvent(new Event("ai_config_updated"));

      toast.success(`Clé ${provider.name} supprimée`);
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibility = (keyField: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyField)) {
      newVisible.delete(keyField);
    } else {
      newVisible.add(keyField);
    }
    setVisibleKeys(newVisible);
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return key.substring(0, 4) + "••••••••" + key.substring(key.length - 4);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Paramètres IA</h2>
        <p className="text-muted-foreground">
          Configurez vos clés API pour utiliser les fonctionnalités d'intelligence artificielle. Chaque clé est stockée
          de manière sécurisée et n'est utilisée que pour votre compte.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Important</p>
          <p>
            Vos clés API sont personnelles. Ne les partagez jamais. Chaque fournisseur facture l'utilisation de son API
            selon ses propres tarifs.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {AI_PROVIDERS.map((provider) => {
          const IconComponent = provider.icon;
          const isConfigured = savedKeys.has(provider.id);
          const currentValue = settings[provider.keyField] || "";
          const isVisible = visibleKeys.has(provider.keyField);

          return (
            <Card key={provider.id} className={isConfigured ? "border-green-200 dark:border-green-800" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${provider.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {provider.name}
                        {isConfigured && (
                          <span className="flex items-center gap-1 text-xs font-normal text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3" />
                            Configuré
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>{provider.description}</CardDescription>
                    </div>
                  </div>
                  <a
                    href={provider.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    Obtenir une clé
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={isVisible ? "text" : "password"}
                      value={isVisible ? currentValue : currentValue ? maskKey(currentValue) : ""}
                      onChange={(e) => {
                        if (isVisible) {
                          setSettings({ ...settings, [provider.keyField]: e.target.value });
                        }
                      }}
                      onFocus={() => {
                        if (!isVisible) {
                          toggleVisibility(provider.keyField);
                        }
                      }}
                      placeholder={provider.placeholder}
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility(provider.keyField)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <Button onClick={() => handleSaveKey(provider)} disabled={isSaving || !currentValue}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Enregistrer
                      </>
                    )}
                  </Button>

                  {isConfigured && (
                    <Button
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteKey(provider)}
                      disabled={isSaving}
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
        <p className="font-medium">Utilisation des clés API :</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <strong>Gemini</strong> : Scan carte grise, transcription audio, résumé PDF
          </li>
          <li>
            <strong>OpenAI</strong> : Génération de texte, images (optionnel)
          </li>
          <li>
            <strong>Anthropic</strong> : Analyse avancée de documents (optionnel)
          </li>
          <li>
            <strong>Mistral</strong> : Alternative française (optionnel)
          </li>
        </ul>
        <p className="text-xs mt-2">
          💡 <strong>Gemini</strong> est recommandé comme clé principale car il offre le meilleur rapport qualité/prix
          pour les fonctionnalités de l'application.
        </p>
      </div>
    </div>
  );
};

export default UserAISettings;
