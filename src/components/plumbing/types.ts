// ============================================
// TYPES & CONSTANTES - PlumbingCanvas
// Circuit d'eau pour fourgon aménagé
// VERSION: 1.0
// ============================================

import { Node, Edge } from "@xyflow/react";

// ============================================
// TYPES DE CONNEXION
// ============================================

export type WaterType = "cold" | "hot" | "waste";
export type ElectricalType = "12v" | "230v" | "none";
export type Polarity12V = "positive" | "negative";
export type Wire230V = "phase" | "neutral" | "earth";

export type PlumbingCategory =
  | "source"
  | "storage"
  | "distribution"
  | "fitting"
  | "filter"
  | "other";

export type ThreadType = "3/8" | "1/2" | "3/4" | "1" | "none";
export type PipeDiameter = 8 | 10 | 12 | 15 | 20 | 30 | 40;
export type CableSection = 0.5 | 0.75 | 1 | 1.5 | 2.5 | 4 | 6 | 10;

// ============================================
// COULEURS
// ============================================

export const WATER_COLORS: Record<WaterType, string> = {
  cold: "#60A5FA",
  hot: "#F87171",
  waste: "#9CA3AF",
};

export const COLORS_12V: Record<Polarity12V, string> = {
  positive: "#DC2626",
  negative: "#171717",
};

export const COLORS_230V: Record<Wire230V, string> = {
  phase: "#92400E",
  neutral: "#1D4ED8",
  earth: "#84CC16",
};

export const CATEGORY_COLORS: Record<PlumbingCategory, string> = {
  source: "#3B82F6",
  storage: "#10B981",
  distribution: "#F59E0B",
  fitting: "#6B7280",
  filter: "#8B5CF6",
  other: "#EC4899",
};

export const CATEGORY_ICONS: Record<PlumbingCategory, string> = {
  source: "💧",
  storage: "🛢️",
  distribution: "🚰",
  fitting: "🔧",
  filter: "🔬",
  other: "📦",
};

// ============================================
// ÉPAISSEURS
// ============================================

export const WATER_STROKE_WIDTH = 6;
export const ELECTRICAL_STROKE_WIDTH = 2;

// ============================================
// VALEURS DISPONIBLES
// ============================================

export const PIPE_DIAMETERS: PipeDiameter[] = [8, 10, 12, 15, 20, 30, 40];
export const CABLE_SECTIONS: CableSection[] = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10];
export const THREAD_TYPES: ThreadType[] = ["3/8", "1/2", "3/4", "1", "none"];

// ============================================
// INTERFACES
// ============================================

export interface PlumbingBlockData {
  label: string;
  category: PlumbingCategory;
  icon: string;
  description?: string;
  capacity_liters?: number;
  flow_rate_lpm?: number;
  waterConnections: {
    inputs: Array<{ id: string; waterType: WaterType; position: "top" | "bottom" | "left" | "right" }>;
    outputs: Array<{ id: string; waterType: WaterType; position: "top" | "bottom" | "left" | "right" }>;
  };
  electricalType: ElectricalType;
  power_watts?: number;
  voltage?: number;
  thread_type?: ThreadType;
  pipe_diameter?: PipeDiameter;
  cable_section?: CableSection;
  accessory_id?: string;
  image_url?: string;
  prix_unitaire?: number;
  marque?: string;
  reference?: string;
  in_quote?: boolean;
  color?: string;
  width?: number;
  height?: number;
}

export interface PlumbingEdgeData {
  connectionType: "water" | "electrical";
  waterType?: WaterType;
  pipe_diameter?: PipeDiameter;
  thread_type?: ThreadType;
  electricalType?: ElectricalType;
  polarity?: Polarity12V;
  wire?: Wire230V;
  cable_section?: CableSection;
  label?: string;
  length_m?: number;
}

export interface PlumbingSchemaState {
  nodes: PlumbingNodeType[];
  edges: PlumbingEdgeType[];
  viewport?: { x: number; y: number; zoom: number };
}

export type PlumbingNodeType = Node<PlumbingBlockData>;
export type PlumbingEdgeType = Edge<PlumbingEdgeData>;

// ============================================
// ÉLÉMENTS PRÉDÉFINIS
// ============================================

