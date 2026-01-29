// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.9 - Position basée sur l'index du handle
// ============================================

import React, { memo, useMemo } from "react";
import { EdgeProps, getSmoothStepPath, BaseEdge, EdgeLabelRenderer, Position } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Cable } from "lucide-react";
import {
  PlumbingEdgeData,
  getConnectionColor,
  getConnectionStrokeWidth,
  ELECTRICAL_CONNECTOR_COLORS,
  WATER_COLORS,
} from "./types";

function getWireColor(wireData: any): string {
  const handle = (wireData.sourceHandle || "") + (wireData.targetHandle || "");
  if (handle.includes("230v-L") || handle.includes("230v_L")) return ELECTRICAL_CONNECTOR_COLORS["230v-L"] || "#8B4513";
  if (handle.includes("230v-N") || handle.includes("230v_N")) return ELECTRICAL_CONNECTOR_COLORS["230v-N"] || "#3B82F6";
  if (handle.includes("_pe") || handle.includes("-pe")) return ELECTRICAL_CONNECTOR_COLORS["pe"] || "#22C55E";
  if (handle.includes("12v+")) return ELECTRICAL_CONNECTOR_COLORS["12v+"] || "#EF4444";
  if (handle.includes("12v-")) return ELECTRICAL_CONNECTOR_COLORS["12v-"] || "#1F2937";
  if (wireData.data?.wire === "phase") return "#8B4513";
  if (wireData.data?.wire === "neutral") return "#3B82F6";
  if (wireData.data?.wire === "earth") return "#22C55E";
  if (wireData.data?.polarity === "positive") return "#EF4444";
  if (wireData.data?.polarity === "negative") return "#1F2937";
  if (wireData.data?.waterType) return WATER_COLORS[wireData.data.waterType] || "#6B7280";
  return "#6B7280";
}

function getWireLabel(wireData: any): string {
  const handle = (wireData.sourceHandle || "") + (wireData.targetHandle || "");
  if (handle.includes("230v-L") || handle.includes("230v_L") || wireData.data?.wire === "phase") return "L";
  if (handle.includes("230v-N") || handle.includes("230v_N") || wireData.data?.wire === "neutral") return "N";
  if (handle.includes("_pe") || handle.includes("-pe") || wireData.data?.wire === "earth") return "PE";
  if (handle.includes("12v+") || wireData.data?.polarity === "positive") return "+";
  if (handle.includes("12v-") || wireData.data?.polarity === "negative") return "-";
  return "?";
}

