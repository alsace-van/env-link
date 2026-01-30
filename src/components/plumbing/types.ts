// ============================================
// TYPES & CONSTANTES - PlumbingCanvas
// Circuit d'eau pour fourgon aménagé
// VERSION: 1.3 - Ajout isGrouped/groupedEdges pour regroupement câbles
// ============================================

import { Node, Edge } from "@xyflow/react";

// ============================================
// TYPES DE CONNEXION
// ============================================

export type WaterType = "cold" | "hot" | "waste";
export type ElectricalType = "12v" | "230v" | "none";
export type Polarity12V = "positive" | "negative";
export type Wire230V = "phase" | "neutral" | "earth";
export type ConnectorSide = "left" | "right" | "top" | "bottom";
export type ConnectorDirection = "in" | "out" | "bidirectional";

// Types de connecteurs électriques unifiés
export type ElectricalConnectorType = 
  | "12v+" 
  | "12v-" 
  | "230v-L" 
  | "230v-N" 
  | "230v-PE";

export type PlumbingCategory =
  | "source"
  | "storage"
  | "distribution"
  | "fitting"
  | "filter"
  | "electrical"
  | "other";

export type ThreadType = "3/8" | "1/2" | "3/4" | "1" | "none";
export type PipeDiameter = 8 | 10 | 12 | 15 | 20 | 30 | 40;
export type CableSection = 0.5 | 0.75 | 1 | 1.5 | 2.5 | 4 | 6 | 10;

// ============================================
// CONFIGURATION DES CONNECTEURS
// ============================================

export interface WaterConnector {
  id: string;
  waterType: WaterType;
  side: ConnectorSide;
  direction: ConnectorDirection;
}

export interface ElectricalConnector {
  id: string;
  type: ElectricalConnectorType;
  side: ConnectorSide;
  direction: ConnectorDirection;
}

export interface ConnectorConfig {
  water: WaterConnector[];
  electrical: ElectricalConnector[];
}

// Labels pour l'UI
export const WATER_TYPE_LABELS: Record<WaterType, string> = {
  cold: "Eau froide",
  hot: "Eau chaude",
  waste: "Eau usée",
};

export const ELECTRICAL_CONNECTOR_LABELS: Record<ElectricalConnectorType, string> = {
  "12v+": "12V +",
  "12v-": "12V -",
  "230v-L": "230V Phase (L)",
  "230v-N": "230V Neutre (N)",
  "230v-PE": "230V Terre (PE)",
};

export const SIDE_LABELS: Record<ConnectorSide, string> = {
  left: "Gauche",
  right: "Droite",
  top: "Haut",
  bottom: "Bas",
};

export const DIRECTION_LABELS: Record<ConnectorDirection, string> = {
  in: "Entrée",
  out: "Sortie",
  bidirectional: "Bidirectionnel",
};

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
  electrical: "#EF4444",
  other: "#EC4899",
};

