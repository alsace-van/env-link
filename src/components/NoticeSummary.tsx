import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NoticeSummaryProps {
  noticeId: string;
  existingSummary?: string | null;
  onSummaryGenerated?: (summary: string) => void;
}

interface AIUsage {
  plan: string;
  today_count: number;
  month_count: number;
  month_tokens: number;
  limit_per_day: number;
  limit_per_month: number;
  remaining_today: number;
  remaining_month_tokens: number;
}

export const NoticeSummary = ({ noticeId, existingSummary, onSummaryGenerated }: NoticeSummaryProps) => {
  const [summary, setSummary] = useState<string | null>(existingSummary || null);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const loadUsage = async () => {
    setLoadingUsage(true);
    try {
      const { data, error } = await supabase.rpc("get_user_ai_usage", {
        p_feature: "pdf_summary",
      });

      if (error) {
        console.error("Erreur chargement usage:", error);
        return;
      }

      if (data && data.length > 0) {
        setUsage(data[0]);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleGenerateSummary = async () => {
    setLoading(true);
    setErrorDetails(null);
    await loadUsage();

    try {
      console.log("🚀 Appel Edge Function avec noticeId:", noticeId);

      const { data, error } = await supabase.functions.invoke("summarize-notice", {
        body: { noticeId },
      });

      console.log("📥 Réponse Edge Function:", { data, error });

      if (error) {
        console.error("❌ Erreur Edge Function:", error);

        // AFFICHER L'ERREUR COMPLÈTE
        const errorMessage = JSON.stringify(error, null, 2);
        setErrorDetails(errorMessage);

        toast.error("Erreur lors de la génération du résumé", {
          description: error.message || "Erreur inconnue",
          duration: 10000,
        });
        return;
      }

      if (data?.error) {
        console.error("❌ Erreur dans data:", data.error);
        setErrorDetails(JSON.stringify(data, null, 2));

        if (data.error.includes("Limite")) {
          toast.error(data.error, {
            description: `Réinitialisation à minuit`,
            action: {
              label: "Passer Pro",
              onClick: () => (window.location.href = "/pricing"),
            },
            duration: 5000,
          });
        } else {
          toast.error(data.error, { duration: 10000 });
        }
        return;
      }

      console.log("✅ Résumé généré avec succès");
      setSummary(data.summary);
      if (onSummaryGenerated) {
        onSummaryGenerated(data.summary);
      }

      if (data.fromCache) {
        toast.success("Résumé récupéré instantanément (cache)", {
          description: "Aucun crédit utilisé",
        });
      } else {
        toast.success("Résumé généré avec succès !", {
          description: `${data.tokens} tokens utilisés`,
        });
      }

      // Recharger l'usage
      await loadUsage();
    } catch (error) {
      console.error("❌ Exception:", error);
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      setErrorDetails(errorMessage);
      toast.error("Erreur lors de la génération du résumé", {
        description: errorMessage,
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Charger l'usage au montage si pas de résumé existant
  useEffect(() => {
    if (!existingSummary) {
      loadUsage();
    }
  }, [existingSummary]);

  return (
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
          {!summary && usage && (
            <Badge variant={usage.remaining_today > 2 ? "secondary" : "destructive"}>
              {usage.remaining_today === -1
                ? "∞ résumés restants"
                : `${usage.remaining_today}/${usage.limit_per_day} restants aujourd'hui`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AFFICHAGE DEBUG DES ERREURS */}
        {errorDetails && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-mono text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">{errorDetails}</div>
            </AlertDescription>
          </Alert>
        )}

        {!summary ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Générez un résumé intelligent de cette notice pour en extraire les informations clés : caractéristiques
                techniques, installation, sécurité et conseils d'utilisation.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleGenerateSummary}
              disabled={loading || loadingUsage || usage?.remaining_today === 0}
              className="w-full"
            >
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

            {usage && usage.remaining_today === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Limite journalière atteinte ({usage.limit_per_day} résumés).
                  {usage.plan === "free" && (
                    <Button
                      variant="link"
                      className="p-0 h-auto font-normal ml-1"
                      onClick={() => (window.location.href = "/pricing")}
                    >
                      Passez Pro pour 50 résumés/jour
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {usage && usage.plan === "free" && usage.remaining_today > 0 && usage.remaining_today < 3 && (
              <div className="text-sm text-muted-foreground text-center">
                Plus que {usage.remaining_today} résumé{usage.remaining_today > 1 ? "s" : ""} gratuit
                {usage.remaining_today > 1 ? "s" : ""} aujourd'hui.{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => (window.location.href = "/pricing")}
                >
                  Passer Pro
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">{summary}</div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                Résumé généré par IA • Vérifiez toujours la notice complète
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
  );
};
