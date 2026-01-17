// ============================================
// COMPOSANT: MeasurePanel
// Panneau d'historique des mesures flottant et draggable
// VERSION: 1.0 - Création initiale
// ============================================
//
// CHANGELOG v1.0 (17/01/2026):
// - Création du panneau d'historique des mesures
// - Modale flottante draggable (comme CalibrationPanel)
// - Liste des mesures avec distance px, mm, angle
// - Actions: supprimer une mesure, tout effacer, copier valeur
// - Total des mesures affiché
// - Export CSV des mesures
// ============================================

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Ruler,
  X,
  GripVertical,
  Trash2,
  Copy,
  Download,
  CornerDownRight,
} from "lucide-react";
import { toast } from "sonner";

// Type pour une mesure
export interface Measurement {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  px: number;
  mm: number;
  angle?: number; // en degrés (si entre 2 segments)
  segment1Id?: string;
  segment2Id?: string;
}

interface MeasurePanelProps {
  // Position et drag
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Fermeture
  onClose: () => void;
  
  // Mesures
  measurements: Measurement[];
  setMeasurements: React.Dispatch<React.SetStateAction<Measurement[]>>;
  
  // État de mesure actuel
  measurePhase: "idle" | "waitingSecond" | "complete";
  
  // Calibration pour affichage
  hasCalibration: boolean;
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({
  position,
  setPosition,
  onClose,
  measurements,
  setMeasurements,
  measurePhase,
  hasCalibration,
}) => {
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Handler pour le drag de la fenêtre
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    
    const handleMouseMove = (ev: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 280, ev.clientX - dragStartRef.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, ev.clientY - dragStartRef.current.y));
      setPosition({ x: newX, y: newY });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Supprimer une mesure
  const deleteMeasurement = (id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    toast.success("Mesure supprimée");
  };

  // Tout effacer
  const clearAll = () => {
    setMeasurements([]);
    toast.success("Toutes les mesures effacées");
  };

  // Copier une valeur
  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copié dans le presse-papier");
  };

  // Export CSV
  const exportCSV = () => {
    if (measurements.length === 0) {
      toast.error("Aucune mesure à exporter");
      return;
    }

    const headers = ["#", "Distance (px)", "Distance (mm)", "Angle (°)", "X1", "Y1", "X2", "Y2"];
    const rows = measurements.map((m, i) => [
      i + 1,
      m.px.toFixed(1),
      m.mm.toFixed(2),
      m.angle !== undefined ? m.angle.toFixed(1) : "",
      m.start.x.toFixed(1),
      m.start.y.toFixed(1),
      m.end.x.toFixed(1),
      m.end.y.toFixed(1),
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mesures_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${measurements.length} mesures exportées`);
  };

  // Calcul du total
  const totalMm = measurements.reduce((acc, m) => acc + m.mm, 0);
  const totalPx = measurements.reduce((acc, m) => acc + m.px, 0);

  return (
    <div 
      className="fixed z-50 w-72 bg-white rounded-lg shadow-xl border flex flex-col overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        maxHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* En-tête draggable */}
      <div 
        className="p-2 border-b flex flex-col gap-1 bg-gray-50 cursor-move select-none rounded-t-lg"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-sm">Mesures</span>
            <span className="text-xs text-muted-foreground">({measurements.length})</span>
            <GripVertical className="h-3 w-3 text-gray-400" />
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* État actuel */}
        <div className={`text-xs px-2 py-1 rounded ${
          measurePhase === "idle" 
            ? "text-gray-600 bg-gray-100" 
            : "text-blue-600 bg-blue-50"
        }`}>
          {measurePhase === "idle" && "Cliquez pour mesurer"}
          {measurePhase === "waitingSecond" && "📍 Cliquez le 2ème point"}
          {measurePhase === "complete" && "✓ Mesure terminée"}
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="p-2 space-y-1">
          
          {measurements.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              Aucune mesure<br/>
              <span className="text-[10px]">Cliquez 2 points sur le canvas</span>
            </p>
          ) : (
            <>
              {/* Liste des mesures */}
              {measurements.map((m, index) => (
                <div 
                  key={m.id} 
                  className="p-2 bg-gray-50 rounded text-xs space-y-1 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-500">#{index + 1}</span>
                      <span 
                        className="font-bold text-green-700 cursor-pointer hover:underline"
                        onClick={() => copyValue(m.mm.toFixed(2))}
                        title="Cliquer pour copier"
                      >
                        {m.mm.toFixed(2)} mm
                      </span>
                      <span className="text-muted-foreground">
                        ({m.px.toFixed(0)}px)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-gray-500 hover:text-blue-600"
                        onClick={() => copyValue(m.mm.toFixed(2))}
                        title="Copier la valeur"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-gray-500 hover:text-red-600"
                        onClick={() => deleteMeasurement(m.id)}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Angle si disponible */}
                  {m.angle !== undefined && (
                    <div className="flex items-center gap-1 text-orange-600">
                      <CornerDownRight className="h-3 w-3" />
                      <span>Angle: {m.angle.toFixed(1)}°</span>
                    </div>
                  )}
                  
                  {/* Coordonnées (collapsées par défaut) */}
                  <div className="text-[10px] text-muted-foreground">
                    ({m.start.x.toFixed(0)}, {m.start.y.toFixed(0)}) → ({m.end.x.toFixed(0)}, {m.end.y.toFixed(0)})
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Footer avec totaux et actions */}
      {measurements.length > 0 && (
        <div className="border-t p-2 bg-gray-50 space-y-2">
          {/* Total */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Total ({measurements.length}):</span>
            <span className="font-bold text-green-700">{totalMm.toFixed(2)} mm</span>
          </div>
          
          {!hasCalibration && (
            <p className="text-[10px] text-orange-600 text-center">
              ⚠️ Sans calibration, les mm sont estimés
            </p>
          )}
          
          <Separator />
          
          {/* Actions */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={exportCSV}
            >
              <Download className="h-3 w-3 mr-1" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={clearAll}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Effacer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurePanel;
