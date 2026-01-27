// ============================================
// COMPOSANT: ArrayPanel
// VERSION: 1.0
// Description: Panneau flottant pour les répétitions/arrays
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Check, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================
// TYPES
// ============================================

export interface ArrayDialogState {
  open: boolean;
  selectedIds: Set<string>;
  type: "linear" | "grid" | "circular" | "checkerboard";
  // Grid
  countX: number;
  countY: number;
  spacingX: string;
  spacingY: string;
  spacingModeX: "spacing" | "distance";
  spacingModeY: "spacing" | "distance";
  // Linear
  linearCount?: number;
  linearSpacing?: string;
  linearDirection?: "x" | "y" | "custom";
  linearAngle?: string;
  linearSpacingMode?: "spacing" | "distance";
  // Circular
  circularCount: number;
  circularAngle: string;
  circularCenter?: { x: number; y: number };
  // Options
  includeOriginal: boolean;
  createIntersections?: boolean;
  // Checkerboard
  checkerCountX?: string;
  checkerCountY?: string;
  checkerSize?: string;
  checkerColor?: string;
}

export interface ArrayPanelProps {
  // Dialog state
  arrayDialog: ArrayDialogState;
  setArrayDialog: React.Dispatch<React.SetStateAction<ArrayDialogState | null>>;
  
  // Position
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Callbacks
  executeArray: () => void;
}

// ============================================
// COMPOSANT
// ============================================

