// ============================================
// COMPOSANT: MeasurePanel
// Panneau d'historique des mesures flottant et draggable
// VERSION: 1.2 - Mesures liées aux images + recalcul temps réel pendant stretch
// ============================================
//
// CHANGELOG v1.2 (22/01/2026):
// - Ajout du champ imageId pour lier une mesure à une image
// - Ajout de relativeStart/relativeEnd pour coordonnées relatives à l'image
// - Recalcul automatique des mm quand l'image est étirée (scaleX/scaleY)
// - Indicateur visuel pour mesures liées aux images (icône photo)
// - Props backgroundImages et scaleFactor pour recalcul live
// - Badge "LIVE" pour les mesures qui se mettent à jour en temps réel
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

import React, { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Ruler, X, GripVertical, Trash2, Copy, Download, CornerDownRight, Eye, EyeOff, Pencil, Image, Radio } from "lucide-react";
import { toast } from "sonner";

// Type pour une image de fond (simplifié pour éviter les imports circulaires)
interface BackgroundImageSimple {
  id: string;
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  image?: HTMLImageElement;
  calibrationData?: {
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    applied?: boolean;
  };
}

// Type pour une mesure
// v1.2: Ajout de imageId et coordonnées relatives pour le recalcul live
export interface Measurement {
  id: string;
  name: string; // Nom éditable de la mesure
  start: { x: number; y: number }; // Coordonnées absolues (world)
  end: { x: number; y: number }; // Coordonnées absolues (world)
  px: number; // Distance en pixels (calculée à la création)
  mm: number; // Distance en mm (calculée à la création)
  angle?: number; // en degrés (si entre 2 segments)
  segment1Id?: string;
  segment2Id?: string;
  visible?: boolean; // Afficher sur le canvas (default: true)
  // v1.2: Champs pour mesures liées aux images
  imageId?: string; // ID de l'image à laquelle la mesure est liée
  relativeStart?: { x: number; y: number }; // Coordonnées relatives à l'image (en pixels image)
  relativeEnd?: { x: number; y: number }; // Coordonnées relatives à l'image (en pixels image)
  baseScaleX?: number; // ScaleX de l'image au moment de la création
  baseScaleY?: number; // ScaleY de l'image au moment de la création
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

  // v1.2: Props pour recalcul temps réel
  backgroundImages?: BackgroundImageSimple[];
  scaleFactor?: number; // px/mm du sketch
  isStretching?: boolean; // Mode stretch actif (pour badge LIVE)
}

