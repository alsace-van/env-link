// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.0
// ============================================

import React, { memo, useMemo } from "react";
import { EdgeProps, getSmoothStepPath, BaseEdge, EdgeLabelRenderer } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import {
  PlumbingEdgeData,
  getConnectionColor,
  getConnectionStrokeWidth,
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

    const strokeColor = useMemo(() => {
      if (!data) return "#9CA3AF";
      return getConnectionColor(data);
    }, [data]);

    const strokeWidth = useMemo(() => {
      if (!data) return 2;
      return getConnectionStrokeWidth(data);
    }, [data]);

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
    }, [data]);

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
