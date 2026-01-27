// ============================================
// HOOK: useDrawingState
// VERSION: 1.0
// Description: Gestion des états temporaires de dessin et outils
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import type { Point, ToolType, Sketch, Line, Arc, Circle, Bezier } from "./types";
import { generateId } from "./types";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface TempGeometry {
  type: "line" | "circle" | "arc" | "rectangle" | "bezier" | "polygon" | "spline";
  p1?: Point;
  p2?: Point;
  center?: Point;
  radius?: number;
  points?: Point[];
  mode?: "corner" | "center";
  sides?: number;
}

export interface RectInputs {
  active: boolean;
  widthValue: string;
  heightValue: string;
  activeField: "width" | "height";
  editingWidth: boolean;
  editingHeight: boolean;
  widthInputPos: { x: number; y: number };
  heightInputPos: { x: number; y: number };
}

export interface PerpendicularInfo {
  isActive: boolean;
  lineId: string;
  intersectionPoint: { x: number; y: number };
  angle: number;
}

export interface TextInputState {
  active: boolean;
  position: { x: number; y: number };
  value: string;
  fontSize: number;
  layerId: string;
}

export interface UseDrawingStateProps {
  initialTool?: ToolType;
  initialStrokeWidth?: number;
  initialStrokeColor?: string;
  initialPolygonSides?: number;
}

export interface UseDrawingStateReturn {
  // Outil actif
  activeTool: ToolType;
  setActiveTool: React.Dispatch<React.SetStateAction<ToolType>>;
  
  // États temporaires de dessin
  tempGeometry: TempGeometry | null;
  setTempGeometry: React.Dispatch<React.SetStateAction<TempGeometry | null>>;
  tempPoints: Point[];
  setTempPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  
  // Modes de création
  rectangleMode: "corner" | "center";
  setRectangleMode: React.Dispatch<React.SetStateAction<"corner" | "center">>;
  polygonSides: number;
  setPolygonSides: React.Dispatch<React.SetStateAction<number>>;
  
  // Inputs rectangle
  rectInputs: RectInputs;
  setRectInputs: React.Dispatch<React.SetStateAction<RectInputs>>;
  widthInputRef: React.RefObject<HTMLInputElement>;
  heightInputRef: React.RefObject<HTMLInputElement>;
  
  // Perpendicularité
  perpendicularInfo: PerpendicularInfo | null;
  setPerpendicularInfo: React.Dispatch<React.SetStateAction<PerpendicularInfo | null>>;
  
  // Mode construction
  isConstructionMode: boolean;
  setIsConstructionMode: React.Dispatch<React.SetStateAction<boolean>>;
  isConstructionModeRef: React.MutableRefObject<boolean>;
  showConstruction: boolean;
  setShowConstruction: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Paramètres de trait
  defaultStrokeWidth: number;
  setDefaultStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  defaultStrokeWidthRef: React.MutableRefObject<number>;
  defaultStrokeColor: string;
  setDefaultStrokeColor: React.Dispatch<React.SetStateAction<string>>;
  defaultStrokeColorRef: React.MutableRefObject<string>;
  STROKE_WIDTH_OPTIONS: number[];
  
  // Text input
  textInput: TextInputState | null;
  setTextInput: React.Dispatch<React.SetStateAction<TextInputState | null>>;
  
  // Snap calque actif uniquement
  snapToActiveLayerOnly: boolean;
  setSnapToActiveLayerOnly: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Fonctions utilitaires
  resetDrawingState: () => void;
  cancelCurrentDrawing: () => void;
  startLine: (point: Point) => void;
  startCircle: (center: Point) => void;
  startRectangle: (point: Point, mode: "corner" | "center") => void;
  startPolygon: (center: Point, sides: number) => void;
  startBezier: (point: Point) => void;
  startArc3Points: (point: Point) => void;
  addSplinePoint: (point: Point) => void;
}

// ============================================
// CONSTANTES
// ============================================

const STROKE_WIDTH_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

const DEFAULT_RECT_INPUTS: RectInputs = {
  active: false,
  widthValue: "",
  heightValue: "",
  activeField: "width",
  editingWidth: false,
  editingHeight: false,
  widthInputPos: { x: 0, y: 0 },
  heightInputPos: { x: 0, y: 0 },
};

// ============================================
// HOOK
// ============================================

