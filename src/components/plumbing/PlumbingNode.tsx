// ============================================
// COMPOSANT: PlumbingNode
// Bloc plomberie pour ReactFlow
// VERSION: 1.1 - Connecteurs dynamiques via connectorConfig
// ============================================

import React, { memo, useMemo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  PlumbingBlockData,
  WATER_COLORS,
  CATEGORY_COLORS,
  WaterType,
  ConnectorSide,
  getConnectorConfig,
  ELECTRICAL_CONNECTOR_COLORS,
  WATER_TYPE_LABELS,
  ELECTRICAL_CONNECTOR_LABELS,
} from "./types";

const positionMap: Record<ConnectorSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

function getWaterLabel(type: WaterType): string {
  return WATER_TYPE_LABELS[type] || type;
}

// Calcul de l'offset pour répartir les handles sur un côté
function calculateOffset(index: number, total: number): number {
  if (total === 1) return 50;
  const spacing = 70 / (total + 1);
  return 15 + spacing * (index + 1);
}

function getPositionOffset(side: ConnectorSide, percent: number): React.CSSProperties {
  if (side === "top" || side === "bottom") {
    return { left: `${percent}%`, transform: "translateX(-50%)" };
  }
  return { top: `${percent}%`, transform: "translateY(-50%)" };
}

const getHandleStyle = (color: string, isWater: boolean): React.CSSProperties => ({
  width: isWater ? 12 : 8,
  height: isWater ? 12 : 8,
  background: color,
  border: `2px solid ${isWater ? "#FFF" : "#374151"}`,
  borderRadius: isWater ? "50%" : "2px",
});

