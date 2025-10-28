import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Photo {
  id: string;
  url: string;
  description?: string;
  comment?: string;
  annotations?: any;
}

interface PhotoAnnotationModalTestProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

/**
 * VERSION TEST ULTRA-SIMPLE
 * Utilisez ce composant pour vérifier si le problème vient de Paper.js
 * ou de la structure Dialog elle-même
 */
const PhotoAnnotationModalTest = ({ photo, isOpen, onClose, onSave }: PhotoAnnotationModalTestProps) => {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${msg}`;
    console.log(log);
    setLogs((prev) => [...prev.slice(-10), log]); // Garder les 10 derniers
  };

  useEffect(() => {
    addLog(`Modal rendered - isOpen: ${isOpen}, hasPhoto: ${!!photo}`);
  }, [isOpen, photo]);

  useEffect(() => {
    if (isOpen && photo) {
      addLog(`Modal should be visible now with photo: ${photo.id}`);
    }
  }, [isOpen, photo]);

  if (!photo) {
    return null;
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          addLog(`Dialog onOpenChange: ${open}`);
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>🧪 TEST MODE - Photo {photo.id}</DialogTitle>
          </DialogHeader>

          {/* Zone de debug visible */}
          <div className="bg-yellow-50 border border-yellow-300 p-4 rounded">
            <p className="font-bold text-sm mb-2">🔍 État du Modal:</p>
            <div className="text-xs space-y-1">
              <p>✅ Modal is open: {isOpen ? "TRUE" : "FALSE"}</p>
              <p>✅ Photo ID: {photo.id}</p>
              <p>✅ Photo URL: {photo.url}</p>
              <p>✅ Dialog component rendered</p>
            </div>
          </div>

          {/* Zone d'image */}
          <div className="flex-1 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
            <div className="text-center">
              <p className="text-sm mb-4">Test de chargement d'image:</p>
              <img
                src={photo.url}
                alt="Test"
                className="max-w-full max-h-[60vh] object-contain"
                onLoad={() => addLog("✅ Image loaded successfully!")}
                onError={(e) => addLog(`❌ Image error: ${e.toString()}`)}
              />
            </div>
          </div>

          {/* Logs visibles */}
          <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
            <p className="text-white font-bold mb-1">Console Logs:</p>
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>

          {/* Boutons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                addLog("Close button clicked");
                onClose();
              }}
            >
              Fermer
            </Button>
            <Button
              onClick={() => {
                addLog("Save button clicked");
                onSave();
              }}
            >
              Test Sauvegarder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Indicateur externe si le modal ne s'affiche pas */}
      {isOpen && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-[999]">
          <p className="font-bold">⚠️ MODAL DEVRAIT ÊTRE OUVERT</p>
          <p className="text-xs">Si vous voyez ceci mais pas le modal,</p>
          <p className="text-xs">le problème est le z-index du Dialog</p>
        </div>
      )}
    </>
  );
};

export default PhotoAnnotationModalTest;
