// Dialog pour proposer l'indexation d'un document après upload
// Permet de faire l'indexation maintenant ou plus tard

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
} from "lucide-react";
import {
  indexDocument,
  IndexingProgress,
  SourceType,
} from "@/services/documentIndexingService";
import { useAIConfig } from "@/hooks/useAIConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IndexDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  documentUrl: string;
  sourceType: SourceType;
  onIndexed?: () => void;
}

export const IndexDocumentDialog = ({
  open,
  onOpenChange,
  documentId,
  documentName,
  documentUrl,
  sourceType,
  onIndexed,
}: IndexDocumentDialogProps) => {
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState<IndexingProgress>({
    status: "idle",
    progress: 0,
    message: "",
  });
  
  const { isConfigured } = useAIConfig();

  const handleIndexNow = async () => {
    if (!isConfigured) {
      toast.error("Configurez votre clé API dans les paramètres IA");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    setIsIndexing(true);

    const result = await indexDocument(
      sourceType,
      documentId,
      documentName,
      documentUrl,
      user.id,
      (p) => setProgress(p)
    );

    if (result.success) {
      toast.success(`Document indexé (${result.chunksCreated} passages)`);
      onIndexed?.();
      onOpenChange(false);
    } else {
      toast.error(`Erreur: ${result.error}`);
    }

    setIsIndexing(false);
  };

  const handleLater = () => {
    onOpenChange(false);
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case "extracting":
      case "chunking":
      case "embedding":
      case "storing":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "done":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Search className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Indexer pour la recherche IA ?
          </DialogTitle>
          <DialogDescription>
            L'indexation permet au chatbot IA de rechercher des informations
            dans ce document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nom du document */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm font-medium truncate">{documentName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {sourceType === "notice" ? "Notice technique" : "Document officiel"}
            </p>
          </div>

          {/* Alerte connexion */}
          <Alert>
            <Wifi className="h-4 w-4" />
            <AlertDescription className="text-xs">
              L'indexation nécessite une connexion stable et consomme des tokens.
              Vous pouvez la faire plus tard si besoin.
            </AlertDescription>
          </Alert>

          {/* Progression */}
          {isIndexing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm">{progress.message}</span>
              </div>
              <Progress value={progress.progress} className="h-2" />
              {progress.chunksTotal && (
                <p className="text-xs text-muted-foreground text-center">
                  {progress.chunksProcessed} / {progress.chunksTotal} passages
                </p>
              )}
            </div>
          )}

          {/* Alerte si pas configuré */}
          {!isConfigured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Vous devez configurer une clé API (Gemini ou OpenAI) dans les
                paramètres IA avant de pouvoir indexer des documents.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleLater}
            disabled={isIndexing}
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2" />
            Plus tard
          </Button>
          <Button
            onClick={handleIndexNow}
            disabled={isIndexing || !isConfigured}
            className="flex-1"
          >
            {isIndexing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Indexation...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Indexer maintenant
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IndexDocumentDialog;
