// ============================================
// HOOK: useContextMenu
// VERSION: 1.0
// Description: Gestion du menu contextuel (clic droit)
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";

// ============================================
// TYPES
// ============================================

export interface ContextMenuState {
  x: number;
  y: number;
  entityId: string;
  entityType: string;
  shapeGeoIds?: string[];
  shapePath?: Path2D;
}

export interface ArcEditDialogState {
  open: boolean;
  arcId: string;
  currentRadius: number;
}

export interface LineLengthDialogState {
  open: boolean;
  lineId: string;
  currentLength: number;
  newLength: string;
  anchorMode: "p1" | "p2" | "center";
  originalSketch: any | null;
}

export interface UseContextMenuReturn {
  // Menu contextuel
  contextMenu: ContextMenuState | null;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  
  // Dialog modification arc
  arcEditDialog: ArcEditDialogState | null;
  setArcEditDialog: React.Dispatch<React.SetStateAction<ArcEditDialogState | null>>;
  
  // Dialog modification longueur ligne
  lineLengthDialog: LineLengthDialogState | null;
  setLineLengthDialog: React.Dispatch<React.SetStateAction<LineLengthDialogState | null>>;
  lineLengthPanelPos: { x: number; y: number };
  setLineLengthPanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  lineLengthPanelDragging: boolean;
  setLineLengthPanelDragging: React.Dispatch<React.SetStateAction<boolean>>;
  lineLengthPanelDragStart: { x: number; y: number };
  setLineLengthPanelDragStart: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Fonctions
  openContextMenu: (x: number, y: number, entityId: string, entityType: string, options?: { shapeGeoIds?: string[]; shapePath?: Path2D }) => void;
  closeContextMenu: () => void;
  openArcEditDialog: (arcId: string, currentRadius: number) => void;
  closeArcEditDialog: () => void;
  openLineLengthDialog: (lineId: string, currentLength: number, x: number, y: number, originalSketch?: any) => void;
  closeLineLengthDialog: () => void;
  
  // Position ajustée pour rester dans l'écran
  getAdjustedMenuPosition: (x: number, y: number, menuWidth?: number, menuHeight?: number) => { x: number; y: number };
}

// ============================================
// HOOK
// ============================================

export function useContextMenu(): UseContextMenuReturn {
  
  // === Menu contextuel ===
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  // === Dialog modification arc ===
  const [arcEditDialog, setArcEditDialog] = useState<ArcEditDialogState | null>(null);
  
  // === Dialog modification longueur ligne ===
  const [lineLengthDialog, setLineLengthDialog] = useState<LineLengthDialogState | null>(null);
  const [lineLengthPanelPos, setLineLengthPanelPos] = useState({ x: 100, y: 100 });
  const [lineLengthPanelDragging, setLineLengthPanelDragging] = useState(false);
  const [lineLengthPanelDragStart, setLineLengthPanelDragStart] = useState({ x: 0, y: 0 });
  
  // === Fonctions ===
  
  const openContextMenu = useCallback((
    x: number,
    y: number,
    entityId: string,
    entityType: string,
    options?: { shapeGeoIds?: string[]; shapePath?: Path2D }
  ) => {
    setContextMenu({
      x,
      y,
      entityId,
      entityType,
      shapeGeoIds: options?.shapeGeoIds,
      shapePath: options?.shapePath,
    });
  }, []);
  
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  const openArcEditDialog = useCallback((arcId: string, currentRadius: number) => {
    setArcEditDialog({
      open: true,
      arcId,
      currentRadius,
    });
    closeContextMenu();
  }, [closeContextMenu]);
  
  const closeArcEditDialog = useCallback(() => {
    setArcEditDialog(null);
  }, []);
  
  const openLineLengthDialog = useCallback((
    lineId: string,
    currentLength: number,
    x: number,
    y: number,
    originalSketch?: any
  ) => {
    setLineLengthDialog({
      open: true,
      lineId,
      currentLength,
      newLength: currentLength.toFixed(2),
      anchorMode: "center",
      originalSketch: originalSketch || null,
    });
    setLineLengthPanelPos({ x: x + 10, y });
    closeContextMenu();
  }, [closeContextMenu]);
  
  const closeLineLengthDialog = useCallback(() => {
    setLineLengthDialog(null);
  }, []);
  
  const getAdjustedMenuPosition = useCallback((
    x: number,
    y: number,
    menuWidth: number = 200,
    menuHeight: number = 150
  ): { x: number; y: number } => {
    const padding = 10;
    let adjustedX = x;
    let adjustedY = y;
    
    // Ajuster X si le menu dépasse à droite
    if (x + menuWidth > window.innerWidth - padding) {
      adjustedX = x - menuWidth;
      if (adjustedX < padding) adjustedX = padding;
    }
    
    // Ajuster Y si le menu dépasse en bas
    if (y + menuHeight > window.innerHeight - padding) {
      adjustedY = y - menuHeight;
      if (adjustedY < padding) adjustedY = padding;
    }
    
    return { x: adjustedX, y: adjustedY };
  }, []);
  
  // === Fermer le menu contextuel quand on clique ailleurs ===
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Le menu se ferme via onClick dans le composant parent
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
        closeArcEditDialog();
        closeLineLengthDialog();
      }
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeContextMenu, closeArcEditDialog, closeLineLengthDialog]);
  
  return {
    // Menu contextuel
    contextMenu,
    setContextMenu,
    
    // Dialog modification arc
    arcEditDialog,
    setArcEditDialog,
    
    // Dialog modification longueur ligne
    lineLengthDialog,
    setLineLengthDialog,
    lineLengthPanelPos,
    setLineLengthPanelPos,
    lineLengthPanelDragging,
    setLineLengthPanelDragging,
    lineLengthPanelDragStart,
    setLineLengthPanelDragStart,
    
    // Fonctions
    openContextMenu,
    closeContextMenu,
    openArcEditDialog,
    closeArcEditDialog,
    openLineLengthDialog,
    closeLineLengthDialog,
    getAdjustedMenuPosition,
  };
}

export default useContextMenu;