// Extraire l'index depuis le handle ID (ex: "elec_230v-L_out_2" -> 2)
function extractHandleIndex(handleId: string): number {
  if (!handleId) return 0;
  const match = handleId.match(/_(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

const PlumbingEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    style,
  }: EdgeProps<PlumbingEdgeData>) => {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });

    const isGrouped = data?.isGrouped || false;
    const groupedEdges = data?.groupedEdges || [];
    const groupedCount = groupedEdges.length;

    const strokeColor = useMemo(() => {
      if (!data) return "#9CA3AF";
      if (isGrouped) return "#374151";
      return getConnectionColor(data);
    }, [data, isGrouped]);

    const strokeWidth = useMemo(() => {
      if (!data) return 2;
      if (isGrouped) return 4;
      return getConnectionStrokeWidth(data);
    }, [data, isGrouped]);

    const edgeStyle = useMemo(
      () => ({
        stroke: strokeColor,
        strokeWidth: selected ? strokeWidth + 2 : strokeWidth,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        filter: selected ? "drop-shadow(0 0 3px rgba(59, 130, 246, 0.5))" : undefined,
        ...style,
      }),
      [strokeColor, strokeWidth, selected, style]
    );

    const groupedWires = useMemo(() => {
      if (!isGrouped || !groupedEdges.length) return [];
      return groupedEdges.map((ge: any, idx: number) => ({
        ...ge,
        color: getWireColor(ge),
        label: getWireLabel(ge),
        srcIndex: extractHandleIndex(ge.sourceHandle),
        tgtIndex: extractHandleIndex(ge.targetHandle),
        index: idx,
      }));
    }, [isGrouped, groupedEdges]);

    const edgeLabel = useMemo(() => {
      if (!data) return null;
      if (isGrouped && groupedWires.length > 0) {
        const labels = groupedWires.map((w: any) => w.label).filter((l: string) => l !== "?");
        if (labels.length > 0) return labels.join("+");
        return `${groupedCount} fils`;
      }
      const parts: string[] = [];
      if (data.connectionType === "water" && data.pipe_diameter) parts.push(`Ø${data.pipe_diameter}`);
      else if (data.connectionType === "electrical") {
        if (data.cable_section) parts.push(`${data.cable_section}mm²`);
        if (data.electricalType === "12v" && data.polarity) parts.push(data.polarity === "positive" ? "+" : "-");
        if (data.electricalType === "230v" && data.wire) parts.push({ phase: "L", neutral: "N", earth: "PE" }[data.wire]);
      }
      if (data.label) parts.unshift(data.label);
      return parts.length > 0 ? parts.join(" ") : null;
    }, [data, isGrouped, groupedCount, groupedWires]);

    // Rendu pour câble groupé
    if (isGrouped && groupedWires.length > 0) {
      const fanLength = 35;
      const gaineWidth = 6;
      
      // Espacement entre connecteurs (basé sur la vraie config du bloc)
      const CONNECTOR_SPACING = 12;
      
      // Trouver les min/max index pour centrer
      const srcIndices = groupedWires.map((w: any) => w.srcIndex);
      const tgtIndices = groupedWires.map((w: any) => w.tgtIndex);
      const srcMinIdx = Math.min(...srcIndices);
      const srcMaxIdx = Math.max(...srcIndices);
      const tgtMinIdx = Math.min(...tgtIndices);
      const tgtMaxIdx = Math.max(...tgtIndices);
      const srcCenter = (srcMinIdx + srcMaxIdx) / 2;
      const tgtCenter = (tgtMinIdx + tgtMaxIdx) / 2;
      
      // Point de convergence
      let srcMergeX = sourceX, srcMergeY = sourceY;
      let tgtMergeX = targetX, tgtMergeY = targetY;
      
      if (sourcePosition === Position.Right) srcMergeX = sourceX + fanLength;
      else if (sourcePosition === Position.Left) srcMergeX = sourceX - fanLength;
      else if (sourcePosition === Position.Bottom) srcMergeY = sourceY + fanLength;
      else srcMergeY = sourceY - fanLength;
      
      if (targetPosition === Position.Left) tgtMergeX = targetX - fanLength;
      else if (targetPosition === Position.Right) tgtMergeX = targetX + fanLength;
      else if (targetPosition === Position.Top) tgtMergeY = targetY - fanLength;
      else tgtMergeY = targetY + fanLength;
      
      // Chemin de la gaine raccourci
      const [shortenedPath] = getSmoothStepPath({
        sourceX: srcMergeX,
        sourceY: srcMergeY,
        sourcePosition,
        targetX: tgtMergeX,
        targetY: tgtMergeY,
        targetPosition,
        borderRadius: 8,
      });
      
      // Générer les éventails basés sur l'index réel du handle
      const fanElements = groupedWires.map((wire: any) => {
        // Offset depuis le centre basé sur l'index réel
        const srcOffset = (wire.srcIndex - srcCenter) * CONNECTOR_SPACING;
        const tgtOffset = (wire.tgtIndex - tgtCenter) * CONNECTOR_SPACING;
        
        // Position du connecteur source
        let srcConnX = sourceX, srcConnY = sourceY;
        if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
          srcConnY = sourceY + srcOffset;
        } else {
          srcConnX = sourceX + srcOffset;
        }
        
        // Position du connecteur target
        let tgtConnX = targetX, tgtConnY = targetY;
        if (targetPosition === Position.Left || targetPosition === Position.Right) {
          tgtConnY = targetY + tgtOffset;
        } else {
          tgtConnX = targetX + tgtOffset;
        }
        
        return {
          ...wire,
          srcPath: `M ${srcConnX} ${srcConnY} L ${srcMergeX} ${srcMergeY}`,
          tgtPath: `M ${tgtMergeX} ${tgtMergeY} L ${tgtConnX} ${tgtConnY}`,
        };
      });
      
      return (
        <>
          {/* Zone de clic */}
          <path d={edgePath} fill="none" stroke="transparent" strokeWidth={40} style={{ cursor: "pointer" }} />

          {/* Gaine raccourcie */}
          <path d={shortenedPath} fill="none" stroke="#1F2937" strokeWidth={gaineWidth} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />
          <path d={shortenedPath} fill="none" stroke="#4B5563" strokeWidth={gaineWidth - 2} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />

          {/* Éventail source */}
          {fanElements.map((wire: any) => (
            <path
              key={`src-${wire.id || wire.index}`}
              d={wire.srcPath}
              fill="none"
              stroke={wire.color}
              strokeWidth={2}
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          ))}
          
          {/* Éventail target */}
          {fanElements.map((wire: any) => (
            <path
              key={`tgt-${wire.id || wire.index}`}
              d={wire.tgtPath}
              fill="none"
              stroke={wire.color}
              strokeWidth={2}
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          ))}

          {/* Sélection */}
          {selected && (
            <path d={edgePath} fill="none" stroke="#3B82F6" strokeWidth={gaineWidth + 6} strokeLinecap="round" strokeOpacity={0.3} style={{ pointerEvents: "none" }} />
          )}

          {/* Label */}
          <EdgeLabelRenderer>
            <div style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all", cursor: "pointer" }}>
              <Badge
                variant={selected ? "default" : "outline"}
                className="text-[10px] px-1.5 py-0.5 shadow-sm flex items-center gap-1"
                style={{ background: selected ? "#1F2937" : "white", color: selected ? "white" : "#1F2937", borderColor: "#1F2937" }}
              >
                <Cable className="h-3 w-3" />
                {edgeLabel}
                <span className="flex gap-0.5 ml-1">
                  {fanElements.map((wire: any) => (
                    <span key={wire.id || wire.index} className="w-2 h-2 rounded-full border border-white/50" style={{ backgroundColor: wire.color }} title={wire.label} />
                  ))}
                </span>
              </Badge>
            </div>
          </EdgeLabelRenderer>
        </>
      );
    }

    // Rendu standard
    return (
      <>
        <path d={edgePath} fill="none" stroke="transparent" strokeWidth={Math.max(strokeWidth + 10, 20)} style={{ cursor: "pointer" }} />
        <BaseEdge id={id} path={edgePath} style={edgeStyle} />
        {data?.connectionType === "electrical" && data.electricalType === "230v" && (
          <path d={edgePath} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="8 4" style={{ pointerEvents: "none" }} />
        )}
        {edgeLabel && (
          <EdgeLabelRenderer>
            <div style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all", cursor: "pointer" }}>
              <Badge variant={selected ? "default" : "outline"} className="text-[10px] px-1.5 py-0.5 shadow-sm" style={{ background: selected ? strokeColor : "white", color: selected ? "white" : strokeColor, borderColor: strokeColor }}>
                {edgeLabel}
              </Badge>
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

PlumbingEdge.displayName = "PlumbingEdge";

export default PlumbingEdge;
