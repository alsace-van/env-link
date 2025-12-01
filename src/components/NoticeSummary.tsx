import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertCircle, Search, X, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useAIConfig } from "@/hooks/useAIConfig";
import { AIConfigDialog } from "@/components/AIConfigDialog";
import { callAI } from "@/services/aiService";

interface NoticeSummaryProps {
  noticeId: string;
  pdfUrl?: string | null;
  existingSummary?: string | null;
  onSummaryGenerated?: (summary: string) => void;
}

/**
 * NoticeSummary - VERSION MULTI-IA (Clé utilisateur)
 *
 * L'utilisateur configure sa propre clé API pour générer les résumés.
 * Pas de gestion de quotas côté serveur.
 */
export const NoticeSummary = ({ noticeId, pdfUrl, existingSummary, onSummaryGenerated }: NoticeSummaryProps) => {
  const [summary, setSummary] = useState<string | null>(existingSummary || null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(0);
  const [showAiConfig, setShowAiConfig] = useState(false);

  // Configuration IA centralisée
  const { config: aiConfig, isConfigured: aiIsConfigured, providerInfo: aiProviderInfo } = useAIConfig();

  const handleGenerateSummary = async () => {
    // Vérifier que l'IA est configurée
    if (!aiIsConfigured) {
      setShowAiConfig(true);
      toast.error("Veuillez d'abord configurer votre clé API IA");
      return;
    }

    if (!pdfUrl) {
      toast.error("Impossible de récupérer le fichier PDF");
      return;
    }

    setLoading(true);

    try {
      console.log(`🚀 Génération du résumé avec ${aiProviderInfo.name}...`);
      toast.info(`Analyse avec ${aiProviderInfo.name}...`);

      // Télécharger le PDF et le convertir en base64
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

      const prompt = `Analyse cette notice technique et génère un résumé structuré en français.

Le résumé doit inclure :
1. **Présentation du produit** : Nom, marque, fonction principale
2. **Caractéristiques techniques** : Dimensions, poids, puissance, capacités
3. **Installation** : Étapes principales d'installation et prérequis
4. **Utilisation** : Mode d'emploi et fonctionnalités principales
5. **Sécurité** : Précautions importantes et avertissements
6. **Entretien** : Conseils de maintenance

Format le résumé de manière claire avec des sections bien identifiées.
Si certaines informations ne sont pas disponibles, ne les inclus pas.`;

      const aiResponse = await callAI({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        prompt,
        pdfBase64: base64Data,
        maxTokens: 4000,
      });

      if (!aiResponse.success || !aiResponse.text) {
        throw new Error(aiResponse.error || "Erreur lors de la génération du résumé");
      }

      const generatedSummary = aiResponse.text;
      setSummary(generatedSummary);

      // Sauvegarder le résumé en base
      await (supabase as any).from("notices").update({ resume_ia: generatedSummary }).eq("id", noticeId);

      if (onSummaryGenerated) {
        onSummaryGenerated(generatedSummary);
      }

      toast.success("Résumé généré avec succès !");
    } catch (error: any) {
      console.error("❌ Erreur:", error);
      toast.error(error.message || "Erreur lors de la génération du résumé");
    } finally {
      setLoading(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Fonction pour surligner les mots recherchés
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    let count = 0;

    const highlighted = parts
      .map((part, i) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          count++;
          return `<mark class="bg-yellow-300 dark:bg-yellow-600">${part}</mark>`;
        }
        return part;
      })
      .join("");

    setSearchResults(count);
    return highlighted;
  };

  const displayedSummary = searchQuery && summary ? highlightText(summary, searchQuery) : summary;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Résumé IA
              </CardTitle>
              <CardDescription>Résumé automatique généré par intelligence artificielle</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAiConfig(true)} className="text-muted-foreground">
              <Settings2 className="h-4 w-4 mr-1" />
              {aiIsConfigured ? aiProviderInfo.name : "Configurer"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!summary ? (
            <div className="space-y-4">
              {/* Alerte si IA non configurée */}
              {!aiIsConfigured ? (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 dark:text-amber-200">Configuration IA requise</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Pour générer des résumés, configurez votre clé API IA (Gemini gratuit recommandé).
                      </p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowAiConfig(true)}>
                        Configurer maintenant
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Générez un résumé intelligent de cette notice pour en extraire les informations clés :
                    caractéristiques techniques, installation, sécurité et conseils d'utilisation.
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleGenerateSummary} disabled={loading || !aiIsConfigured} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Générer le résumé IA
                  </>
                )}
              </Button>

              {aiIsConfigured && (
                <p className="text-xs text-center text-muted-foreground">Utilise votre clé {aiProviderInfo.name}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barre de recherche */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Rechercher dans le résumé..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults(0);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {searchQuery && (
                  <Badge variant="secondary" className="shrink-0">
                    {searchResults} résultat{searchResults !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {/* Résumé avec surlignage */}
              <div
                className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: displayedSummary || "" }}
              />

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  Résumé généré par {aiProviderInfo.name} • Vérifiez toujours la notice complète
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateSummary} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Sparkles className="mr-2 h-3 w-3" />}
                  Régénérer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Configuration IA */}
      <AIConfigDialog open={showAiConfig} onOpenChange={setShowAiConfig} />
    </>
  );
};