const PlumbingNode = memo(({ data, selected }: NodeProps<PlumbingBlockData>) => {
  const categoryColor = CATEGORY_COLORS[data.category] || "#6B7280";
  
  // Obtenir la configuration des connecteurs (nouveau ou legacy)
  const config = useMemo(() => getConnectorConfig(data), [data]);

  // Grouper les connecteurs par côté pour calculer les offsets
  const connectorsBySide = useMemo(() => {
    const sides: Record<ConnectorSide, Array<{ type: "water" | "electrical"; index: number }>> = {
      top: [],
      bottom: [],
      left: [],
      right: [],
    };

    config.water.forEach((conn, idx) => {
      sides[conn.side].push({ type: "water", index: idx });
    });

    config.electrical.forEach((conn, idx) => {
      sides[conn.side].push({ type: "electrical", index: idx });
    });

    return sides;
  }, [config]);

  // Handles eau - dynamiques selon config
  const waterHandles = useMemo(() => {
    const handles: JSX.Element[] = [];

    config.water.forEach((conn, idx) => {
      const sideConnectors = connectorsBySide[conn.side];
      const indexInSide = sideConnectors.findIndex((c) => c.type === "water" && c.index === idx);
      const totalInSide = sideConnectors.length;
      const offset = calculateOffset(indexInSide, totalInSide);

      // Déterminer le type de handle selon direction
      const handleType = conn.direction === "out" ? "source" : conn.direction === "in" ? "target" : "source";
      const dirLabel = conn.direction === "in" ? "Entrée" : conn.direction === "out" ? "Sortie" : "↔";

      handles.push(
        <Handle
          key={`water_${conn.id}`}
          type={handleType}
          position={positionMap[conn.side]}
          id={`water_${conn.direction}_${conn.waterType}_${idx}`}
          style={{
            ...getHandleStyle(WATER_COLORS[conn.waterType], true),
            ...getPositionOffset(conn.side, offset),
          }}
          title={`${dirLabel} ${getWaterLabel(conn.waterType)}`}
        />
      );

      // Pour bidirectionnel, ajouter aussi un handle target
      if (conn.direction === "bidirectional") {
        handles.push(
          <Handle
            key={`water_${conn.id}_target`}
            type="target"
            position={positionMap[conn.side]}
            id={`water_in_${conn.waterType}_${idx}`}
            style={{
              ...getHandleStyle(WATER_COLORS[conn.waterType], true),
              ...getPositionOffset(conn.side, offset),
              opacity: 0.5,
            }}
            title={`${dirLabel} ${getWaterLabel(conn.waterType)}`}
          />
        );
      }
    });

    return handles;
  }, [config.water, connectorsBySide]);

  // Handles électriques - dynamiques selon config
  const electricalHandles = useMemo(() => {
    const handles: JSX.Element[] = [];

    config.electrical.forEach((conn, idx) => {
      const sideConnectors = connectorsBySide[conn.side];
      const indexInSide = sideConnectors.findIndex((c) => c.type === "electrical" && c.index === idx);
      const totalInSide = sideConnectors.length;
      const offset = calculateOffset(indexInSide, totalInSide);

      const handleType = conn.direction === "out" ? "source" : "target";
      const color = ELECTRICAL_CONNECTOR_COLORS[conn.type];
      const label = ELECTRICAL_CONNECTOR_LABELS[conn.type];

      handles.push(
        <Handle
          key={`elec_${conn.id}`}
          type={handleType}
          position={positionMap[conn.side]}
          id={`elec_${conn.type}_${idx}`}
          style={{
            ...getHandleStyle(color, false),
            ...getPositionOffset(conn.side, offset),
          }}
          title={label}
        />
      );

      // Pour bidirectionnel
      if (conn.direction === "bidirectional") {
        handles.push(
          <Handle
            key={`elec_${conn.id}_source`}
            type="source"
            position={positionMap[conn.side]}
            id={`elec_${conn.type}_out_${idx}`}
            style={{
              ...getHandleStyle(color, false),
              ...getPositionOffset(conn.side, offset),
              opacity: 0.5,
            }}
            title={label}
          />
        );
      }
    });

    return handles;
  }, [config.electrical, connectorsBySide]);

  // Indicateurs de type électrique (pour affichage)
  const electricalType = useMemo(() => {
    if (config.electrical.length === 0) return "none";
    const has12v = config.electrical.some((c) => c.type.startsWith("12v"));
    const has230v = config.electrical.some((c) => c.type.startsWith("230v"));
    if (has12v && has230v) return "mixed";
    return has12v ? "12v" : has230v ? "230v" : "none";
  }, [config.electrical]);

  return (
    <TooltipProvider>
      <div
        style={{
          background: "white",
          border: `2px solid ${selected ? "#3B82F6" : categoryColor}`,
          borderRadius: "8px",
          padding: "8px",
          minWidth: "160px",
          maxWidth: "200px",
          boxShadow: selected
            ? "0 0 0 2px rgba(59, 130, 246, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            : "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span style={{ fontSize: "20px" }}>{data.icon}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#1F2937",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {data.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{data.label}</p>
              {data.description && <p className="text-xs text-gray-500">{data.description}</p>}
              {data.marque && <p className="text-xs text-gray-400">{data.marque}</p>}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Image */}
        {data.image_url && (
          <img
            src={data.image_url}
            alt={data.label}
            style={{ width: "100%", height: "40px", objectFit: "cover", borderRadius: "4px", marginTop: "4px" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}

        {/* Détails */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
          {data.capacity_liters && (
            <Badge variant="outline" className="text-[9px] px-1 h-4">{data.capacity_liters}L</Badge>
          )}
          {data.flow_rate_lpm && (
            <Badge variant="outline" className="text-[9px] px-1 h-4">{data.flow_rate_lpm}L/min</Badge>
          )}
          {data.power_watts && electricalType !== "none" && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 h-4"
              style={{
                borderColor: electricalType === "230v" ? "#92400E" : "#DC2626",
                color: electricalType === "230v" ? "#92400E" : "#DC2626",
              }}
            >
              {data.power_watts}W {electricalType.toUpperCase()}
            </Badge>
          )}
          {data.pipe_diameter && (
            <Badge variant="outline" className="text-[9px] px-1 h-4" style={{ borderColor: WATER_COLORS.cold }}>
              Ø{data.pipe_diameter}mm
            </Badge>
          )}
          {data.thread_type && data.thread_type !== "none" && (
            <Badge variant="outline" className="text-[9px] px-1 h-4">{data.thread_type}"</Badge>
          )}
          {data.cable_section && (
            <Badge variant="outline" className="text-[9px] px-1 h-4">{data.cable_section}mm²</Badge>
          )}
          {data.prix_unitaire && (
            <Badge variant="secondary" className="text-[9px] px-1 h-4">{data.prix_unitaire.toFixed(2)}€</Badge>
          )}
          {data.in_quote && (
            <Badge className="text-[9px] px-1 h-4 bg-green-500">Devis</Badge>
          )}
          {/* Indicateur nombre de connecteurs */}
          {(config.water.length > 0 || config.electrical.length > 0) && (
            <Badge variant="outline" className="text-[9px] px-1 h-4">
              {config.water.length > 0 && `💧${config.water.length}`}
              {config.water.length > 0 && config.electrical.length > 0 && " "}
              {config.electrical.length > 0 && `⚡${config.electrical.length}`}
            </Badge>
          )}
        </div>

        {waterHandles}
        {electricalHandles}
      </div>
    </TooltipProvider>
  );
});

PlumbingNode.displayName = "PlumbingNode";

export default PlumbingNode;
