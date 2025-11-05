import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "./PdfViewerModal.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
}

export const PdfViewerModal = ({ isOpen, onClose, pdfUrl, title }: PdfViewerModalProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes or URL changes
  useEffect(() => {
    if (isOpen && pdfUrl) {
      setPageNumber(1);
      setScale(1.0);
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, pdfUrl]);

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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error);
    setError("Erreur lors du chargement du PDF");
    setIsLoading(false);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(2.0, prev + 0.2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.2));
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
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-4 px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {pageNumber} / {numPages || "?"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 0.5 || isLoading}
              title="Zoom arrière"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 2.0 || isLoading}
              title="Zoom avant"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto px-6 pb-6 bg-gray-100">
          {pdfUrl ? (
            <div className="flex justify-center py-4">
              {error ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenNewTab}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ouvrir dans un nouvel onglet
                  </Button>
                </div>
              ) : (
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div className="text-muted-foreground">Chargement du PDF...</div>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                      <p className="text-destructive mb-4">Erreur lors du chargement du PDF</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenNewTab}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ouvrir dans un nouvel onglet
                      </Button>
                    </div>
                  }
                  className="flex justify-center"
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    loading={
                      <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-muted-foreground">Chargement de la page...</div>
                      </div>
                    }
                    className="shadow-lg"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              )}
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
