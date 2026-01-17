// ============================================
// COMPOSANT: CalibrationPanel
// Panneau de calibration flottant et draggable pour CAD Gabarit
// VERSION: 1.1 - Correction types TypeScript
// ============================================
//
// CHANGELOG v1.1 (17/01/2026):
// - Import des types depuis types.ts au lieu de définitions locales
// - Correction perspectiveMethod: "rectangle" | "checkerboard" (au lieu de "4points" | "checker")
// - Correction rectPoints: string[] (IDs des points, pas coordonnées)
// - Suppression des définitions de types dupliquées
//
// CHANGELOG v1.0 (17/01/2026):
// - Extraction depuis CADGabaritCanvas.tsx (~1000 lignes)
// - Panneau flottant avec position: fixed
// - Draggable via l'en-tête (onMouseDown)
// - Gestion complète des points et paires de calibration
// - Support des modes: Simple, Aniso, Affine, Perspective
// - Suggestions de distance en temps réel
// - Bouton "Utiliser" intelligent (→ X ou → Y en mode Aniso)
// - Mode création de paires persistant (reste actif après création)
// - Étirement manuel pour mode anisotrope
// - Configuration perspective (4 points ou damier)
// ============================================
// CalibrationPanel.tsx
// MOD v1.1: Composant extrait de CADGabaritCanvas.tsx - types corrigés pour cohérence avec types.ts
// Panneau de calibration flottant et draggable

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Target,
  X,
  GripVertical,
  Trash2,
  ChevronDown,
  Check,
  RotateCcw,
  Plus,
  Link2,
  Move,
  Grid3X3,
} from "lucide-react";
import { toast } from "sonner";

// Importer les types depuis types.ts pour cohérence
import { CalibrationData, CalibrationPoint, CalibrationPair, BackgroundImage, distance } from "./types";

interface CalibrationPanelProps {
  // Position et drag
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;

  // Fermeture
  onClose: () => void;

  // Image sélectionnée
  selectedImageId: string | null;
  backgroundImages: BackgroundImage[];
  getSelectedImage: () => BackgroundImage | null;
  setBackgroundImages: React.Dispatch<React.SetStateAction<BackgroundImage[]>>;

  // Données de calibration
  calibrationData: CalibrationData;
  setCalibrationData: React.Dispatch<React.SetStateAction<CalibrationData>>;
  getSelectedImageCalibration: () => CalibrationData;
  updateSelectedImageCalibration: (updater: (prev: CalibrationData) => CalibrationData) => void;

  // Mode de calibration
  calibrationMode: "idle" | "addPoint" | "selectPair1" | "selectPair2" | "selectRect";
  setCalibrationMode: React.Dispatch<
    React.SetStateAction<"idle" | "addPoint" | "selectPair1" | "selectPair2" | "selectRect">
  >;
  selectedCalibrationPoint: string | null;
  setSelectedCalibrationPoint: React.Dispatch<React.SetStateAction<string | null>>;

  // Création de paires
  newPairDistance: string;
  setNewPairDistance: React.Dispatch<React.SetStateAction<string>>;
  newPairColor: string;
  setNewPairColor: React.Dispatch<React.SetStateAction<string>>;

  // Fonctions de calibration (du hook useCalibration)
  calculateCalibration: () => void;
  applyCalibration: () => void;
  resetCalibration: () => void;
  updatePairDistance: (pairId: string, distanceMm: number) => void;

  // Fonctions locales
  deleteCalibrationPair: (pairId: string) => void;
  deleteCalibrationPoint: (pointId: string) => void;

  // Perspective
  perspectiveMethod: "rectangle" | "checkerboard";
  setPerspectiveMethod: React.Dispatch<React.SetStateAction<"rectangle" | "checkerboard">>;
  rectPoints: string[]; // IDs des 4 points du rectangle
  setRectPoints: React.Dispatch<React.SetStateAction<string[]>>;
  rectWidth: string;
  setRectWidth: React.Dispatch<React.SetStateAction<string>>;
  rectHeight: string;
  setRectHeight: React.Dispatch<React.SetStateAction<string>>;
  checkerCornersX: string;
  setCheckerCornersX: React.Dispatch<React.SetStateAction<string>>;
  checkerCornersY: string;
  setCheckerCornersY: React.Dispatch<React.SetStateAction<string>>;
  checkerSquareSize: string;
  setCheckerSquareSize: React.Dispatch<React.SetStateAction<string>>;

