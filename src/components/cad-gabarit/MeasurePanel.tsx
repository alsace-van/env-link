// ============================================
// COMPOSANT: MeasurePanel
// Panneau d'historique des mesures flottant et draggable
// VERSION: 1.1 - Noms éditables + visibilité + sauvegarde
// ============================================
//
// CHANGELOG v1.1 (17/01/2026):
// - Ajout du champ name éditable sur chaque mesure
// - Toggle visibilité individuelle des mesures sur le canvas
// - Bouton "Tout afficher/masquer"
// - Noms auto-générés (M1, M2, M3...)
//
// CHANGELOG v1.0 (17/01/2026):
// - Création du panneau d'historique des mesures
// - Modale flottante draggable
// - Liste des mesures avec distance px, mm, angle
// - Actions: supprimer, copier, exporter CSV
// ============================================

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Ruler, X, GripVertical, Trash2, Copy, Download, CornerDownRight, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";

// Type pour une mesure
export interface Measurement {
  id: string;
  name: string; // Nom éditable de la mesure
  start: { x: number; y: number };
  end: { x: number; y: number };
  px: number;
  mm: number;
  angle?: number; // en degrés (si entre 2 segments)
  segment1Id?: string;
  segment2Id?: string;
  visible?: boolean; // Afficher sur le canvas (default: true)
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Handler pour le drag de la fenêtre
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
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
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Supprimer une mesure
  const deleteMeasurement = (id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    toast.success("Mesure supprimée");
  };

  // Tout effacer
  const clearAll = () => {
    if (measurements.length === 0) return;
    setMeasurements([]);
    toast.success("Toutes les mesures effacées");
  };

  // Copier une valeur
  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copié");
  };

  // Toggle visibilité d'une mesure
  const toggleVisibility = (id: string) => {
    setMeasurements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, visible: m.visible === false ? true : false } : m)),
    );
  };

  // Tout afficher/masquer
  const toggleAllVisibility = () => {
    const allVisible = measurements.every((m) => m.visible !== false);
    setMeasurements((prev) => prev.map((m) => ({ ...m, visible: !allVisible })));
  };

  // Commencer l'édition du nom
  const startEditing = (m: Measurement) => {
    setEditingId(m.id);
    setEditingName(m.name);
  };

  // Sauvegarder le nom
  const saveName = () => {
    if (editingId) {
      setMeasurements((prev) => prev.map((m) => (m.id === editingId ? { ...m, name: editingName || m.name } : m)));
      setEditingId(null);
      setEditingName("");
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (measurements.length === 0) {
      toast.error("Aucune mesure à exporter");
      return;
    }

    const headers = ["Nom", "Distance (mm)", "Distance (px)", "Angle (°)", "X1", "Y1", "X2", "Y2"];
    const rows = measurements.map((m) => [
      m.name,
      m.mm.toFixed(2),
      m.px.toFixed(1),
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

  // Calcul du total (uniquement visibles)
  const visibleMeasurements = measurements.filter((m) => m.visible !== false);
  const totalMm = visibleMeasurements.reduce((acc, m) => acc + m.mm, 0);
  const allVisible = measurements.length > 0 && measurements.every((m) => m.visible !== false);

  return (
    <div
      className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border flex flex-col overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        maxHeight: "calc(100vh - 120px)",
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
          <div className="flex items-center gap-1">
            {measurements.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={toggleAllVisibility}
                title={allVisible ? "Tout masquer" : "Tout afficher"}
              >
                {allVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* État actuel */}
        <div
          className={`text-xs px-2 py-1 rounded ${
            measurePhase === "idle" ? "text-gray-600 bg-gray-100" : "text-blue-600 bg-blue-50"
          }`}
        >
          {measurePhase === "idle" && "Cliquez pour mesurer"}
          {measurePhase === "waitingSecond" && "📍 Cliquez le 2ème point"}
          {measurePhase === "complete" && "✓ Mesure terminée"}
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="p-2 space-y-1">
          {measurements.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              Aucune mesure
              <br />
              <span className="text-[10px]">Cliquez 2 points sur le canvas</span>
            </p>
          ) : (
            <>
              {/* Liste des mesures */}
              {measurements.map((m, index) => (
                <div
                  key={m.id}
                  className={`p-2 rounded text-xs space-y-1 transition-colors ${
                    m.visible === false ? "bg-gray-100 opacity-60" : "bg-green-50 hover:bg-green-100"
                  }`}
                >
                  {/* Ligne 1: Nom + Actions */}
                  <div className="flex items-center justify-between gap-1">
                    {editingId === m.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName();
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditingName("");
                          }
                        }}
                        className="h-5 text-xs px-1 flex-1"
                        autoFocus
                      />
                    ) : (
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:text-green-700 flex-1"
                        onClick={() => startEditing(m)}
                        title="Cliquer pour renommer"
                      >
                        <span className="font-bold text-green-800">{m.name}</span>
                        <Pencil className="h-2.5 w-2.5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-5 w-5 p-0 ${m.visible === false ? "text-gray-400" : "text-green-600"}`}
                        onClick={() => toggleVisibility(m.id)}
                        title={m.visible === false ? "Afficher" : "Masquer"}
                      >
                        {m.visible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-gray-500 hover:text-blue-600"
                        onClick={() => copyValue(m.mm.toFixed(2))}
                        title="Copier"
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

                  {/* Ligne 2: Valeurs */}
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold text-green-700 cursor-pointer hover:underline"
                      onClick={() => copyValue(m.mm.toFixed(2))}
                    >
                      {m.mm.toFixed(2)} mm
                    </span>
                    <span className="text-muted-foreground">({m.px.toFixed(0)}px)</span>
                    {m.angle !== undefined && (
                      <span className="text-orange-600 flex items-center gap-0.5">
                        <CornerDownRight className="h-3 w-3" />
                        {m.angle.toFixed(1)}°
                      </span>
                    )}
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
            <span className="font-medium">
              Total ({visibleMeasurements.length}/{measurements.length}):
            </span>
            <span className="font-bold text-green-700">{totalMm.toFixed(2)} mm</span>
          </div>

          {!hasCalibration && (
            <p className="text-[10px] text-orange-600 text-center">⚠️ Sans calibration, les mm sont estimés</p>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={exportCSV}>
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={clearAll}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Tout effacer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurePanel;
