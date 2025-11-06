import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from 'react-markdown';

interface NoticeSummaryProps {
  noticeId: string;
  existingSummary?: string | null;
  onSummaryGenerated?: (summary: string) => void;
}

export const NoticeSummary = ({ noticeId, existingSummary, onSummaryGenerated }: NoticeSummaryProps) => {
  const [summary, setSummary] = useState<string | null>(existingSummary || null);
  const [loading, setLoading] = useState(false);

  const handleGenerateSummary = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('summarize-notice', {
        body: { noticeId }
      });

      if (error) {
        console.error('Erreur Edge Function:', error);
        
        // Gérer les erreurs spécifiques
        if (error.message?.includes('limit')) {
          toast.error(
            "Limite journalière atteinte ! Passez Pro pour plus de résumés.",
            {
              action: {
                label: 'Voir les plans',
                onClick: () => window.location.href = '/pricing'
              },
              duration: 5000
            }
          );
        } else {
          toast.error(`Erreur: ${error.message}`);
        }
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setSummary(data.summary);
      if (onSummaryGenerated) {
        onSummaryGenerated(data.summary);
      }

      if (data.fromCache) {
        toast.success('Résumé récupéré instantanément (cache)');
      } else {
        toast.success('Résumé généré avec succès !');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la génération du résumé');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Résumé IA
            </CardTitle>
            <CardDescription>
              Résumé automatique généré par intelligence artificielle
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Générez un résumé intelligent de cette notice pour en extraire les informations clés :
                caractéristiques techniques, installation, sécurité et conseils d'utilisation.
              </AlertDescription>
            </Alert>
            
            <Button
              onClick={handleGenerateSummary}
              disabled={loading}
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
          </div>
        ) : (
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                Résumé généré par IA • Vérifiez toujours la notice complète
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-3 w-3" />
                )}
                Régénérer
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
