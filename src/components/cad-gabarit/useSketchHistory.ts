// ============================================
// HOOK: useSketchHistory
// VERSION: 1.0
// Description: Gestion de l'historique, undo/redo et branches
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Sketch, BackgroundImage, ImageMarkerLink } from "./types";
import { generateId } from "./types";

// ============================================
// TYPES
// ============================================

export interface HistoryEntry {
  sketch: string; // JSON sérialisé
  description: string;
  timestamp: number;
}

export interface Branch {
  id: string;
  name: string;
  color: string;
  history: HistoryEntry[];
  historyIndex: number;
  parentBranchId?: string;
  parentHistoryIndex?: number;
  createdAt: number;
}

export interface ImageHistoryState {
  backgroundImages: BackgroundImage[];
  markerLinks: ImageMarkerLink[];
  timestamp: number;
}

export interface UseSketchHistoryProps {
  sketch: Sketch;
  serializeSketch: (sketch: Sketch) => string;
  loadSketchData: (data: string) => void;
}

export interface UseSketchHistoryReturn {
  // États des branches
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  activeBranchId: string;
  setActiveBranchId: React.Dispatch<React.SetStateAction<string>>;
  
  // Historique courant (pour compatibilité)
  history: HistoryEntry[];
  historyIndex: number;
  
  // Refs
  branchesRef: React.MutableRefObject<{ branches: Branch[]; activeBranchId: string }>;
  historyRef: React.MutableRefObject<{ history: HistoryEntry[]; index: number }>;
  
  // Mode comparaison
  comparisonMode: boolean;
  setComparisonMode: React.Dispatch<React.SetStateAction<boolean>>;
  comparisonStyle: "overlay" | "reveal";
  setComparisonStyle: React.Dispatch<React.SetStateAction<"overlay" | "reveal">>;
  visibleBranches: Set<string>;
  setVisibleBranches: React.Dispatch<React.SetStateAction<Set<string>>>;
  comparisonOpacity: number;
  setComparisonOpacity: React.Dispatch<React.SetStateAction<number>>;
  revealPosition: number;
  setRevealPosition: React.Dispatch<React.SetStateAction<number>>;
  revealBranchId: string | null;
  setRevealBranchId: React.Dispatch<React.SetStateAction<string | null>>;
  isDraggingReveal: boolean;
  setIsDraggingReveal: React.Dispatch<React.SetStateAction<boolean>>;
  isDraggingRevealRef: React.MutableRefObject<boolean>;
  
  // Panneau historique
  showHistoryPanel: boolean;
  setShowHistoryPanel: React.Dispatch<React.SetStateAction<boolean>>;
  previewHistoryIndex: number | null;
  setPreviewHistoryIndex: React.Dispatch<React.SetStateAction<number | null>>;
  
  // Modales branches
  showComparisonModal: boolean;
  setShowComparisonModal: React.Dispatch<React.SetStateAction<boolean>>;
  showOverviewModal: boolean;
  setShowOverviewModal: React.Dispatch<React.SetStateAction<boolean>>;
  comparisonModalPos: { x: number; y: number };
  setComparisonModalPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  renamingBranchId: string | null;
  setRenamingBranchId: React.Dispatch<React.SetStateAction<string | null>>;
  renamingValue: string;
  setRenamingValue: React.Dispatch<React.SetStateAction<string>>;
  mergeBranchIds: { source: string | null; target: string | null };
  setMergeBranchIds: React.Dispatch<React.SetStateAction<{ source: string | null; target: string | null }>>;
  
  // Historique images
  imageHistory: ImageHistoryState[];
  setImageHistory: React.Dispatch<React.SetStateAction<ImageHistoryState[]>>;
  imageHistoryRef: React.MutableRefObject<ImageHistoryState[]>;
  addToImageHistory: (images: BackgroundImage[], links: ImageMarkerLink[]) => void;
  
