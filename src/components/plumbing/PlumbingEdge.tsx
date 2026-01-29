// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.5 - Debug couleurs + éventail visible
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

// Fonction pour obtenir la couleur d'un fil depuis son handle
function getWireColor(wireData: any): string {
  const sourceHandle = wireData.sourceHandle || "";
  const targetHandle = wireData.targetHandle || "";
  const handle = sourceHandle + targetHandle;
  
  console.log("[PlumbingEdge v1.5] getWireColor handle:", handle, "data:", wireData.data);
  
  // Chercher dans le handle (format: elec_TYPE_direction_index)
  if (handle.includes("230v-L") || handle.includes("230v_L")) {
    return ELECTRICAL_CONNECTOR_COLORS["230v-L"] || "#8B4513";
  }
  if (handle.includes("230v-N") || handle.includes("230v_N")) {
    return ELECTRICAL_CONNECTOR_COLORS["230v-N"] || "#3B82F6";
  }
  if (handle.includes("_pe_") || handle.includes("_pe")) {
    return ELECTRICAL_CONNECTOR_COLORS["pe"] || "#22C55E";
  }
  if (handle.includes("12v+") || handle.includes("12v_plus")) {
    return ELECTRICAL_CONNECTOR_COLORS["12v+"] || "#EF4444";
  }
  if (handle.includes("12v-") || handle.includes("12v_minus")) {
    return ELECTRICAL_CONNECTOR_COLORS["12v-"] || "#1F2937";
  }
  
  // Fallback sur les données de l'edge
  if (wireData.data?.wire === "phase") return "#8B4513";
  if (wireData.data?.wire === "neutral") return "#3B82F6";
  if (wireData.data?.wire === "earth") return "#22C55E";
  if (wireData.data?.polarity === "positive") return "#EF4444";
  if (wireData.data?.polarity === "negative") return "#1F2937";
  
  // Eau
  if (wireData.data?.waterType) {
    return WATER_COLORS[wireData.data.waterType] || "#6B7280";
  }
  
  return "#6B7280";
}

// Fonction pour obtenir le label court d'un fil
function getWireLabel(wireData: any): string {
  const handle = (wireData.sourceHandle || "") + (wireData.targetHandle || "");
  
  if (handle.includes("230v-L") || handle.includes("230v_L") || wireData.data?.wire === "phase") return "L";
  if (handle.includes("230v-N") || handle.includes("230v_N") || wireData.data?.wire === "neutral") return "N";
  if (handle.includes("_pe") || wireData.data?.wire === "earth") return "PE";
  if (handle.includes("12v+") || wireData.data?.polarity === "positive") return "+";
  if (handle.includes("12v-") || wireData.data?.polarity === "negative") return "-";
  
  return "?";
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

    // Données des fils groupés avec couleurs
    const groupedWires = useMemo(() => {
      if (!isGrouped || !groupedEdges.length) return [];
      
      const wires = groupedEdges.map((ge: any, idx: number) => ({
        ...ge,
        color: getWireColor(ge),
        label: getWireLabel(ge),
        index: idx,
      }));
      
      console.log("[PlumbingEdge v1.5] groupedWires:", wires);
      return wires;
    }, [isGrouped, groupedEdges]);

    const edgeLabel = useMemo(() => {
      if (!data) return null;
      
      if (isGrouped && groupedWires.length > 0) {
        const labels = groupedWires.map((w: any) => w.label).filter((l: string) => l !== "?");
        if (labels.length > 0) return labels.join("+");
        return `${groupedCount} fils`;
      }

      const parts: string[] = [];
      if (data.connectionType === "water") {
        if (data.pipe_diameter) parts.push(`Ø${data.pipe_diameter}`);
      } else if (data.connectionType === "electrical") {
        if (data.cable_section) parts.push(`${data.cable_section}mm²`);
        if (data.electricalType === "12v" && data.polarity) parts.push(data.polarity === "positive" ? "+" : "-");
        if (data.electricalType === "230v" && data.wire) {
          parts.push({ phase: "L", neutral: "N", earth: "PE" }[data.wire]);
        }
      }
      if (data.label) parts.unshift(data.label);
      return parts.length > 0 ? parts.join(" ") : null;
    }, [data, isGrouped, groupedCount, groupedWires]);

    // Rendu pour câble groupé avec éventail
    if (isGrouped && groupedWires.length > 0) {
      const total = groupedWires.length;
      const spacing = 8;
      const fanLength = 50;
      const gaineWidth = total * 4 + 6;
      
      // Calculer les chemins en éventail
      const fanPaths = groupedWires.map((wire: any, idx: number) => {
        const offset = (idx - (total - 1) / 2) * spacing;
        
        let srcStartX = sourceX;
        let srcStartY = sourceY;
        let srcMergeX = sourceX;
        let srcMergeY = sourceY;
        let tgtEndX = targetX;
        let tgtEndY = targetY;
        let tgtMergeX = targetX;
        let tgtMergeY = targetY;
        
        // Offset selon direction source
        if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
          srcStartY = sourceY + offset;
          srcMergeX = sourcePosition === Position.Right ? sourceX + fanLength : sourceX - fanLength;
        } else {
          srcStartX = sourceX + offset;
          srcMergeY = sourcePosition === Position.Bottom ? sourceY + fanLength : sourceY - fanLength;
        }
        
        // Offset selon direction target
        if (targetPosition === Position.Left || targetPosition === Position.Right) {
          tgtEndY = targetY + offset;
          tgtMergeX = targetPosition === Position.Left ? targetX - fanLength : targetX + fanLength;
        } else {
          tgtEndX = targetX + offset;
          tgtMergeY = targetPosition === Position.Top ? targetY - fanLength : targetY + fanLength;
        }
        
        const path = `M ${srcStartX} ${srcStartY} L ${srcMergeX} ${srcMergeY} L ${tgtMergeX} ${tgtMergeY} L ${tgtEndX} ${tgtEndY}`;
        
        return { ...wire, path };
      });
      
      return (
        <>
          {/* Zone de clic */}
          <path d={edgePath} fill="none" stroke="transparent" strokeWidth={gaineWidth + 30} style={{ cursor: "pointer" }} />

          {/* Gaine centrale */}
          <path d={edgePath} fill="none" stroke="#1F2937" strokeWidth={gaineWidth} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />
          <path d={edgePath} fill="none" stroke="#374151" strokeWidth={gaineWidth - 4} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />

          {/* Fils en éventail */}
          {fanPaths.map((wire: any) => (
            <path
              key={wire.id || wire.index}
              d={wire.path}
              fill="none"
              stroke={wire.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: "none" }}
            />
          ))}

          {/* Sélection */}
          {selected && (
            <path d={edgePath} fill="none" stroke="#3B82F6" strokeWidth={gaineWidth + 8} strokeLinecap="round" strokeOpacity={0.3} style={{ pointerEvents: "none" }} />
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
                  {fanPaths.map((wire: any) => (
                    <span key={wire.id || wire.index} className="w-2.5 h-2.5 rounded-full border border-white/50" style={{ backgroundColor: wire.color }} title={wire.label} />
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
