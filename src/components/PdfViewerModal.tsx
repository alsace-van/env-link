import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
}

export const PdfViewerModal = ({ isOpen, onClose, pdfUrl, title }: PdfViewerModalProps) => {
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
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload} title="Télécharger">
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenNewTab} title="Ouvrir dans un nouvel onglet">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 px-6 pb-6 pt-4 gap-4">
          {pdfUrl ? (
            <>
              {/* Message informatif */}
              <Alert className="bg-blue-50 border-blue-200 flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  Si le PDF ne s'affiche pas, cliquez sur "Ouvrir" pour le voir dans un nouvel onglet.
                </AlertDescription>
              </Alert>

              {/* Viewer natif avec iframe pour le scroll */}
              <div className="flex-1 min-h-0 rounded-lg border shadow-sm overflow-hidden">
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title={title}
                  style={{ border: 'none' }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">Chargement du PDF...</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
