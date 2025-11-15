import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { NoticeSummary } from "./NoticeSummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./PdfViewerModal.css";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
  noticeId?: string;
  existingSummary?: string | null;
}

export const PdfViewerModal = ({ isOpen, onClose, pdfUrl, title, noticeId, existingSummary }: PdfViewerModalProps) => {
  const handleDownload = async () => {
    if (!pdfUrl) return;
    
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Téléchargement lancé");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir dans un nouvel onglet
              </Button>
            </div>
          </div>
        </DialogHeader>

        {noticeId ? (
          <Tabs defaultValue="pdf" className="flex-1 flex flex-col">
            <TabsList className="mx-6 mt-4 grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="pdf">PDF</TabsTrigger>
              <TabsTrigger value="summary">Résumé IA</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pdf" className="flex-1 px-6 pb-6 mt-4">
              <div className="pdf-viewer-container h-full">
                {pdfUrl ? (
                  <iframe
                    src={`${pdfUrl}#view=FitH`}
                    className="w-full h-full border-0 rounded-lg"
                    title={title}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Aucun PDF à afficher
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="summary" className="flex-1 px-6 pb-6 mt-4 overflow-y-auto h-0">
              <div className="h-full overflow-y-auto">
                <NoticeSummary 
                  noticeId={noticeId} 
                  existingSummary={existingSummary}
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 px-6 pb-6">
            <div className="pdf-viewer-container h-full">
              {pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#view=FitH`}
                  className="w-full h-full border-0 rounded-lg"
                  title={title}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucun PDF à afficher
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
