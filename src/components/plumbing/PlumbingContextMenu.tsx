// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.1 - Support câbles groupés
// ============================================

import React, { memo, useMemo } from "react";
import { EdgeProps, getSmoothStepPath, BaseEdge, EdgeLabelRenderer } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Cable } from "lucide-react";
import {
  PlumbingEdgeData,
  getConnectionColor,
  getConnectionStrokeWidth,
  ELECTRICAL_CONNECTOR_COLORS,
  WATER_COLORS,
} from "./types";

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
    const groupedCount = data?.groupedEdges?.length || 0;

    const strokeColor = useMemo(() => {
      if (!data) return "#9CA3AF";
      // Pour les câbles groupés, on utilise une couleur neutre
      if (isGrouped) return "#374151";
      return getConnectionColor(data);
    }, [data, isGrouped]);

    const strokeWidth = useMemo(() => {
      if (!data) return 2;
      // Câbles groupés = plus épais
      if (isGrouped) return 6 + groupedCount;
      return getConnectionStrokeWidth(data);
    }, [data, isGrouped, groupedCount]);

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
      
      // Pour les câbles groupés, afficher le nombre de fils
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

    // Couleurs des fils groupés (pour l'affichage décoratif)
    const groupedColors = useMemo(() => {
      if (!isGrouped || !data?.groupedEdges) return [];
      return data.groupedEdges.map((ge) => {
        if (ge.data?.electricalType === "230v" && ge.data?.wire) {
          const wireColors: Record<string, string> = {
            phase: ELECTRICAL_CONNECTOR_COLORS["230v-L"],
            neutral: ELECTRICAL_CONNECTOR_COLORS["230v-N"],
            earth: ELECTRICAL_CONNECTOR_COLORS["pe"],
          };
          return wireColors[ge.data.wire] || "#6B7280";
        }
        if (ge.data?.electricalType === "12v" && ge.data?.polarity) {
          return ge.data.polarity === "positive" 
            ? ELECTRICAL_CONNECTOR_COLORS["12v+"] 
            : ELECTRICAL_CONNECTOR_COLORS["12v-"];
        }
        if (ge.data?.waterType) {
          return WATER_COLORS[ge.data.waterType];
        }
        return "#6B7280";
      });
    }, [isGrouped, data]);

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

        {/* Câble groupé : gaine externe */}
        {isGrouped && (
          <path
            d={edgePath}
            fill="none"
            stroke="#1F2937"
            strokeWidth={strokeWidth + 4}
            strokeLinecap="round"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Ligne principale */}
        <BaseEdge id={id} path={edgePath} style={edgeStyle} />

        {/* Câble groupé : fils internes (décoratifs) */}
        {isGrouped && groupedColors.length > 0 && (
          <>
            {groupedColors.map((color, idx) => {
              const offset = (idx - (groupedColors.length - 1) / 2) * 2;
              return (
                <path
                  key={idx}
                  d={edgePath}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  style={{ 
                    pointerEvents: "none",
                    transform: `translate(0, ${offset}px)`,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Pointillés pour 230V (non groupé) */}
        {!isGrouped && data?.connectionType === "electrical" && data.electricalType === "230v" && (
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
                className="text-[10px] px-1.5 py-0.5 shadow-sm flex items-center gap-1"
                style={{
                  background: selected ? strokeColor : "white",
                  color: selected ? "white" : strokeColor,
                  borderColor: strokeColor,
                }}
              >
                {isGrouped && <Cable className="h-3 w-3" />}
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
