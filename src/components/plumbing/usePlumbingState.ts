// ============================================
// HOOK: usePlumbingState
// Gestion de l'état du schéma plomberie
// VERSION: 1.0
// ============================================

import { useCallback, useState, useRef } from "react";
import { useNodesState, useEdgesState, Connection, addEdge } from "@xyflow/react";
import {
  PlumbingNodeType,
  PlumbingEdgeType,
  PlumbingBlockData,
  PlumbingEdgeData,
  PlumbingSchemaState,
  generateId,
  WaterType,
  ElectricalType,
} from "./types";

interface HistoryEntry {
  nodes: PlumbingNodeType[];
  edges: PlumbingEdgeType[];
  timestamp: number;
}

export function usePlumbingState(maxHistorySize = 50) {
  const [nodes, setNodes, onNodesChange] = useNodesState<PlumbingNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PlumbingEdgeType>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);

  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoRef = useRef<boolean>(false);

  // ============================================
  // HISTORIQUE
  // ============================================

  const saveToHistory = useCallback(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const entry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now(),
    };

    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(entry);

    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    } else {
      historyIndexRef.current++;
    }

    historyRef.current = newHistory;
  }, [nodes, edges, maxHistorySize]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    const entry = historyRef.current[historyIndexRef.current];
    if (entry) {
      setNodes(entry.nodes);
      setEdges(entry.edges);
    }
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    const entry = historyRef.current[historyIndexRef.current];
    if (entry) {
      setNodes(entry.nodes);
      setEdges(entry.edges);
    }
  }, [setNodes, setEdges]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  // ============================================
  // ACTIONS NODES
  // ============================================

  const addNode = useCallback(
    (data: PlumbingBlockData, position?: { x: number; y: number }): PlumbingNodeType => {
      const newNode: PlumbingNodeType = {
        id: generateId(),
        type: "plumbingBlock",
        position: position || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
        data: { ...data, width: data.width || 180, height: data.height || 100 },
      };
      setNodes((prev) => [...prev, newNode]);
      saveToHistory();
      return newNode;
    },
    [setNodes, saveToHistory]
  );

  const updateNode = useCallback(
    (nodeId: string, data: Partial<PlumbingBlockData>) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        )
      );
      saveToHistory();
    },
    [setNodes, saveToHistory]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setEdges((prev) => prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setNodes((prev) => prev.filter((node) => node.id !== nodeId));
      saveToHistory();
    },
    [setNodes, setEdges, saveToHistory]
  );

  const duplicateNode = useCallback(
    (nodeId: string): PlumbingNodeType | null => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return null;

      const newNode: PlumbingNodeType = {
        ...node,
        id: generateId(),
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data },
      };
      setNodes((prev) => [...prev, newNode]);
      saveToHistory();
      return newNode;
    },
    [nodes, setNodes, saveToHistory]
  );

  // ============================================
  // ACTIONS EDGES
  // ============================================

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const sourceHandleId = connection.sourceHandle || "";
      const isWaterConnection = sourceHandleId.startsWith("water_");

      let edgeData: PlumbingEdgeData;

      if (isWaterConnection) {
        const parts = sourceHandleId.split("_");
        const waterType = (parts[2] as WaterType) || "cold";
        edgeData = {
          connectionType: "water",
          waterType,
          pipe_diameter: sourceNode.data.pipe_diameter || 12,
          thread_type: sourceNode.data.thread_type,
        };
      } else {
        // Analyser le handle ID pour extraire le type électrique et le fil
        // Format: elec_TYPE_direction_index (ex: elec_230v-L_out_0, elec_pe_0, elec_12v+_out_0)
        const handleLower = sourceHandleId.toLowerCase();
        
        let elecType: ElectricalType = "12v";
        let wire: Wire230V | undefined;
        let polarity: Polarity12V | undefined;
        
        // Détection terre (PE) - doit être avant 230V car pe peut être seul
        // Format: elec_pe_0 ou elec_pe_in_0 ou elec_pe_out_0
        if (handleLower.includes("elec_pe") || handleLower.includes("_pe_")) {
          elecType = "230v";
          wire = "earth";
        }
        // Détection 230V Phase
        else if (handleLower.includes("230v-l") || handleLower.includes("230v_l")) {
          elecType = "230v";
          wire = "phase";
        }
        // Détection 230V Neutre
        else if (handleLower.includes("230v-n") || handleLower.includes("230v_n")) {
          elecType = "230v";
          wire = "neutral";
        }
        // Détection 12V
        else if (handleLower.includes("12v")) {
          elecType = "12v";
          if (handleLower.includes("12v+")) {
            polarity = "positive";
          } else if (handleLower.includes("12v-")) {
            polarity = "negative";
          } else {
            polarity = "positive"; // Défaut
          }
        }
        
        console.log("[usePlumbingState v1.2] Connexion électrique:", {
          handleId: sourceHandleId,
          elecType,
          wire,
          polarity
        });
        
        edgeData = {
          connectionType: "electrical",
          electricalType: elecType,
          polarity,
          wire,
          cable_section: sourceNode.data.cable_section || 1.5,
        };
      }

      const newEdge: PlumbingEdgeType = {
        id: `edge_${generateId()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "plumbingEdge",
        data: edgeData,
      };

      setEdges((prev) => addEdge(newEdge, prev));
      saveToHistory();
    },
    [nodes, setEdges, saveToHistory]
  );

  const updateEdge = useCallback(
    (edgeId: string, data: Partial<PlumbingEdgeData>) => {
      setEdges((prev) =>
        prev.map((edge) =>
          edge.id === edgeId ? { ...edge, data: { ...edge.data, ...data } } : edge
        )
      );
      saveToHistory();
    },
    [setEdges, saveToHistory]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((prev) => prev.filter((edge) => edge.id !== edgeId));
      saveToHistory();
    },
    [setEdges, saveToHistory]
  );

  // ============================================
  // SÉLECTION
  // ============================================

  const selectAll = useCallback(() => {
    setSelectedNodes(nodes.map((n) => n.id));
    setSelectedEdges(edges.map((e) => e.id));
  }, [nodes, edges]);

  const clearSelection = useCallback(() => {
    setSelectedNodes([]);
    setSelectedEdges([]);
  }, []);

  const deleteSelected = useCallback(() => {
    setEdges((prev) => prev.filter((edge) => !selectedEdges.includes(edge.id)));
    const nodesToDelete = new Set(selectedNodes);
    setEdges((prev) =>
      prev.filter((edge) => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target))
    );
    setNodes((prev) => prev.filter((node) => !selectedNodes.includes(node.id)));
    clearSelection();
    saveToHistory();
  }, [selectedNodes, selectedEdges, setNodes, setEdges, clearSelection, saveToHistory]);

  // ============================================
  // IMPORT/EXPORT
  // ============================================

  const exportSchema = useCallback((): PlumbingSchemaState => {
    return {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
  }, [nodes, edges]);

  const importSchema = useCallback(
    (schema: PlumbingSchemaState) => {
      if (schema.nodes) setNodes(schema.nodes);
      if (schema.edges) setEdges(schema.edges);
      saveToHistory();
    },
    [setNodes, setEdges, saveToHistory]
  );

  const clearSchema = useCallback(() => {
    setNodes([]);
    setEdges([]);
    clearSelection();
    saveToHistory();
  }, [setNodes, setEdges, clearSelection, saveToHistory]);

  // ============================================
  // UTILITAIRES
  // ============================================

  const getNodeById = useCallback(
    (id: string) => nodes.find((n) => n.id === id),
    [nodes]
  );

  const getEdgeById = useCallback(
    (id: string) => edges.find((e) => e.id === id),
    [edges]
  );

  const getConnectedEdges = useCallback(
    (nodeId: string) => edges.filter((e) => e.source === nodeId || e.target === nodeId),
    [edges]
  );

  return {
    nodes,
    edges,
    selectedNodes,
    selectedEdges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    addNode,
    updateNode,
    deleteNode,
    duplicateNode,
    onConnect,
    updateEdge,
    deleteEdge,
    setSelectedNodes,
    setSelectedEdges,
    selectAll,
    clearSelection,
    deleteSelected,
    undo,
    redo,
    canUndo,
    canRedo,
    saveToHistory,
    exportSchema,
    importSchema,
    clearSchema,
    getNodeById,
    getEdgeById,
    getConnectedEdges,
  };
}

export default usePlumbingState;
