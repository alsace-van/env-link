import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, RefreshCw, AlertTriangle, CheckCircle2, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AISettingRow {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

// Modèles connus par fournisseur (à jour décembre 2025)
const KNOWN_MODELS = {
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommandé)", free: true },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", free: true },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Payant)", free: false },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Recommandé)", free: false },
    { value: "gpt-4o", label: "GPT-4o", free: false },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", free: false },
  ],
  anthropic: [
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku (Recommandé)", free: false },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", free: false },
  ],
  mistral: [
    { value: "mistral-small-latest", label: "Mistral Small (Recommandé)", free: false },
    { value: "mistral-large-latest", label: "Mistral Large", free: false },
    { value: "open-mistral-nemo", label: "Mistral Nemo (Open)", free: true },
  ],
};

const PROVIDERS_INFO = {
  gemini: {
    name: "Google Gemini",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    deprecationUrl: "https://ai.google.dev/gemini-api/docs/deprecations",
  },
  openai: {
    name: "OpenAI",
    docsUrl: "https://platform.openai.com/docs/models",
    deprecationUrl: "https://platform.openai.com/docs/deprecations",
  },
  anthropic: {
    name: "Anthropic Claude",
    docsUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    deprecationUrl: "https://docs.anthropic.com/en/docs/resources/model-deprecations",
  },
  mistral: {
    name: "Mistral AI",
    docsUrl: "https://docs.mistral.ai/getting-started/models/",
    deprecationUrl: "https://docs.mistral.ai/",
  },
};

export const AdminAISettings = () => {
  const [settings, setSettings] = useState<Record<string, AISettingRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("*")
        .in("key", ["gemini_model", "openai_model", "anthropic_model", "mistral_model"]);

      if (error) throw error;

      const settingsMap: Record<string, AISettingRow> = {};
      data?.forEach((row: AISettingRow) => {
        settingsMap[row.key] = row;
      });
      setSettings(settingsMap);
    } catch (error: any) {
      console.error("Erreur chargement paramètres:", error);
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: string) => {
    setSaving(key);
    try {
      const { error } = await (supabase as any).from("app_settings").update({ value }).eq("key", key);

      if (error) throw error;

      setSettings((prev) => ({
        ...prev,
        [key]: { ...prev[key], value, updated_at: new Date().toISOString() },
      }));

      toast.success("Modèle mis à jour avec succès !");
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(null);
    }
  };

  const getProviderKey = (settingKey: string): keyof typeof KNOWN_MODELS => {
    return settingKey.replace("_model", "") as keyof typeof KNOWN_MODELS;
  };

  const isKnownModel = (provider: keyof typeof KNOWN_MODELS, model: string) => {
    return KNOWN_MODELS[provider].some((m) => m.value === model);
  };

  const renderProviderCard = (settingKey: string) => {
    const provider = getProviderKey(settingKey);
    const providerInfo = PROVIDERS_INFO[provider];
    const setting = settings[settingKey];
    const currentValue = setting?.value || "";
    const knownModels = KNOWN_MODELS[provider];
    const isCustom = currentValue && !isKnownModel(provider, currentValue);

    return (
      <Card key={settingKey}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {providerInfo.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {setting?.description || `Modèle ${providerInfo.name} utilisé par l'application`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={providerInfo.docsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Modèles
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={providerInfo.deprecationUrl} target="_blank" rel="noopener noreferrer">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Dépréciations
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sélecteur de modèle */}
          <div className="space-y-2">
            <Label>Modèle actuel</Label>
            <div className="flex gap-2">
              <Select
                value={isCustom ? "custom" : currentValue}
                onValueChange={(value) => {
                  if (value === "custom") {
                    setCustomModel((prev) => ({ ...prev, [settingKey]: currentValue }));
                  } else {
                    handleSave(settingKey, value);
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  {knownModels.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      <div className="flex items-center gap-2">
                        {model.label}
                        {model.free && (
                          <Badge variant="secondary" className="text-xs">
                            Gratuit
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">
                    <span className="text-muted-foreground">Modèle personnalisé...</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {saving === settingKey && <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* Champ personnalisé si modèle custom */}
          {(isCustom || customModel[settingKey] !== undefined) && (
            <div className="space-y-2">
              <Label>Nom du modèle personnalisé</Label>
              <div className="flex gap-2">
                <Input
                  value={customModel[settingKey] ?? currentValue}
                  onChange={(e) => setCustomModel((prev) => ({ ...prev, [settingKey]: e.target.value }))}
                  placeholder="ex: gemini-3.0-flash"
                />
                <Button
                  onClick={() => {
                    if (customModel[settingKey]) {
                      handleSave(settingKey, customModel[settingKey]);
                      setCustomModel((prev) => {
                        const copy = { ...prev };
                        delete copy[settingKey];
                        return copy;
                      });
                    }
                  }}
                  disabled={!customModel[settingKey] || saving === settingKey}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Enregistrer
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Entrez le nom exact du modèle tel qu'il apparaît dans la documentation du fournisseur.
              </p>
            </div>
          )}

          {/* Statut */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Modèle actif : <code className="bg-muted px-1 rounded">{currentValue}</code>
            </div>
            {setting?.updated_at && (
              <span className="text-xs text-muted-foreground">
                Mis à jour le {new Date(setting.updated_at).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerte d'information */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ces paramètres définissent les modèles IA utilisés par l'application. Si un fournisseur désactive un modèle,
          vous pouvez le changer ici sans toucher au code.
          <strong className="block mt-1">
            Conseil : Consultez régulièrement les pages de dépréciation des fournisseurs.
          </strong>
        </AlertDescription>
      </Alert>

      {/* Cartes par fournisseur */}
      <div className="grid gap-4">
        {renderProviderCard("gemini_model")}
        {renderProviderCard("openai_model")}
        {renderProviderCard("anthropic_model")}
        {renderProviderCard("mistral_model")}
      </div>

      {/* Section d'aide */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Que faire si un modèle est désactivé ?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. Consultez la page des modèles du fournisseur (liens ci-dessus)</p>
          <p>2. Trouvez le nouveau modèle recommandé (généralement similaire avec un numéro de version plus récent)</p>
          <p>3. Sélectionnez-le dans la liste ou entrez le nom exact en "modèle personnalisé"</p>
          <p>4. Testez avec une fonctionnalité IA (ex: résumé de notice) pour vérifier que ça fonctionne</p>
        </CardContent>
      </Card>
    </div>
  );
};
