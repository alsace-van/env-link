// ============================================
// TOOLBAR TYPES
// Types TypeScript pour la toolbar configurable
// VERSION: 2.0 - Support multi-lignes dynamiques
// ============================================

// Catégories d'outils pour le regroupement logique
export type ToolCategory =
  | "file" // Sauvegarde, import/export
  | "draw" // Outils de dessin (ligne, cercle, etc.)
  | "transform" // Transformation (symétrie, move, rotate)
  | "modify" // Modifications (congé, chanfrein, offset)
  | "dimension" // Cotations et contraintes
  | "photo" // Outils photos
  | "view" // Vue et zoom
  | "history" // Historique et branches
  | "display" // Options d'affichage (grille, snap)
  | "style" // Style (épaisseur, couleur)
  | "help"; // Aide

// Type de rendu de l'outil
export type ToolRenderType =
  | "button" // Bouton simple
  | "button-dropdown" // Bouton avec dropdown associé
  | "dropdown" // Dropdown seul
  | "toggle" // Bouton toggle (on/off)
  | "slider" // Slider (opacité, etc.)
  | "color-picker" // Sélecteur de couleur
  | "display" // Affichage seul (status, zoom level)
  | "separator"; // Séparateur visuel

// Définition d'un outil individuel
export interface ToolDefinition {
  id: string; // ID unique de l'outil
  label: string; // Label affiché (tooltip)
  shortcut?: string; // Raccourci clavier
  icon: string; // Nom de l'icône Lucide ou "custom:xxx" pour SVG
  category: ToolCategory; // Catégorie de l'outil
  renderType: ToolRenderType; // Type de rendu
  hasDropdown?: boolean; // A un dropdown associé
  conditional?: string; // Condition d'affichage (ex: "hasImages")
  defaultVisible?: boolean; // Visible par défaut
}

// Un groupe d'outils personnalisé
export interface ToolbarGroup {
  id: string; // ID unique du groupe
  name: string; // Nom affiché du groupe
  color?: string; // Couleur du groupe (optionnel)
  collapsed?: boolean; // Groupe replié (affiche juste le premier outil)
  items: string[]; // IDs des outils dans le groupe
}

// Un élément dans la toolbar (soit un outil seul, soit un groupe)
export interface ToolbarItem {
  type: "tool" | "group"; // Type d'élément
  id: string; // ID de l'outil ou du groupe
}

// Une ligne de toolbar
export interface ToolbarLine {
  id: string; // ID unique de la ligne
  name?: string; // Nom optionnel de la ligne
  items: ToolbarItem[]; // Éléments dans cette ligne
}

// Configuration complète de la toolbar (v2 - multi-lignes)
export interface ToolbarConfig {
  version: string; // Version de la config (pour migrations)
  lines: ToolbarLine[]; // Toutes les lignes de la toolbar
  groups: ToolbarGroup[]; // Définitions des groupes personnalisés
  hidden: string[]; // IDs des outils masqués
}

// État du drag & drop
export interface DragState {
  isDragging: boolean;
  draggedId: string | null;
  draggedType: "tool" | "group" | null;
  sourceLineIndex: number | null;
  sourceIndex: number | null;
  targetLineIndex: number | "hidden" | null;
  targetIndex: number | null;
}

// Props pour le composant ToolbarEditor
export interface ToolbarEditorProps {
  isOpen: boolean;
  onClose: () => void;
  config: ToolbarConfig;
  onConfigChange: (config: ToolbarConfig) => void;
}

// Résultat d'un drop
export interface DropResult {
  sourceLineIndex: number;
  sourceIndex: number;
  targetLineIndex: number | "hidden";
  targetIndex: number;
  itemId: string;
  itemType: "tool" | "group";
}

// Action pour créer un groupe
export interface CreateGroupAction {
  name: string;
  color?: string;
  toolIds: string[];
  targetLineIndex: number;
  targetIndex: number;
}

// Préférences de la toolbar (sauvegardées séparément)
export interface ToolbarPreferences {
  editModeEnabled: boolean; // Mode édition actif
  showLabels: boolean; // Afficher les labels sous les icônes
  compactMode: boolean; // Mode compact (icônes plus petites)
  autoHideEmpty: boolean; // Masquer automatiquement les groupes vides
}

// Constantes pour localStorage
export const TOOLBAR_CONFIG_KEY = "cad-toolbar-config-v3";
export const TOOLBAR_PREFERENCES_KEY = "cad-toolbar-preferences";

// Couleurs prédéfinies pour les groupes
export const GROUP_COLORS = [
  "#3B82F6", // Bleu
  "#10B981", // Vert
  "#F59E0B", // Orange
  "#EF4444", // Rouge
  "#8B5CF6", // Violet
  "#EC4899", // Rose
  "#06B6D4", // Cyan
  "#84CC16", // Lime
] as const;

// Fonction utilitaire pour générer un ID unique
export function generateToolbarId(): string {
  return `tb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Fonction pour générer un ID de ligne
export function generateLineId(): string {
  return `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

// Fonction pour valider une config v3
export function isValidToolbarConfig(config: unknown): config is ToolbarConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as ToolbarConfig;
  return typeof c.version === "string" && Array.isArray(c.lines) && Array.isArray(c.groups) && Array.isArray(c.hidden);
}
