// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.3 - Câbles groupés avec fils parallèles
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
        // Afficher les types de fils
        const wireTypes: string[] = [];
        groupedEdges.forEach((ge: any) => {
          if (ge.data?.electricalType === "230v" && ge.data?.wire) {
            wireTypes.push({ phase: "L", neutral: "N", earth: "PE" }[ge.data.wire] || "");
          } else if (ge.data?.electricalType === "12v" && ge.data?.polarity) {
            wireTypes.push(ge.data.polarity === "positive" ? "+" : "-");
          }
        });
        if (wireTypes.length > 0) {
          return wireTypes.join("+");
        }
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
    }, [data, isGrouped, groupedCount, groupedEdges]);

    // Couleurs des fils groupés
    const groupedWireColors = useMemo(() => {
      if (!isGrouped || !groupedEdges.length) return [];
      return groupedEdges.map((ge: any) => {
        if (ge.data?.electricalType === "230v" && ge.data?.wire) {
          const wireColors: Record<string, string> = {
            phase: ELECTRICAL_CONNECTOR_COLORS["230v-L"],
            neutral: ELECTRICAL_CONNECTOR_COLORS["230v-N"],
            earth: ELECTRICAL_CONNECTOR_COLORS["pe"],
          };
          return wireColors[ge.data.wire] || "#6B7280";
        } else if (ge.data?.electricalType === "12v" && ge.data?.polarity) {
          return ge.data.polarity === "positive" 
            ? ELECTRICAL_CONNECTOR_COLORS["12v+"] 
            : ELECTRICAL_CONNECTOR_COLORS["12v-"];
        } else if (ge.data?.waterType) {
          return WATER_COLORS[ge.data.waterType];
        }
        return "#6B7280";
      });
    }, [isGrouped, groupedEdges]);

    // Rendu pour câble groupé
    if (isGrouped && groupedWireColors.length > 0) {
      const gaineWidth = groupedCount * 4 + 8;
      
      return (
        <>
          {/* Zone de clic élargie */}
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={gaineWidth + 20}
            style={{ cursor: "pointer" }}
          />

          {/* Gaine externe (noir) */}
          <path
            d={edgePath}
            fill="none"
            stroke="#1F2937"
            strokeWidth={gaineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          />

          {/* Gaine interne (gris foncé) */}
          <path
            d={edgePath}
            fill="none"
            stroke="#374151"
            strokeWidth={gaineWidth - 4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          />

          {/* Fils colorés côte à côte */}
          {groupedWireColors.map((color: string, idx: number) => (
            <path
              key={idx}
              d={edgePath}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={idx === 0 ? "none" : `${8 + idx * 4} ${4 + idx * 2}`}
              strokeDashoffset={idx * 6}
              style={{ pointerEvents: "none" }}
            />
          ))}

          {/* Sélection highlight */}
          {selected && (
            <path
              d={edgePath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={gaineWidth + 4}
              strokeLinecap="round"
              strokeOpacity={0.3}
              style={{ pointerEvents: "none" }}
            />
          )}

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
                  background: selected ? "#1F2937" : "white",
                  color: selected ? "white" : "#1F2937",
                  borderColor: "#1F2937",
                }}
              >
                <Cable className="h-3 w-3" />
                {edgeLabel}
                {/* Indicateurs de couleur des fils */}
                <span className="flex gap-0.5 ml-1">
                  {groupedWireColors.map((color: string, idx: number) => (
                    <span
                      key={idx}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
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
