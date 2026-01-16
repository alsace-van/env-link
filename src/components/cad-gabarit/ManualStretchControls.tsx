// ============================================
// COMPOSANT: ManualStretchControls
// Contrôles d'étirement manuel précis pour images
// VERSION: 1.1 - Ajout étirement par paires de calibration
// ============================================

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown,
  ChevronUp,
  Move,
  ArrowLeftRight,
  ArrowUpDown,
  Maximize2,
  RotateCcw,
  Check,
  Minus,
  Plus,
  Link2,
} from "lucide-react";

// Types pour les paires de calibration
interface CalibrationPoint {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface CalibrationPair {
  id: string;
  point1Id: string;
  point2Id: string;
  distanceMm: number;
}

interface ManualStretchControlsProps {
  /** Dimensions actuelles de l'image en pixels */
  currentWidth: number;
  currentHeight: number;
  /** Échelle actuelle (px/mm) - utilisé pour calculer les dimensions en mm */
  scaleFactor: number;
  /** Callback quand l'utilisateur applique un étirement */
  onApplyStretch: (stretchX: number, stretchY: number) => void;
  /** Si un étirement a déjà été appliqué */
  hasAppliedStretch?: boolean;
  /** Callback pour reset */
  onReset?: () => void;
  /** Points de calibration */
  calibrationPoints?: Map<string, CalibrationPoint>;
  /** Paires de calibration */
  calibrationPairs?: Map<string, CalibrationPair>;
}

interface CornerOffsets {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

// Interface pour les ajustements par paire
interface PairAdjustment {
  pairId: string;
  targetDistanceMm: string;
  initialDistanceMm: number; // Distance initiale avant tout étirement
}

export const ManualStretchControls: React.FC<ManualStretchControlsProps> = ({
  currentWidth,
  currentHeight,
  scaleFactor,
  onApplyStretch,
  hasAppliedStretch,
  onReset,
  calibrationPoints,
  calibrationPairs,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Dimensions cibles en mm
  const currentWidthMm = currentWidth / scaleFactor;
  const currentHeightMm = currentHeight / scaleFactor;
  
  // État pour les dimensions cibles
  const [targetWidthMm, setTargetWidthMm] = useState<string>(currentWidthMm.toFixed(1));
  const [targetHeightMm, setTargetHeightMm] = useState<string>(currentHeightMm.toFixed(1));
  
  // État pour les offsets des coins (en mm)
  const [cornerOffsets, setCornerOffsets] = useState<CornerOffsets>({
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
  });
  
  // État pour les ajustements par paire
  const [pairAdjustments, setPairAdjustments] = useState<Map<string, PairAdjustment>>(new Map());
  
  // Incrément par défaut en mm
  const [increment, setIncrement] = useState<string>("0.1");
  
  // Mettre à jour les dimensions quand les props changent
  useEffect(() => {
    const wMm = currentWidth / scaleFactor;
    const hMm = currentHeight / scaleFactor;
    setTargetWidthMm(wMm.toFixed(1));
    setTargetHeightMm(hMm.toFixed(1));
  }, [currentWidth, currentHeight, scaleFactor]);
  
  // Initialiser les ajustements de paires - recalculer quand les paires ou points changent
  const initialDistancesRef = React.useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    if (calibrationPairs && calibrationPairs.size > 0 && calibrationPoints) {
      const newAdjustments = new Map<string, PairAdjustment>();
      calibrationPairs.forEach((pair, id) => {
        const p1 = calibrationPoints.get(pair.point1Id);
        const p2 = calibrationPoints.get(pair.point2Id);
        if (p1 && p2) {
          const distPx = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          const currentDistMm = distPx / scaleFactor;
          
          // Stocker la distance initiale si pas encore connue
          if (!initialDistancesRef.current.has(id)) {
            initialDistancesRef.current.set(id, pair.distanceMm > 0 ? pair.distanceMm : currentDistMm);
          }
          const initialDist = initialDistancesRef.current.get(id) || currentDistMm;
          
          // Conserver la valeur cible existante si elle existe, sinon utiliser la distance actuelle
          const existingAdjustment = pairAdjustments.get(id);
          newAdjustments.set(id, {
            pairId: id,
            targetDistanceMm: existingAdjustment?.targetDistanceMm ?? currentDistMm.toFixed(1),
            initialDistanceMm: initialDist,
          });
        }
      });
      setPairAdjustments(newAdjustments);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrationPairs, calibrationPoints, scaleFactor]);
  
  const parseNumber = (value: string): number => {
    return parseFloat(value.replace(",", ".")) || 0;
  };
  
  const getIncrement = (): number => {
    return parseNumber(increment) || 0.1;
  };
  
  // Calculer les ratios d'étirement global
  const stretchX = parseNumber(targetWidthMm) / currentWidthMm;
  const stretchY = parseNumber(targetHeightMm) / currentHeightMm;
  
  // Calculer le stretch basé sur une paire
  const calculatePairStretch = (pairId: string): { stretchX: number; stretchY: number } | null => {
    if (!calibrationPairs || !calibrationPoints) return null;
    
    const pair = calibrationPairs.get(pairId);
    const adjustment = pairAdjustments.get(pairId);
    if (!pair || !adjustment) return null;
    
    const p1 = calibrationPoints.get(pair.point1Id);
    const p2 = calibrationPoints.get(pair.point2Id);
    if (!p1 || !p2) return null;
    
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const currentDistMm = distPx / scaleFactor;
    const targetDistMm = parseNumber(adjustment.targetDistanceMm);
    
    if (targetDistMm <= 0 || currentDistMm <= 0) return null;
    
    const stretchRatio = targetDistMm / currentDistMm;
    
    // Déterminer si la paire est plutôt horizontale ou verticale
    if (dx > dy * 2) {
      // Paire horizontale → étirer X
      return { stretchX: stretchRatio, stretchY: 1 };
    } else if (dy > dx * 2) {
      // Paire verticale → étirer Y
      return { stretchX: 1, stretchY: stretchRatio };
    } else {
      // Paire diagonale → étirer uniformément
      return { stretchX: stretchRatio, stretchY: stretchRatio };
    }
  };
  
  const handleIncrement = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    current: string,
    delta: number
  ) => {
    const currentVal = parseNumber(current);
    const newVal = Math.max(0.1, currentVal + delta);
    setter(newVal.toFixed(1));
  };
  
