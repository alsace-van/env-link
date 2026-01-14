// ============================================
// TOOLBAR DEFAULTS
// Configuration par défaut de la toolbar CAD
// VERSION: 1.0 - Création initiale
// ============================================

import {
  ToolDefinition,
  ToolbarConfig,
  ToolbarGroup,
  ToolbarItem,
  ToolCategory,
  generateToolbarId,
} from "./toolbar-types";

// ============================================
// DÉFINITIONS DE TOUS LES OUTILS DISPONIBLES
// ============================================

export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  // ========== LIGNE 1 - FICHIERS ==========
  {
    id: "save",
    label: "Sauvegarder",
    shortcut: "Ctrl+S",
    icon: "Save",
    category: "file",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "import",
    label: "Importer un fichier DXF",
    icon: "FileUp",
    category: "file",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "photos",
    label: "Charger des photos de référence",
    icon: "Image",
    category: "file",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "exportSvg",
    label: "Exporter en SVG",
    icon: "FileDown",
    category: "file",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "exportPng",
    label: "Exporter en PNG",
    icon: "FileImage",
    category: "file",
    renderType: "button-dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "exportDxf",
    label: "Exporter en DXF",
    icon: "Download",
    category: "file",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "exportPdf",
    label: "Exporter en PDF",
    icon: "FileDown",
    category: "file",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "templates",
    label: "Bibliothèque de templates",
    icon: "Library",
    category: "file",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "help",
    label: "Raccourcis clavier",
    icon: "HelpCircle",
    category: "help",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "status",
    label: "Status des contraintes",
    icon: "custom:status",
    category: "display",
    renderType: "display",
    defaultVisible: true,
  },
  {
    id: "fullscreen",
    label: "Plein écran",
    icon: "Maximize",
    category: "view",
    renderType: "toggle",
    defaultVisible: true,
  },

  // ========== LIGNE 2 - OUTILS ==========
  {
    id: "select",
    label: "Sélection",
    shortcut: "V",
    icon: "MousePointer",
    category: "transform",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "pan",
    label: "Déplacer la vue",
    shortcut: "H",
    icon: "Hand",
    category: "transform",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "mirror",
    label: "Symétrie",
    shortcut: "S",
    icon: "FlipHorizontal2",
    category: "transform",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "moveRotate",
    label: "Déplacer / Rotation",
    shortcut: "T",
    icon: "Move",
    category: "transform",
    renderType: "toggle",
    defaultVisible: true,
  },
  {
    id: "line",
    label: "Ligne",
    shortcut: "L",
    icon: "Minus",
    category: "draw",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "circle",
    label: "Cercle",
    shortcut: "C",
    icon: "Circle",
    category: "draw",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "arc3points",
    label: "Arc 3 points",
    shortcut: "A",
    icon: "CircleDot",
    category: "draw",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "rectangle",
    label: "Rectangle",
    icon: "Square",
    category: "draw",
    renderType: "button-dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "bezier",
    label: "Courbe Bézier",
    shortcut: "B",
    icon: "Spline",
    category: "draw",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "spline",
    label: "Spline - Double-clic pour terminer",
    shortcut: "S",
    icon: "custom:spline",
    category: "draw",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "polygon",
    label: "Polygone régulier",
    shortcut: "P",
    icon: "custom:polygon",
    category: "draw",
    renderType: "button-dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "text",
    label: "Texte / Annotation",
    shortcut: "Shift+T",
    icon: "Type",
    category: "draw",
    renderType: "button-dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },

  // ========== OUTILS PHOTOS ==========
  {
    id: "showBackground",
    label: "Afficher/Masquer photos",
    icon: "Eye",
    category: "photo",
    renderType: "toggle",
    conditional: "hasImages",
    defaultVisible: true,
  },
  {
    id: "imageOpacity",
    label: "Opacité des photos",
    icon: "custom:slider",
    category: "photo",
    renderType: "slider",
    conditional: "hasImages",
    defaultVisible: true,
  },
  {
    id: "addMarker",
    label: "Ajouter un marqueur",
    icon: "MapPin",
    category: "photo",
    renderType: "button",
    conditional: "hasImages",
    defaultVisible: true,
  },
  {
    id: "linkMarker",
    label: "Lier deux marqueurs",
    icon: "Link2",
    category: "photo",
    renderType: "button",
    conditional: "hasImages",
    defaultVisible: true,
  },
  {
    id: "calibrate",
    label: "Calibration",
    icon: "Target",
    category: "photo",
    renderType: "button",
    conditional: "hasImages",
    defaultVisible: true,
  },
  {
    id: "adjustEdges",
    label: "Ajuster les contours",
    icon: "Contrast",
    category: "photo",
    renderType: "button",
    conditional: "hasImages",
    defaultVisible: true,
  },
  {
    id: "deletePhotos",
    label: "Supprimer toutes les photos",
    icon: "Trash2",
    category: "photo",
    renderType: "button",
    conditional: "hasImages",
    defaultVisible: true,
  },

  // ========== COTATIONS ET CONTRAINTES ==========
  {
    id: "dimension",
    label: "Cotation",
    shortcut: "D",
    icon: "custom:dimension",
    category: "dimension",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "measure",
    label: "Mesurer",
    shortcut: "M",
    icon: "Ruler",
    category: "dimension",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "constraints",
    label: "Contraintes",
    icon: "Link",
    category: "dimension",
    renderType: "dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "group",
    label: "Grouper",
    shortcut: "Ctrl+G",
    icon: "Group",
    category: "dimension",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "ungroup",
    label: "Dégrouper",
    shortcut: "Ctrl+Shift+G",
    icon: "Ungroup",
    category: "dimension",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "array",
    label: "Répétition / Array",
    icon: "Grid3X3",
    category: "dimension",
    renderType: "button",
    defaultVisible: true,
  },

  // ========== MODIFICATIONS ==========
  {
    id: "fillet",
    label: "Congé",
    icon: "custom:fillet",
    category: "modify",
    renderType: "button-dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "chamfer",
    label: "Chanfrein",
    icon: "custom:chamfer",
    category: "modify",
    renderType: "button-dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "offset",
    label: "Offset - Copie parallèle",
    icon: "custom:offset",
    category: "modify",
    renderType: "button",
    defaultVisible: true,
  },

  // ========== STYLE ==========
  {
    id: "strokeWidth",
    label: "Épaisseur du trait",
    icon: "custom:strokeWidth",
    category: "style",
    renderType: "dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "strokeColor",
    label: "Couleur du trait",
    icon: "custom:colorPicker",
    category: "style",
    renderType: "color-picker",
    defaultVisible: true,
  },

  // ========== VUE ET ZOOM ==========
  {
    id: "zoomOut",
    label: "Zoom arrière",
    icon: "ZoomOut",
    category: "view",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "zoomLevel",
    label: "Niveau de zoom",
    icon: "custom:zoomLevel",
    category: "view",
    renderType: "display",
    defaultVisible: true,
  },
  {
    id: "zoomIn",
    label: "Zoom avant",
    icon: "ZoomIn",
    category: "view",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "fitContent",
    label: "Ajuster au contenu",
    icon: "Scan",
    category: "view",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "resetView",
    label: "Reset vue",
    icon: "RotateCcw",
    category: "view",
    renderType: "button",
    defaultVisible: true,
  },

  // ========== HISTORIQUE ==========
  {
    id: "undo",
    label: "Annuler",
    shortcut: "Ctrl+Z",
    icon: "Undo",
    category: "history",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "redo",
    label: "Refaire",
    shortcut: "Ctrl+Y",
    icon: "Redo",
    category: "history",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "branchSelect",
    label: "Branche active",
    icon: "custom:branch",
    category: "history",
    renderType: "dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },
  {
    id: "newBranch",
    label: "Nouvelle branche",
    icon: "Plus",
    category: "history",
    renderType: "button",
    defaultVisible: true,
  },
  {
    id: "historyPanel",
    label: "Historique et branches",
    icon: "History",
    category: "history",
    renderType: "dropdown",
    hasDropdown: true,
    defaultVisible: true,
  },

  // ========== AFFICHAGE ==========
  {
    id: "toggleGrid",
    label: "Grille",
    icon: "Grid3X3",
    category: "display",
    renderType: "toggle",
    defaultVisible: true,
  },
  {
    id: "toggleA4Grid",
    label: "Grille A4 (export PDF)",
    icon: "FileDown",
    category: "display",
    renderType: "toggle",
    defaultVisible: true,
  },
  {
    id: "toggleSnap",
    label: "Snap (aimantation)",
    icon: "Magnet",
    category: "display",
    renderType: "toggle",
    defaultVisible: true,
  },
  {
    id: "snapActiveLayer",
    label: "Snap calque actif uniquement",
    icon: "Layers",
    category: "display",
    renderType: "toggle",
    defaultVisible: true,
  },
  {
    id: "constructionMode",
    label: "Mode construction",
    icon: "custom:construction",
    category: "display",
    renderType: "toggle",
    defaultVisible: true,
  },
  {
    id: "showConstruction",
    label: "Afficher lignes construction",
    icon: "Eye",
    category: "display",
    renderType: "toggle",
    defaultVisible: true,
  },
  {
    id: "highlightOpacity",
    label: "Opacité surbrillance",
    icon: "custom:highlight",
    category: "display",
    renderType: "slider",
    defaultVisible: true,
  },
];

// ============================================
// GROUPES PAR DÉFAUT
// ============================================

export const DEFAULT_GROUPS: ToolbarGroup[] = [
  {
    id: "grp_save",
    name: "Sauvegarde",
    color: "#3B82F6",
    items: ["save"],
  },
  {
    id: "grp_import_export",
    name: "Import/Export",
    color: "#10B981",
    items: ["import", "photos", "exportSvg", "exportPng", "exportDxf", "exportPdf", "templates"],
  },
  {
    id: "grp_help",
    name: "Aide",
    color: "#8B5CF6",
    items: ["help"],
  },
  {
    id: "grp_select",
    name: "Sélection",
    color: "#3B82F6",
    items: ["select", "pan"],
  },
  {
    id: "grp_transform",
    name: "Transformation",
    color: "#F59E0B",
    items: ["mirror", "moveRotate"],
  },
  {
    id: "grp_draw",
    name: "Dessin",
    color: "#10B981",
    items: ["line", "circle", "arc3points", "rectangle", "bezier", "spline", "polygon", "text"],
  },
  {
    id: "grp_photo",
    name: "Photos",
    color: "#EC4899",
    items: ["showBackground", "imageOpacity", "addMarker", "linkMarker", "calibrate", "adjustEdges", "deletePhotos"],
  },
  {
    id: "grp_dimension",
    name: "Cotations",
    color: "#06B6D4",
    items: ["dimension", "measure", "constraints", "group", "ungroup", "array"],
  },
  {
    id: "grp_modify",
    name: "Modifications",
    color: "#EF4444",
    items: ["fillet", "chamfer", "offset"],
  },
  {
    id: "grp_style",
    name: "Style",
    color: "#84CC16",
    items: ["strokeWidth", "strokeColor"],
  },
  {
    id: "grp_view",
    name: "Vue",
    color: "#8B5CF6",
    items: ["zoomOut", "zoomLevel", "zoomIn", "fitContent", "resetView"],
  },
  {
    id: "grp_history",
    name: "Historique",
    color: "#F59E0B",
    items: ["undo", "redo", "branchSelect", "newBranch", "historyPanel"],
  },
  {
    id: "grp_display",
    name: "Affichage",
    color: "#06B6D4",
    items: [
      "toggleGrid",
      "toggleA4Grid",
      "toggleSnap",
      "snapActiveLayer",
      "constructionMode",
      "showConstruction",
      "highlightOpacity",
    ],
  },
];

// ============================================
// CONFIGURATION PAR DÉFAUT
// ============================================

export const DEFAULT_TOOLBAR_CONFIG: ToolbarConfig = {
  version: "2.0",
  line1: [
    { type: "group", id: "grp_save" },
    { type: "group", id: "grp_import_export" },
    { type: "group", id: "grp_help" },
    { type: "tool", id: "status" },
    { type: "tool", id: "fullscreen" },
  ],
  line2: [
    { type: "group", id: "grp_select" },
    { type: "group", id: "grp_transform" },
    { type: "group", id: "grp_draw" },
    { type: "group", id: "grp_photo" },
    { type: "group", id: "grp_dimension" },
    { type: "group", id: "grp_modify" },
    { type: "group", id: "grp_style" },
    { type: "group", id: "grp_view" },
    { type: "group", id: "grp_history" },
    { type: "group", id: "grp_display" },
  ],
  groups: DEFAULT_GROUPS,
  hidden: [],
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

export function createToolDefinitionsMap(): Map<string, ToolDefinition> {
  const map = new Map<string, ToolDefinition>();
  ALL_TOOL_DEFINITIONS.forEach((tool) => {
    map.set(tool.id, tool);
  });
  return map;
}

export function getDefaultToolbarConfig(): ToolbarConfig {
  return JSON.parse(JSON.stringify(DEFAULT_TOOLBAR_CONFIG));
}

export function createNewGroup(name: string, toolIds: string[], color?: string): ToolbarGroup {
  return {
    id: generateToolbarId(),
    name,
    color: color || "#3B82F6",
    items: [...toolIds],
  };
}

export function mergeWithDefaults(savedConfig: ToolbarConfig): ToolbarConfig {
  const allToolIds = new Set(ALL_TOOL_DEFINITIONS.map((t) => t.id));
  const configToolIds = new Set<string>();

  const collectIds = (items: ToolbarItem[], groups: ToolbarGroup[]) => {
    items.forEach((item) => {
      if (item.type === "tool") {
        configToolIds.add(item.id);
      } else {
        const group = groups.find((g) => g.id === item.id);
        if (group) {
          group.items.forEach((id) => configToolIds.add(id));
        }
      }
    });
  };

  collectIds(savedConfig.line1, savedConfig.groups);
  collectIds(savedConfig.line2, savedConfig.groups);
  savedConfig.hidden.forEach((id) => configToolIds.add(id));

  const newTools: string[] = [];
  allToolIds.forEach((id) => {
    if (!configToolIds.has(id)) {
      newTools.push(id);
    }
  });

  if (newTools.length > 0) {
    savedConfig.hidden = [...savedConfig.hidden, ...newTools];
  }

  return savedConfig;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  file: "Fichiers",
  draw: "Dessin",
  transform: "Transformation",
  modify: "Modifications",
  dimension: "Cotations",
  photo: "Photos",
  view: "Vue",
  history: "Historique",
  display: "Affichage",
  style: "Style",
  help: "Aide",
};
