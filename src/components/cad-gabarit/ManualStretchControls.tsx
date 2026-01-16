// ============================================
// COMPOSANT: ManualStretchControls
// Contrôles d'étirement manuel précis pour images
// VERSION: 1.0
// ============================================

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
} from "lucide-react";

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
}

interface CornerOffsets {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export const ManualStretchControls: React.FC<ManualStretchControlsProps> = ({
  currentWidth,
  currentHeight,
  scaleFactor,
  onApplyStretch,
  hasAppliedStretch,
  onReset,
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
  
  // Incrément par défaut en mm
  const [increment, setIncrement] = useState<string>("0.1");
  
  // Mettre à jour les dimensions quand les props changent
  useEffect(() => {
    const wMm = currentWidth / scaleFactor;
    const hMm = currentHeight / scaleFactor;
    setTargetWidthMm(wMm.toFixed(1));
    setTargetHeightMm(hMm.toFixed(1));
  }, [currentWidth, currentHeight, scaleFactor]);
  
  const parseNumber = (value: string): number => {
    return parseFloat(value.replace(",", ".")) || 0;
  };
  
  const getIncrement = (): number => {
    return parseNumber(increment) || 0.1;
  };
  
  // Calculer les ratios d'étirement
  const stretchX = parseNumber(targetWidthMm) / currentWidthMm;
  const stretchY = parseNumber(targetHeightMm) / currentHeightMm;
  
  const handleIncrement = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    current: string,
    delta: number
  ) => {
    const currentVal = parseNumber(current);
    const newVal = Math.max(0.1, currentVal + delta);
    setter(newVal.toFixed(1));
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
  };
  
  const hasChanges = Math.abs(stretchX - 1) > 0.001 || Math.abs(stretchY - 1) > 0.001;
  
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
        
        {/* Dimensions globales */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            Dimensions cibles
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
