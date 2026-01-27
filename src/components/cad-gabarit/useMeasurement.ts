// ============================================
// HOOK: useMeasurement
// VERSION: 1.0
// Description: Gestion des mesures et cotations
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useState, useCallback, useMemo, useRef } from "react";
import { generateId } from "./types";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface Measurement {
  id: string;
  name: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  px: number;
  mm: number;
  angle?: number;
  segment1Id?: string;
  segment2Id?: string;
  visible?: boolean;
  imageId?: string;
  relativeStart?: { x: number; y: number };
  relativeEnd?: { x: number; y: number };
  baseScaleX?: number;
  baseScaleY?: number;
}

export interface MeasureState {
  phase: "idle" | "waitingSecond" | "complete";
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  result: { px: number; mm: number } | null;
  segment1Id?: string | null;
}

export interface DraggingMeasurePoint {
  measureId: string;
  pointType: "start" | "end";
}

export interface UseMeasurementProps {
  scaleFactor: number; // px per mm
}

export interface UseMeasurementReturn {
  // État de la mesure en cours
  measureState: MeasureState;
  setMeasureState: React.Dispatch<React.SetStateAction<MeasureState>>;
  measurePreviewEnd: { x: number; y: number } | null;
  setMeasurePreviewEnd: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  
  // Liste des mesures
  measurements: Measurement[];
  setMeasurements: React.Dispatch<React.SetStateAction<Measurement[]>>;
  
  // Déplacement d'un point de mesure
  draggingMeasurePoint: DraggingMeasurePoint | null;
  setDraggingMeasurePoint: React.Dispatch<React.SetStateAction<DraggingMeasurePoint | null>>;
  
  // Panneau de mesures
  showMeasurePanel: boolean;
  setShowMeasurePanel: React.Dispatch<React.SetStateAction<boolean>>;
  measurePanelPos: { x: number; y: number };
  setMeasurePanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Fonctions
  startMeasure: (point: { x: number; y: number }, segmentId?: string) => void;
  completeMeasure: (endPoint: { x: number; y: number }, segmentId?: string, options?: { imageId?: string; relativeStart?: { x: number; y: number }; relativeEnd?: { x: number; y: number }; baseScaleX?: number; baseScaleY?: number }) => void;
  cancelMeasure: () => void;
  resetMeasure: () => void;
  addMeasurement: (measurement: Omit<Measurement, "id">) => string;
  removeMeasurement: (id: string) => void;
  updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  toggleMeasurementVisibility: (id: string) => void;
  renameMeasurement: (id: string, newName: string) => void;
  clearAllMeasurements: () => void;
  getMeasurement: (id: string) => Measurement | undefined;
  duplicateMeasurement: (id: string) => string | null;
  
  // Helpers
  calculateDistance: (p1: { x: number; y: number }, p2: { x: number; y: number }) => { px: number; mm: number };
  calculateAngle: (p1: { x: number; y: number }, p2: { x: number; y: number }) => number;
  measureCount: number;
  visibleMeasures: Measurement[];
  hasMeasures: boolean;
}

// ============================================
// HELPERS
// ============================================

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// ============================================
// HOOK
// ============================================

