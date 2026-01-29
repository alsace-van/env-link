// ============================================
// COMPOSANT: PlumbingCanvas
// Schéma circuit d'eau interactif avec ReactFlow
// VERSION: 1.1 - Ajout plein écran
// ============================================

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";

import {
  PlumbingNodeType,
  PlumbingEdgeType,
  PlumbingBlockData,
  CATEGORY_COLORS,
  WATER_COLORS,
  calculateTotalCapacity,
  calculateTotalPower,
  countFittings,
} from "./types";

import { usePlumbingState } from "./usePlumbingState";
import { usePlumbingSave } from "./usePlumbingSave";
import { usePlumbingCatalog } from "./usePlumbingCatalog";

import PlumbingNodeComponent from "./PlumbingNode";
import PlumbingEdgeComponent from "./PlumbingEdge";
import { PlumbingToolbar } from "./PlumbingToolbar";
import { PlumbingPropertiesPanel } from "./PlumbingPropertiesPanel";

import { Badge } from "@/components/ui/badge";
import { Droplets, Zap, Package } from "lucide-react";

interface PlumbingCanvasProps {
  projectId?: string | null;
  onSave?: (data: any) => void;
}

const nodeTypes = {
  plumbingBlock: PlumbingNodeComponent,
};

const edgeTypes = {
  plumbingEdge: PlumbingEdgeComponent,
};

