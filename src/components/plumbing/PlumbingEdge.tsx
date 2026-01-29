// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.2 - Effet éventail pour câbles groupés
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

// Générer un chemin en éventail pour les câbles groupés
function generateFanPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  groupedEdges: any[],
  index: number,
  total: number
): string {
  // Offset pour chaque fil dans l'éventail
  const spacing = 8;
  const offset = (index - (total - 1) / 2) * spacing;
  
  // Points de convergence (où les fils se rejoignent)
  const convergenceDistance = 40;
  
  let sourceConvergeX = sourceX;
  let sourceConvergeY = sourceY;
  let targetConvergeX = targetX;
  let targetConvergeY = targetY;
  
  // Calculer les points de convergence selon la direction
  if (sourcePosition === Position.Right) {
    sourceConvergeX = sourceX + convergenceDistance;
  } else if (sourcePosition === Position.Left) {
    sourceConvergeX = sourceX - convergenceDistance;
  } else if (sourcePosition === Position.Bottom) {
    sourceConvergeY = sourceY + convergenceDistance;
  } else if (sourcePosition === Position.Top) {
    sourceConvergeY = sourceY - convergenceDistance;
  }
  
  if (targetPosition === Position.Left) {
    targetConvergeX = targetX - convergenceDistance;
  } else if (targetPosition === Position.Right) {
    targetConvergeX = targetX + convergenceDistance;
  } else if (targetPosition === Position.Top) {
    targetConvergeY = targetY - convergenceDistance;
  } else if (targetPosition === Position.Bottom) {
    targetConvergeY = targetY + convergenceDistance;
  }
  
  // Point de départ avec offset (éventail source)
  let startX = sourceX;
  let startY = sourceY + offset;
  if (sourcePosition === Position.Top || sourcePosition === Position.Bottom) {
    startX = sourceX + offset;
    startY = sourceY;
  }
  
  // Point d'arrivée avec offset (éventail target)
  let endX = targetX;
  let endY = targetY + offset;
  if (targetPosition === Position.Top || targetPosition === Position.Bottom) {
    endX = targetX + offset;
    endY = targetY;
  }
  
  // Générer le chemin : départ → convergence source → convergence target → arrivée
  const midX = (sourceConvergeX + targetConvergeX) / 2;
  const midY = (sourceConvergeY + targetConvergeY) / 2;
  
  return `M ${startX} ${startY} 
          C ${sourceConvergeX} ${startY}, ${sourceConvergeX} ${midY}, ${midX} ${midY}
          C ${targetConvergeX} ${midY}, ${targetConvergeX} ${endY}, ${endX} ${endY}`;
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

    // Vérifier si c'est un câble groupé
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

    const edgeLabel = useMemo(() => {
      if (!data) return null;
      
      if (isGrouped && groupedCount > 0) {
        return `${groupedCount} fils`;
      }

      const parts: string[] = [];

      if (data.connectionType === "water") {
        if (data.pipe_diameter) parts.push(`Ø${data.pipe_diameter}`);
        if (data.thread_type && data.thread_type !== "none") parts.push(`${data.thread_type}"`);
      } else if (data.connectionType === "electrical") {
        if (data.cable_section) parts.push(`${data.cable_section}mm²`);
        if (data.electricalType === "12v" && data.polarity) parts.push(data.polarity === "positive" ? "+" : "-");
        if (data.electricalType === "230v" && data.wire) {
          parts.push({ phase: "L", neutral: "N", earth: "PE" }[data.wire]);
        }
      }
      if (data.label) parts.unshift(data.label);
      return parts.length > 0 ? parts.join(" ") : null;
    }, [data, isGrouped, groupedCount]);

    // Couleurs des fils groupés
    const groupedWireData = useMemo(() => {
      if (!isGrouped || !groupedEdges.length) return [];
      return groupedEdges.map((ge: any) => {
        let color = "#6B7280";
        if (ge.data?.electricalType === "230v" && ge.data?.wire) {
          const wireColors: Record<string, string> = {
            phase: ELECTRICAL_CONNECTOR_COLORS["230v-L"],
            neutral: ELECTRICAL_CONNECTOR_COLORS["230v-N"],
            earth: ELECTRICAL_CONNECTOR_COLORS["pe"],
          };
          color = wireColors[ge.data.wire] || "#6B7280";
        } else if (ge.data?.electricalType === "12v" && ge.data?.polarity) {
          color = ge.data.polarity === "positive" 
            ? ELECTRICAL_CONNECTOR_COLORS["12v+"] 
            : ELECTRICAL_CONNECTOR_COLORS["12v-"];
        } else if (ge.data?.waterType) {
          color = WATER_COLORS[ge.data.waterType];
        }
        return { ...ge, color };
      });
    }, [isGrouped, groupedEdges]);

    // Rendu pour câble groupé avec éventail
    if (isGrouped && groupedWireData.length > 0) {
      return (
        <>
          {/* Zone de clic élargie */}
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={30}
            style={{ cursor: "pointer" }}
          />

          {/* Gaine centrale (fond sombre) */}
          <path
            d={edgePath}
            fill="none"
            stroke="#1F2937"
            strokeWidth={groupedCount * 3 + 6}
            strokeLinecap="round"
            style={{ pointerEvents: "none" }}
          />

          {/* Fils individuels en éventail */}
          {groupedWireData.map((wire: any, idx: number) => {
            const fanPath = generateFanPath(
              sourceX,
              sourceY,
              targetX,
              targetY,
              sourcePosition,
              targetPosition,
              groupedWireData,
              idx,
              groupedWireData.length
            );
            
            return (
              <path
                key={wire.id || idx}
                d={fanPath}
                fill="none"
                stroke={wire.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                style={{ pointerEvents: "none" }}
              />
            );
          })}

          {/* Label */}
          <EdgeLabelRenderer>
            <div
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "all",
                cursor: "pointer",
              }}
            >
              <Badge
                variant={selected ? "default" : "outline"}
                className="text-[10px] px-1.5 py-0.5 shadow-sm flex items-center gap-1"
                style={{
                  background: selected ? "#374151" : "white",
                  color: selected ? "white" : "#374151",
                  borderColor: "#374151",
                }}
              >
                <Cable className="h-3 w-3" />
                {edgeLabel}
              </Badge>
            </div>
          </EdgeLabelRenderer>
        </>
      );
    }

    // Rendu standard pour câble simple
    return (
      <>
        {/* Zone de clic élargie */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(strokeWidth + 10, 20)}
          style={{ cursor: "pointer" }}
        />

        {/* Ligne principale */}
        <BaseEdge id={id} path={edgePath} style={edgeStyle} />

        {/* Pointillés pour 230V */}
        {data?.connectionType === "electrical" && data.electricalType === "230v" && (
          <path
            d={edgePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray="8 4"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Label */}
        {edgeLabel && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "all",
                cursor: "pointer",
              }}
            >
              <Badge
                variant={selected ? "default" : "outline"}
                className="text-[10px] px-1.5 py-0.5 shadow-sm"
                style={{
                  background: selected ? strokeColor : "white",
                  color: selected ? "white" : strokeColor,
                  borderColor: strokeColor,
                }}
              >
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
