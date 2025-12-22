// ============================================
// SchemaValidation.tsx
// Composant pour valider le circuit électrique
// VERSION: 1.3 - Recherche protection dans les 3 premiers blocs
// ============================================

import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle, XCircle, Info, Zap, Shield, Cable, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ElectricalItem {
  id: string;
  nom_accessoire: string;
  type_electrique: string;
  puissance_watts?: number;
  capacite_ah?: number;
  tension_volts?: number;
  intensite_amperes?: number;
}

interface SchemaEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string | null;
  target_handle?: string | null;
  color?: string;
  length_m?: number;
  section_mm2?: number;
}

interface ValidationIssue {
  type: "error" | "warning" | "info";
  category: "connection" | "protection" | "power" | "cable" | "general";
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
  suggestion?: string;
}

interface SchemaValidationProps {
  items: ElectricalItem[];
  edges: SchemaEdge[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onHighlightNodes?: (nodeIds: string[]) => void;
  onHighlightEdges?: (edgeIds: string[]) => void;
}

// Types considérés comme sources d'énergie
const PRODUCER_TYPES = ["producteur", "panneau_solaire", "batterie", "alternateur", "chargeur", "combi"];

// Mots-clés pour détecter une protection (dans type OU nom)
const PROTECTION_KEYWORDS = [
  "fusible",
  "disjoncteur",
  "protection",
  "coupe_circuit",
  "coupe-circuit",
  "porte_fusible",
  "porte-fusible",
  "porte fusible",
  "fuse",
  "breaker",
];

// Types considérés comme distribution
const DISTRIBUTION_TYPES = ["distribution", "bornier", "repartiteur"];

// Types considérés comme régulation
const REGULATION_TYPES = ["regulation", "regulateur", "mppt", "regulateur_mppt"];

// Fonction helper pour vérifier si un item est une protection
const isProtectionItem = (item: ElectricalItem): boolean => {
  const typeElec = item.type_electrique?.toLowerCase() || "";
  const nom = item.nom_accessoire?.toLowerCase() || "";

  return PROTECTION_KEYWORDS.some((keyword) => typeElec.includes(keyword) || nom.includes(keyword));
};

export function useSchemaValidation(items: ElectricalItem[], edges: SchemaEdge[]): ValidationIssue[] {
  return useMemo(() => {
    const issues: ValidationIssue[] = [];

    if (items.length === 0) {
      return [];
    }

    // Créer un graphe pour l'analyse
    const nodeConnections: Record<string, { incoming: string[]; outgoing: string[] }> = {};
    items.forEach((item) => {
      nodeConnections[item.id] = { incoming: [], outgoing: [] };
    });

    edges.forEach((edge) => {
      if (nodeConnections[edge.source_node_id]) {
        nodeConnections[edge.source_node_id].outgoing.push(edge.target_node_id);
      }
      if (nodeConnections[edge.target_node_id]) {
        nodeConnections[edge.target_node_id].incoming.push(edge.source_node_id);
      }
    });

    // Vérification 1: Blocs non connectés
    items.forEach((item) => {
      const conn = nodeConnections[item.id];
      if (conn && conn.incoming.length === 0 && conn.outgoing.length === 0) {
        // Ignorer les batteries (peuvent être isolées)
        if (item.type_electrique !== "batterie" && item.type_electrique !== "stockage") {
          issues.push({
            type: "warning",
            category: "connection",
            message: `"${item.nom_accessoire}" n'est connecté à rien`,
            nodeIds: [item.id],
            suggestion: "Connectez ce bloc au reste du circuit",
          });
        }
      }
    });

    // Vérification 2: Producteurs sans protection
    const producers = items.filter((i) => PRODUCER_TYPES.some((t) => i.type_electrique?.toLowerCase().includes(t)));
    const protections = items.filter((i) => isProtectionItem(i));

    producers.forEach((producer) => {
      const conn = nodeConnections[producer.id];
      if (!conn) return;

      // Chercher une protection dans les 3 premiers blocs après le producteur
      // (permet d'avoir un coupe-circuit avant le fusible par exemple)
      const visited = new Set<string>();
      const maxDepth = 3; // Nombre max de blocs à parcourir

      const hasProtectionNearby = (nodeId: string, depth: number): boolean => {
        if (depth > maxDepth) return false;
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);

        const item = items.find((i) => i.id === nodeId);
        if (item && isProtectionItem(item)) {
          return true;
        }

        // Continuer à chercher dans les sorties
        const nodeConn = nodeConnections[nodeId];
        if (!nodeConn) return false;

        return nodeConn.outgoing.some((outId) => hasProtectionNearby(outId, depth + 1));
      };

      // Vérifier si une protection existe dans les blocs proches
      const hasNearbyProtection = conn.outgoing.some((outId) => hasProtectionNearby(outId, 1));

      if (!hasNearbyProtection && conn.outgoing.length > 0) {
        issues.push({
          type: "warning",
          category: "protection",
          message: `"${producer.nom_accessoire}" n'a pas de protection proche en sortie`,
          nodeIds: [producer.id],
          suggestion: "Ajoutez un fusible ou disjoncteur après la source (dans les 3 premiers blocs)",
        });
      }
    });

    // Vérification 3: Consommateurs sans protection en amont
    const consumers = items.filter(
      (i) =>
        i.type_electrique === "consommateur" ||
        i.type_electrique === "eclairage" ||
        i.type_electrique === "refrigeration" ||
        i.type_electrique === "pompe" ||
        i.type_electrique === "ventilation",
    );

    consumers.forEach((consumer) => {
      const conn = nodeConnections[consumer.id];
      if (!conn) return;

      // Remonter le graphe pour trouver une protection
      const visited = new Set<string>();
      const hasProtection = (nodeId: string): boolean => {
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);

        const item = items.find((i) => i.id === nodeId);
        if (item && isProtectionItem(item)) {
          return true;
        }

        const nodeConn = nodeConnections[nodeId];
        if (!nodeConn) return false;

        return nodeConn.incoming.some((inId) => hasProtection(inId));
      };

      const hasUpstreamProtection = conn.incoming.some((inId) => hasProtection(inId));

      if (!hasUpstreamProtection && conn.incoming.length > 0) {
        issues.push({
          type: "error",
          category: "protection",
          message: `"${consumer.nom_accessoire}" n'est pas protégé par un fusible`,
          nodeIds: [consumer.id],
          suggestion: "Ajoutez une protection entre la source et ce consommateur",
        });
      }
    });

    // Vérification 4: Câbles sans section définie (si longueur > 0)
    edges.forEach((edge) => {
      if (edge.length_m && edge.length_m > 0 && !edge.section_mm2) {
        issues.push({
          type: "info",
          category: "cable",
          message: "Câble avec longueur mais sans section définie",
          edgeIds: [edge.id],
          suggestion: "La section sera calculée automatiquement",
        });
      }
    });

    // Vérification 5: Puissance totale vs capacité batterie
    const totalPower = consumers.reduce((sum, c) => sum + (c.puissance_watts || 0), 0);
    const batteries = items.filter((i) => i.type_electrique === "batterie" || i.type_electrique === "stockage");
    const totalCapacity = batteries.reduce((sum, b) => sum + (b.capacite_ah || 0), 0);

    if (totalCapacity > 0 && totalPower > 0) {
      // Autonomie approximative en heures (à 12V)
      const autonomyHours = (totalCapacity * 12) / totalPower;
      if (autonomyHours < 1) {
        issues.push({
          type: "warning",
          category: "power",
          message: `Autonomie faible: ~${Math.round(autonomyHours * 60)} minutes à pleine charge`,
          suggestion: "Envisagez d'augmenter la capacité de stockage",
        });
      }
    }

    // Vérification 6: Régulateur sans panneau solaire en amont
    const regulators = items.filter((i) => REGULATION_TYPES.some((t) => i.type_electrique?.toLowerCase().includes(t)));

    regulators.forEach((regulator) => {
      const conn = nodeConnections[regulator.id];
      if (!conn) return;

      const hasSolarInput = conn.incoming.some((inId) => {
        const inItem = items.find((i) => i.id === inId);
        return inItem && (inItem.type_electrique === "producteur" || inItem.type_electrique === "panneau_solaire");
      });

      // Vérifier aussi via les protections
      const hasSolarViaProtection = conn.incoming.some((inId) => {
        const inItem = items.find((i) => i.id === inId);
        if (!inItem || !isProtectionItem(inItem)) return false;

        const protConn = nodeConnections[inId];
        return protConn?.incoming.some((pInId) => {
          const pInItem = items.find((i) => i.id === pInId);
          return pInItem && (pInItem.type_electrique === "producteur" || pInItem.type_electrique === "panneau_solaire");
        });
      });

      if (!hasSolarInput && !hasSolarViaProtection && conn.incoming.length > 0) {
        issues.push({
          type: "info",
          category: "connection",
          message: `"${regulator.nom_accessoire}" n'est pas connecté à un panneau solaire`,
          nodeIds: [regulator.id],
          suggestion: "Vérifiez la connexion avec la source solaire",
        });
      }
    });

    // Trier par gravité
    const priority = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => priority[a.type] - priority[b.type]);

