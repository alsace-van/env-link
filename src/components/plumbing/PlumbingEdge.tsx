// ============================================
// COMPOSANT: PlumbingEdge
// Connexion plomberie (tuyau ou câble) pour ReactFlow
// VERSION: 1.4 - Effet éventail aux extrémités + couleurs connecteurs
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

// Fonction pour obtenir la couleur d'un fil depuis son handle ou ses données
function getWireColor(wireData: any): string {
  // Essayer d'extraire le type depuis le sourceHandle
  const handle = wireData.sourceHandle || wireData.targetHandle || "";
  
  // 230V
  if (handle.includes("230v-L") || wireData.data?.wire === "phase") {
    return ELECTRICAL_CONNECTOR_COLORS["230v-L"]; // Marron
  }
  if (handle.includes("230v-N") || wireData.data?.wire === "neutral") {
    return ELECTRICAL_CONNECTOR_COLORS["230v-N"]; // Bleu
  }
  if (handle.includes("pe") || wireData.data?.wire === "earth") {
    return ELECTRICAL_CONNECTOR_COLORS["pe"]; // Vert/Jaune
  }
  
  // 12V
  if (handle.includes("12v+") || wireData.data?.polarity === "positive") {
    return ELECTRICAL_CONNECTOR_COLORS["12v+"]; // Rouge
  }
  if (handle.includes("12v-") || wireData.data?.polarity === "negative") {
    return ELECTRICAL_CONNECTOR_COLORS["12v-"]; // Noir
  }
  
  // Eau
  if (wireData.data?.waterType) {
    return WATER_COLORS[wireData.data.waterType];
  }
  
  // Fallback
  return "#6B7280";
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
        const wireTypes: string[] = [];
        groupedEdges.forEach((ge: any) => {
          const handle = ge.sourceHandle || "";
          if (handle.includes("230v-L") || ge.data?.wire === "phase") wireTypes.push("L");
          else if (handle.includes("230v-N") || ge.data?.wire === "neutral") wireTypes.push("N");
          else if (handle.includes("pe") || ge.data?.wire === "earth") wireTypes.push("PE");
          else if (handle.includes("12v+") || ge.data?.polarity === "positive") wireTypes.push("+");
          else if (handle.includes("12v-") || ge.data?.polarity === "negative") wireTypes.push("-");
        });
        if (wireTypes.length > 0) return wireTypes.join("+");
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
    }, [data, isGrouped, groupedCount, groupedEdges]);

    // Données des fils groupés avec couleurs
    const groupedWires = useMemo(() => {
      if (!isGrouped || !groupedEdges.length) return [];
      return groupedEdges.map((ge: any, idx: number) => ({
        ...ge,
        color: getWireColor(ge),
        index: idx,
      }));
    }, [isGrouped, groupedEdges]);

    // Générer les chemins en éventail pour chaque fil
    const fanPaths = useMemo(() => {
      if (!isGrouped || groupedWires.length === 0) return [];
      
      const total = groupedWires.length;
      const spacing = 6; // Espacement entre les fils
      const fanLength = 30; // Longueur de l'éventail
      
      return groupedWires.map((wire: any, idx: number) => {
        const offset = (idx - (total - 1) / 2) * spacing;
        
        // Calculer les points de l'éventail côté source
        let srcFanX = sourceX;
        let srcFanY = sourceY + offset;
        let srcMergeX = sourceX;
        let srcMergeY = sourceY;
        
        if (sourcePosition === Position.Right) {
          srcFanY = sourceY + offset;
          srcMergeX = sourceX + fanLength;
          srcMergeY = sourceY;
        } else if (sourcePosition === Position.Left) {
          srcFanY = sourceY + offset;
          srcMergeX = sourceX - fanLength;
          srcMergeY = sourceY;
        } else if (sourcePosition === Position.Bottom) {
          srcFanX = sourceX + offset;
          srcFanY = sourceY;
          srcMergeX = sourceX;
          srcMergeY = sourceY + fanLength;
        } else if (sourcePosition === Position.Top) {
          srcFanX = sourceX + offset;
          srcFanY = sourceY;
          srcMergeX = sourceX;
          srcMergeY = sourceY - fanLength;
        }
        
        // Calculer les points de l'éventail côté target
        let tgtFanX = targetX;
        let tgtFanY = targetY + offset;
        let tgtMergeX = targetX;
        let tgtMergeY = targetY;
        
        if (targetPosition === Position.Left) {
          tgtFanY = targetY + offset;
          tgtMergeX = targetX - fanLength;
          tgtMergeY = targetY;
        } else if (targetPosition === Position.Right) {
          tgtFanY = targetY + offset;
          tgtMergeX = targetX + fanLength;
          tgtMergeY = targetY;
        } else if (targetPosition === Position.Top) {
          tgtFanX = targetX + offset;
          tgtFanY = targetY;
          tgtMergeX = targetX;
          tgtMergeY = targetY - fanLength;
        } else if (targetPosition === Position.Bottom) {
          tgtFanX = targetX + offset;
          tgtFanY = targetY;
          tgtMergeX = targetX;
          tgtMergeY = targetY + fanLength;
        }
        
        // Chemin complet : source fan → source merge → target merge → target fan
        // Utiliser des courbes de Bézier pour un rendu fluide
        const path = `
          M ${srcFanX} ${srcFanY}
          Q ${srcMergeX} ${srcFanY}, ${srcMergeX} ${srcMergeY}
          L ${tgtMergeX} ${tgtMergeY}
          Q ${tgtMergeX} ${tgtFanY}, ${tgtFanX} ${tgtFanY}
        `;
        
        return {
          ...wire,
          path: path.trim(),
        };
      });
    }, [isGrouped, groupedWires, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

    // Rendu pour câble groupé avec éventail
    if (isGrouped && fanPaths.length > 0) {
      const gaineWidth = groupedCount * 3 + 8;
      
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

          {/* Gaine centrale (entre les zones d'éventail) */}
          <path
            d={edgePath}
            fill="none"
            stroke="#1F2937"
            strokeWidth={gaineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          />

          {/* Fils individuels en éventail */}
          {fanPaths.map((wire: any) => (
            <path
              key={wire.id || wire.index}
              d={wire.path}
              fill="none"
              stroke={wire.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: "none" }}
            />
          ))}

          {/* Sélection highlight */}
          {selected && (
            <path
              d={edgePath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={gaineWidth + 6}
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
                <span className="flex gap-0.5 ml-1">
                  {fanPaths.map((wire: any) => (
                    <span
                      key={wire.id || wire.index}
                      className="w-2 h-2 rounded-full border border-white/50"
                      style={{ backgroundColor: wire.color }}
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
