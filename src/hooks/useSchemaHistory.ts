// ============================================
// useSchemaHistory.ts
// Hook pour gérer l'historique Undo/Redo du schéma
// VERSION: 1.0
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";

export interface SchemaState {
  items: any[];
  edges: any[];
  positions: Record<string, { x: number; y: number }>;
  nodeHandles: Record<string, any>;
  annotations?: any[];
}

interface HistoryEntry {
  state: SchemaState;
  timestamp: number;
  action: string;
}

interface UseSchemaHistoryOptions {
  maxHistory?: number;
  debounceMs?: number;
}

export function useSchemaHistory(
  initialState: SchemaState,
  options: UseSchemaHistoryOptions = {}
) {
  const { maxHistory = 50, debounceMs = 300 } = options;

  const [history, setHistory] = useState<HistoryEntry[]>([
    { state: initialState, timestamp: Date.now(), action: "initial" },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const lastSaveRef = useRef<number>(Date.now());
  const pendingStateRef = useRef<SchemaState | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // État actuel
  const currentState = history[currentIndex]?.state || initialState;

  // Peut-on annuler ?
  const canUndo = currentIndex > 0;

  // Peut-on refaire ?
  const canRedo = currentIndex < history.length - 1;

  // Sauvegarder un nouvel état dans l'historique (avec debounce)
  const saveState = useCallback(
    (newState: SchemaState, action: string = "edit") => {
      pendingStateRef.current = newState;

      // Debounce pour éviter trop d'entrées lors d'éditions rapides
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const now = Date.now();
        
        setHistory((prev) => {
          // Supprimer les états futurs si on a fait undo puis édité
          const newHistory = prev.slice(0, currentIndex + 1);

          // Ajouter le nouvel état
          newHistory.push({
            state: pendingStateRef.current!,
            timestamp: now,
            action,
          });

          // Limiter la taille de l'historique
          if (newHistory.length > maxHistory) {
            return newHistory.slice(-maxHistory);
          }

          return newHistory;
        });

        setCurrentIndex((prev) => Math.min(prev + 1, maxHistory - 1));
        lastSaveRef.current = now;
        pendingStateRef.current = null;
      }, debounceMs);
    },
    [currentIndex, maxHistory, debounceMs]
  );

  // Sauvegarder immédiatement (sans debounce)
  const saveStateImmediate = useCallback(
    (newState: SchemaState, action: string = "edit") => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const now = Date.now();

      setHistory((prev) => {
        const newHistory = prev.slice(0, currentIndex + 1);
        newHistory.push({
          state: newState,
          timestamp: now,
          action,
        });

        if (newHistory.length > maxHistory) {
          return newHistory.slice(-maxHistory);
        }

        return newHistory;
      });

      setCurrentIndex((prev) => Math.min(prev + 1, maxHistory - 1));
      lastSaveRef.current = now;
    },
    [currentIndex, maxHistory]
  );

  // Annuler (Undo)
  const undo = useCallback(() => {
    if (canUndo) {
      setCurrentIndex((prev) => prev - 1);
      return history[currentIndex - 1]?.state || null;
    }
    return null;
  }, [canUndo, currentIndex, history]);

  // Refaire (Redo)
  const redo = useCallback(() => {
    if (canRedo) {
      setCurrentIndex((prev) => prev + 1);
      return history[currentIndex + 1]?.state || null;
    }
    return null;
  }, [canRedo, currentIndex, history]);

  // Réinitialiser l'historique
  const resetHistory = useCallback((newInitialState: SchemaState) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHistory([
      { state: newInitialState, timestamp: Date.now(), action: "reset" },
    ]);
    setCurrentIndex(0);
  }, []);

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Raccourcis clavier Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) && e.key === "y" ||
        (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z"
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    currentState,
    canUndo,
    canRedo,
    undo,
    redo,
    saveState,
    saveStateImmediate,
    resetHistory,
    historyLength: history.length,
    currentIndex,
  };
}