export const PLUMBING_ELEMENTS: Omit<PlumbingBlockData, "width" | "height">[] = [
  // SOURCES
  {
    label: "Pompe à eau 12V",
    category: "source",
    icon: "💧",
    description: "Pompe immergée ou de surface",
    flow_rate_lpm: 10,
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [{ id: "out1", waterType: "cold", position: "right" }],
    },
    electricalType: "12v",
    power_watts: 60,
    pipe_diameter: 12,
    cable_section: 2.5,
  },
  {
    label: "Pompe submersible",
    category: "source",
    icon: "🔌",
    description: "Pompe immergée dans le réservoir",
    flow_rate_lpm: 8,
    waterConnections: {
      inputs: [],
      outputs: [{ id: "out1", waterType: "cold", position: "right" }],
    },
    electricalType: "12v",
    power_watts: 40,
    pipe_diameter: 10,
    cable_section: 1.5,
  },
  {
    label: "Arrivée ville",
    category: "source",
    icon: "🏠",
    description: "Raccordement eau de ville",
    waterConnections: {
      inputs: [],
      outputs: [{ id: "out1", waterType: "cold", position: "right" }],
    },
    electricalType: "none",
    thread_type: "1/2",
  },
  // STOCKAGE
  {
    label: "Réservoir eau propre",
    category: "storage",
    icon: "🛢️",
    description: "Réservoir principal eau potable",
    capacity_liters: 100,
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "top" }],
      outputs: [
        { id: "out1", waterType: "cold", position: "bottom" },
        { id: "out2", waterType: "waste", position: "left" },
      ],
    },
    electricalType: "none",
    thread_type: "1/2",
  },
  {
    label: "Réservoir eaux grises",
    category: "storage",
    icon: "🗑️",
    description: "Collecteur eaux usées",
    capacity_liters: 80,
    waterConnections: {
      inputs: [{ id: "in1", waterType: "waste", position: "top" }],
      outputs: [{ id: "out1", waterType: "waste", position: "bottom" }],
    },
    electricalType: "none",
    pipe_diameter: 40,
    thread_type: "1",
  },
  {
    label: "Chauffe-eau 12V",
    category: "storage",
    icon: "🔥",
    description: "Boiler électrique 12V",
    capacity_liters: 10,
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [{ id: "out1", waterType: "hot", position: "right" }],
    },
    electricalType: "12v",
    power_watts: 200,
    cable_section: 4,
    thread_type: "1/2",
  },
  {
    label: "Chauffe-eau 230V",
    category: "storage",
    icon: "🔥",
    description: "Boiler électrique 230V",
    capacity_liters: 15,
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [{ id: "out1", waterType: "hot", position: "right" }],
    },
    electricalType: "230v",
    power_watts: 1500,
    cable_section: 2.5,
    thread_type: "1/2",
  },
  // DISTRIBUTION
  {
    label: "Robinet mitigeur",
    category: "distribution",
    icon: "🚰",
    description: "Mitigeur eau chaude/froide",
    waterConnections: {
      inputs: [
        { id: "in1", waterType: "cold", position: "left" },
        { id: "in2", waterType: "hot", position: "left" },
      ],
      outputs: [],
    },
    electricalType: "none",
    thread_type: "3/8",
  },
  {
    label: "Évier",
    category: "distribution",
    icon: "🍽️",
    description: "Évier de cuisine",
    waterConnections: {
      inputs: [
        { id: "in1", waterType: "cold", position: "top" },
        { id: "in2", waterType: "hot", position: "top" },
      ],
      outputs: [{ id: "out1", waterType: "waste", position: "bottom" }],
    },
    electricalType: "none",
    pipe_diameter: 40,
  },
  {
    label: "Douche",
    category: "distribution",
    icon: "🚿",
    description: "Bac de douche",
    waterConnections: {
      inputs: [
        { id: "in1", waterType: "cold", position: "top" },
        { id: "in2", waterType: "hot", position: "top" },
      ],
      outputs: [{ id: "out1", waterType: "waste", position: "bottom" }],
    },
    electricalType: "none",
    pipe_diameter: 40,
  },
  // RACCORDS
  {
    label: "Té",
    category: "fitting",
    icon: "⊤",
    description: "Raccord en T",
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [
        { id: "out1", waterType: "cold", position: "right" },
        { id: "out2", waterType: "cold", position: "bottom" },
      ],
    },
    electricalType: "none",
  },
  {
    label: "Vanne d'arrêt",
    category: "fitting",
    icon: "⊗",
    description: "Vanne quart de tour",
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [{ id: "out1", waterType: "cold", position: "right" }],
    },
    electricalType: "none",
    thread_type: "1/2",
  },
  {
    label: "Clapet anti-retour",
    category: "fitting",
    icon: "◄",
    description: "Empêche le retour d'eau",
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [{ id: "out1", waterType: "cold", position: "right" }],
    },
    electricalType: "none",
    thread_type: "1/2",
  },
  {
    label: "Siphon",
    category: "fitting",
    icon: "⌒",
    description: "Siphon anti-odeur",
    waterConnections: {
      inputs: [{ id: "in1", waterType: "waste", position: "top" }],
      outputs: [{ id: "out1", waterType: "waste", position: "bottom" }],
    },
    electricalType: "none",
    pipe_diameter: 40,
  },
  // FILTRATION
  {
    label: "Filtre à eau",
    category: "filter",
    icon: "🔬",
    description: "Filtre standard",
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [{ id: "out1", waterType: "cold", position: "right" }],
    },
    electricalType: "none",
    thread_type: "1/2",
  },
  {
    label: "Stérilisateur UV",
    category: "filter",
    icon: "☀️",
    description: "Stérilisation par UV",
    waterConnections: {
      inputs: [{ id: "in1", waterType: "cold", position: "left" }],
      outputs: [{ id: "out1", waterType: "cold", position: "right" }],
    },
    electricalType: "12v",
    power_watts: 15,
    cable_section: 1,
  },
  // AUTRES
  {
    label: "Jauge de niveau",
    category: "other",
    icon: "📊",
    description: "Capteur de niveau d'eau",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "12v",
    power_watts: 1,
    cable_section: 0.5,
  },
];