  const handlePairIncrement = (pairId: string, delta: number) => {
    setPairAdjustments((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(pairId);
      if (current) {
        const currentVal = parseNumber(current.targetDistanceMm);
        const newVal = Math.max(0.1, currentVal + delta);
        newMap.set(pairId, { ...current, targetDistanceMm: newVal.toFixed(1) });
      }
      return newMap;
    });
  };
  
  const handlePairInputChange = (pairId: string, value: string) => {
    setPairAdjustments((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(pairId);
      if (current) {
        newMap.set(pairId, { ...current, targetDistanceMm: value.replace(/[^0-9.,]/g, "") });
      }
      return newMap;
    });
  };
  
  const handleApplyPairStretch = (pairId: string) => {
    const stretch = calculatePairStretch(pairId);
    if (stretch) {
      onApplyStretch(stretch.stretchX, stretch.stretchY);
    }
  };
  
  const handleCornerChange = (
    corner: keyof CornerOffsets,
    axis: "x" | "y",
    delta: number
  ) => {
    setCornerOffsets((prev) => ({
      ...prev,
      [corner]: {
        ...prev[corner],
        [axis]: prev[corner][axis] + delta,
      },
    }));
  };
  
  const handleApply = useCallback(() => {
    onApplyStretch(stretchX, stretchY);
  }, [stretchX, stretchY, onApplyStretch]);
  
  const handleResetInputs = () => {
    setTargetWidthMm(currentWidthMm.toFixed(1));
    setTargetHeightMm(currentHeightMm.toFixed(1));
    setCornerOffsets({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
    });
    // Reset pair adjustments - réinitialiser aussi les distances initiales
    initialDistancesRef.current.clear();
    if (calibrationPairs && calibrationPoints) {
      const newAdjustments = new Map<string, PairAdjustment>();
      calibrationPairs.forEach((pair, id) => {
        const p1 = calibrationPoints.get(pair.point1Id);
        const p2 = calibrationPoints.get(pair.point2Id);
        if (p1 && p2) {
          const distPx = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          const distMm = distPx / scaleFactor;
          const initialDist = pair.distanceMm > 0 ? pair.distanceMm : distMm;
          initialDistancesRef.current.set(id, initialDist);
          newAdjustments.set(id, {
            pairId: id,
            targetDistanceMm: distMm.toFixed(1),
            initialDistanceMm: initialDist,
          });
        }
      });
      setPairAdjustments(newAdjustments);
    }
  };
  
  const hasChanges = Math.abs(stretchX - 1) > 0.001 || Math.abs(stretchY - 1) > 0.001;
  