export function ArrayPanel({
  arrayDialog,
  setArrayDialog,
  position,
  setPosition,
  executeArray,
}: ArrayPanelProps) {
  // État local pour le drag
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: 280,
      }}
      onMouseDown={(e) => {
        if (
          (e.target as HTMLElement).tagName === "INPUT" ||
          (e.target as HTMLElement).tagName === "BUTTON" ||
          (e.target as HTMLElement).tagName === "SELECT"
        )
          return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }}
      onMouseMove={(e) => {
        if (isDragging) {
          setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
          });
        }
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-500 text-white rounded-t-lg cursor-move">
        <span className="text-sm font-medium">
          <Grid3X3 className="h-4 w-4 inline mr-2" />
          Répétition / Array
        </span>
        <button onClick={() => setArrayDialog(null)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Type de répétition */}
      <div className="px-3 py-2 border-b">
        <div className="flex gap-1 flex-wrap">
          <Button
            variant={arrayDialog.type === "linear" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setArrayDialog({ ...arrayDialog, type: "linear" })}
          >
            Linéaire
          </Button>
          <Button
            variant={arrayDialog.type === "grid" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setArrayDialog({ ...arrayDialog, type: "grid" })}
          >
            Grille
          </Button>
          <Button
            variant={arrayDialog.type === "circular" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setArrayDialog({ ...arrayDialog, type: "circular" })}
          >
            Circulaire
          </Button>
          <Button
            variant={arrayDialog.type === "checkerboard" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs bg-gradient-to-r from-black via-white to-black bg-[length:20px_20px]"
            onClick={() => setArrayDialog({ ...arrayDialog, type: "checkerboard" })}
          >
            🏁 Damier
          </Button>
        </div>
      </div>

      {/* Contenu selon le type */}
      <div className="p-3 space-y-3">
        {arrayDialog.type === "linear" && (
          <>
            {/* Nombre de copies */}
            <div className="flex items-center gap-2">
              <Label className="text-xs w-20">Nombre :</Label>
              <Input
                type="number"
                value={arrayDialog.linearCount ?? 3}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1) {
                    setArrayDialog({ ...arrayDialog, linearCount: val });
                  }
                }}
                className="h-7 flex-1 text-xs"
                min="2"
                max="100"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>

            {/* Direction */}
            <div className="space-y-1">
              <Label className="text-xs">Direction :</Label>
              <div className="flex gap-1 bg-gray-100 p-1 rounded">
                <button
                  className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors ${
                    (arrayDialog.linearDirection ?? "x") === "x"
                      ? "bg-white shadow text-purple-600 font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setArrayDialog({ ...arrayDialog, linearDirection: "x" })}
                >
                  → Horizontal (X)
                </button>
                <button
                  className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors ${
                    (arrayDialog.linearDirection ?? "x") === "y"
                      ? "bg-white shadow text-purple-600 font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setArrayDialog({ ...arrayDialog, linearDirection: "y" })}
                >
                  ↓ Vertical (Y)
                </button>
                <button
                  className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors ${
                    (arrayDialog.linearDirection ?? "x") === "custom"
                      ? "bg-white shadow text-purple-600 font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setArrayDialog({ ...arrayDialog, linearDirection: "custom" })}
                >
                  ∠ Angle
                </button>
              </div>
            </div>

            {/* Angle personnalisé */}
            {(arrayDialog.linearDirection ?? "x") === "custom" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs w-20">Angle :</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={arrayDialog.linearAngle ?? "0"}
                  onChange={(e) =>
                    setArrayDialog({ ...arrayDialog, linearAngle: e.target.value.replace(/[^0-9.,\-]/g, "") })
                  }
                  className="h-7 flex-1 text-xs"
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-gray-500">°</span>
              </div>
            )}

            {/* Toggle espacement / distance */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded">
              <button
                className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${
                  (arrayDialog.linearSpacingMode ?? "spacing") === "spacing"
                    ? "bg-white shadow text-purple-600 font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setArrayDialog({ ...arrayDialog, linearSpacingMode: "spacing" })}
              >
                Espacement
              </button>
              <button
                className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${
                  (arrayDialog.linearSpacingMode ?? "spacing") === "distance"
                    ? "bg-white shadow text-purple-600 font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setArrayDialog({ ...arrayDialog, linearSpacingMode: "distance" })}
              >
                Distance totale
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs w-20">
                {(arrayDialog.linearSpacingMode ?? "spacing") === "spacing" ? "Espacement :" : "Distance :"}
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={arrayDialog.linearSpacing ?? "50"}
                onChange={(e) =>
                  setArrayDialog({ ...arrayDialog, linearSpacing: e.target.value.replace(/[^0-9.,\-]/g, "") })
                }
                className="h-7 flex-1 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-gray-500">mm</span>
            </div>

            {/* Info calculée */}
            {(arrayDialog.linearSpacingMode ?? "spacing") === "distance" && (arrayDialog.linearCount ?? 3) > 1 && (
              <div className="text-xs text-gray-500 text-center bg-gray-50 py-1 rounded">
                Espacement réel :{" "}
                {(
                  (parseFloat(String(arrayDialog.linearSpacing ?? "50").replace(",", ".")) || 0) /
                  ((arrayDialog.linearCount ?? 3) - 1)
                ).toFixed(1)}{" "}
                mm
              </div>
            )}

            {(arrayDialog.linearSpacingMode ?? "spacing") === "spacing" && (arrayDialog.linearCount ?? 3) > 1 && (
              <div className="text-xs text-gray-500 text-center bg-gray-50 py-1 rounded">
                Distance totale :{" "}
                {(
                  (parseFloat(String(arrayDialog.linearSpacing ?? "50").replace(",", ".")) || 0) *
                  ((arrayDialog.linearCount ?? 3) - 1)
                ).toFixed(1)}{" "}
                mm
              </div>
            )}
          </>
        )}

        {arrayDialog.type === "grid" && (
          <>
            {/* Colonnes (X) */}
            <div className="space-y-2 p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-20">Colonnes :</Label>
                <Input
                  type="number"
                  value={arrayDialog.countX}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      setArrayDialog({ ...arrayDialog, countX: val });
                    }
                  }}
                  className="h-7 w-16 text-xs"
                  min="1"
                  max="50"
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <div className="flex gap-1 flex-1">
                  <button
                    className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                      arrayDialog.spacingModeX === "spacing" ? "bg-purple-500 text-white" : "bg-gray-200"
                    }`}
                    onClick={() => setArrayDialog({ ...arrayDialog, spacingModeX: "spacing" })}
                  >
                    Esp.
                  </button>
                  <button
                    className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                      arrayDialog.spacingModeX === "distance" ? "bg-purple-500 text-white" : "bg-gray-200"
                    }`}
                    onClick={() => setArrayDialog({ ...arrayDialog, spacingModeX: "distance" })}
                  >
                    Dist.
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-20">
                  {arrayDialog.spacingModeX === "spacing" ? "Esp. X :" : "Dist. X :"}
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={arrayDialog.spacingX}
                  onChange={(e) =>
                    setArrayDialog({ ...arrayDialog, spacingX: e.target.value.replace(/[^0-9.,\-]/g, "") })
                  }
                  className="h-7 flex-1 text-xs"
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-gray-500">mm</span>
              </div>
            </div>

            {/* Lignes (Y) */}
            <div className="space-y-2 p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-20">Lignes :</Label>
                <Input
                  type="number"
                  value={arrayDialog.countY}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      setArrayDialog({ ...arrayDialog, countY: val });
                    }
                  }}
                  className="h-7 w-16 text-xs"
                  min="1"
                  max="50"
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <div className="flex gap-1 flex-1">
                  <button
                    className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                      arrayDialog.spacingModeY === "spacing" ? "bg-purple-500 text-white" : "bg-gray-200"
                    }`}
                    onClick={() => setArrayDialog({ ...arrayDialog, spacingModeY: "spacing" })}
                  >
                    Esp.
                  </button>
                  <button
                    className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                      arrayDialog.spacingModeY === "distance" ? "bg-purple-500 text-white" : "bg-gray-200"
                    }`}
                    onClick={() => setArrayDialog({ ...arrayDialog, spacingModeY: "distance" })}
                  >
                    Dist.
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-20">
                  {arrayDialog.spacingModeY === "spacing" ? "Esp. Y :" : "Dist. Y :"}
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={arrayDialog.spacingY}
                  onChange={(e) =>
                    setArrayDialog({ ...arrayDialog, spacingY: e.target.value.replace(/[^0-9.,\-]/g, "") })
                  }
                  className="h-7 flex-1 text-xs"
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-gray-500">mm</span>
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center bg-purple-50 py-1 rounded">
              Total: {arrayDialog.countX * arrayDialog.countY} éléments
            </div>
          </>
        )}

        {arrayDialog.type === "circular" && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-20">Nombre :</Label>
              <Input
                type="number"
                value={arrayDialog.circularCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 2) {
                    setArrayDialog({ ...arrayDialog, circularCount: val });
                  }
                }}
                className="h-7 flex-1 text-xs"
                min="2"
                max="100"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-20">Angle total :</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={arrayDialog.circularAngle}
                onChange={(e) =>
                  setArrayDialog({ ...arrayDialog, circularAngle: e.target.value.replace(/[^0-9.,\-]/g, "") })
                }
                className="h-7 flex-1 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-gray-500">°</span>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 py-1 px-2 rounded">
              Pas angulaire:{" "}
              {(
                (parseFloat(String(arrayDialog.circularAngle).replace(",", ".")) || 360) / arrayDialog.circularCount
              ).toFixed(1)}
              °
            </div>
            {arrayDialog.circularCenter && (
              <div className="text-xs text-gray-400">
                Centre: ({arrayDialog.circularCenter.x.toFixed(0)}, {arrayDialog.circularCenter.y.toFixed(0)})
              </div>
            )}
          </>
        )}

        {/* Mode Damier (Mire de calibrage) */}
        {arrayDialog.type === "checkerboard" && (
          <>
            <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-2">
              <div className="text-xs text-purple-700 font-medium flex items-center gap-1">
                🏁 Mire de calibrage
              </div>
              <div className="text-[10px] text-purple-600 mt-1">Crée un damier pour la calibration photo</div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Cases en X :</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={arrayDialog.checkerCountX ?? "8"}
                onChange={(e) =>
                  setArrayDialog({ ...arrayDialog, checkerCountX: e.target.value.replace(/[^0-9]/g, "") })
                }
                className="h-7 flex-1 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Cases en Y :</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={arrayDialog.checkerCountY ?? "6"}
                onChange={(e) =>
                  setArrayDialog({ ...arrayDialog, checkerCountY: e.target.value.replace(/[^0-9]/g, "") })
                }
                className="h-7 flex-1 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Taille case :</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={arrayDialog.checkerSize ?? "20"}
                onChange={(e) =>
                  setArrayDialog({ ...arrayDialog, checkerSize: e.target.value.replace(/[^0-9.,]/g, "") })
                }
                className="h-7 flex-1 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-gray-500">mm</span>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Couleur :</Label>
              <input
                type="color"
                value={arrayDialog.checkerColor ?? "#000000"}
                onChange={(e) => setArrayDialog({ ...arrayDialog, checkerColor: e.target.value })}
                className="h-7 w-10 rounded cursor-pointer"
              />
              <span className="text-xs text-gray-500 flex-1">{arrayDialog.checkerColor ?? "#000000"}</span>
            </div>

            {/* Dimensions totales calculées */}
            <div className="bg-gray-50 rounded p-2 space-y-1">
              <div className="text-xs text-gray-600 font-medium">Dimensions totales :</div>
              <div className="text-xs text-gray-500">
                {(
                  (parseInt(String(arrayDialog.checkerCountX ?? "8")) || 8) *
                  (parseFloat(String(arrayDialog.checkerSize ?? "20").replace(",", ".")) || 20)
                ).toFixed(1)}{" "}
                ×{" "}
                {(
                  (parseInt(String(arrayDialog.checkerCountY ?? "6")) || 6) *
                  (parseFloat(String(arrayDialog.checkerSize ?? "20").replace(",", ".")) || 20)
                ).toFixed(1)}{" "}
                mm
              </div>
              <div className="text-xs text-gray-400">
                Points intérieurs: {Math.max(0, (parseInt(String(arrayDialog.checkerCountX ?? "8")) || 8) - 1)} ×{" "}
                {Math.max(0, (parseInt(String(arrayDialog.checkerCountY ?? "6")) || 6) - 1)} ={" "}
                {Math.max(0, (parseInt(String(arrayDialog.checkerCountX ?? "8")) || 8) - 1) *
                  Math.max(0, (parseInt(String(arrayDialog.checkerCountY ?? "6")) || 6) - 1)}
              </div>
            </div>
          </>
        )}

        {/* Option: inclure l'original (masqué pour damier) */}
        {arrayDialog.type !== "checkerboard" && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={arrayDialog.includeOriginal}
              onChange={(e) => setArrayDialog({ ...arrayDialog, includeOriginal: e.target.checked })}
              className="h-3 w-3"
            />
            Inclure l'original dans le compte
          </label>
        )}

        {/* Option: créer les intersections */}
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={arrayDialog.createIntersections ?? true}
            onChange={(e) => setArrayDialog({ ...arrayDialog, createIntersections: e.target.checked })}
            className="h-3 w-3"
          />
          Créer les points d'intersection
        </label>

        {/* Boutons */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setArrayDialog(null)}>
            Annuler
          </Button>
          <Button size="sm" className="flex-1 h-8 bg-purple-500 hover:bg-purple-600" onClick={executeArray}>
            <Check className="h-3 w-3 mr-1" />
            Appliquer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ArrayPanel;