function PlumbingCanvasInner({ projectId, onSave }: PlumbingCanvasProps) {
  const reactFlowInstance = useReactFlow();

  const {
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
    exportSchema,
    importSchema,
    clearSchema,
    getNodeById,
    getEdgeById,
  } = usePlumbingState();

  const {
    isSaving,
    hasUnsavedChanges,
    saveToProject,
    loadFromProject,
    markAsChanged,
  } = usePlumbingSave(nodes, edges, {
    projectId,
    enabled: !!projectId,
    autoSaveEnabled: true,
    autoSaveDelayMs: 3000,
  });

  const {
    catalogItems,
    quoteItems,
    isLoadingCatalog,
    loadCatalog,
    searchCatalog,
    addToQuote,
    isInQuote,
    catalogToBlockData,
    quoteToBlockData,
  } = usePlumbingCatalog({ projectId });

  const [showProperties, setShowProperties] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gestion plein écran
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("[PlumbingCanvas] Erreur fullscreen:", err);
        toast.error("Impossible d'activer le plein écran");
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Écouter les changements de fullscreen (ex: touche Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const selectedNode = useMemo(() => {
    if (selectedNodes.length === 1) return getNodeById(selectedNodes[0]) || null;
    return null;
  }, [selectedNodes, getNodeById]);

  const selectedEdge = useMemo(() => {
    if (selectedEdges.length === 1 && selectedNodes.length === 0) return getEdgeById(selectedEdges[0]) || null;
    return null;
  }, [selectedEdges, selectedNodes, getEdgeById]);

  const stats = useMemo(() => {
    const capacity = calculateTotalCapacity(nodes);
    const power = calculateTotalPower(nodes);
    return {
      totalFreshWater: capacity.freshWater,
      totalGreyWater: capacity.greyWater,
      totalHotWater: capacity.hotWater,
      power12v: power.power12v,
      power230v: power.power230v,
      nodesCount: nodes.length,
      edgesCount: edges.length,
    };
  }, [nodes, edges]);

  // Chargement initial
  useEffect(() => {
    if (projectId) {
      loadFromProject().then((schema) => {
        if (schema) importSchema(schema);
      });
    }
    // Charger le catalogue automatiquement
    loadCatalog();
  }, [projectId]);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) markAsChanged();
  }, [nodes, edges]);

  const handleAddElement = useCallback(
    (data: PlumbingBlockData) => {
      const position = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      addNode({ ...data, width: 180, height: 100 }, position);
      toast.success(`${data.label} ajouté`);
    },
    [addNode, reactFlowInstance]
  );

  const handleAddFromCatalog = useCallback(
    (item: any) => handleAddElement(catalogToBlockData(item)),
    [catalogToBlockData, handleAddElement]
  );

  const handleAddFromQuote = useCallback(
    (item: any) => handleAddElement(quoteToBlockData(item)),
    [quoteToBlockData, handleAddElement]
  );

  const handleSave = useCallback(() => {
    if (projectId) saveToProject();
    if (onSave) onSave(exportSchema());
  }, [projectId, saveToProject, onSave, exportSchema]);

  const handleExport = useCallback(() => {
    const schema = exportSchema();
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plumbing-schema-${projectId || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Schéma exporté");
  }, [exportSchema, projectId]);

  const handleClear = useCallback(() => {
    if ((nodes.length > 0 || edges.length > 0) && window.confirm("Voulez-vous vraiment effacer tout le schéma ?")) {
      clearSchema();
      toast.success("Schéma effacé");
    }
  }, [nodes.length, edges.length, clearSchema]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedNodes.length === 1) {
      const newNode = duplicateNode(selectedNodes[0]);
      if (newNode) {
        setSelectedNodes([newNode.id]);
        toast.success("Élément dupliqué");
      }
    }
  }, [selectedNodes, duplicateNode, setSelectedNodes]);

  const handleAddToQuote = useCallback(
    (node: PlumbingNodeType) => {
      if (node.data.accessory_id) addToQuote(node.data);
    },
    [addToQuote]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: PlumbingNodeType[]; edges: PlumbingEdgeType[] }) => {
      setSelectedNodes(selNodes.map((n) => n.id));
      setSelectedEdges(selEdges.map((e) => e.id));
    },
    [setSelectedNodes, setSelectedEdges]
  );

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey && e.key === "y") || (e.ctrlKey && e.shiftKey && e.key === "z")) { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === "d") { e.preventDefault(); handleDuplicateSelected(); }
      if (e.ctrlKey && e.key === "a") { e.preventDefault(); selectAll(); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
      if (e.key === "Escape") clearSelection();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, undo, redo, handleDuplicateSelected, selectAll, deleteSelected, clearSelection]);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-white">
      <PlumbingToolbar
        onAddElement={handleAddElement}
        onSave={handleSave}
        onExport={handleExport}
        onClear={handleClear}
        onUndo={undo}
        onRedo={redo}
        onDeleteSelected={deleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={selectedNodes.length > 0 || selectedEdges.length > 0}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        catalogItems={catalogItems}
        quoteItems={quoteItems}
        isLoadingCatalog={isLoadingCatalog}
        onLoadCatalog={loadCatalog}
        onSearchCatalog={searchCatalog}
        onAddFromCatalog={handleAddFromCatalog}
        onAddFromQuote={handleAddFromQuote}
        catalogToBlockData={catalogToBlockData}
        quoteToBlockData={quoteToBlockData}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: "plumbingEdge", animated: false }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            snapToGrid
            snapGrid={[10, 10]}
            deleteKeyCode={null}
            multiSelectionKeyCode="Shift"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E5E7EB" />
            <Controls />
            <MiniMap
              nodeColor={(node) => CATEGORY_COLORS[(node.data as PlumbingBlockData)?.category] || "#6B7280"}
              maskColor="rgba(255, 255, 255, 0.8)"
            />

            <Panel position="bottom-left" className="bg-white/90 rounded-lg shadow-lg p-3 m-2">
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <Droplets className="h-4 w-4" style={{ color: WATER_COLORS.cold }} />
                  <span>{stats.totalFreshWater}L</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="h-4 w-4" style={{ color: WATER_COLORS.hot }} />
                  <span>{stats.totalHotWater}L</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="h-4 w-4" style={{ color: WATER_COLORS.waste }} />
                  <span>{stats.totalGreyWater}L</span>
                </div>
                {stats.power12v > 0 && (
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span>{stats.power12v}W 12V</span>
                  </div>
                )}
                {stats.power230v > 0 && (
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-purple-500" />
                    <span>{stats.power230v}W 230V</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-gray-500">
                  <Package className="h-4 w-4" />
                  <span>{stats.nodesCount} éléments</span>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {showProperties && (
          <PlumbingPropertiesPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onUpdateNode={updateNode}
            onUpdateEdge={updateEdge}
            onDeleteNode={deleteNode}
            onDeleteEdge={deleteEdge}
            onDuplicateNode={(id) => {
              const newNode = duplicateNode(id);
              if (newNode) setSelectedNodes([newNode.id]);
            }}
            onAddToQuote={handleAddToQuote}
            isInQuote={isInQuote}
            onClose={() => setShowProperties(false)}
          />
        )}
      </div>
    </div>
  );
}

export function PlumbingCanvas(props: PlumbingCanvasProps) {
  return (
    <ReactFlowProvider>
      <PlumbingCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default PlumbingCanvas;