export const CATEGORY_ICONS: Record<PlumbingCategory, string> = {
  source: "💧",
  storage: "🛢️",
  distribution: "🚰",
  fitting: "🔧",
  filter: "🔬",
  electrical: "⚡",
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
  // Nouveau système de configuration des connecteurs
  connectorConfig: ConnectorConfig;
  // Legacy - pour rétrocompatibilité (sera converti en connectorConfig)
  waterConnections?: {
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

// Fonction utilitaire pour convertir l'ancien format vers le nouveau
export function convertLegacyConnections(data: Partial<PlumbingBlockData>): ConnectorConfig {
  const config: ConnectorConfig = {
    water: [],
    electrical: [],
  };

  // Convertir les connexions eau legacy
  if (data.waterConnections) {
    data.waterConnections.inputs.forEach((input) => {
      config.water.push({
        id: input.id,
        waterType: input.waterType,
        side: input.position,
        direction: "in",
      });
    });
    data.waterConnections.outputs.forEach((output) => {
      config.water.push({
        id: output.id,
        waterType: output.waterType,
        side: output.position,
        direction: "out",
      });
    });
  }

  // Convertir les connexions électriques legacy
  if (data.electricalType && data.electricalType !== "none") {
    if (data.electricalType === "12v") {
      config.electrical.push(
        { id: "elec-12v-pos", type: "12v+", side: "left", direction: "in" },
        { id: "elec-12v-neg", type: "12v-", side: "left", direction: "in" }
      );
    } else if (data.electricalType === "230v") {
      config.electrical.push(
        { id: "elec-230v-L", type: "230v-L", side: "left", direction: "in" },
        { id: "elec-230v-N", type: "230v-N", side: "left", direction: "in" },
        { id: "elec-230v-PE", type: "230v-PE", side: "left", direction: "in" }
      );
    }
  }

  return config;
}

// Fonction pour obtenir la config (avec fallback legacy)
export function getConnectorConfig(data: PlumbingBlockData): ConnectorConfig {
  if (data.connectorConfig && (data.connectorConfig.water.length > 0 || data.connectorConfig.electrical.length > 0)) {
    return data.connectorConfig;
  }
  return convertLegacyConnections(data);
}

// Couleurs des connecteurs électriques
export const ELECTRICAL_CONNECTOR_COLORS: Record<ElectricalConnectorType, string> = {
  "12v+": "#DC2626", // Rouge
  "12v-": "#171717", // Noir
  "230v-L": "#92400E", // Marron
  "230v-N": "#1D4ED8", // Bleu
  "230v-PE": "#84CC16", // Vert/Jaune
};

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
  // Regroupement de câbles
  isGrouped?: boolean;
  groupedEdges?: Array<{
    id: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: PlumbingEdgeData;
  }>;
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
  // DISTRIBUTION ÉLECTRIQUE
  {
    label: "Jonction 12V+",
    category: "electrical",
    icon: "●",
    description: "Point de dérivation 12V positif",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "p1", type: "12v+", side: "left", direction: "bidirectional" },
        { id: "p2", type: "12v+", side: "top", direction: "bidirectional" },
        { id: "p3", type: "12v+", side: "right", direction: "bidirectional" },
        { id: "p4", type: "12v+", side: "bottom", direction: "bidirectional" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Jonction 12V-",
    category: "electrical",
    icon: "●",
    description: "Point de dérivation 12V négatif (masse)",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "p1", type: "12v-", side: "left", direction: "bidirectional" },
        { id: "p2", type: "12v-", side: "top", direction: "bidirectional" },
        { id: "p3", type: "12v-", side: "right", direction: "bidirectional" },
        { id: "p4", type: "12v-", side: "bottom", direction: "bidirectional" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Jonction 230V-L",
    category: "electrical",
    icon: "●",
    description: "Point de dérivation Phase",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "p1", type: "230v-L", side: "left", direction: "bidirectional" },
        { id: "p2", type: "230v-L", side: "top", direction: "bidirectional" },
        { id: "p3", type: "230v-L", side: "right", direction: "bidirectional" },
        { id: "p4", type: "230v-L", side: "bottom", direction: "bidirectional" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Jonction 230V-N",
    category: "electrical",
    icon: "●",
    description: "Point de dérivation Neutre",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "p1", type: "230v-N", side: "left", direction: "bidirectional" },
        { id: "p2", type: "230v-N", side: "top", direction: "bidirectional" },
        { id: "p3", type: "230v-N", side: "right", direction: "bidirectional" },
        { id: "p4", type: "230v-N", side: "bottom", direction: "bidirectional" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Jonction PE",
    category: "electrical",
    icon: "●",
    description: "Point de dérivation Terre",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "p1", type: "230v-PE", side: "left", direction: "bidirectional" },
        { id: "p2", type: "230v-PE", side: "top", direction: "bidirectional" },
        { id: "p3", type: "230v-PE", side: "right", direction: "bidirectional" },
        { id: "p4", type: "230v-PE", side: "bottom", direction: "bidirectional" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Busbar + (12V)",
    category: "electrical",
    icon: "➕",
    description: "Barre de distribution positive 12V - 6 sorties",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "in1", type: "12v+", side: "left", direction: "in" },
        { id: "out1", type: "12v+", side: "right", direction: "out" },
        { id: "out2", type: "12v+", side: "right", direction: "out" },
        { id: "out3", type: "12v+", side: "right", direction: "out" },
        { id: "out4", type: "12v+", side: "right", direction: "out" },
        { id: "out5", type: "12v+", side: "right", direction: "out" },
        { id: "out6", type: "12v+", side: "right", direction: "out" },
      ],
    },
    cable_section: 6,
  },
  {
    label: "Busbar - (12V)",
    category: "electrical",
    icon: "➖",
    description: "Barre de distribution négative 12V (masse) - 6 sorties",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "in1", type: "12v-", side: "left", direction: "in" },
        { id: "out1", type: "12v-", side: "right", direction: "out" },
        { id: "out2", type: "12v-", side: "right", direction: "out" },
        { id: "out3", type: "12v-", side: "right", direction: "out" },
        { id: "out4", type: "12v-", side: "right", direction: "out" },
        { id: "out5", type: "12v-", side: "right", direction: "out" },
        { id: "out6", type: "12v-", side: "right", direction: "out" },
      ],
    },
    cable_section: 6,
  },
  {
    label: "Bornier 230V",
    category: "electrical",
    icon: "🔌",
    description: "Bornier de raccordement 230V tripôle",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        // Entrées
        { id: "inL", type: "230v-L", side: "left", direction: "in" },
        { id: "inN", type: "230v-N", side: "left", direction: "in" },
        { id: "inPE", type: "230v-PE", side: "left", direction: "in" },
        // Sorties
        { id: "outL", type: "230v-L", side: "right", direction: "out" },
        { id: "outN", type: "230v-N", side: "right", direction: "out" },
        { id: "outPE", type: "230v-PE", side: "right", direction: "out" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Wago 3 entrées",
    category: "electrical",
    icon: "🟧",
    description: "Connecteur rapide Wago - 3 positions",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "p1", type: "12v+", side: "left", direction: "bidirectional" },
        { id: "p2", type: "12v+", side: "top", direction: "bidirectional" },
        { id: "p3", type: "12v+", side: "right", direction: "bidirectional" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Wago 5 entrées",
    category: "electrical",
    icon: "🟧",
    description: "Connecteur rapide Wago - 5 positions",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "p1", type: "12v+", side: "left", direction: "bidirectional" },
        { id: "p2", type: "12v+", side: "left", direction: "bidirectional" },
        { id: "p3", type: "12v+", side: "top", direction: "bidirectional" },
        { id: "p4", type: "12v+", side: "right", direction: "bidirectional" },
        { id: "p5", type: "12v+", side: "right", direction: "bidirectional" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Barre de terre",
    category: "electrical",
    icon: "🌍",
    description: "Barre de terre (PE) - 4 connexions",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "pe1", type: "230v-PE", side: "left", direction: "bidirectional" },
        { id: "pe2", type: "230v-PE", side: "top", direction: "bidirectional" },
        { id: "pe3", type: "230v-PE", side: "right", direction: "bidirectional" },
        { id: "pe4", type: "230v-PE", side: "bottom", direction: "bidirectional" },
      ],
    },
    cable_section: 4,
  },
  {
    label: "Fusible 12V",
    category: "electrical",
    icon: "🔒",
    description: "Porte-fusible 12V",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "in", type: "12v+", side: "left", direction: "in" },
        { id: "out", type: "12v+", side: "right", direction: "out" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Disjoncteur 230V",
    category: "electrical",
    icon: "🔲",
    description: "Disjoncteur modulaire 230V",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "inL", type: "230v-L", side: "top", direction: "in" },
        { id: "inN", type: "230v-N", side: "top", direction: "in" },
        { id: "outL", type: "230v-L", side: "bottom", direction: "out" },
        { id: "outN", type: "230v-N", side: "bottom", direction: "out" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Différentiel 30mA",
    category: "electrical",
    icon: "🛡️",
    description: "Interrupteur différentiel 30mA",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "inL", type: "230v-L", side: "top", direction: "in" },
        { id: "inN", type: "230v-N", side: "top", direction: "in" },
        { id: "outL", type: "230v-L", side: "bottom", direction: "out" },
        { id: "outN", type: "230v-N", side: "bottom", direction: "out" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Batterie 12V",
    category: "electrical",
    icon: "🔋",
    description: "Batterie auxiliaire 12V",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "plus", type: "12v+", side: "right", direction: "out" },
        { id: "minus", type: "12v-", side: "right", direction: "out" },
      ],
    },
    cable_section: 10,
  },
  {
    label: "Prise 230V",
    category: "electrical",
    icon: "🔌",
    description: "Prise de courant 230V",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "L", type: "230v-L", side: "left", direction: "in" },
        { id: "N", type: "230v-N", side: "left", direction: "in" },
        { id: "PE", type: "230v-PE", side: "left", direction: "in" },
      ],
    },
    cable_section: 2.5,
  },
  {
    label: "Prise extérieure CEE",
    category: "electrical",
    icon: "🔵",
    description: "Prise camping 230V (entrée secteur)",
    waterConnections: { inputs: [], outputs: [] },
    electricalType: "none",
    connectorConfig: {
      water: [],
      electrical: [
        { id: "L", type: "230v-L", side: "right", direction: "out" },
        { id: "N", type: "230v-N", side: "right", direction: "out" },
        { id: "PE", type: "230v-PE", side: "right", direction: "out" },
      ],
    },
    cable_section: 2.5,
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
  if (data.connectionType === "water") {
    // Épaisseur proportionnelle au diamètre du tuyau
    // Diamètres: 10, 12, 15, 16, 18, 20, 22, 25, 28, 32mm
    const diameter = data.pipe_diameter || 12;
    // Échelle: 10mm → 4px, 32mm → 12px
    return Math.max(4, Math.min(12, Math.round(diameter / 3)));
  } else {
    // Épaisseur proportionnelle à la section du câble
    // Sections: 0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25mm²
    const section = data.cable_section || 1.5;
    // Échelle: 0.5mm² → 1px, 25mm² → 6px
    if (section <= 1) return 1;
    if (section <= 2.5) return 2;
    if (section <= 6) return 3;
    if (section <= 16) return 4;
    return 5;
  }
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
