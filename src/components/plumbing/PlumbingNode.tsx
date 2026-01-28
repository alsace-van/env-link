// ============================================
// COMPOSANT: PlumbingNode
// Bloc plomberie pour ReactFlow
// VERSION: 1.0
// ============================================

import React, { memo, useMemo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  PlumbingBlockData,
  WATER_COLORS,
  COLORS_12V,
  COLORS_230V,
  CATEGORY_COLORS,
  WaterType,
} from "./types";

const positionMap: Record<string, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

function getWaterLabel(type: WaterType): string {
  return { cold: "froide", hot: "chaude", waste: "usée" }[type];
}

function calculateOffset(index: number, total: number): number {
  if (total === 1) return 50;
  const spacing = 60 / (total + 1);
  return 20 + spacing * index;
}

function getPositionOffset(position: string, percent: number): Record<string, string> {
  if (position === "top" || position === "bottom") return { left: `${percent}%` };
  return { top: `${percent}%` };
}

const getHandleStyle = (color: string, isWater: boolean) => ({
  width: isWater ? 12 : 8,
  height: isWater ? 12 : 8,
  background: color,
  border: `2px solid ${isWater ? "#FFF" : "#374151"}`,
  borderRadius: isWater ? "50%" : "2px",
});

const PlumbingNode = memo(({ data, selected }: NodeProps<PlumbingBlockData>) => {
  const categoryColor = CATEGORY_COLORS[data.category] || "#6B7280";

  // Handles eau
  const waterHandles = useMemo(() => {
    const handles: JSX.Element[] = [];
    const inputsByPos: Record<string, number> = {};
    const outputsByPos: Record<string, number> = {};

    data.waterConnections.inputs.forEach((input, idx) => {
      inputsByPos[input.position] = (inputsByPos[input.position] || 0) + 1;
      const count = inputsByPos[input.position];
      const total = data.waterConnections.inputs.filter((i) => i.position === input.position).length;

      handles.push(
        <Handle
          key={`water_in_${input.id}`}
          type="target"
          position={positionMap[input.position]}
          id={`water_in_${input.waterType}_${idx}`}
          style={{
            ...getHandleStyle(WATER_COLORS[input.waterType], true),
            ...getPositionOffset(input.position, calculateOffset(count, total)),
          }}
          title={`Entrée eau ${getWaterLabel(input.waterType)}`}
        />
      );
    });

    data.waterConnections.outputs.forEach((output, idx) => {
      outputsByPos[output.position] = (outputsByPos[output.position] || 0) + 1;
      const count = outputsByPos[output.position];
      const total = data.waterConnections.outputs.filter((o) => o.position === output.position).length;

      handles.push(
        <Handle
          key={`water_out_${output.id}`}
          type="source"
          position={positionMap[output.position]}
          id={`water_out_${output.waterType}_${idx}`}
          style={{
            ...getHandleStyle(WATER_COLORS[output.waterType], true),
            ...getPositionOffset(output.position, calculateOffset(count, total)),
          }}
          title={`Sortie eau ${getWaterLabel(output.waterType)}`}
        />
      );
    });

    return handles;
  }, [data.waterConnections]);

  // Handles électriques
  const electricalHandles = useMemo(() => {
    if (data.electricalType === "none") return null;
    const handles: JSX.Element[] = [];

    if (data.electricalType === "12v") {
      handles.push(
        <Handle
          key="elec_12v_pos"
          type="target"
          position={Position.Bottom}
          id="elec_12v_positive"
          style={{ ...getHandleStyle(COLORS_12V.positive, false), left: "30%" }}
          title="12V + (Rouge)"
        />,
        <Handle
          key="elec_12v_neg"
          type="target"
          position={Position.Bottom}
          id="elec_12v_negative"
          style={{ ...getHandleStyle(COLORS_12V.negative, false), left: "70%" }}
          title="12V - (Noir)"
        />
      );
    } else if (data.electricalType === "230v") {
      handles.push(
        <Handle
          key="elec_230v_phase"
          type="target"
          position={Position.Bottom}
          id="elec_230v_phase"
          style={{ ...getHandleStyle(COLORS_230V.phase, false), left: "25%" }}
          title="Phase L (Marron)"
        />,
        <Handle
          key="elec_230v_neutral"
          type="target"
          position={Position.Bottom}
          id="elec_230v_neutral"
          style={{ ...getHandleStyle(COLORS_230V.neutral, false), left: "50%" }}
          title="Neutre N (Bleu)"
        />,
        <Handle
          key="elec_230v_earth"
          type="target"
          position={Position.Bottom}
          id="elec_230v_earth"
          style={{ ...getHandleStyle(COLORS_230V.earth, false), left: "75%" }}
          title="Terre PE (J/V)"
        />
      );
    }
    return handles;
  }, [data.electricalType]);

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
          {data.power_watts && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 h-4"
              style={{
                borderColor: data.electricalType === "230v" ? COLORS_230V.phase : COLORS_12V.positive,
                color: data.electricalType === "230v" ? COLORS_230V.phase : COLORS_12V.positive,
              }}
            >
              {data.power_watts}W {data.electricalType?.toUpperCase()}
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
        </div>

        {waterHandles}
        {electricalHandles}
      </div>
    </TooltipProvider>
  );
});

PlumbingNode.displayName = "PlumbingNode";

export default PlumbingNode;
