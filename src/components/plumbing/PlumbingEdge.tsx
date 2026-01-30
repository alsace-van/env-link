// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 2.2 - Flèche de direction pour l'eau
// ============================================

import React, { memo, useMemo } from "react";
import { EdgeProps, getSmoothStepPath, BaseEdge, EdgeLabelRenderer, Position } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Cable, Droplets } from "lucide-react";
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
    // Calculer si c'est une ligne quasi-droite (même axe horizontal ou vertical)
    const isHorizontalLine = Math.abs(targetY - sourceY) < 5;
    const isVerticalLine = Math.abs(targetX - sourceX) < 5;
    const isStraightLine = isHorizontalLine || isVerticalLine;
    
    // Utiliser un offset très petit pour minimiser les coudes inutiles
    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
      offset: isStraightLine ? 0 : 10, // Pas d'offset si ligne droite
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

    // Préparer et TRIER les fils par leur index source
    const groupedWires = useMemo(() => {
      if (!isGrouped || !groupedEdges.length) return [];
      
      const wires = groupedEdges.map((ge: any, idx: number) => ({
        ...ge,
        color: getWireColor(ge),
        label: getWireLabel(ge),
        srcIndex: extractHandleIndex(ge.sourceHandle),
        tgtIndex: extractHandleIndex(ge.targetHandle),
        originalIndex: idx,
      }));
      
      // Trier par index source
      wires.sort((a, b) => a.srcIndex - b.srcIndex);
      
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
      const fanLength = 30;
      const gaineWidth = 6;
      
      // Récupérer l'espacement RÉEL depuis les données stockées
      const srcSpacing = (data as any)?.srcSpacing || 12;
      const tgtSpacing = (data as any)?.tgtSpacing || 12;
      const middleSrcIndex = (data as any)?.middleSrcIndex ?? groupedWires[Math.floor(groupedWires.length / 2)]?.srcIndex ?? 0;
      const middleTgtIndex = (data as any)?.middleTgtIndex ?? groupedWires[Math.floor(groupedWires.length / 2)]?.tgtIndex ?? 0;
      
      console.log("[PlumbingEdge v2.1] Espacement reçu:", { srcSpacing, tgtSpacing, middleSrcIndex, middleTgtIndex });
      
      // Point de convergence (où les fils rejoignent la gaine)
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
      
      // Générer les éventails avec l'espacement RÉEL
      const fanElements = groupedWires.map((wire: any) => {
        // Offset basé sur la DIFFÉRENCE d'index par rapport au milieu × espacement réel
        const srcOffset = (wire.srcIndex - middleSrcIndex) * srcSpacing;
        const tgtOffset = (wire.tgtIndex - middleTgtIndex) * tgtSpacing;
        
        // Position source (éventail)
        let srcConnX = sourceX, srcConnY = sourceY;
        if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
          srcConnY = sourceY + srcOffset;
        } else {
          srcConnX = sourceX + srcOffset;
        }
        
        // Position target
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
              key={`src-${wire.id || wire.srcIndex}`}
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
              key={`tgt-${wire.id || wire.tgtIndex}`}
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
                    <span key={wire.id || wire.srcIndex} className="w-2 h-2 rounded-full border border-white/50" style={{ backgroundColor: wire.color }} title={wire.label} />
                  ))}
                </span>
              </Badge>
            </div>
          </EdgeLabelRenderer>
        </>
      );
    }

    // Rendu standard
    const isWater = data?.connectionType === "water";
    
    // Calculer l'angle de la flèche basé sur la direction source → target
    const angle = useMemo(() => {
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      return Math.atan2(dy, dx) * (180 / Math.PI);
    }, [sourceX, sourceY, targetX, targetY]);
    
    return (
      <>
        <path d={edgePath} fill="none" stroke="transparent" strokeWidth={Math.max(strokeWidth + 10, 20)} style={{ cursor: "pointer" }} />
        <BaseEdge id={id} path={edgePath} style={edgeStyle} />
        
        {/* Flèche de direction pour l'eau - positionnée au milieu */}
        {isWater && (
          <g transform={`translate(${labelX}, ${labelY})`}>
            <g transform={`rotate(${angle})`}>
              {/* Fond blanc pour contraste */}
              <polygon
                points="-6,-5 6,0 -6,5"
                fill="white"
                stroke="white"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Flèche colorée */}
              <polygon
                points="-5,-4 5,0 -5,4"
                fill={strokeColor}
                stroke={strokeColor}
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </g>
          </g>
        )}
        
        {data?.connectionType === "electrical" && data.electricalType === "230v" && (
          <path d={edgePath} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="8 4" style={{ pointerEvents: "none" }} />
        )}
        {edgeLabel && (
          <EdgeLabelRenderer>
            <div style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 15}px)`, pointerEvents: "all", cursor: "pointer" }}>
              <Badge variant={selected ? "default" : "outline"} className="text-[10px] px-1.5 py-0.5 shadow-sm flex items-center gap-1" style={{ background: selected ? strokeColor : "white", color: selected ? "white" : strokeColor, borderColor: strokeColor }}>
                {isWater && <Droplets className="h-3 w-3" />}
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
