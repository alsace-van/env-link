// ============================================
// COMPOSANT: OverviewModal
// VERSION: 1.0
// Description: Modale vue d'ensemble des branches avec flowchart vertical
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { GitBranch, Plus, Trash2 as TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================
// TYPES
// ============================================

interface HistoryEntry {
  timestamp: number;
  description: string;
  sketch: unknown;
}

interface Branch {
  id: string;
  name: string;
  color: string;
  history: HistoryEntry[];
  parentBranchId?: string;
  parentHistoryIndex?: number;
}

export interface OverviewModalProps {
  showOverviewModal: boolean;
  setShowOverviewModal: React.Dispatch<React.SetStateAction<boolean>>;
  branches: Branch[];
  activeBranchId: string;
  historyIndex: number;
  flowchartContainerRef: React.RefObject<HTMLDivElement>;
  isGrabbing: boolean;
  setIsGrabbing: React.Dispatch<React.SetStateAction<boolean>>;
  grabStart: { x: number; y: number; scrollLeft: number; scrollTop: number };
  setGrabStart: React.Dispatch<React.SetStateAction<{ x: number; y: number; scrollLeft: number; scrollTop: number }>>;
  goToHistoryIndex: (index: number) => void;
  switchToBranch: (branchId: string) => void;
  createBranchFromHistoryIndex: (index: number) => void;
  deleteBranch: (branchId: string) => void;
  renameBranch: (branchId: string, newName: string) => void;
  renamingBranchId: string | null;
  setRenamingBranchId: React.Dispatch<React.SetStateAction<string | null>>;
  renamingValue: string;
  setRenamingValue: React.Dispatch<React.SetStateAction<string>>;
}

// ============================================
// CONSTANTES
// ============================================

const NODE_WIDTH = 200;
const NODE_HEIGHT = 48;
const BRANCH_NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 80;
const VERTICAL_SPACING = 20;

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

interface FlowNode {
  id: string;
  type: "branch-start" | "state";
  branchId: string;
  branchName: string;
  branchColor: string;
  stateIndex?: number;
  description: string;
  timestamp: number;
  isActive: boolean;
  isCurrent: boolean;
  nextState: FlowNode | null;
  childBranches: FlowNode[];
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseDescription(desc: string): { icon: string; label: string; details: string } {
  const lower = desc.toLowerCase();
  if (lower.includes("rectangle")) {
    const match = desc.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    return { icon: "▭", label: "Rectangle", details: match ? `${match[1]}×${match[2]}mm` : "" };
  }
  if (lower.includes("ligne") || lower.includes("line")) {
    const match = desc.match(/L\s*=?\s*(\d+(?:\.\d+)?)/i);
    return { icon: "╱", label: "Ligne", details: match ? `L=${match[1]}mm` : "" };
  }
  if (lower.includes("cercle") || lower.includes("circle")) {
    const match = desc.match(/R\s*=?\s*(\d+(?:\.\d+)?)/i);
    return { icon: "○", label: "Cercle", details: match ? `R=${match[1]}mm` : "" };
  }
  if (lower.includes("arc")) {
    return { icon: "⌒", label: "Arc", details: "" };
  }
  if (lower.includes("polyligne") || lower.includes("polyline")) {
    return { icon: "⟋", label: "Polyligne", details: "" };
  }
  if (lower.includes("bézier") || lower.includes("bezier") || lower.includes("courbe")) {
    return { icon: "∿", label: "Courbe", details: "" };
  }
  if (lower.includes("annotation") || lower.includes("texte") || lower.includes("text")) {
    return { icon: "T", label: "Annotation", details: "" };
  }
  if (lower.includes("dimension") || lower.includes("cote")) {
    return { icon: "↔", label: "Dimension", details: "" };
  }
  if (lower.includes("fusion")) {
    return { icon: "⊕", label: "Fusion", details: "" };
  }
  if (lower.includes("suppression") || lower.includes("delete")) {
    return { icon: "✕", label: "Suppression", details: "" };
  }
  if (lower.includes("déplacement") || lower.includes("move")) {
    return { icon: "↗", label: "Déplacement", details: "" };
  }
  if (lower.includes("congé") || lower.includes("fillet")) {
    return { icon: "◠", label: "Congé", details: "" };
  }
  if (lower.includes("chanfrein")) {
    return { icon: "∠", label: "Chanfrein", details: "" };
  }
  if (lower.includes("offset") || lower.includes("décalage")) {
    return { icon: "⧈", label: "Offset", details: "" };
  }
  if (lower.includes("image")) {
    return { icon: "🖼", label: "Image", details: "" };
  }
  return { icon: "●", label: desc.substring(0, 15), details: "" };
}

// ============================================
// COMPOSANT
// ============================================

export function OverviewModal({
  showOverviewModal,
  setShowOverviewModal,
  branches,
  activeBranchId,
  historyIndex,
  flowchartContainerRef,
  isGrabbing,
  setIsGrabbing,
  grabStart,
  setGrabStart,
  goToHistoryIndex,
  switchToBranch,
  createBranchFromHistoryIndex,
  deleteBranch,
  renameBranch,
  renamingBranchId,
  setRenamingBranchId,
  renamingValue,
  setRenamingValue,
}: OverviewModalProps) {
  // Construire l'arbre de nœuds
  const rootBranch = branches.find((b) => !b.parentBranchId) || branches[0];
  
  if (!rootBranch) {
    return (
      <Dialog open={showOverviewModal} onOpenChange={setShowOverviewModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Vue d'ensemble des branches
            </DialogTitle>
          </DialogHeader>
          <div className="text-center text-gray-500 py-8">Aucune branche</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Construire les nœuds récursivement
  const buildBranchNodes = (
    branch: Branch,
    startX: number,
    startY: number,
    depth: number
  ): { nodes: FlowNode[]; maxY: number; maxX: number } => {
    const nodes: FlowNode[] = [];
    let currentY = startY;
    let maxX = startX;

    // Nœud de branche
    const branchNode: FlowNode = {
      id: `branch-${branch.id}`,
      type: "branch-start",
      branchId: branch.id,
      branchName: branch.name,
      branchColor: branch.color,
      description: branch.name,
      timestamp: branch.history[0]?.timestamp || Date.now(),
      isActive: branch.id === activeBranchId,
      isCurrent: false,
      nextState: null,
      childBranches: [],
      x: startX,
      y: currentY,
      width: NODE_WIDTH,
      height: BRANCH_NODE_HEIGHT,
    };
    nodes.push(branchNode);
    currentY += BRANCH_NODE_HEIGHT + VERTICAL_SPACING;

    // Nœuds d'état
    let prevNode: FlowNode = branchNode;
    branch.history.forEach((entry, idx) => {
      const isCurrent = branch.id === activeBranchId && idx === historyIndex;

      const stateNode: FlowNode = {
        id: `state-${branch.id}-${idx}`,
        type: "state",
        branchId: branch.id,
        branchName: branch.name,
        branchColor: branch.color,
        stateIndex: idx,
        description: entry.description,
        timestamp: entry.timestamp,
        isActive: branch.id === activeBranchId,
        isCurrent,
        nextState: null,
        childBranches: [],
        x: startX,
        y: currentY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };

      prevNode.nextState = stateNode;
      prevNode = stateNode;
      nodes.push(stateNode);

      // Branches enfants à ce point
      const childBranches = branches.filter(
        (b) => b.parentBranchId === branch.id && b.parentHistoryIndex === idx
      );
      let childOffsetX = HORIZONTAL_SPACING;
      for (const child of childBranches) {
        const childResult = buildBranchNodes(
          child,
          startX + NODE_WIDTH + childOffsetX,
          currentY,
          depth + 1
        );
        nodes.push(...childResult.nodes);
        stateNode.childBranches.push(childResult.nodes[0]);
        childOffsetX += childResult.maxX - startX + HORIZONTAL_SPACING;
        maxX = Math.max(maxX, childResult.maxX);
      }

      currentY += NODE_HEIGHT + VERTICAL_SPACING;
    });

    return { nodes, maxY: currentY, maxX };
  };

  const { nodes: allNodes, maxY, maxX } = buildBranchNodes(rootBranch, 40, 20, 0);

  // Calculer les connexions
  const connections: { from: FlowNode; to: FlowNode }[] = [];
  for (const node of allNodes) {
    if (node.nextState) {
      connections.push({ from: node, to: node.nextState });
    }
    for (const child of node.childBranches) {
      connections.push({ from: node, to: child });
    }
  }

  return (
    <Dialog open={showOverviewModal} onOpenChange={setShowOverviewModal}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Vue d'ensemble des branches
          </DialogTitle>
          <DialogDescription>
            Flowchart de l'historique. Cliquez sur un état pour y revenir, double-cliquez sur un nom de branche pour
            le modifier.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={flowchartContainerRef}
          className={`flex-1 overflow-auto py-4 ${isGrabbing ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ maxHeight: "calc(90vh - 200px)" }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return;
            setIsGrabbing(true);
            setGrabStart({
              x: e.clientX,
              y: e.clientY,
              scrollLeft: flowchartContainerRef.current?.scrollLeft || 0,
              scrollTop: flowchartContainerRef.current?.scrollTop || 0,
            });
          }}
          onMouseMove={(e) => {
            if (!isGrabbing || !flowchartContainerRef.current) return;
            const dx = e.clientX - grabStart.x;
            const dy = e.clientY - grabStart.y;
            flowchartContainerRef.current.scrollLeft = grabStart.scrollLeft - dx;
            flowchartContainerRef.current.scrollTop = grabStart.scrollTop - dy;
          }}
          onMouseUp={() => setIsGrabbing(false)}
          onMouseLeave={() => setIsGrabbing(false)}
        >
          <div
            className="relative"
            style={{
              width: Math.max(maxX + NODE_WIDTH + 80, 600),
              height: maxY + 40,
              minWidth: "100%",
            }}
          >
            {/* SVG pour les connexions */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: "100%", height: "100%" }}
            >
              {connections.map((conn, idx) => {
                const fromX = conn.from.x + conn.from.width / 2;
                const fromY = conn.from.y + conn.from.height;
                const toX = conn.to.x + conn.to.width / 2;
                const toY = conn.to.y;
                const midY = (fromY + toY) / 2;

                let path: string;
                if (Math.abs(fromX - toX) < 5) {
                  path = `M ${fromX} ${fromY} L ${toX} ${toY - 6}`;
                } else {
                  path = `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY - 6}`;
                }

                return (
                  <g key={idx}>
                    <path d={path} fill="none" stroke={conn.to.branchColor} strokeWidth="2" />
                    <polygon
                      points={`${toX},${toY} ${toX - 5},${toY - 8} ${toX + 5},${toY - 8}`}
                      fill={conn.to.branchColor}
                    />
                    <circle cx={fromX} cy={fromY} r="4" fill={conn.from.branchColor} />
                  </g>
                );
              })}
            </svg>

            {/* Nœuds */}
            {allNodes.map((node) => {
              const parsed = parseDescription(node.description);
              const timeStr = new Date(node.timestamp).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });

              if (node.type === "branch-start") {
                return (
                  <div
                    key={node.id}
                    className="absolute rounded-lg border-2 bg-white shadow-sm cursor-pointer transition-all hover:shadow-md"
                    style={{
                      left: node.x,
                      top: node.y,
                      width: NODE_WIDTH,
                      height: node.height,
                      borderColor: node.branchColor,
                      boxShadow: node.isActive ? `0 0 0 2px white, 0 0 0 4px ${node.branchColor}` : undefined,
                    }}
                    onClick={() => switchToBranch(node.branchId)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingBranchId(node.branchId);
                      setRenamingValue(node.branchName);
                    }}
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-2 h-full"
                      style={{ backgroundColor: `${node.branchColor}15` }}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: node.branchColor }}
                      />
                      {renamingBranchId === node.branchId ? (
                        <Input
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          className="h-6 text-sm flex-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              renameBranch(node.branchId, renamingValue);
                              setRenamingBranchId(null);
                            } else if (e.key === "Escape") {
                              setRenamingBranchId(null);
                            }
                          }}
                          onBlur={() => {
                            renameBranch(node.branchId, renamingValue);
                            setRenamingBranchId(null);
                          }}
                        />
                      ) : (
                        <span className="font-medium text-sm truncate flex-1">{node.branchName}</span>
                      )}
                      {node.isActive && (
                        <Badge className="text-xs px-1.5 py-0" style={{ backgroundColor: node.branchColor }}>
                          Active
                        </Badge>
                      )}
                      {branches.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBranch(node.branchId);
                          }}
                          title="Supprimer la branche"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={node.id}
                    className={`absolute rounded-lg border bg-white shadow-sm cursor-pointer transition-all hover:shadow-md ${
                      node.isCurrent ? "ring-2 ring-offset-2" : ""
                    }`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: NODE_WIDTH,
                      height: node.height,
                      borderColor: node.branchColor,
                      ringColor: node.branchColor,
                    }}
                    onClick={() => {
                      if (node.branchId !== activeBranchId) {
                        switchToBranch(node.branchId);
                      }
                      if (node.stateIndex !== undefined) {
                        goToHistoryIndex(node.stateIndex);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 h-full">
                      <span className="text-lg">{parsed.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{parsed.label}</div>
                        {parsed.details && (
                          <div className="text-[10px] text-gray-500 truncate">{parsed.details}</div>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">{timeStr}</div>
                      {node.isCurrent && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: node.branchColor }}
                        />
                      )}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* Légende */}
        {branches.length > 1 && (
          <div className="mt-2 p-2 bg-gray-50 rounded-lg border">
            <div className="text-xs text-gray-500 mb-1">Branches</div>
            <div className="flex flex-wrap gap-2">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                    branch.id === activeBranchId
                      ? "bg-gray-200 font-medium"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => switchToBranch(branch.id)}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: branch.color }}
                  />
                  <span>{branch.name}</span>
                  <span className="text-gray-400">({branch.history.length})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setShowOverviewModal(false)}>
            Fermer
          </Button>
          <Button onClick={() => createBranchFromHistoryIndex(historyIndex)} disabled={branches.length >= 10}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle branche ({branches.length}/10)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OverviewModal;