    return issues;
  }, [items, edges]);
}

export function SchemaValidation({
  items,
  edges,
  isExpanded = false,
  onToggleExpand,
  onHighlightNodes,
  onHighlightEdges,
}: SchemaValidationProps) {
  const issues = useSchemaValidation(items, edges);

  const errorCount = issues.filter((i) => i.type === "error").length;
  const warningCount = issues.filter((i) => i.type === "warning").length;
  const infoCount = issues.filter((i) => i.type === "info").length;

  const getIcon = (type: ValidationIssue["type"]) => {
    switch (type) {
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: ValidationIssue["category"]) => {
    switch (category) {
      case "connection":
        return <Cable className="w-3 h-3" />;
      case "protection":
        return <Shield className="w-3 h-3" />;
      case "power":
        return <Zap className="w-3 h-3" />;
      case "cable":
        return <Cable className="w-3 h-3" />;
      default:
        return <Info className="w-3 h-3" />;
    }
  };

  const handleIssueClick = (issue: ValidationIssue) => {
    if (issue.nodeIds && onHighlightNodes) {
      onHighlightNodes(issue.nodeIds);
    }
    if (issue.edgeIds && onHighlightEdges) {
      onHighlightEdges(issue.edgeIds);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Popover open={isExpanded} onOpenChange={onToggleExpand}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${
            errorCount > 0
              ? "border-red-300 bg-red-50 hover:bg-red-100"
              : warningCount > 0
                ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
                : "border-green-300 bg-green-50 hover:bg-green-100"
          }`}
        >
          {errorCount > 0 ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          <span className="text-xs">
            {errorCount > 0 && <span className="text-red-600 font-medium">{errorCount} erreur(s)</span>}
            {errorCount > 0 && warningCount > 0 && " · "}
            {warningCount > 0 && <span className="text-amber-600 font-medium">{warningCount} alerte(s)</span>}
            {errorCount === 0 && warningCount === 0 && <span className="text-green-600 font-medium">Circuit OK</span>}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[350px] max-h-[400px] overflow-auto p-3" align="start" side="bottom" sideOffset={5}>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Validation du circuit
        </div>

        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 text-sm py-2">
            <CheckCircle className="w-4 h-4" />
            Aucun problème détecté
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div
                key={index}
                className={`p-2 rounded-md cursor-pointer transition-colors ${
                  issue.type === "error"
                    ? "bg-red-50 hover:bg-red-100"
                    : issue.type === "warning"
                      ? "bg-amber-50 hover:bg-amber-100"
                      : "bg-blue-50 hover:bg-blue-100"
                }`}
                onClick={() => handleIssueClick(issue)}
              >
                <div className="flex items-start gap-2">
                  {getIcon(issue.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{issue.message}</div>
                    {issue.suggestion && <div className="text-xs text-gray-500 mt-1">💡 {issue.suggestion}</div>}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {getCategoryIcon(issue.category)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