  // Calculer les infos de paire pour l'affichage
  const getPairInfo = (pair: CalibrationPair) => {
    if (!calibrationPoints) return null;
    const p1 = calibrationPoints.get(pair.point1Id);
    const p2 = calibrationPoints.get(pair.point2Id);
    if (!p1 || !p2) return null;
    
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const currentDistMm = distPx / scaleFactor;
    
    // Orientation
    let orientation: "H" | "V" | "D" = "D";
    if (dx > dy * 2) orientation = "H";
    else if (dy > dx * 2) orientation = "V";
    
    return {
      p1Label: p1.label,
      p2Label: p2.label,
      currentDistMm,
      orientation,
    };
  };
  
  const hasPairs = calibrationPairs && calibrationPairs.size > 0;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between text-xs"
        >
          <span className="flex items-center gap-2">
            <Move className="h-3 w-3" />
            Étirement manuel
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-3">
        {/* Incrément */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20">Incrément:</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={increment}
            onChange={(e) => setIncrement(e.target.value.replace(/[^0-9.,]/g, ""))}
            className="h-7 text-xs w-16 text-center"
          />
          <span className="text-xs text-muted-foreground">mm</span>
        </div>
        
        <Separator />
        
        {/* Étirement par paires de calibration - dans un dropdown */}
        {hasPairs && (
          <>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-8 px-2">
                  <span className="text-xs font-medium flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    Étirement par paire ({calibrationPairs?.size || 0} paires)
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="text-[10px] text-muted-foreground mb-2">
                  Ajustez la distance cible pour chaque paire de points
                </p>
                
                <ScrollArea className="h-auto max-h-[300px]">
                  <div className="space-y-2 pr-3">
                    {Array.from(calibrationPairs!.entries()).map(([id, pair]) => {
                      const info = getPairInfo(pair);
                      const adjustment = pairAdjustments.get(id);
                      if (!info || !adjustment) return null;
                      
                      const targetMm = parseNumber(adjustment.targetDistanceMm);
                      const hasChange = Math.abs(targetMm - info.currentDistMm) > 0.01;
                      const stretchPreview = targetMm / info.currentDistMm;
                      
                      return (
                        <div key={id} className="border rounded p-2 space-y-1 bg-muted/20">
                          {/* En-tête de la paire */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">
                              {info.p1Label} ↔ {info.p2Label}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              info.orientation === "H" ? "bg-blue-100 text-blue-700" :
                              info.orientation === "V" ? "bg-green-100 text-green-700" :
                              "bg-purple-100 text-purple-700"
                            }`}>
                              {info.orientation === "H" ? "Horizontal" :
                               info.orientation === "V" ? "Vertical" : "Diagonal"}
                            </span>
                          </div>
                          
                          {/* Distance actuelle et initiale */}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>Actuel: {info.currentDistMm.toFixed(2)} mm</span>
                            {Math.abs(adjustment.initialDistanceMm - info.currentDistMm) > 0.1 && (
                              <span className="text-orange-500">
                                (init: {adjustment.initialDistanceMm.toFixed(1)} mm)
                              </span>
                            )}
                          </div>
                          
                          {/* Contrôle de distance cible */}
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] w-10">Cible:</Label>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handlePairIncrement(id, -getIncrement())}
                            >
                              <Minus className="h-2 w-2" />
                            </Button>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={adjustment.targetDistanceMm}
                              onChange={(e) => handlePairInputChange(id, e.target.value)}
                              className="h-6 text-[10px] w-16 text-center"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handlePairIncrement(id, getIncrement())}
                            >
                              <Plus className="h-2 w-2" />
                            </Button>
                            <span className="text-[10px] text-muted-foreground">mm</span>
                            {/* Bouton reset pour cette paire */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-1"
                              onClick={() => {
                                setPairAdjustments((prev) => {
                                  const newMap = new Map(prev);
                                  const current = newMap.get(id);
                                  if (current) {
                                    newMap.set(id, {
                                      ...current,
                                      targetDistanceMm: info.currentDistMm.toFixed(1),
                                    });
                                  }
                                  return newMap;
                                });
                              }}
                              title="Réinitialiser à la valeur actuelle"
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                          
                          {/* Prévisualisation et bouton appliquer */}
                          {hasChange && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-blue-600">
                                ×{stretchPreview.toFixed(4)} ({stretchPreview > 1 ? "+" : ""}{((stretchPreview - 1) * 100).toFixed(1)}%)
                              </span>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-5 text-[10px] px-2"
                                onClick={() => handleApplyPairStretch(id)}
                              >
                                <Check className="h-2 w-2 mr-1" />
                                Appliquer
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
            
            <Separator />
          </>
        )}
        
        {/* Dimensions globales */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            Dimensions globales
          </Label>
          
          {/* Largeur (X) */}
          <div className="flex items-center gap-1">
            <Label className="text-xs w-14 flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              Larg:
            </Label>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleIncrement(setTargetWidthMm, targetWidthMm, -getIncrement())}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="text"
              inputMode="decimal"
              value={targetWidthMm}
              onChange={(e) => setTargetWidthMm(e.target.value.replace(/[^0-9.,]/g, ""))}
              className="h-7 text-xs w-20 text-center"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleIncrement(setTargetWidthMm, targetWidthMm, getIncrement())}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground">mm</span>
          </div>
          
          {/* Hauteur (Y) */}
          <div className="flex items-center gap-1">
            <Label className="text-xs w-14 flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" />
              Haut:
            </Label>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleIncrement(setTargetHeightMm, targetHeightMm, -getIncrement())}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="text"
              inputMode="decimal"
              value={targetHeightMm}
              onChange={(e) => setTargetHeightMm(e.target.value.replace(/[^0-9.,]/g, ""))}
              className="h-7 text-xs w-20 text-center"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleIncrement(setTargetHeightMm, targetHeightMm, getIncrement())}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground">mm</span>
          </div>
          
          {/* Affichage du ratio */}
          {hasChanges && (
            <div className="p-2 bg-blue-50 rounded text-xs space-y-1">
              <p className="text-blue-700">
                Étirement X: <strong>×{stretchX.toFixed(4)}</strong>
                {stretchX !== 1 && ` (${stretchX > 1 ? "+" : ""}${((stretchX - 1) * 100).toFixed(1)}%)`}
              </p>
              <p className="text-blue-700">
                Étirement Y: <strong>×{stretchY.toFixed(4)}</strong>
                {stretchY !== 1 && ` (${stretchY > 1 ? "+" : ""}${((stretchY - 1) * 100).toFixed(1)}%)`}
              </p>
            </div>
          )}
        </div>
        
        <Separator />
        
        {/* Contrôles par coin */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Ajustement par coin (mm)</Label>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Top Left */}
            <CornerControl
              label="↖ Haut-G"
              offset={cornerOffsets.topLeft}
              increment={getIncrement()}
              onChange={(axis, delta) => handleCornerChange("topLeft", axis, delta)}
            />
            
            {/* Top Right */}
            <CornerControl
              label="↗ Haut-D"
              offset={cornerOffsets.topRight}
              increment={getIncrement()}
              onChange={(axis, delta) => handleCornerChange("topRight", axis, delta)}
            />
            
            {/* Bottom Left */}
            <CornerControl
              label="↙ Bas-G"
              offset={cornerOffsets.bottomLeft}
              increment={getIncrement()}
              onChange={(axis, delta) => handleCornerChange("bottomLeft", axis, delta)}
            />
            
            {/* Bottom Right */}
            <CornerControl
              label="↘ Bas-D"
              offset={cornerOffsets.bottomRight}
              increment={getIncrement()}
              onChange={(axis, delta) => handleCornerChange("bottomRight", axis, delta)}
            />
          </div>
          
          <p className="text-[10px] text-muted-foreground italic">
            Note: L'ajustement par coin nécessite une transformation perspective (non encore implémentée).
          </p>
        </div>
        
        <Separator />
        
        {/* Boutons d'action */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleResetInputs}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={handleApply}
            disabled={!hasChanges}
          >
            <Check className="h-3 w-3 mr-1" />
            Appliquer
          </Button>
        </div>
        
        {hasAppliedStretch && onReset && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Annuler l'étirement appliqué
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

// Sous-composant pour contrôle d'un coin
interface CornerControlProps {
  label: string;
  offset: { x: number; y: number };
  increment: number;
  onChange: (axis: "x" | "y", delta: number) => void;
}

const CornerControl: React.FC<CornerControlProps> = ({
  label,
  offset,
  increment,
  onChange,
}) => {
  return (
    <div className="border rounded p-1.5 space-y-1 bg-muted/30">
      <p className="text-[10px] font-medium text-center">{label}</p>
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onChange("x", -increment)}
        >
          <Minus className="h-2 w-2" />
        </Button>
        <span className="text-[10px] w-10 text-center">
          X: {offset.x >= 0 ? "+" : ""}{offset.x.toFixed(1)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onChange("x", increment)}
        >
          <Plus className="h-2 w-2" />
        </Button>
      </div>
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onChange("y", -increment)}
        >
          <Minus className="h-2 w-2" />
        </Button>
        <span className="text-[10px] w-10 text-center">
          Y: {offset.y >= 0 ? "+" : ""}{offset.y.toFixed(1)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onChange("y", increment)}
        >
          <Plus className="h-2 w-2" />
        </Button>
      </div>
    </div>
  );
};

export default ManualStretchControls;