// ============================================
// HELPERS
// ============================================

export function getConnectionColor(data: PlumbingEdgeData): string {
  if (data.connectionType === "water" && data.waterType) {
    return WATER_COLORS[data.waterType];
  }
  if (data.connectionType === "electrical") {
    if (data.electricalType === "12v" && data.polarity) {
      return COLORS_12V[data.polarity];
    }
    if (data.electricalType === "230v" && data.wire) {
      return COLORS_230V[data.wire];
    }
  }
  return "#9CA3AF";
}

export function getConnectionStrokeWidth(data: PlumbingEdgeData): number {
  return data.connectionType === "water" ? WATER_STROKE_WIDTH : ELECTRICAL_STROKE_WIDTH;
}

export function calculateTotalCapacity(nodes: PlumbingNodeType[]): {
  freshWater: number;
  greyWater: number;
  hotWater: number;
} {
  let freshWater = 0;
  let greyWater = 0;
  let hotWater = 0;

  nodes.forEach((node) => {
    const data = node.data;
    if (!data.capacity_liters || data.category !== "storage") return;

    const hasHotOutput = data.waterConnections.outputs.some((o) => o.waterType === "hot");
    const hasWasteInput = data.waterConnections.inputs.some((i) => i.waterType === "waste");

    if (hasHotOutput) {
      hotWater += data.capacity_liters;
    } else if (hasWasteInput || data.label.toLowerCase().includes("gris")) {
      greyWater += data.capacity_liters;
    } else {
      freshWater += data.capacity_liters;
    }
  });

  return { freshWater, greyWater, hotWater };
}

export function calculateTotalPower(nodes: PlumbingNodeType[]): {
  power12v: number;
  power230v: number;
} {
  let power12v = 0;
  let power230v = 0;

  nodes.forEach((node) => {
    const data = node.data;
    if (!data.power_watts) return;

    if (data.electricalType === "12v") power12v += data.power_watts;
    else if (data.electricalType === "230v") power230v += data.power_watts;
  });

  return { power12v, power230v };
}

export function countFittings(nodes: PlumbingNodeType[]): Record<string, number> {
  const counts: Record<string, number> = {};
  nodes.forEach((node) => {
    if (node.data.category === "fitting") {
      counts[node.data.label] = (counts[node.data.label] || 0) + 1;
    }
  });
  return counts;
}

export function generateId(): string {
  return `plumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}