// v1.2: Calculer les mm en temps réel pour une mesure liée à une image
function computeLiveMeasurement(
  m: Measurement,
  images: BackgroundImageSimple[],
  defaultScaleFactor: number
): { px: number; mm: number; isLive: boolean } {
  // Si pas de lien avec une image, retourner les valeurs originales
  if (!m.imageId || !m.relativeStart || !m.relativeEnd || !m.baseScaleX || !m.baseScaleY) {
    return { px: m.px, mm: m.mm, isLive: false };
  }

  // Trouver l'image liée
  const img = images.find((i) => i.id === m.imageId);
  if (!img) {
    return { px: m.px, mm: m.mm, isLive: false };
  }

  // Récupérer les scales actuels de l'image
  const currentScaleX = img.scaleX ?? img.scale ?? 1;
  const currentScaleY = img.scaleY ?? img.scale ?? 1;

  // Calculer le ratio de changement de scale
  const ratioX = currentScaleX / m.baseScaleX;
  const ratioY = currentScaleY / m.baseScaleY;

  // Calculer la nouvelle distance en pixels
  const dx = m.relativeStart.x - m.relativeEnd.x;
  const dy = m.relativeStart.y - m.relativeEnd.y;
  
  // Appliquer les ratios de scale aux composantes
  const scaledDx = dx * ratioX;
  const scaledDy = dy * ratioY;
  
  const newPx = Math.sqrt(scaledDx * scaledDx + scaledDy * scaledDy) * m.baseScaleX;

  // Déterminer le scale à utiliser pour la conversion en mm
  // Priorité: calibration de l'image > scaleFactor du sketch
  let mmPerPx = 1 / defaultScaleFactor; // Par défaut: inverser px/mm -> mm/px
  
  if (img.calibrationData?.applied && img.calibrationData.scale) {
    mmPerPx = img.calibrationData.scale;
  }

  const newMm = newPx * mmPerPx;

  // Vérifier si les valeurs ont changé (tolérance de 0.1%)
  const hasChanged = Math.abs(newMm - m.mm) / m.mm > 0.001;

  return { px: newPx, mm: newMm, isLive: hasChanged };
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({
  position,
  setPosition,
  onClose,
  measurements,
  setMeasurements,
  measurePhase,
  hasCalibration,
  backgroundImages = [],
  scaleFactor = 1,
  isStretching = false,
}) => {
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // v1.2: Recalculer les mesures liées aux images
  const computedMeasurements = useMemo(() => {
    return measurements.map((m) => {
      const computed = computeLiveMeasurement(m, backgroundImages, scaleFactor);
      return {
        ...m,
        livePx: computed.px,
        liveMm: computed.mm,
        isLive: computed.isLive,
      };
    });
  }, [measurements, backgroundImages, scaleFactor]);

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

  // v1.2: Mettre à jour les valeurs de base avec les valeurs live (pour "figer" après stretch)
  const freezeLiveValues = (id: string) => {
    const computed = computedMeasurements.find((m) => m.id === id);
    if (!computed || !computed.isLive) return;

    setMeasurements((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        
        // Trouver l'image liée pour les nouveaux baseScale
        const img = backgroundImages.find((i) => i.id === m.imageId);
        if (!img) return m;
        
        return {
          ...m,
          px: computed.livePx,
          mm: computed.liveMm,
          baseScaleX: img.scaleX ?? img.scale ?? 1,
          baseScaleY: img.scaleY ?? img.scale ?? 1,
        };
      })
    );
    toast.success("Mesure mise à jour avec les nouvelles valeurs");
  };

  // Export CSV
  const exportCSV = () => {
    if (measurements.length === 0) {
      toast.error("Aucune mesure à exporter");
      return;
    }

    const headers = ["Nom", "Distance (mm)", "Distance (px)", "Angle (°)", "X1", "Y1", "X2", "Y2", "ImageID"];
    const rows = computedMeasurements.map((m) => [
      m.name,
      (m.liveMm || m.mm).toFixed(2),
      (m.livePx || m.px).toFixed(1),
      m.angle !== undefined ? m.angle.toFixed(1) : "",
      m.start.x.toFixed(1),
      m.start.y.toFixed(1),
      m.end.x.toFixed(1),
      m.end.y.toFixed(1),
      m.imageId || "",
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

  // Calcul du total (uniquement visibles, avec valeurs live)
  const visibleMeasurements = computedMeasurements.filter((m) => m.visible !== false);
  const totalMm = visibleMeasurements.reduce((acc, m) => acc + (m.liveMm || m.mm), 0);
  const allVisible = measurements.length > 0 && measurements.every((m) => m.visible !== false);
  const hasLiveMeasurements = computedMeasurements.some((m) => m.isLive);

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
            {/* v1.2: Badge LIVE si des mesures se mettent à jour */}
            {(isStretching || hasLiveMeasurements) && (
              <span className="flex items-center gap-0.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">
                <Radio className="h-2.5 w-2.5" />
                LIVE
              </span>
            )}
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

        {/* v1.2: Info mode stretch */}
        {isStretching && (
          <div className="text-[10px] px-2 py-1 rounded bg-orange-100 text-orange-700">
            📏 Mode stretch actif - Les mesures liées à l'image se mettent à jour en temps réel
          </div>
        )}
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
              {computedMeasurements.map((m, index) => {
                const displayMm = m.liveMm || m.mm;
                const displayPx = m.livePx || m.px;
                const mmDiff = m.isLive ? (m.liveMm - m.mm) : 0;
                const diffPercent = m.isLive ? ((m.liveMm - m.mm) / m.mm * 100) : 0;

                return (
                  <div
                    key={m.id}
                    className={`p-2 rounded text-xs space-y-1 transition-colors ${
                      m.visible === false 
                        ? "bg-gray-100 opacity-60" 
                        : m.isLive 
                          ? "bg-orange-50 hover:bg-orange-100 border border-orange-200" 
                          : "bg-green-50 hover:bg-green-100"
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
                          <span className={`font-bold ${m.isLive ? "text-orange-800" : "text-green-800"}`}>{m.name}</span>
                          {/* v1.2: Icône si lié à une image */}
                          {m.imageId && (
                            <Image className="h-2.5 w-2.5 text-blue-500" title="Mesure liée à une image" />
                          )}
                          <Pencil className="h-2.5 w-2.5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex items-center gap-0.5">
                        {/* v1.2: Bouton pour figer les valeurs live */}
                        {m.isLive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-[9px] text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                            onClick={() => freezeLiveValues(m.id)}
                            title="Figer les nouvelles valeurs"
                          >
                            Figer
                          </Button>
                        )}
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
                          onClick={() => copyValue(displayMm.toFixed(2))}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-bold cursor-pointer hover:underline ${m.isLive ? "text-orange-700" : "text-green-700"}`}
                        onClick={() => copyValue(displayMm.toFixed(2))}
                      >
                        {displayMm.toFixed(2)} mm
                      </span>
                      <span className="text-muted-foreground">({displayPx.toFixed(0)}px)</span>
                      {m.angle !== undefined && (
                        <span className="text-orange-600 flex items-center gap-0.5">
                          <CornerDownRight className="h-3 w-3" />
                          {m.angle.toFixed(1)}°
                        </span>
                      )}
                    </div>

                    {/* v1.2: Ligne 3: Différence si live */}
                    {m.isLive && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className={`${mmDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {mmDiff >= 0 ? "+" : ""}{mmDiff.toFixed(2)} mm
                        </span>
                        <span className={`${diffPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ({diffPercent >= 0 ? "+" : ""}{diffPercent.toFixed(1)}%)
                        </span>
                        <span className="text-gray-400">
                          (était {m.mm.toFixed(2)} mm)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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
            <span className={`font-bold ${hasLiveMeasurements ? "text-orange-700" : "text-green-700"}`}>
              {totalMm.toFixed(2)} mm
              {hasLiveMeasurements && <span className="text-[9px] ml-1">(live)</span>}
            </span>
          </div>

          {!hasCalibration && (
            <p className="text-[10px] text-orange-600 text-center">⚠️ Sans calibration, les mm sont estimés</p>
          )}

          {/* v1.2: Info mesures live */}
          {hasLiveMeasurements && (
            <p className="text-[10px] text-orange-600 text-center">
              📏 {computedMeasurements.filter(m => m.isLive).length} mesure(s) en temps réel
            </p>
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