export function useDrawingState({
  initialTool = "select",
  initialStrokeWidth = 1,
  initialStrokeColor = "#000000",
  initialPolygonSides = 6,
}: UseDrawingStateProps = {}): UseDrawingStateReturn {
  
  // === Outil actif ===
  const [activeTool, setActiveTool] = useState<ToolType>(initialTool);
  
  // === États temporaires de dessin ===
  const [tempGeometry, setTempGeometry] = useState<TempGeometry | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  
  // === Modes de création ===
  const [rectangleMode, setRectangleMode] = useState<"corner" | "center">("corner");
  const [polygonSides, setPolygonSides] = useState<number>(initialPolygonSides);
  
  // === Inputs rectangle ===
  const [rectInputs, setRectInputs] = useState<RectInputs>(DEFAULT_RECT_INPUTS);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);
  
  // === Perpendicularité ===
  const [perpendicularInfo, setPerpendicularInfo] = useState<PerpendicularInfo | null>(null);
  
  // === Mode construction ===
  const [isConstructionMode, setIsConstructionMode] = useState(false);
  const isConstructionModeRef = useRef(false);
  const [showConstruction, setShowConstruction] = useState(true);
  
  // === Paramètres de trait ===
  const [defaultStrokeWidth, setDefaultStrokeWidth] = useState<number>(initialStrokeWidth);
  const defaultStrokeWidthRef = useRef<number>(initialStrokeWidth);
  const [defaultStrokeColor, setDefaultStrokeColor] = useState(initialStrokeColor);
  const defaultStrokeColorRef = useRef<string>(initialStrokeColor);
  
  // === Text input ===
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  
  // === Snap calque actif uniquement ===
  const [snapToActiveLayerOnly, setSnapToActiveLayerOnly] = useState(false);
  
  // === Synchronisation des refs ===
  useEffect(() => {
    isConstructionModeRef.current = isConstructionMode;
  }, [isConstructionMode]);
  
  useEffect(() => {
    defaultStrokeWidthRef.current = defaultStrokeWidth;
  }, [defaultStrokeWidth]);
  
  useEffect(() => {
    defaultStrokeColorRef.current = defaultStrokeColor;
  }, [defaultStrokeColor]);
  
  // === Fermer le text input quand on change d'outil ===
  useEffect(() => {
    if (activeTool !== "text" && textInput?.active) {
      setTextInput(null);
    }
  }, [activeTool, textInput?.active]);
  
  // === Fonctions utilitaires ===
  
  const resetDrawingState = useCallback(() => {
    setTempGeometry(null);
    setTempPoints([]);
    setRectInputs(DEFAULT_RECT_INPUTS);
    setPerpendicularInfo(null);
  }, []);
  
  const cancelCurrentDrawing = useCallback(() => {
    resetDrawingState();
    toast.info("Dessin annulé");
  }, [resetDrawingState]);
  
  const startLine = useCallback((point: Point) => {
    setTempPoints([point]);
    setTempGeometry({ type: "line", p1: point });
  }, []);
  
  const startCircle = useCallback((center: Point) => {
    setTempPoints([center]);
    setTempGeometry({ type: "circle", center, radius: 0 });
  }, []);
  
  const startRectangle = useCallback((point: Point, mode: "corner" | "center") => {
    setTempPoints([point]);
    setTempGeometry({ type: "rectangle", p1: point, mode });
  }, []);
  
  const startPolygon = useCallback((center: Point, sides: number) => {
    setTempPoints([center]);
    setTempGeometry({ type: "polygon", center, radius: 0, sides });
  }, []);
  
  const startBezier = useCallback((point: Point) => {
    setTempPoints([point]);
    setTempGeometry({ type: "bezier", points: [point] });
  }, []);
  
  const startArc3Points = useCallback((point: Point) => {
    setTempPoints([point]);
    setTempGeometry({ type: "arc", points: [point] });
  }, []);
  
  const addSplinePoint = useCallback((point: Point) => {
    setTempPoints(prev => [...prev, point]);
    setTempGeometry(prev => {
      if (prev?.type === "spline") {
        return { ...prev, points: [...(prev.points || []), point] };
      }
      return { type: "spline", points: [point] };
    });
  }, []);
  
  return {
    // Outil actif
    activeTool,
    setActiveTool,
    
    // États temporaires de dessin
    tempGeometry,
    setTempGeometry,
    tempPoints,
    setTempPoints,
    
    // Modes de création
    rectangleMode,
    setRectangleMode,
    polygonSides,
    setPolygonSides,
    
    // Inputs rectangle
    rectInputs,
    setRectInputs,
    widthInputRef,
    heightInputRef,
    
    // Perpendicularité
    perpendicularInfo,
    setPerpendicularInfo,
    
    // Mode construction
    isConstructionMode,
    setIsConstructionMode,
    isConstructionModeRef,
    showConstruction,
    setShowConstruction,
    
    // Paramètres de trait
    defaultStrokeWidth,
    setDefaultStrokeWidth,
    defaultStrokeWidthRef,
    defaultStrokeColor,
    setDefaultStrokeColor,
    defaultStrokeColorRef,
    STROKE_WIDTH_OPTIONS,
    
    // Text input
    textInput,
    setTextInput,
    
    // Snap calque actif uniquement
    snapToActiveLayerOnly,
    setSnapToActiveLayerOnly,
    
    // Fonctions utilitaires
    resetDrawingState,
    cancelCurrentDrawing,
    startLine,
    startCircle,
    startRectangle,
    startPolygon,
    startBezier,
    startArc3Points,
    addSplinePoint,
  };
}

export default useDrawingState;
