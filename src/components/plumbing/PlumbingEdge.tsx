// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.7 - Gaine raccourcie + éventail visible
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
      const total = groupedWires.length;
      const spacing = 5; // Espacement entre fils
      const fanLength = 30; // Longueur de l'éventail
      const gaineWidth = 8; // Gaine fine
      
      // Calculer le point de convergence (où les fils rejoignent la gaine)
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
      
      // Chemin de la gaine RACCOURCI (du point de merge source au point de merge target)
      const [shortenedPath] = getSmoothStepPath({
        sourceX: srcMergeX,
        sourceY: srcMergeY,
        sourcePosition,
        targetX: tgtMergeX,
        targetY: tgtMergeY,
        targetPosition,
        borderRadius: 8,
      });
      
      // Générer les éventails
      const fanElements = groupedWires.map((wire: any, idx: number) => {
        const offset = (idx - (total - 1) / 2) * spacing;
        
        // Point de départ sur le bloc (avec offset)
        let srcX = sourceX, srcY = sourceY;
        if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
          srcY += offset;
        } else {
          srcX += offset;
        }
        
        // Point d'arrivée sur le bloc (avec offset)
        let tgtX = targetX, tgtY = targetY;
        if (targetPosition === Position.Left || targetPosition === Position.Right) {
          tgtY += offset;
        } else {
          tgtX += offset;
        }
        
        return {
          ...wire,
          srcPath: `M ${srcX} ${srcY} L ${srcMergeX} ${srcMergeY}`,
          tgtPath: `M ${tgtMergeX} ${tgtMergeY} L ${tgtX} ${tgtY}`,
        };
      });
      
      return (
        <>
          {/* Zone de clic (sur le chemin complet) */}
          <path d={edgePath} fill="none" stroke="transparent" strokeWidth={40} style={{ cursor: "pointer" }} />

          {/* Gaine RACCOURCIE (ne va pas jusqu'aux blocs) */}
          <path 
            d={shortenedPath} 
            fill="none" 
            stroke="#1F2937" 
            strokeWidth={gaineWidth} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ pointerEvents: "none" }} 
          />
          <path 
            d={shortenedPath} 
            fill="none" 
            stroke="#4B5563" 
            strokeWidth={gaineWidth - 3} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ pointerEvents: "none" }} 
          />

          {/* Éventail source - fils qui sortent du bloc vers la gaine */}
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
          
          {/* Éventail target - fils qui vont de la gaine vers le bloc */}
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
