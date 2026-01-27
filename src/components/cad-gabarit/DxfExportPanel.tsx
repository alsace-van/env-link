// ============================================
// COMPOSANT: DxfExportPanel
// VERSION: 1.0
// Description: Panneau flottant pour l'export DXF
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================
// TYPES
// ============================================

export interface DxfExportDialogState {
  open: boolean;
  filename: string;
  position: { x: number; y: number };
}

export interface DxfExportPanelProps {
  // Dialog state
  dxfExportDialog: DxfExportDialogState;
  setDxfExportDialog: React.Dispatch<React.SetStateAction<DxfExportDialogState | null>>;
  
  // Callbacks
  confirmExportDXF: () => void;
}

// ============================================
// COMPOSANT
// ============================================

export function DxfExportPanel({
  dxfExportDialog,
  setDxfExportDialog,
  confirmExportDXF,
}: DxfExportPanelProps) {

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
    const startX = e.clientX - dxfExportDialog.position.x;
    const startY = e.clientY - dxfExportDialog.position.y;
    
    const onMouseMove = (ev: MouseEvent) => {
      setDxfExportDialog({
        ...dxfExportDialog,
        position: { x: ev.clientX - startX, y: ev.clientY - startY },
      });
    };
    
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: dxfExportDialog.position.x,
        top: dxfExportDialog.position.y,
        width: 300,
      }}
      onMouseDown={handleDragStart}
    >
      {/* Header draggable */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-t-lg cursor-move border-b">
        <span className="text-sm font-medium">Export DXF</span>
        <button className="text-gray-500 hover:text-gray-700" onClick={() => setDxfExportDialog(null)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Nom du fichier</label>
          <Input
            type="text"
            value={dxfExportDialog.filename}
            onChange={(e) => setDxfExportDialog({ ...dxfExportDialog, filename: e.target.value })}
            className="h-8 text-sm"
            placeholder="nom-du-fichier"
            autoFocus
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && dxfExportDialog.filename.trim()) {
                confirmExportDXF();
              }
              if (e.key === "Escape") {
                setDxfExportDialog(null);
              }
            }}
          />
          <p className="text-[10px] text-gray-400">.dxf sera ajouté automatiquement</p>
        </div>

        <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded">
          📁 Le fichier sera téléchargé dans votre dossier de téléchargements
        </div>

        {/* Boutons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setDxfExportDialog(null)}>
            Annuler
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8"
            onClick={confirmExportDXF}
            disabled={!dxfExportDialog.filename.trim()}
          >
            <Check className="h-3 w-3 mr-1" />
            Exporter
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DxfExportPanel;