  // Sketch
  sketch: { scaleFactor: number };
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  position,
  setPosition,
  onClose,
  selectedImageId,
  backgroundImages,
  getSelectedImage,
  setBackgroundImages,
  calibrationData,
  setCalibrationData,
  getSelectedImageCalibration,
  updateSelectedImageCalibration,
  calibrationMode,
  setCalibrationMode,
  selectedCalibrationPoint,
  setSelectedCalibrationPoint,
  newPairDistance,
  setNewPairDistance,
  newPairColor,
  setNewPairColor,
  calculateCalibration,
  applyCalibration,
  resetCalibration,
  updatePairDistance,
  deleteCalibrationPair,
  deleteCalibrationPoint,
  perspectiveMethod,
  setPerspectiveMethod,
  rectPoints,
  setRectPoints,
  rectWidth,
  setRectWidth,
  rectHeight,
  setRectHeight,
  checkerCornersX,
  setCheckerCornersX,
  checkerCornersY,
  setCheckerCornersY,
  checkerSquareSize,
  setCheckerSquareSize,
  sketch,
}) => {
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const imgCalib = getSelectedImageCalibration();
  const selectedImage = getSelectedImage();
  const hasPairs = imgCalib.pairs.size > 0;

  // Calcul de l'échelle moyenne pour les suggestions
  let avgScaleFromPairs = 0;
  let countValidPairs = 0;
  imgCalib.pairs.forEach((pair) => {
    if (pair.distanceMm > 0) {
      const pp1 = imgCalib.points.get(pair.point1Id);
      const pp2 = imgCalib.points.get(pair.point2Id);
      if (pp1 && pp2) {
        const d = distance(pp1, pp2);
        if (d > 0) {
          avgScaleFromPairs += pair.distanceMm / d;
          countValidPairs++;
        }
      }
    }
  });
  avgScaleFromPairs = countValidPairs > 0 ? avgScaleFromPairs / countValidPairs : 0;
  const displayScale = imgCalib.scale || avgScaleFromPairs;

  // Handler pour le drag de la fenêtre
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 288, ev.clientX - dragStartRef.current.x));
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

  return (
    <div
      className="fixed z-50 w-72 bg-white rounded-lg shadow-xl border flex flex-col overflow-hidden"
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
            <Target className="h-4 w-4 text-red-500" />
            <span className="font-semibold text-sm">Calibration</span>
            <GripVertical className="h-3 w-3 text-gray-400" />
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Photo sélectionnée */}
        {selectedImageId && selectedImage ? (
          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded truncate">📷 {selectedImage.name}</div>
        ) : backgroundImages.length > 0 ? (
          <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">⚠️ Sélectionnez une photo</div>
        ) : null}
      </div>

      {/* Contenu scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* === SECTION POINTS === */}
          <Collapsible defaultOpen={imgCalib.points.size > 0 && imgCalib.points.size <= 6}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-7 px-2 gap-1">
                <ChevronDown className="h-3 w-3" />
                <span className="text-sm font-medium">Points ({imgCalib.points.size})</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {imgCalib.points.size === 0 ? (
                <p className="text-xs text-muted-foreground italic pl-2">Aucun point</p>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Array.from(imgCalib.points.values()).map((point) => (
                    <div key={point.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                      <span className="font-medium">{point.label}</span>
                      <button
                        className="text-red-500 hover:text-red-700"
                        onClick={() => deleteCalibrationPoint(point.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant={calibrationMode === "addPoint" ? "default" : "outline"}
                size="sm"
                className="w-full mt-2 h-7 text-xs"
                onClick={() => setCalibrationMode(calibrationMode === "addPoint" ? "idle" : "addPoint")}
              >
                <Plus className="h-3 w-3 mr-1" />
                {calibrationMode === "addPoint" ? "Cliquez sur l'image..." : "Ajouter point"}
              </Button>
              {calibrationMode === "addPoint" && (
                <p className="text-xs text-blue-600 mt-1 text-center">
                  Cliquez sur l'image pour ajouter un point
                  <button className="ml-2 text-gray-500 hover:text-gray-700" onClick={() => setCalibrationMode("idle")}>
                    (Annuler)
                  </button>
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* === SECTION PAIRES === */}
          <Collapsible defaultOpen={imgCalib.pairs.size > 0 && imgCalib.pairs.size <= 4}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-7 px-2 gap-1">
                <ChevronDown className="h-3 w-3" />
                <span className="text-sm font-medium">Paires ({imgCalib.pairs.size})</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {imgCalib.pairs.size === 0 ? (
                <p className="text-xs text-muted-foreground italic pl-2">Aucune paire</p>
              ) : (
                <div className="space-y-1.5 mt-1">
                  {Array.from(imgCalib.pairs.values()).map((pair) => {
                    const p1 = imgCalib.points.get(pair.point1Id);
                    const p2 = imgCalib.points.get(pair.point2Id);
                    const distPx = p1 && p2 ? distance(p1, p2) : 0;
                    const pairScale = distPx > 0 ? pair.distanceMm / distPx : 0;
                    const measuredWithAvgScale = displayScale > 0 ? distPx * displayScale : 0;
                    const errorMm = measuredWithAvgScale - pair.distanceMm;
                    const dx = p1 && p2 ? Math.abs(p2.x - p1.x) : 0;
                    const dy = p1 && p2 ? Math.abs(p2.y - p1.y) : 0;
                    const isHorizontal = dx > dy;

                    return (
                      <div key={pair.id} className="p-1.5 bg-gray-50 rounded space-y-1">
                        {/* Ligne 1 */}
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: pair.color }}
                            title={isHorizontal ? "Horizontale (→ X)" : "Verticale (→ Y)"}
                          />
                          <span className="font-medium text-xs whitespace-nowrap">
                            {p1?.label}↔{p2?.label}
                          </span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={pair.distanceMm}
                            onChange={(e) => {
                              const val = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                              updatePairDistance(pair.id, parseFloat(val) || 0);
                            }}
                            onFocus={(e) => e.target.value === "0" && e.target.select()}
                            className="h-6 text-xs w-16 px-1.5"
                            placeholder={displayScale > 0 ? `~${(distPx * displayScale).toFixed(0)}` : "mm"}
                          />
                          <span className="text-xs text-muted-foreground">mm</span>
                          {pair.distanceMm === 0 && displayScale > 0 && (
                            <button
                              className="text-xs text-blue-600 hover:text-blue-700"
                              onClick={() => updatePairDistance(pair.id, Math.round(distPx * displayScale * 10) / 10)}
                              title="Appliquer l'estimation"
                            >
                              ≈{(distPx * displayScale).toFixed(0)}
                            </button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCalibrationPair(pair.id)}
                            className="h-5 w-5 p-0 ml-auto text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Ligne 2 */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span>{distPx.toFixed(0)}px</span>
                            {pair.distanceMm > 0 && (
                              <>
                                <span>·</span>
                                <span>{pairScale.toFixed(4)}</span>
                              </>
                            )}
                            {displayScale > 0 && pair.distanceMm > 0 && (
                              <>
                                <span>·</span>
                                <span
                                  className={`font-medium ${Math.abs(errorMm) < 0.5 ? "text-green-600" : Math.abs(errorMm) < 2 ? "text-orange-500" : "text-red-500"}`}
                                >
                                  Δ{errorMm >= 0 ? "+" : ""}
                                  {errorMm.toFixed(1)}
                                </span>
                                {Math.abs(errorMm) >= 0.1 && (
                                  <button
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() =>
                                      updatePairDistance(pair.id, Math.round(measuredWithAvgScale * 10) / 10)
                                    }
                                    title="Utiliser l'estimation"
                                  >
                                    ✓
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 text-xs px-1.5"
                            onClick={() => {
                              if (calibrationData.mode === "anisotrope") {
                                if (isHorizontal) {
                                  updateSelectedImageCalibration((prev) => ({ ...prev, scaleX: pairScale }));
                                  setCalibrationData((prev) => ({
                                    ...prev,
                                    scaleX: pairScale,
                                    scale: prev.scaleY ? (pairScale + prev.scaleY) / 2 : pairScale,
                                  }));
                                  toast.success(`Échelle X: ${pairScale.toFixed(4)} mm/px`);
                                } else {
                                  updateSelectedImageCalibration((prev) => ({ ...prev, scaleY: pairScale }));
                                  setCalibrationData((prev) => ({
                                    ...prev,
                                    scaleY: pairScale,
                                    scale: prev.scaleX ? (prev.scaleX + pairScale) / 2 : pairScale,
                                  }));
                                  toast.success(`Échelle Y: ${pairScale.toFixed(4)} mm/px`);
                                }
                              } else {
                                updateSelectedImageCalibration((prev) => ({ ...prev, scale: pairScale, error: 0 }));
                                setCalibrationData((prev) => ({ ...prev, scale: pairScale }));
                                toast.success(`Échelle: ${pairScale.toFixed(4)} mm/px`);
                              }
                            }}
                            title={isHorizontal ? "Définir comme échelle X" : "Définir comme échelle Y"}
                          >
                            {calibrationData.mode === "anisotrope" ? (isHorizontal ? "→ X" : "→ Y") : "Utiliser"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Bouton Créer paire */}
          <Button
            variant={calibrationMode === "selectPair1" || calibrationMode === "selectPair2" ? "default" : "outline"}
            size="sm"
            className="w-full h-8"
            disabled={imgCalib.points.size < 2}
            onClick={() => {
              if (calibrationMode === "selectPair1" || calibrationMode === "selectPair2") {
                setCalibrationMode("idle");
                setSelectedCalibrationPoint(null);
              } else {
                setCalibrationMode("selectPair1");
              }
            }}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {calibrationMode === "selectPair1" || calibrationMode === "selectPair2" ? "Annuler" : "Créer paire"}
          </Button>
          {(calibrationMode === "selectPair1" || calibrationMode === "selectPair2") && (
            <p className="text-xs text-blue-600 text-center">
              {calibrationMode === "selectPair1" && "1️⃣ Cliquez sur le 1er point"}
              {calibrationMode === "selectPair2" && "2️⃣ Cliquez sur le 2ème point"}
            </p>
          )}

          <Separator />

          {/* === SECTION MODE === */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Mode</Label>
            <div className="flex gap-1">
              {(["simple", "anisotrope", "affine", "perspective"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={calibrationData.mode === mode ? "default" : "outline"}
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => setCalibrationData((prev) => ({ ...prev, mode }))}
                >
                  {mode === "simple"
                    ? "Simple"
                    : mode === "anisotrope"
                      ? "Aniso"
                      : mode === "affine"
                        ? "Affine"
                        : "Persp."}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {calibrationData.mode === "simple" && "Échelle uniforme (scaleX = scaleY)"}
              {calibrationData.mode === "anisotrope" && "Échelles X/Y séparées (pas de rotation)"}
              {calibrationData.mode === "affine" && "Échelle + rotation + cisaillement (min 3 pts)"}
              {calibrationData.mode === "perspective" && "Correction perspective complète (4 pts)"}
            </p>
          </div>

          {/* Étirement manuel (mode anisotrope) */}
          {calibrationData.mode === "anisotrope" && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-7 px-2 gap-1 w-full justify-start">
                  <Move className="h-3 w-3" />
                  <span className="text-xs">Étirement manuel</span>
                  <ChevronDown className="h-3 w-3 ml-auto" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-8">X:</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="10"
                    defaultValue="1"
                    className="h-6 text-xs flex-1"
                    onChange={(e) => {
                      const stretchX = parseFloat(e.target.value) || 1;
                      setCalibrationData((prev) => ({ ...prev, manualStretchX: stretchX }));
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-8">Y:</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="10"
                    defaultValue="1"
                    className="h-6 text-xs flex-1"
                    onChange={(e) => {
                      const stretchY = parseFloat(e.target.value) || 1;
                      setCalibrationData((prev) => ({ ...prev, manualStretchY: stretchY }));
                    }}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Perspective 4 points */}
          {calibrationData.mode === "perspective" && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-7 px-2 gap-1 w-full justify-start">
                  <Grid3X3 className="h-3 w-3" />
                  <span className="text-xs">Configuration perspective</span>
                  <ChevronDown className="h-3 w-3 ml-auto" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <Select
                  value={perspectiveMethod}
                  onValueChange={(v) => setPerspectiveMethod(v as "rectangle" | "checkerboard")}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rectangle">4 points (rectangle)</SelectItem>
                    <SelectItem value="checkerboard">Damier (automatique)</SelectItem>
                  </SelectContent>
                </Select>

                {perspectiveMethod === "rectangle" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Largeur (mm)</Label>
                        <Input
                          type="number"
                          value={rectWidth}
                          onChange={(e) => setRectWidth(e.target.value)}
                          className="h-6 text-xs"
                          placeholder="100"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Hauteur (mm)</Label>
                        <Input
                          type="number"
                          value={rectHeight}
                          onChange={(e) => setRectHeight(e.target.value)}
                          className="h-6 text-xs"
                          placeholder="100"
                        />
                      </div>
                    </div>
                    <Button
                      variant={calibrationMode === "selectRect" ? "default" : "outline"}
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => {
                        if (calibrationMode === "selectRect") {
                          setCalibrationMode("idle");
                          setRectPoints([]);
                        } else {
                          setRectPoints([]);
                          setCalibrationMode("selectRect");
                        }
                      }}
                    >
                      {calibrationMode === "selectRect"
                        ? `Points: ${rectPoints.length}/4 (Annuler)`
                        : rectPoints.length === 4
                          ? "✓ Rectangle défini"
                          : "Sélectionner 4 coins"}
                    </Button>
                    {rectPoints.length === 4 && (
                      <p className="text-xs text-green-600 text-center">✓ Rectangle prêt pour correction</p>
                    )}
                  </div>
                )}

                {perspectiveMethod === "checkerboard" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Coins X</Label>
                        <Input
                          type="number"
                          value={checkerCornersX}
                          onChange={(e) => setCheckerCornersX(e.target.value)}
                          className="h-6 text-xs"
                          placeholder="7"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Coins Y</Label>
                        <Input
                          type="number"
                          value={checkerCornersY}
                          onChange={(e) => setCheckerCornersY(e.target.value)}
                          className="h-6 text-xs"
                          placeholder="5"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Taille carrés (mm)</Label>
                      <Input
                        type="number"
                        value={checkerSquareSize}
                        onChange={(e) => setCheckerSquareSize(e.target.value)}
                        className="h-6 text-xs"
                        placeholder="25"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" disabled>
                      Détecter damier (bientôt)
                    </Button>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          <Separator />

          {/* === SECTION RÉSULTATS & ACTIONS === */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8"
              onClick={calculateCalibration}
              disabled={!hasPairs}
            >
              Calculer l'échelle
            </Button>

            {/* Échelle calculée */}
            {calibrationData.scale && (
              <div className="p-2 bg-green-50 rounded space-y-1">
                <p className="text-sm font-medium text-green-700">Échelle: {calibrationData.scale.toFixed(4)} mm/px</p>
                {calibrationData.error !== undefined && (
                  <p className="text-xs text-green-600">Erreur moyenne: {calibrationData.error.toFixed(1)}%</p>
                )}
                {/* Bouton appliquer estimations */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7 border-green-300 text-green-700 hover:bg-green-100"
                  onClick={() => {
                    const scale = imgCalib.scale || calibrationData.scale;
                    if (!scale) return;
                    let count = 0;
                    imgCalib.pairs.forEach((pair) => {
                      const p1 = imgCalib.points.get(pair.point1Id);
                      const p2 = imgCalib.points.get(pair.point2Id);
                      if (p1 && p2) {
                        const distPx = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                        const estimatedMm = Math.round(distPx * scale * 10) / 10;
                        updatePairDistance(pair.id, estimatedMm);
                        count++;
                      }
                    });
                    toast.success(`${count} paires mises à jour`);
                    setTimeout(() => calculateCalibration(), 100);
                  }}
                >
                  ✓ Appliquer estimations
                </Button>
              </div>
            )}

            {/* Affichage scaleX/scaleY si anisotrope */}
            {(() => {
              const scaleX = calibrationData.scaleX ?? imgCalib.scaleX;
              const scaleY = calibrationData.scaleY ?? imgCalib.scaleY;
              const errorX = calibrationData.errorX ?? imgCalib.errorX;
              const errorY = calibrationData.errorY ?? imgCalib.errorY;

              if (!scaleX || !scaleY) return null;

              const avgScale = (scaleX + scaleY) / 2;
              const diffPercent = (Math.abs(scaleX - scaleY) / avgScale) * 100;

              return (
                <div className="p-2 bg-blue-50 rounded text-xs space-y-1">
                  <p className="font-medium text-blue-700">Échelles X/Y (diff: {diffPercent.toFixed(1)}%)</p>
                  <p className="text-blue-600">
                    X: {scaleX.toFixed(4)} mm/px {errorX !== undefined && `(±${errorX.toFixed(1)}%)`}
                  </p>
                  <p className="text-blue-600">
                    Y: {scaleY.toFixed(4)} mm/px {errorY !== undefined && `(±${errorY.toFixed(1)}%)`}
                  </p>
                  <p className="text-blue-500 text-[10px]">Ratio X/Y: {(scaleX / scaleY).toFixed(3)}</p>
                </div>
              );
            })()}

            {/* Boutons Appliquer + Reset */}
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={applyCalibration}
                disabled={!calibrationData.scale && !imgCalib.scale}
              >
                <Check className="h-4 w-4 mr-1" />
                Appliquer
              </Button>
              {(calibrationData.applied || imgCalib.applied) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetCalibration}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  title="Annuler la calibration"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {calibrationData.applied && (
              <p className="text-xs text-center text-green-600 font-medium">✓ Calibration appliquée</p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CalibrationPanel;