export function useMeasurement({ scaleFactor }: UseMeasurementProps): UseMeasurementReturn {
  
  // === État de la mesure en cours ===
  const [measureState, setMeasureState] = useState<MeasureState>({
    phase: "idle",
    start: null,
    end: null,
    result: null,
    segment1Id: null,
  });
  const [measurePreviewEnd, setMeasurePreviewEnd] = useState<{ x: number; y: number } | null>(null);
  
  // === Liste des mesures ===
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  
  // === Déplacement d'un point de mesure ===
  const [draggingMeasurePoint, setDraggingMeasurePoint] = useState<DraggingMeasurePoint | null>(null);
  
  // === Panneau de mesures ===
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  const [measurePanelPos, setMeasurePanelPos] = useState({ x: window.innerWidth - 320, y: 400 });
  
  // === Compteur pour les noms auto ===
  const measureCounterRef = useRef(0);
  
  // === Fonctions de calcul ===
  
  const calculateDistance = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }): { px: number; mm: number } => {
    const px = distance(p1, p2);
    const mm = px / scaleFactor;
    return { px, mm };
  }, [scaleFactor]);
  
  const calculateAngle = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }, []);
  
  // === Fonctions de mesure ===
  
  const startMeasure = useCallback((point: { x: number; y: number }, segmentId?: string) => {
    setMeasureState({
      phase: "waitingSecond",
      start: point,
      end: null,
      result: null,
      segment1Id: segmentId || null,
    });
    setMeasurePreviewEnd(null);
  }, []);
  
  const completeMeasure = useCallback((
    endPoint: { x: number; y: number },
    segmentId?: string,
    options?: {
      imageId?: string;
      relativeStart?: { x: number; y: number };
      relativeEnd?: { x: number; y: number };
      baseScaleX?: number;
      baseScaleY?: number;
    }
  ) => {
    const startPoint = measureState.start;
    if (!startPoint || measureState.phase !== "waitingSecond") return;
    
    const { px, mm } = calculateDistance(startPoint, endPoint);
    
    // Calculer l'angle si on a deux segments
    let angle: number | undefined;
    if (measureState.segment1Id && segmentId && measureState.segment1Id !== segmentId) {
      // Angle entre les deux segments (à calculer par le composant parent si nécessaire)
      angle = undefined; // Le calcul d'angle entre segments est complexe
    }
    
    // Générer un nom auto-incrémenté
    measureCounterRef.current++;
    const name = `Mesure ${measureCounterRef.current}`;
    
    const newMeasurement: Measurement = {
      id: generateId(),
      name,
      start: startPoint,
      end: endPoint,
      px,
      mm,
      angle,
      segment1Id: measureState.segment1Id || undefined,
      segment2Id: segmentId,
      visible: true,
      ...options,
    };
    
    setMeasurements(prev => [...prev, newMeasurement]);
    
    setMeasureState({
      phase: "complete",
      start: startPoint,
      end: endPoint,
      result: { px, mm },
      segment1Id: measureState.segment1Id,
    });
    
    setMeasurePreviewEnd(null);
    
  }, [measureState, calculateDistance]);
  
  const cancelMeasure = useCallback(() => {
    setMeasureState({
      phase: "idle",
      start: null,
      end: null,
      result: null,
      segment1Id: null,
    });
    setMeasurePreviewEnd(null);
  }, []);
  
  const resetMeasure = useCallback(() => {
    cancelMeasure();
  }, [cancelMeasure]);
  
  // === Fonctions CRUD sur les mesures ===
  
  const addMeasurement = useCallback((measurement: Omit<Measurement, "id">): string => {
    const id = generateId();
    const newMeasurement: Measurement = { ...measurement, id };
    setMeasurements(prev => [...prev, newMeasurement]);
    return id;
  }, []);
  
  const removeMeasurement = useCallback((id: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  }, []);
  
  const updateMeasurement = useCallback((id: string, updates: Partial<Measurement>) => {
    setMeasurements(prev => prev.map(m => 
      m.id === id ? { ...m, ...updates } : m
    ));
  }, []);
  
  const toggleMeasurementVisibility = useCallback((id: string) => {
    setMeasurements(prev => prev.map(m => 
      m.id === id ? { ...m, visible: m.visible === false ? true : false } : m
    ));
  }, []);
  
  const renameMeasurement = useCallback((id: string, newName: string) => {
    setMeasurements(prev => prev.map(m => 
      m.id === id ? { ...m, name: newName } : m
    ));
  }, []);
  
  const clearAllMeasurements = useCallback(() => {
    setMeasurements([]);
    measureCounterRef.current = 0;
    cancelMeasure();
    toast.success("Toutes les mesures supprimées");
  }, [cancelMeasure]);
  
  const getMeasurement = useCallback((id: string): Measurement | undefined => {
    return measurements.find(m => m.id === id);
  }, [measurements]);
  
  const duplicateMeasurement = useCallback((id: string): string | null => {
    const original = measurements.find(m => m.id === id);
    if (!original) return null;
    
    measureCounterRef.current++;
    const newId = generateId();
    const duplicate: Measurement = {
      ...original,
      id: newId,
      name: `${original.name} (copie)`,
      // Décaler légèrement la position
      start: { x: original.start.x + 10, y: original.start.y + 10 },
      end: { x: original.end.x + 10, y: original.end.y + 10 },
    };
    
    setMeasurements(prev => [...prev, duplicate]);
    return newId;
  }, [measurements]);
  
  // === Données calculées ===
  
  const measureCount = measurements.length;
  
  const visibleMeasures = useMemo(() => {
    return measurements.filter(m => m.visible !== false);
  }, [measurements]);
  
  const hasMeasures = measurements.length > 0;
  
  return {
    // État de la mesure en cours
    measureState,
    setMeasureState,
    measurePreviewEnd,
    setMeasurePreviewEnd,
    
    // Liste des mesures
    measurements,
    setMeasurements,
    
    // Déplacement d'un point de mesure
    draggingMeasurePoint,
    setDraggingMeasurePoint,
    
    // Panneau de mesures
    showMeasurePanel,
    setShowMeasurePanel,
    measurePanelPos,
    setMeasurePanelPos,
    
    // Fonctions
    startMeasure,
    completeMeasure,
    cancelMeasure,
    resetMeasure,
    addMeasurement,
    removeMeasurement,
    updateMeasurement,
    toggleMeasurementVisibility,
    renameMeasurement,
    clearAllMeasurements,
    getMeasurement,
    duplicateMeasurement,
    
    // Helpers
    calculateDistance,
    calculateAngle,
    measureCount,
    visibleMeasures,
    hasMeasures,
  };
}

export default useMeasurement;
