// ============================================
// COMPOSANT: PlumbingCanvas
// Schéma circuit d'eau interactif avec ReactFlow
// VERSION: 1.3 - Menu contextuel, dérivations, regroupement câbles
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
  PlumbingEdgeData,
  CATEGORY_COLORS,
  WATER_COLORS,
  ELECTRICAL_CONNECTOR_COLORS,
  ElectricalConnectorType,
  WaterType,
  ConnectorConfig,
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
import { PlumbingContextMenu, ContextMenuType } from "./PlumbingContextMenu";

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

  // État du menu contextuel
  const [contextMenu, setContextMenu] = useState<{
    type: ContextMenuType;
    position: { x: number; y: number };
    edgeId?: string;
    nodeId?: string;
    flowPosition?: { x: number; y: number };
  } | null>(null);

  // Générer un ID unique
  const generateId = useCallback(() => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);
  const generateEdgeId = useCallback(() => `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

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

  // ============================================
  // MENU CONTEXTUEL - Handlers
  // ============================================

  // Clic droit sur un edge
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: PlumbingEdgeType) => {
      event.preventDefault();
      event.stopPropagation();
      
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        type: edge.data?.isGrouped ? "grouped-edge" : "edge",
        position: { x: event.clientX, y: event.clientY },
        edgeId: edge.id,
        flowPosition,
      });
    },
    [reactFlowInstance]
  );

  // Clic droit sur un nœud (pour les jonctions)
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: PlumbingNodeType) => {
      event.preventDefault();
      event.stopPropagation();

      const isJunction = node.data.label?.startsWith("Jonction");
      
      if (isJunction) {
        setContextMenu({
          type: "junction",
          position: { x: event.clientX, y: event.clientY },
          nodeId: node.id,
        });
      }
    },
    []
  );

  // Fermer le menu contextuel
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Ajouter un point de dérivation
  const handleAddDerivation = useCallback(
    (connectorType: ElectricalConnectorType | WaterType) => {
      if (!contextMenu?.edgeId || !contextMenu?.flowPosition) return;

      const edge = getEdgeById(contextMenu.edgeId);
      if (!edge) return;

      const isElectrical = edge.data?.connectionType === "electrical";
      const position = contextMenu.flowPosition;

      // Créer la configuration des connecteurs pour la jonction
      let connectorConfig: ConnectorConfig;
      let junctionLabel: string;
      let junctionColor: string;

      if (isElectrical) {
        const elecType = connectorType as ElectricalConnectorType;
        junctionLabel = `Jonction ${elecType}`;
        junctionColor = ELECTRICAL_CONNECTOR_COLORS[elecType];
        connectorConfig = {
          water: [],
          electrical: [
            { id: "e1", type: elecType, side: "left", direction: "bidirectional" },
            { id: "e2", type: elecType, side: "right", direction: "bidirectional" },
            { id: "e3", type: elecType, side: "bottom", direction: "bidirectional" },
          ],
        };
      } else {
        const waterType = connectorType as WaterType;
        junctionLabel = `Jonction ${waterType}`;
        junctionColor = WATER_COLORS[waterType];
        connectorConfig = {
          water: [
            { id: "w1", waterType, side: "left", direction: "bidirectional" },
            { id: "w2", waterType, side: "right", direction: "bidirectional" },
            { id: "w3", waterType, side: "bottom", direction: "bidirectional" },
          ],
          electrical: [],
        };
      }

      // Créer le nœud jonction
      const junctionId = generateId();
      const junctionNode: PlumbingNodeType = {
        id: junctionId,
        type: "plumbingBlock",
        position: { x: position.x - 12, y: position.y - 12 },
        data: {
          label: junctionLabel,
          category: "electrical",
          icon: "●",
          description: "Point de dérivation",
          connectorConfig,
          electricalType: "none",
        },
      };

      // Créer les 2 nouveaux edges (avant et après la jonction)
      const handlePrefix = isElectrical ? "elec" : "water";
      const sourceHandle = edge.sourceHandle;
      const targetHandle = edge.targetHandle;

      // Edge 1: source → jonction (entrée gauche)
      const edge1Id = generateEdgeId();
      const edge1: PlumbingEdgeType = {
        id: edge1Id,
        source: edge.source,
        target: junctionId,
        sourceHandle: sourceHandle,
        targetHandle: isElectrical 
          ? `elec_${connectorType}_bidirectional_0`
          : `water_bidirectional_${connectorType}_0`,
        type: "plumbingEdge",
        data: { ...edge.data },
      };

      // Edge 2: jonction (sortie droite) → target
      const edge2Id = generateEdgeId();
      const edge2: PlumbingEdgeType = {
        id: edge2Id,
        source: junctionId,
        target: edge.target,
        sourceHandle: isElectrical
          ? `elec_${connectorType}_bidirectional_1`
          : `water_bidirectional_${connectorType}_1`,
        targetHandle: targetHandle,
        type: "plumbingEdge",
        data: { ...edge.data },
      };

      // Mettre à jour les nodes et edges
      setNodes((nds) => [...nds, junctionNode]);
      setEdges((eds) => {
        return [...eds.filter((e) => e.id !== edge.id), edge1, edge2];
      });

      markAsChanged();
      toast.success(`Point de dérivation ${junctionLabel} ajouté`);
      closeContextMenu();
    },
    [contextMenu, getEdgeById, generateId, generateEdgeId, setNodes, setEdges, markAsChanged, closeContextMenu]
  );

  // Supprimer une jonction et reconnecter les edges
  const handleDeleteJunction = useCallback(() => {
    if (!contextMenu?.nodeId) return;

    const junctionId = contextMenu.nodeId;
    
    // Trouver tous les edges connectés à cette jonction
    const connectedEdges = edges.filter(
      (e) => e.source === junctionId || e.target === junctionId
    );

    if (connectedEdges.length === 2) {
      // Cas simple: 2 edges, on les fusionne
      const incomingEdge = connectedEdges.find((e) => e.target === junctionId);
      const outgoingEdge = connectedEdges.find((e) => e.source === junctionId);

      if (incomingEdge && outgoingEdge) {
        // Créer un nouvel edge qui connecte directement source → target
        const newEdgeId = generateEdgeId();
        const newEdge: PlumbingEdgeType = {
          id: newEdgeId,
          source: incomingEdge.source,
          target: outgoingEdge.target,
          sourceHandle: incomingEdge.sourceHandle,
          targetHandle: outgoingEdge.targetHandle,
          type: "plumbingEdge",
          data: { ...incomingEdge.data },
        };

        setEdges((eds) => [
          ...eds.filter((e) => !connectedEdges.some((ce) => ce.id === e.id)),
          newEdge,
        ]);
      }
    } else {
      // Plus de 2 edges ou moins: supprimer tous les edges connectés
      setEdges((eds) => eds.filter((e) => e.source !== junctionId && e.target !== junctionId));
    }

    // Supprimer le nœud jonction
    setNodes((nds) => nds.filter((n) => n.id !== junctionId));
    
    markAsChanged();
    toast.success("Jonction supprimée");
    closeContextMenu();
  }, [contextMenu, edges, generateEdgeId, setNodes, setEdges, markAsChanged, closeContextMenu]);

  // Supprimer un edge depuis le menu contextuel
  const handleDeleteEdgeFromMenu = useCallback(() => {
    if (!contextMenu?.edgeId) return;
    deleteEdge(contextMenu.edgeId);
    closeContextMenu();
  }, [contextMenu, deleteEdge, closeContextMenu]);

  // Regrouper les edges sélectionnés
  const handleGroupEdges = useCallback(() => {
    if (selectedEdges.length < 2) {
      toast.error("Sélectionnez au moins 2 câbles à regrouper");
      return;
    }

    const selectedEdgeObjs = edges.filter((e) => selectedEdges.includes(e.id));
    
    // Vérifier que tous les edges vont entre les mêmes nœuds
    const sources = new Set(selectedEdgeObjs.map((e) => e.source));
    const targets = new Set(selectedEdgeObjs.map((e) => e.target));
    
    if (sources.size !== 1 || targets.size !== 1) {
      toast.error("Les câbles doivent connecter les mêmes blocs");
      return;
    }

    const sourceId = selectedEdgeObjs[0].source;
    const targetId = selectedEdgeObjs[0].target;

    // TRIER les edges par index du handle source pour trouver celui du milieu
    const extractIndex = (handleId: string): number => {
      if (!handleId) return 0;
      const match = handleId.match(/_(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const sortedEdges = [...selectedEdgeObjs].sort((a, b) => 
      extractIndex(a.sourceHandle || "") - extractIndex(b.sourceHandle || "")
    );
    
    // Prendre le fil du MILIEU comme référence
    const middleIndex = Math.floor(sortedEdges.length / 2);
    const middleEdge = sortedEdges[middleIndex];
    
    console.log("[PlumbingCanvas v1.4] Edges triés:", sortedEdges.map(e => ({
      id: e.id,
      srcHandle: e.sourceHandle,
      srcIdx: extractIndex(e.sourceHandle || "")
    })));
    console.log("[PlumbingCanvas v1.4] Edge du milieu:", middleEdge.sourceHandle);

    // Créer un edge groupé - utiliser le handle du MILIEU comme référence
    const groupedEdgeId = generateEdgeId();
    const groupedEdge: PlumbingEdgeType = {
      id: groupedEdgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: middleEdge.sourceHandle, // Handle du fil du MILIEU
      targetHandle: middleEdge.targetHandle,
      type: "plumbingEdge",
      data: {
        connectionType: selectedEdgeObjs[0].data?.connectionType || "electrical",
        isGrouped: true,
        groupedEdges: sortedEdges.map((e) => ({
          id: e.id,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          data: { ...e.data },
        })),
        cable_section: Math.max(...selectedEdgeObjs.map((e) => e.data?.cable_section || 1.5)),
      },
    };

    console.log("[PlumbingCanvas v1.4] Regroupement de", selectedEdgeObjs.length, "câbles centré sur:", middleEdge.sourceHandle);

    // Remplacer les edges individuels par l'edge groupé
    setEdges((eds) => [
      ...eds.filter((e) => !selectedEdges.includes(e.id)),
      groupedEdge,
    ]);

    markAsChanged();
    toast.success(`${selectedEdges.length} câbles regroupés`);
    closeContextMenu();
    clearSelection();
  }, [selectedEdges, edges, generateEdgeId, setEdges, markAsChanged, closeContextMenu, clearSelection]);

  // Dégrouper un câble
  const handleUngroupEdge = useCallback(() => {
    if (!contextMenu?.edgeId) return;

    const groupedEdge = getEdgeById(contextMenu.edgeId);
    if (!groupedEdge || !groupedEdge.data?.isGrouped) return;

    const storedEdges = groupedEdge.data.groupedEdges || [];

    // Restaurer les edges individuels
    const restoredEdges: PlumbingEdgeType[] = storedEdges.map((stored: any) => ({
      id: stored.id || generateEdgeId(),
      source: groupedEdge.source,
      target: groupedEdge.target,
      sourceHandle: stored.sourceHandle,
      targetHandle: stored.targetHandle,
      type: "plumbingEdge",
      data: stored.data,
    }));

    // Remplacer l'edge groupé par les edges individuels
    setEdges((eds) => [
      ...eds.filter((e) => e.id !== groupedEdge.id),
      ...restoredEdges,
    ]);

    markAsChanged();
    toast.success(`Câble dégroupé en ${restoredEdges.length} fils`);
    closeContextMenu();
  }, [contextMenu, getEdgeById, generateEdgeId, setEdges, markAsChanged, closeContextMenu]);

  // Infos pour le menu contextuel
  const contextEdge = contextMenu?.edgeId ? getEdgeById(contextMenu.edgeId) : null;
  const canGroupSelected = selectedEdges.length >= 2;

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
        containerRef={containerRef}
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
            onEdgeContextMenu={handleEdgeContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneClick={closeContextMenu}
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
            nodesDraggable={true}
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
            containerRef={containerRef}
          />
        )}

        {/* Menu contextuel */}
        {contextMenu && (
          <PlumbingContextMenu
            type={contextMenu.type}
            position={contextMenu.position}
            onClose={closeContextMenu}
            onAddDerivation={handleAddDerivation}
            onDeleteEdge={handleDeleteEdgeFromMenu}
            onGroupEdges={handleGroupEdges}
            onUngroupEdge={handleUngroupEdge}
            onDeleteJunction={handleDeleteJunction}
            edgeType={contextEdge?.data?.connectionType || "electrical"}
            canGroup={canGroupSelected}
            isGrouped={contextEdge?.data?.isGrouped || false}
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
