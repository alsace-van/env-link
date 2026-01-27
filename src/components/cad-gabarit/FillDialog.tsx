// ============================================
// COMPOSANT: FillDialog
// VERSION: 1.0
// Description: Dialogue pour le remplissage et hachures des formes
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================
// TYPES
// ============================================

export interface FillDialogTarget {
  geoIds: Set<string>;
  path: { x: number; y: number }[];
}

export interface FillDialogProps {
  // Dialog state
  fillDialogOpen: boolean;
  setFillDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fillDialogTarget: FillDialogTarget | null;
  setFillDialogTarget: React.Dispatch<React.SetStateAction<FillDialogTarget | null>>;
  
  // Fill options
  fillType: "solid" | "hatch";
  setFillType: React.Dispatch<React.SetStateAction<"solid" | "hatch">>;
  fillColor: string;
  setFillColor: React.Dispatch<React.SetStateAction<string>>;
  fillOpacity: number;
  setFillOpacity: React.Dispatch<React.SetStateAction<number>>;
  
  // Hatch options
  hatchPattern: "lines" | "cross" | "dots";
  setHatchPattern: React.Dispatch<React.SetStateAction<"lines" | "cross" | "dots">>;
  hatchAngle: number;
  setHatchAngle: React.Dispatch<React.SetStateAction<number>>;
  hatchSpacing: number;
  setHatchSpacing: React.Dispatch<React.SetStateAction<number>>;
  
  // Callback
  confirmFillDialog: () => void;
}

// ============================================
// COMPOSANT
// ============================================

export function FillDialog({
  fillDialogOpen,
  setFillDialogOpen,
  fillDialogTarget,
  setFillDialogTarget,
  fillType,
  setFillType,
  fillColor,
  setFillColor,
  fillOpacity,
  setFillOpacity,
  hatchPattern,
  setHatchPattern,
  hatchAngle,
  setHatchAngle,
  hatchSpacing,
  setHatchSpacing,
  confirmFillDialog,
}: FillDialogProps) {
  if (!fillDialogTarget) return null;

  return (
    <Dialog
      open={fillDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setFillDialogOpen(false);
          setFillDialogTarget(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Remplissage de forme</DialogTitle>
          <DialogDescription>Choisissez le type de remplissage et les paramètres</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {/* Type de remplissage */}
          <div className="space-y-2">
            <Label>Type de remplissage</Label>
            <div className="flex gap-2">
              <Button
                variant={fillType === "solid" ? "default" : "outline"}
                size="sm"
                onClick={() => setFillType("solid")}
                className="flex-1"
              >
                Solide
              </Button>
              <Button
                variant={fillType === "hatch" ? "default" : "outline"}
                size="sm"
                onClick={() => setFillType("hatch")}
                className="flex-1"
              >
                Hachures
              </Button>
            </div>
          </div>

          {/* Couleur */}
          <div className="space-y-2">
            <Label htmlFor="fill-color">Couleur</Label>
            <div className="flex gap-2 items-center">
              <input
                id="fill-color"
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <Input
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            {/* Couleurs prédéfinies */}
            <div className="flex gap-1 flex-wrap">
              {["#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#6B7280"].map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded border-2 ${fillColor === c ? "border-gray-800" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFillColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Opacité */}
          <div className="space-y-2">
            <Label>Opacité: {Math.round(fillOpacity * 100)}%</Label>
            <input
              type="range"
              min="0"
              max="100"
              value={fillOpacity * 100}
              onChange={(e) => setFillOpacity(parseInt(e.target.value) / 100)}
              className="w-full"
            />
          </div>

          {/* Options hachures */}
          {fillType === "hatch" && (
            <>
              <div className="space-y-2">
                <Label>Motif</Label>
                <div className="flex gap-2">
                  <Button
                    variant={hatchPattern === "lines" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHatchPattern("lines")}
                    className="flex-1"
                  >
                    Lignes
                  </Button>
                  <Button
                    variant={hatchPattern === "cross" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHatchPattern("cross")}
                    className="flex-1"
                  >
                    Croisé
                  </Button>
                  <Button
                    variant={hatchPattern === "dots" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHatchPattern("dots")}
                    className="flex-1"
                  >
                    Points
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hatch-angle">Angle (°)</Label>
                  <Input
                    id="hatch-angle"
                    type="number"
                    value={hatchAngle}
                    onChange={(e) => setHatchAngle(parseInt(e.target.value) || 0)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hatch-spacing">Espacement (mm)</Label>
                  <Input
                    id="hatch-spacing"
                    type="number"
                    value={hatchSpacing}
                    onChange={(e) => setHatchSpacing(parseFloat(e.target.value) || 5)}
                    min="1"
                    step="0.5"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </>
          )}

          {/* Aperçu */}
          <div className="space-y-2">
            <Label>Aperçu</Label>
            <div
              className="w-full h-16 rounded border"
              style={{
                backgroundColor: fillType === "solid" ? fillColor : "transparent",
                opacity: fillOpacity,
                backgroundImage:
                  fillType === "hatch" && hatchPattern === "lines"
                    ? `repeating-linear-gradient(${hatchAngle}deg, ${fillColor} 0px, ${fillColor} 1px, transparent 1px, transparent ${hatchSpacing}px)`
                    : fillType === "hatch" && hatchPattern === "cross"
                      ? `repeating-linear-gradient(${hatchAngle}deg, ${fillColor} 0px, ${fillColor} 1px, transparent 1px, transparent ${hatchSpacing}px), repeating-linear-gradient(${hatchAngle + 90}deg, ${fillColor} 0px, ${fillColor} 1px, transparent 1px, transparent ${hatchSpacing}px)`
                      : fillType === "hatch" && hatchPattern === "dots"
                        ? `radial-gradient(circle, ${fillColor} 1px, transparent 1px)`
                        : "none",
                backgroundSize:
                  fillType === "hatch" && hatchPattern === "dots"
                    ? `${hatchSpacing}px ${hatchSpacing}px`
                    : undefined,
              }}
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setFillDialogOpen(false);
              setFillDialogTarget(null);
            }}
          >
            Annuler
          </Button>
          <Button onClick={confirmFillDialog}>
            <Check className="h-4 w-4 mr-2" />
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FillDialog;
