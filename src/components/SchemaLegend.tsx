// ============================================
// SchemaLegend.tsx
// Composant légende auto-générée du schéma
// VERSION: 1.4 - Types de connexion (cosse, MC4, borne)
// ============================================

import React, { useMemo, useState } from "react";
import {
  Sun,
  Battery,
  Zap,
  Lightbulb,
  Fan,
  Refrigerator,
  Waves,
  Cable,
  Shield,
  Gauge,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ElectricalItem {
  id: string;
  nom_accessoire: string;
  type_electrique: string;
  puissance_watts?: number;
  capacite_ah?: number;
  quantite?: number;
  type_connexion?: string | null;
  filetage?: string | null;
}

interface SchemaEdge {
  id: string;
  color?: string;
  section_mm2?: number;
  length_m?: number;
}

interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

interface SchemaLegendProps {
  items: ElectricalItem[];
  edges: SchemaEdge[];
  layers: Layer[];
  isVisible: boolean;
  onToggleVisibility: () => void;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

// Configuration des types avec leurs icônes
const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  producteur: { label: "Producteur", icon: Sun, color: "#f59e0b" },
  panneau_solaire: { label: "Panneau solaire", icon: Sun, color: "#f59e0b" },
  chargeur: { label: "Chargeur", icon: Zap, color: "#f59e0b" },
  convertisseur: { label: "Convertisseur", icon: Zap, color: "#f59e0b" },
  dcdc: { label: "DC/DC", icon: Zap, color: "#f59e0b" },
  "dc-dc": { label: "DC/DC", icon: Zap, color: "#f59e0b" },
  batterie: { label: "Batterie", icon: Battery, color: "#22c55e" },
  stockage: { label: "Stockage", icon: Battery, color: "#22c55e" },
  consommateur: { label: "Consommateur", icon: Zap, color: "#ef4444" },
  eclairage: { label: "Éclairage", icon: Lightbulb, color: "#eab308" },
  ventilation: { label: "Ventilation", icon: Fan, color: "#06b6d4" },
  refrigeration: { label: "Réfrigération", icon: Refrigerator, color: "#0ea5e9" },
  pompe: { label: "Pompe à eau", icon: Waves, color: "#14b8a6" },
  distribution: { label: "Distribution", icon: Cable, color: "#6b7280" },
  fusible: { label: "Fusible", icon: Shield, color: "#f97316" },
  protection: { label: "Protection", icon: Shield, color: "#f97316" },
  regulation: { label: "Régulateur", icon: Gauge, color: "#3b82f6" },
  regulateur_mppt: { label: "Régulateur MPPT", icon: Gauge, color: "#3b82f6" },
  accessoire: { label: "Accessoire", icon: Cable, color: "#94a3b8" },
  neutre: { label: "Accessoire", icon: Cable, color: "#94a3b8" },
};

// Couleurs de câble standard
const CABLE_COLORS: Record<string, string> = {
  "#ef4444": "Positif (+)",
  "#f87171": "Positif (+)",
  "#dc2626": "Positif (+)",
  "#1f2937": "Négatif/Masse (-)",
  "#000000": "Négatif/Masse (-)",
  "#374151": "Négatif/Masse (-)",
  "#22c55e": "Terre",
  "#16a34a": "Terre",
  "#3b82f6": "Neutre",
  "#2563eb": "Neutre",
  "#f97316": "Signal/Data",
  "#64748b": "Standard",
};

export function SchemaLegend({
  items,
  edges,
  layers,
  isVisible,
  onToggleVisibility,
  position = "bottom-left",
}: SchemaLegendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Analyser les types présents
  const presentTypes = useMemo(() => {
    const types = new Map<string, { count: number; totalPower: number; totalCapacity: number }>();

    items.forEach((item) => {
      const type = item.type_electrique || "accessoire";
      const qty = item.quantite || 1;
      const existing = types.get(type) || { count: 0, totalPower: 0, totalCapacity: 0 };
      types.set(type, {
        count: existing.count + qty,
        totalPower: existing.totalPower + (item.puissance_watts || 0) * qty,
        totalCapacity: existing.totalCapacity + (item.capacite_ah || 0) * qty,
      });
    });

    return types;
  }, [items]);

  // Analyser les couleurs de câbles présentes
  const presentCableColors = useMemo(() => {
    const colors = new Map<string, { count: number; totalLength: number }>();

    edges.forEach((edge) => {
      const color = edge.color || "#64748b";
      const existing = colors.get(color) || { count: 0, totalLength: 0 };
      colors.set(color, {
        count: existing.count + 1,
        totalLength: existing.totalLength + (edge.length_m || 0),
      });
    });

    return colors;
  }, [edges]);

  // Analyser les sections de câbles avec longueur totale
  const presentSections = useMemo(() => {
    const sections = new Map<number, { count: number; totalLength: number }>();

    edges.forEach((edge) => {
      if (edge.section_mm2) {
        const existing = sections.get(edge.section_mm2) || { count: 0, totalLength: 0 };
        sections.set(edge.section_mm2, {
          count: existing.count + 1,
          totalLength: existing.totalLength + (edge.length_m || 0),
        });
      }
    });

    return sections;
  }, [edges]);

  // Analyser les connexions nécessaires (par type et filetage)
  const presentConnexions = useMemo(() => {
    const connexions = {
      cosses: new Map<string, { count: number; equipments: string[] }>(),
      mc4: { count: 0, equipments: [] as string[] },
      bornes: { count: 0, equipments: [] as string[] },
    };

    items.forEach((item) => {
      const qty = item.quantite || 1;
      // Chaque équipement a généralement 2 connexions (+ et -)
      const connectionCount = qty * 2;

      if (item.type_connexion === "cosse_ronde" && item.filetage) {
        const existing = connexions.cosses.get(item.filetage) || { count: 0, equipments: [] };
        connexions.cosses.set(item.filetage, {
          count: existing.count + connectionCount,
          equipments: [...existing.equipments, item.nom_accessoire],
        });
      } else if (item.type_connexion === "mc4") {
        connexions.mc4.count += connectionCount;
        connexions.mc4.equipments.push(item.nom_accessoire);
      } else if (item.type_connexion === "borne_vis") {
        connexions.bornes.count += connectionCount;
        connexions.bornes.equipments.push(item.nom_accessoire);
      } else if (item.filetage) {
        // Rétrocompatibilité: filetage sans type_connexion
        const existing = connexions.cosses.get(item.filetage) || { count: 0, equipments: [] };
        connexions.cosses.set(item.filetage, {
          count: existing.count + connectionCount,
          equipments: [...existing.equipments, item.nom_accessoire],
        });
      }
    });

    return connexions;
  }, [items]);

  // Totaux
  const totals = useMemo(() => {
    let production = 0;
    let stockage = 0;
    let consommation = 0;

    items.forEach((item) => {
      const type = item.type_electrique || "";
      const qty = item.quantite || 1;
      // Producteurs : panneaux solaires, chargeurs DC/DC, convertisseurs
      if (
        type === "producteur" ||
        type === "panneau_solaire" ||
        type === "chargeur" ||
        type === "convertisseur" ||
        type === "dcdc" ||
        type === "dc-dc"
      ) {
        production += (item.puissance_watts || 0) * qty;
      } else if (type === "batterie" || type === "stockage") {
        stockage += (item.capacite_ah || 0) * qty;
      } else if (
        type === "consommateur" ||
        type === "eclairage" ||
        type === "ventilation" ||
        type === "refrigeration" ||
        type === "pompe"
      ) {
        consommation += (item.puissance_watts || 0) * qty;
      }
    });

    return { production, stockage, consommation };
  }, [items]);

  const positionClasses = {
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={`absolute ${positionClasses[position]} z-10 bg-white/90 backdrop-blur-sm`}
        onClick={onToggleVisibility}
      >
        <Eye className="w-4 h-4 mr-1" />
        Légende
      </Button>
    );
  }

  return (
    <div
      className={`absolute ${positionClasses[position]} z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border max-w-[280px]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Légende</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggleVisibility}>
            <EyeOff className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-4 max-h-[400px] overflow-y-auto">
          {/* Résumé */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-amber-50 rounded p-1.5">
              <div className="text-xs text-amber-600">Production</div>
              <div className="text-sm font-semibold text-amber-700">{totals.production} W</div>
            </div>
            <div className="bg-green-50 rounded p-1.5">
              <div className="text-xs text-green-600">Stockage</div>
              <div className="text-sm font-semibold text-green-700">{totals.stockage} Ah</div>
            </div>
            <div className="bg-red-50 rounded p-1.5">
              <div className="text-xs text-red-600">Conso.</div>
              <div className="text-sm font-semibold text-red-700">{totals.consommation} W</div>
            </div>
          </div>

          {/* Types de blocs */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">Équipements</div>
            <div className="space-y-1">
              {Array.from(presentTypes.entries()).map(([type, data]) => {
                const config = TYPE_CONFIG[type] || TYPE_CONFIG.accessoire;
                const Icon = config.icon;
                return (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <Icon className="w-3 h-3" style={{ color: config.color }} />
                    </div>
                    <span className="flex-1">{config.label}</span>
                    <Badge variant="secondary" className="text-[10px] h-4">
                      ×{data.count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Couleurs de câbles */}
          {presentCableColors.size > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Câblage</div>
              <div className="space-y-1">
                {Array.from(presentCableColors.entries()).map(([color, data]) => {
                  const label = CABLE_COLORS[color] || "Autre";
                  return (
                    <div key={color} className="flex items-center gap-2 text-xs">
                      <div className="w-5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="flex-1">{label}</span>
                      <span className="text-gray-400">×{data.count}</span>
                      {data.totalLength > 0 && <span className="text-gray-400">({data.totalLength.toFixed(1)}m)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sections de câbles */}
          {presentSections.size > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Sections</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(presentSections.entries())
                  .sort((a, b) => a[0] - b[0])
                  .map(([section, data]) => (
                    <Badge key={section} variant="outline" className="text-[10px]">
                      {section} mm² (×{data.count}) {data.totalLength > 0 && `- ${data.totalLength.toFixed(1)}m`}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Connexions nécessaires */}
          {(presentConnexions.cosses.size > 0 ||
            presentConnexions.mc4.count > 0 ||
            presentConnexions.bornes.count > 0) && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">🔌 Connexions</div>
              <div className="flex flex-wrap gap-1">
                {/* Cosses par filetage */}
                {Array.from(presentConnexions.cosses.entries())
                  .sort((a, b) => {
                    const numA = parseInt(a[0].replace("M", "")) || 0;
                    const numB = parseInt(b[0].replace("M", "")) || 0;
                    return numA - numB;
                  })
                  .map(([filetage, data]) => (
                    <Badge
                      key={filetage}
                      variant="outline"
                      className="text-[10px] bg-purple-50 border-purple-200 text-purple-700"
                      title={`Équipements: ${data.equipments.join(", ")}`}
                    >
                      🔩 {filetage} (×{data.count})
                    </Badge>
                  ))}
                {/* MC4 */}
                {presentConnexions.mc4.count > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-orange-50 border-orange-200 text-orange-700"
                    title={`Équipements: ${presentConnexions.mc4.equipments.join(", ")}`}
                  >
                    ☀️ MC4 (×{presentConnexions.mc4.count})
                  </Badge>
                )}
                {/* Bornes à vis */}
                {presentConnexions.bornes.count > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-blue-50 border-blue-200 text-blue-700"
                    title={`Équipements: ${presentConnexions.bornes.equipments.join(", ")}`}
                  >
                    🔧 Bornes (×{presentConnexions.bornes.count})
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Calques */}
          {layers.length > 1 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Calques</div>
              <div className="space-y-1">
                {layers.map((layer) => (
                  <div key={layer.id} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: layer.color }} />
                    <span className={layer.visible ? "" : "text-gray-400 line-through"}>{layer.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
