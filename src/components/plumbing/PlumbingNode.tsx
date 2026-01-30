// ============================================
// COMPOSANT: PlumbingNode
// Bloc plomberie pour ReactFlow
// VERSION: 1.3 - Rendu compact pour jonctions
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

// Constantes pour le calcul des dimensions
const MIN_CONNECTOR_SPACING = 20; // Espacement minimum entre connecteurs en px
const CONNECTOR_SIZE_WATER = 12;
const CONNECTOR_SIZE_ELEC = 8;
const PADDING_EDGE = 16; // Padding depuis le bord du bloc
const BASE_WIDTH = 160;
const BASE_HEIGHT = 80;
const MIN_WIDTH = 140;
const MIN_HEIGHT = 60;

// Calcul de l'offset en pixels pour répartir les handles sur un côté
function calculatePixelOffset(index: number, total: number, dimension: number): number {
  if (total === 1) return dimension / 2;
  const availableSpace = dimension - (PADDING_EDGE * 2);
  const spacing = availableSpace / (total + 1);
  return PADDING_EDGE + spacing * (index + 1);
}

const getHandleStyle = (color: string, isWater: boolean): React.CSSProperties => ({
  width: isWater ? CONNECTOR_SIZE_WATER : CONNECTOR_SIZE_ELEC,
  height: isWater ? CONNECTOR_SIZE_WATER : CONNECTOR_SIZE_ELEC,
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

  // Calculer les dimensions du bloc selon le nombre de connecteurs
  const dimensions = useMemo(() => {
    const topCount = connectorsBySide.top.length;
    const bottomCount = connectorsBySide.bottom.length;
    const leftCount = connectorsBySide.left.length;
    const rightCount = connectorsBySide.right.length;

    // Calculer la largeur minimale nécessaire (basé sur top/bottom)
    const maxHorizontal = Math.max(topCount, bottomCount);
    const neededWidth = maxHorizontal > 0 
      ? PADDING_EDGE * 2 + (maxHorizontal - 1) * MIN_CONNECTOR_SPACING + maxHorizontal * CONNECTOR_SIZE_WATER
      : MIN_WIDTH;

    // Calculer la hauteur minimale nécessaire (basé sur left/right)
    const maxVertical = Math.max(leftCount, rightCount);
    const neededHeight = maxVertical > 0
      ? PADDING_EDGE * 2 + (maxVertical - 1) * MIN_CONNECTOR_SPACING + maxVertical * CONNECTOR_SIZE_WATER
      : MIN_HEIGHT;

    return {
      width: Math.max(BASE_WIDTH, neededWidth),
      height: Math.max(BASE_HEIGHT, neededHeight),
    };
  }, [connectorsBySide]);

  // Fonction pour obtenir le style de position en pixels
  const getPositionStyle = (side: ConnectorSide, index: number, total: number): React.CSSProperties => {
    const isHorizontal = side === "top" || side === "bottom";
    const dimension = isHorizontal ? dimensions.width : dimensions.height;
    const pixelOffset = calculatePixelOffset(index, total, dimension);
    
    if (isHorizontal) {
      return { left: `${pixelOffset}px`, transform: "translateX(-50%)" };
    }
    return { top: `${pixelOffset}px`, transform: "translateY(-50%)" };
  };

  // Handles eau - dynamiques selon config
  const waterHandles = useMemo(() => {
    const handles: JSX.Element[] = [];

    config.water.forEach((conn, idx) => {
      const sideConnectors = connectorsBySide[conn.side];
      const indexInSide = sideConnectors.findIndex((c) => c.type === "water" && c.index === idx);
      const totalInSide = sideConnectors.length;

      const dirLabel = conn.direction === "in" ? "Entrée" : conn.direction === "out" ? "Sortie" : "↔";
      
      // Tous les handles sont bidirectionnels pour permettre les connexions dans les deux sens
      const handleId = `water_${conn.direction}_${conn.waterType}_${idx}`;
      console.log("[PlumbingNode v1.6] Handle eau bidirectionnel:", handleId, "side:", conn.side);

      handles.push(
        <Handle
          key={`water_${conn.id}`}
          type="source"
          position={positionMap[conn.side]}
          id={handleId}
          isConnectableStart={true}
          isConnectableEnd={true}
          style={{
            ...getHandleStyle(WATER_COLORS[conn.waterType], true),
            ...getPositionStyle(conn.side, indexInSide, totalInSide),
          }}
          title={`${dirLabel} ${getWaterLabel(conn.waterType)}`}
        />
      );
    });

    return handles;
  }, [config.water, connectorsBySide, dimensions]);

  // Handles électriques - dynamiques selon config
  const electricalHandles = useMemo(() => {
    const handles: JSX.Element[] = [];

    config.electrical.forEach((conn, idx) => {
      const sideConnectors = connectorsBySide[conn.side];
      const indexInSide = sideConnectors.findIndex((c) => c.type === "electrical" && c.index === idx);
      const totalInSide = sideConnectors.length;

      const color = ELECTRICAL_CONNECTOR_COLORS[conn.type];
      const label = ELECTRICAL_CONNECTOR_LABELS[conn.type];

      // Utiliser un seul handle bidirectionnel pour permettre les connexions dans les deux sens
      handles.push(
        <Handle
          key={`elec_${conn.id}`}
          type="source"
          position={positionMap[conn.side]}
          id={`elec_${conn.type}_${conn.direction}_${idx}`}
          isConnectableStart={true}
          isConnectableEnd={true}
          style={{
            ...getHandleStyle(color, false),
            ...getPositionStyle(conn.side, indexInSide, totalInSide),
          }}
          title={label}
        />
      );
    });

    return handles;
  }, [config.electrical, connectorsBySide, dimensions]);

  // Indicateurs de type électrique (pour affichage)
  const electricalType = useMemo(() => {
    if (config.electrical.length === 0) return "none";
    const has12v = config.electrical.some((c) => c.type.startsWith("12v"));
    const has230v = config.electrical.some((c) => c.type.startsWith("230v"));
    if (has12v && has230v) return "mixed";
    return has12v ? "12v" : has230v ? "230v" : "none";
  }, [config.electrical]);

  // Détecter si c'est une jonction (point de dérivation compact)
  const isJunction = data.label.startsWith("Jonction");
  
  // Couleur de la jonction selon le type de connecteur
  const junctionColor = useMemo(() => {
    if (!isJunction) return "#6B7280";
    // Électrique
    if (config.electrical.length > 0) {
      const connType = config.electrical[0]?.type;
      return ELECTRICAL_CONNECTOR_COLORS[connType] || "#6B7280";
    }
    // Eau
    if (config.water.length > 0) {
      const waterType = config.water[0]?.waterType;
      return WATER_COLORS[waterType] || "#6B7280";
    }
    return "#6B7280";
  }, [isJunction, config.electrical, config.water]);

  // Rendu style collecteur/distributeur pour les jonctions
  if (isJunction) {
    // Compter les connecteurs par côté
    const allConnectors = [...config.water, ...config.electrical];
    const connectorsBySideJunction = {
      left: allConnectors.filter(c => c.side === "left"),
      right: allConnectors.filter(c => c.side === "right"),
      top: allConnectors.filter(c => c.side === "top"),
      bottom: allConnectors.filter(c => c.side === "bottom"),
    };
    
    // Calculer la taille dynamique selon le nombre de connecteurs
    const maxHorizontal = Math.max(connectorsBySideJunction.top.length, connectorsBySideJunction.bottom.length, 1);
    const maxVertical = Math.max(connectorsBySideJunction.left.length, connectorsBySideJunction.right.length, 1);
    
    const handleSpacing = 20; // Espacement entre handles
    const minSize = 24;
    const padding = 8;
    
    const junctionWidth = Math.max(minSize, maxHorizontal * handleSpacing + padding);
    const junctionHeight = Math.max(minSize, maxVertical * handleSpacing + padding);
    
    // Fonction pour calculer la position d'un handle selon son index sur un côté
    const handleSize = 14;
    const getHandlePosition = (side: string, index: number, total: number): React.CSSProperties => {
      const offset = total > 1 
        ? (index - (total - 1) / 2) * handleSpacing
        : 0;
      
      // Centre du handle sur le bord de la jonction
      const edgeOffset = -(handleSize / 2);
      
      switch (side) {
        case "left":
          return { 
            left: `${edgeOffset}px`, 
            top: `calc(50% + ${offset}px)`,
            transform: "translateY(-50%)",
          };
        case "right":
          return { 
            right: `${edgeOffset}px`, 
            top: `calc(50% + ${offset}px)`,
            transform: "translateY(-50%)",
          };
        case "top":
          return { 
            top: `${edgeOffset}px`, 
            left: `calc(50% + ${offset}px)`,
            transform: "translateX(-50%)",
          };
        case "bottom":
          return { 
            bottom: `${edgeOffset}px`, 
            left: `calc(50% + ${offset}px)`,
            transform: "translateX(-50%)",
          };
        default:
          return {};
      }
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              style={{
                width: `${junctionWidth}px`,
                height: `${junctionHeight}px`,
                background: junctionColor,
                border: `3px solid ${selected ? "#3B82F6" : "white"}`,
                borderRadius: junctionWidth > 30 ? "12px" : "50%",
                boxShadow: selected
                  ? "0 0 0 2px rgba(59, 130, 246, 0.5), 0 2px 4px rgba(0,0,0,0.2)"
                  : "0 2px 4px rgba(0,0,0,0.3)",
                cursor: "pointer",
                position: "relative",
              }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{data.label}</p>
            {data.description && <p className="text-xs text-gray-500">{data.description}</p>}
            <p className="text-xs text-gray-400">{allConnectors.length} connexions</p>
          </TooltipContent>
        </Tooltip>
        
        {/* Handles électriques pour jonctions - transparents, seule la jonction est visible */}
        {config.electrical.map((conn, idx) => {
          const sideConnectors = connectorsBySideJunction[conn.side].filter(c => 'type' in c);
          const indexInSide = sideConnectors.findIndex(c => 'type' in c && c.type === conn.type && config.electrical.indexOf(c as any) === idx);
          const totalInSide = sideConnectors.length;
          
          return (
            <Handle
              key={`elec_${conn.id}`}
              type="source"
              position={positionMap[conn.side]}
              id={`elec_${conn.type}_bidirectional_${idx}`}
              isConnectableStart={true}
              isConnectableEnd={true}
              style={{
                ...getHandlePosition(conn.side, indexInSide >= 0 ? indexInSide : 0, totalInSide),
                width: 14,
                height: 14,
                background: "transparent",
                border: "none",
              }}
            />
          );
        })}
        
        {/* Handles eau pour jonctions - transparents */}
        {config.water.map((conn, idx) => {
          const sideConnectors = connectorsBySideJunction[conn.side].filter(c => 'waterType' in c);
          const indexInSide = sideConnectors.findIndex(c => 'waterType' in c && c.waterType === conn.waterType && config.water.indexOf(c as any) === idx);
          const totalInSide = sideConnectors.length;
          
          return (
            <Handle
              key={`water_${conn.id}`}
              type="source"
              position={positionMap[conn.side]}
              id={`water_bidirectional_${conn.waterType}_${idx}`}
              isConnectableStart={true}
              isConnectableEnd={true}
              style={{
                ...getHandlePosition(conn.side, indexInSide >= 0 ? indexInSide : 0, totalInSide),
                width: 14,
                height: 14,
                background: "transparent",
                border: "none",
              }}
            />
          );
        })}
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div
        style={{
          background: "white",
          border: `2px solid ${selected ? "#3B82F6" : categoryColor}`,
          borderRadius: "8px",
          padding: "8px",
          width: `${dimensions.width}px`,
          minHeight: `${dimensions.height}px`,
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
