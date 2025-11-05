import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Détecte si on est sur Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
}

export const PdfViewerModal = ({ isOpen, onClose, pdfUrl, title }: PdfViewerModalProps) => {
  const [useNativeViewer, setUseNativeViewer] = useState(isSafari);

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `${title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                title="Télécharger"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenNewTab}
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto px-6 pb-6">
          {pdfUrl ? (
            <div className="h-full flex flex-col gap-4 py-4">
              {/* Message pour Safari */}
              {isSafari && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800">
                    Safari détecté : Pour une meilleure expérience, cliquez sur "Ouvrir" pour voir le PDF dans un nouvel onglet.
                    <div className="mt-2">
                      <strong>Astuce :</strong> Dans les réglages Safari → Confidentialité, désactivez "Empêcher le suivi sur plusieurs domaines" pour améliorer l'affichage.
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Viewer natif (fonctionne mieux sur Safari) */}
              <div className="flex-1 min-h-0">
                <object
                  data={pdfUrl}
                  type="application/pdf"
                  className="w-full h-full rounded-lg border shadow-sm"
                  aria-label={title}
                >
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">
                      Prévisualisation non disponible
                    </p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Votre navigateur ne peut pas afficher le PDF directement.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="default"
                        onClick={handleOpenNewTab}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ouvrir dans un nouvel onglet
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </Button>
                    </div>
                  </div>
                </object>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Chargement du PDF...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