  // Fonctions principales
  getActiveBranch: () => Branch | null;
  addToHistory: (newSketch: Sketch, description?: string) => void;
  undo: () => void;
  redo: () => void;
  goToHistoryIndex: (targetIndex: number) => void;
  createBranchFromHistoryIndex: (targetIndex: number, branchName?: string) => void;
  truncateHistoryAtIndex: (targetIndex: number) => void;
  deleteStateAndAfter: (targetIndex: number) => void;
  switchToBranch: (branchId: string) => void;
  deleteBranch: (branchId: string) => void;
  toggleBranchVisibility: (branchId: string) => void;
  renameBranch: (branchId: string, newName: string) => void;
  duplicateBranch: (branchId: string) => void;
  
  // Helpers
  canUndo: boolean;
  canRedo: boolean;
  activeBranchColor: string;
  BRANCH_COLORS: string[];
}

// ============================================
// CONSTANTES
// ============================================

const BRANCH_COLORS = [
  "#3B82F6", // Bleu
  "#F97316", // Orange
  "#22C55E", // Vert
  "#A855F7", // Violet
  "#EC4899", // Rose
  "#06B6D4", // Cyan
  "#EAB308", // Jaune
  "#EF4444", // Rouge
  "#6366F1", // Indigo
  "#14B8A6", // Teal
];

// ============================================
// HOOK
// ============================================

export function useSketchHistory({
  sketch,
  serializeSketch,
  loadSketchData,
}: UseSketchHistoryProps): UseSketchHistoryReturn {
  
  // === États des branches ===
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const branchesRef = useRef<{ branches: Branch[]; activeBranchId: string }>({ branches: [], activeBranchId: "" });

  // === Mode comparaison ===
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonStyle, setComparisonStyle] = useState<"overlay" | "reveal">("overlay");
  const [visibleBranches, setVisibleBranches] = useState<Set<string>>(new Set());
  const [comparisonOpacity, setComparisonOpacity] = useState(70);
  const [revealPosition, setRevealPosition] = useState(50);
  const [revealBranchId, setRevealBranchId] = useState<string | null>(null);
  const [isDraggingReveal, setIsDraggingReveal] = useState(false);
  const isDraggingRevealRef = useRef(false);

  // === Panneau historique ===
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [previewHistoryIndex, setPreviewHistoryIndex] = useState<number | null>(null);

  // === Modales branches ===
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [comparisonModalPos, setComparisonModalPos] = useState({ x: window.innerWidth - 320, y: 100 });
  const [renamingBranchId, setRenamingBranchId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [mergeBranchIds, setMergeBranchIds] = useState<{ source: string | null; target: string | null }>({
    source: null,
    target: null,
  });

  // === Historique images ===
  const [imageHistory, setImageHistory] = useState<ImageHistoryState[]>([]);
  const imageHistoryRef = useRef<ImageHistoryState[]>([]);

  // === Refs pour compatibilité ===
  const historyRef = useRef<{ history: HistoryEntry[]; index: number }>({ history: [], index: -1 });

  // === Sync refs ===
  useEffect(() => {
    isDraggingRevealRef.current = isDraggingReveal;
  }, [isDraggingReveal]);

  useEffect(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    if (branch) {
      historyRef.current = { history: branch.history, index: branch.historyIndex };
    }
    branchesRef.current = { branches, activeBranchId };
  }, [branches, activeBranchId]);

  useEffect(() => {
    imageHistoryRef.current = imageHistory;
  }, [imageHistory]);

  // Maintenir la cohérence de revealBranchId
  useEffect(() => {
    const currentRevealBranch = branches.find((b) => b.id === revealBranchId);
    const isInvalid = !revealBranchId || revealBranchId === activeBranchId || !currentRevealBranch;

    if (isInvalid && branches.length > 1) {
      const otherBranch = branches.find((b) => b.id !== activeBranchId);
      if (otherBranch) {
        setRevealBranchId(otherBranch.id);
      }
    }
  }, [activeBranchId, branches, revealBranchId]);

  // === Initialisation ===
  const historyInitializedRef = useRef(false);
  useEffect(() => {
    if (!historyInitializedRef.current && sketch) {
      historyInitializedRef.current = true;
      const initialEntry: HistoryEntry = {
        sketch: serializeSketch(sketch),
        description: "État initial",
        timestamp: Date.now(),
      };
      const mainBranch: Branch = {
        id: generateId(),
        name: "Principal",
        color: BRANCH_COLORS[0],
        history: [initialEntry],
        historyIndex: 0,
        createdAt: Date.now(),
      };
      setBranches([mainBranch]);
      setActiveBranchId(mainBranch.id);
      setVisibleBranches(new Set([mainBranch.id]));
      branchesRef.current = { branches: [mainBranch], activeBranchId: mainBranch.id };
      historyRef.current = { history: [initialEntry], index: 0 };
    }
  }, [sketch, serializeSketch]);

  // === Helpers mémoïsés ===
  const getActiveBranch = useCallback((): Branch | null => {
    return branches.find((b) => b.id === activeBranchId) || null;
  }, [branches, activeBranchId]);

  const history = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return branch?.history || [];
  }, [branches, activeBranchId]);

  const historyIndex = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return branch?.historyIndex ?? -1;
  }, [branches, activeBranchId]);

  const canUndo = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return (branch && branch.historyIndex > 0) || imageHistory.length > 0;
  }, [branches, activeBranchId, imageHistory]);

  const canRedo = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return branch ? branch.historyIndex < branch.history.length - 1 : false;
  }, [branches, activeBranchId]);

  const activeBranchColor = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return branch?.color || BRANCH_COLORS[0];
  }, [branches, activeBranchId]);

  // === Fonctions historique images ===
  const addToImageHistory = useCallback((images: BackgroundImage[], links: ImageMarkerLink[]) => {
    const newState: ImageHistoryState = {
      backgroundImages: images.map(img => ({ ...img })),
      markerLinks: links.map(link => ({ ...link })),
      timestamp: Date.now(),
    };
    setImageHistory(prev => [...prev, newState]);
  }, []);

  // === Fonction addToHistory ===
  const addToHistory = useCallback((newSketch: Sketch, description: string = "Modification") => {
    const { branches: currentBranches, activeBranchId: currentActiveBranchId } = branchesRef.current;
    const branchIndex = currentBranches.findIndex((b) => b.id === currentActiveBranchId);
    if (branchIndex === -1) return;

    const branch = currentBranches[branchIndex];
    const newEntry: HistoryEntry = {
      sketch: serializeSketch(newSketch),
      description,
      timestamp: Date.now(),
    };

    const newHistory = [...branch.history.slice(0, branch.historyIndex + 1), newEntry];
    const newIndex = branch.historyIndex + 1;

    const updatedBranch = { ...branch, history: newHistory, historyIndex: newIndex };
    const newBranches = [...currentBranches];
    newBranches[branchIndex] = updatedBranch;

    setBranches(newBranches);
    branchesRef.current = { branches: newBranches, activeBranchId: currentActiveBranchId };
    historyRef.current = { history: newHistory, index: newIndex };
  }, [serializeSketch]);

  // === Undo ===
  const undo = useCallback(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    const sketchCanUndo = branch && branch.historyIndex > 0;
    const imageCanUndo = imageHistory.length > 0;

    if (!sketchCanUndo && !imageCanUndo) {
      return;
    }

    let sketchTimestamp = 0;
    let imageTimestamp = 0;

    if (sketchCanUndo && branch) {
      const currentEntry = branch.history[branch.historyIndex];
      sketchTimestamp = currentEntry?.timestamp || 0;
    }

    if (imageCanUndo) {
      const lastImageState = imageHistory[imageHistory.length - 1];
      imageTimestamp = lastImageState.timestamp || 0;
    }

    // Annuler la modification la plus récente
    if (imageCanUndo && (!sketchCanUndo || imageTimestamp >= sketchTimestamp)) {
      // Retourner les données pour que le composant parent puisse les appliquer
      const lastState = imageHistory[imageHistory.length - 1];
      setImageHistory((prev) => prev.slice(0, -1));
      toast.success("Photo restaurée");
      // Note: Le composant parent doit appeler setBackgroundImages et setMarkerLinks
      return { type: "image" as const, state: lastState };
    }

    if (sketchCanUndo && branch) {
      const newIndex = branch.historyIndex - 1;
      const prevEntry = branch.history[newIndex];
      loadSketchData(prevEntry.sketch);

      const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
      const updatedBranch = { ...branch, historyIndex: newIndex };
      const newBranches = [...branches];
      newBranches[branchIndex] = updatedBranch;
      setBranches(newBranches);
      branchesRef.current = { branches: newBranches, activeBranchId };
      historyRef.current = { history: branch.history, index: newIndex };
      setPreviewHistoryIndex(null);
      return { type: "sketch" as const };
    }
  }, [branches, activeBranchId, loadSketchData, imageHistory]);

  // === Redo ===
  const redo = useCallback(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    const sketchCanRedo = branch && branch.historyIndex < branch.history.length - 1;

    if (sketchCanRedo && branch) {
      const newIndex = branch.historyIndex + 1;
      const nextEntry = branch.history[newIndex];
      loadSketchData(nextEntry.sketch);

      const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
      const updatedBranch = { ...branch, historyIndex: newIndex };
      const newBranches = [...branches];
      newBranches[branchIndex] = updatedBranch;
      setBranches(newBranches);
      branchesRef.current = { branches: newBranches, activeBranchId };
      historyRef.current = { history: branch.history, index: newIndex };
      setPreviewHistoryIndex(null);
    }
  }, [branches, activeBranchId, loadSketchData]);

  // === Aller à un index ===
  const goToHistoryIndex = useCallback((targetIndex: number) => {
    const branch = branches.find((b) => b.id === activeBranchId);
    if (!branch || targetIndex < 0 || targetIndex >= branch.history.length) return;

    const entry = branch.history[targetIndex];
    loadSketchData(entry.sketch);

    const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
    const updatedBranch = { ...branch, historyIndex: targetIndex };
    const newBranches = [...branches];
    newBranches[branchIndex] = updatedBranch;
    setBranches(newBranches);
    branchesRef.current = { branches: newBranches, activeBranchId };
    historyRef.current = { history: branch.history, index: targetIndex };
    setPreviewHistoryIndex(null);
    toast.success(`Retour à: ${entry.description}`);
  }, [branches, activeBranchId, loadSketchData]);

  // === Créer branche depuis historique ===
  const createBranchFromHistoryIndex = useCallback((targetIndex: number, branchName?: string) => {
    const parentBranch = branches.find((b) => b.id === activeBranchId);
    if (!parentBranch || targetIndex < 0 || targetIndex >= parentBranch.history.length) return;

    if (branches.length >= 10) {
      toast.error("Maximum 10 branches atteint");
      return;
    }

    const entry = parentBranch.history[targetIndex];
    const usedColors = new Set(branches.map((b) => b.color));
    const nextColor = BRANCH_COLORS.find((c) => !usedColors.has(c)) || BRANCH_COLORS[branches.length % BRANCH_COLORS.length];

    let branchNumber = branches.length + 1;
    const existingNames = new Set(branches.map((b) => b.name));
    while (existingNames.has(`Branche ${branchNumber}`)) {
      branchNumber++;
    }

    const newBranchId = generateId();
    const newBranch: Branch = {
      id: newBranchId,
      name: branchName || `Branche ${branchNumber}`,
      color: nextColor,
      history: parentBranch.history.slice(0, targetIndex + 1),
      historyIndex: targetIndex,
      parentBranchId: activeBranchId,
      parentHistoryIndex: targetIndex,
      createdAt: Date.now(),
    };

    loadSketchData(entry.sketch);

    const newBranches = [...branches, newBranch];
    setBranches(newBranches);
    setActiveBranchId(newBranchId);
    setVisibleBranches((prev) => new Set([...prev, newBranchId]));
    branchesRef.current = { branches: newBranches, activeBranchId: newBranchId };
    historyRef.current = { history: newBranch.history, index: targetIndex };
    setPreviewHistoryIndex(null);

    toast.success(`Nouvelle branche créée: ${newBranch.name}`);
  }, [branches, activeBranchId, loadSketchData]);

  // === Tronquer historique ===
  const truncateHistoryAtIndex = useCallback((targetIndex: number) => {
    const branch = branches.find((b) => b.id === activeBranchId);
    if (!branch || targetIndex < 0 || targetIndex >= branch.history.length) return;

    const entry = branch.history[targetIndex];
    loadSketchData(entry.sketch);

    const newHistory = branch.history.slice(0, targetIndex + 1);
    const deletedCount = branch.history.length - targetIndex - 1;

    const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
    const updatedBranch = { ...branch, history: newHistory, historyIndex: targetIndex };
    const newBranches = [...branches];
    newBranches[branchIndex] = updatedBranch;
    setBranches(newBranches);
    branchesRef.current = { branches: newBranches, activeBranchId };
    historyRef.current = { history: newHistory, index: targetIndex };
    setPreviewHistoryIndex(null);

    toast.success(`Historique tronqué: ${deletedCount} entrée(s) supprimée(s)`);
  }, [branches, activeBranchId, loadSketchData]);

  // === Supprimer état et suivants ===
  const deleteStateAndAfter = useCallback((targetIndex: number) => {
    const branch = branches.find((b) => b.id === activeBranchId);
    if (!branch || targetIndex <= 0 || targetIndex >= branch.history.length) return;

    const previousIndex = targetIndex - 1;
    const entry = branch.history[previousIndex];
    loadSketchData(entry.sketch);

    const newHistory = branch.history.slice(0, targetIndex);
    const deletedCount = branch.history.length - targetIndex;

    const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
    const updatedBranch = { ...branch, history: newHistory, historyIndex: previousIndex };
    const newBranches = [...branches];
    newBranches[branchIndex] = updatedBranch;
    setBranches(newBranches);
    branchesRef.current = { branches: newBranches, activeBranchId };
    historyRef.current = { history: newHistory, index: previousIndex };
    setPreviewHistoryIndex(null);

    toast.success(`${deletedCount} état(s) supprimé(s)`);
  }, [branches, activeBranchId, loadSketchData]);

  // === Switcher de branche ===
  const switchToBranch = useCallback((branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;

    const entry = branch.history[branch.historyIndex];
    loadSketchData(entry.sketch);

    setActiveBranchId(branchId);
    branchesRef.current = { ...branchesRef.current, activeBranchId: branchId };
    historyRef.current = { history: branch.history, index: branch.historyIndex };
    setPreviewHistoryIndex(null);

    toast.success(`Branche active: ${branch.name}`);
  }, [branches, loadSketchData]);

  // === Supprimer branche ===
  const deleteBranch = useCallback((branchId: string) => {
    if (branches.length <= 1) {
      toast.error("Impossible de supprimer la dernière branche");
      return;
    }

    const branchIndex = branches.findIndex((b) => b.id === branchId);
    if (branchIndex === -1) return;

    const branchName = branches[branchIndex].name;
    const newBranches = branches.filter((b) => b.id !== branchId);

    let newActiveBranchId = activeBranchId;
    if (activeBranchId === branchId) {
      newActiveBranchId = newBranches[0].id;
      const newActiveBranch = newBranches[0];
      loadSketchData(newActiveBranch.history[newActiveBranch.historyIndex].sketch);
    }

    setBranches(newBranches);
    setActiveBranchId(newActiveBranchId);
    setVisibleBranches((prev) => {
      const newSet = new Set(prev);
      newSet.delete(branchId);
      return newSet;
    });
    branchesRef.current = { branches: newBranches, activeBranchId: newActiveBranchId };

    toast.success(`Branche supprimée: ${branchName}`);
  }, [branches, activeBranchId, loadSketchData]);

  // === Toggle visibilité ===
  const toggleBranchVisibility = useCallback((branchId: string) => {
    setVisibleBranches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        if (branchId !== activeBranchId) {
          newSet.delete(branchId);
        }
      } else {
        newSet.add(branchId);
      }
      return newSet;
    });
  }, [activeBranchId]);

  // === Renommer branche ===
  const renameBranch = useCallback((branchId: string, newName: string) => {
    const branchIndex = branches.findIndex((b) => b.id === branchId);
    if (branchIndex === -1) return;

    const newBranches = [...branches];
    newBranches[branchIndex] = { ...newBranches[branchIndex], name: newName };
    setBranches(newBranches);
    branchesRef.current = { ...branchesRef.current, branches: newBranches };

    toast.success(`Branche renommée: ${newName}`);
  }, [branches]);

  // === Dupliquer branche ===
  const duplicateBranch = useCallback((branchId: string) => {
    if (branches.length >= 10) {
      toast.error("Maximum 10 branches atteint");
      return;
    }

    const sourceBranch = branches.find((b) => b.id === branchId);
    if (!sourceBranch) return;

    const usedColors = new Set(branches.map((b) => b.color));
    const nextColor = BRANCH_COLORS.find((c) => !usedColors.has(c)) || BRANCH_COLORS[branches.length % BRANCH_COLORS.length];

    const newBranchId = generateId();
    const newBranch: Branch = {
      id: newBranchId,
      name: `${sourceBranch.name} (copie)`,
      color: nextColor,
      history: [...sourceBranch.history],
      historyIndex: sourceBranch.historyIndex,
      parentBranchId: branchId,
      parentHistoryIndex: sourceBranch.historyIndex,
      createdAt: Date.now(),
    };

    const newBranches = [...branches, newBranch];
    setBranches(newBranches);
    setVisibleBranches((prev) => new Set([...prev, newBranchId]));
    branchesRef.current = { ...branchesRef.current, branches: newBranches };

    toast.success(`Branche dupliquée: ${newBranch.name}`);
  }, [branches]);

  return {
    // États des branches
    branches,
    setBranches,
    activeBranchId,
    setActiveBranchId,
    
    // Historique courant
    history,
    historyIndex,
    
    // Refs
    branchesRef,
    historyRef,
    
    // Mode comparaison
    comparisonMode,
    setComparisonMode,
    comparisonStyle,
    setComparisonStyle,
    visibleBranches,
    setVisibleBranches,
    comparisonOpacity,
    setComparisonOpacity,
    revealPosition,
    setRevealPosition,
    revealBranchId,
    setRevealBranchId,
    isDraggingReveal,
    setIsDraggingReveal,
    isDraggingRevealRef,
    
    // Panneau historique
    showHistoryPanel,
    setShowHistoryPanel,
    previewHistoryIndex,
    setPreviewHistoryIndex,
    
    // Modales branches
    showComparisonModal,
    setShowComparisonModal,
    showOverviewModal,
    setShowOverviewModal,
    comparisonModalPos,
    setComparisonModalPos,
    renamingBranchId,
    setRenamingBranchId,
    renamingValue,
    setRenamingValue,
    mergeBranchIds,
    setMergeBranchIds,
    
    // Historique images
    imageHistory,
    setImageHistory,
    imageHistoryRef,
    addToImageHistory,
    
    // Fonctions principales
    getActiveBranch,
    addToHistory,
    undo,
    redo,
    goToHistoryIndex,
    createBranchFromHistoryIndex,
    truncateHistoryAtIndex,
    deleteStateAndAfter,
    switchToBranch,
    deleteBranch,
    toggleBranchVisibility,
    renameBranch,
    duplicateBranch,
    
    // Helpers
    canUndo,
    canRedo,
    activeBranchColor,
    BRANCH_COLORS,
  };
}

export default useSketchHistory;
