// components/scenarios/ScenarioColumn.tsx
// Colonne de scénario avec liste compacte optimisée pour 450px
// ✅ MODIFIÉ: Passe projectName et clientName à ScenarioHeader pour export Evoliz

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import ScenarioHeader from "./ScenarioHeader";
import CompactExpensesList from "./CompactExpensesList";
import type { Scenario } from "@/types/scenarios";

interface ScenarioColumnProps {
  scenario: Scenario;
  projectId: string;
  isLocked: boolean;
  onExpenseChange: () => void;
  onScenarioChange: () => void;
}

interface BilanEnergie {
  production_w: number;
  stockage_ah: number;
  stockage_wh: number;
  autonomie_jours: number;
}

interface Totaux {
  total_achat: number;
  total_vente: number;
  marge_pourcent: number;
  nombre_articles: number;
}

const ScenarioColumn = ({ scenario, projectId, isLocked, onExpenseChange, onScenarioChange }: ScenarioColumnProps) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [bilanEnergie, setBilanEnergie] = useState<BilanEnergie | null>(null);
  const [totaux, setTotaux] = useState<Totaux>({
    total_achat: 0,
    total_vente: 0,
    marge_pourcent: 0,
    nombre_articles: 0,
  });

  // ✅ Infos projet pour export Evoliz
  const [projectInfo, setProjectInfo] = useState<{
    projectName: string;
    clientName: string;
  }>({ projectName: "", clientName: "" });

  // ✅ Charger les infos du projet (avec cast any pour éviter erreurs TS)
  const loadProjectInfo = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("nom_proprietaire, nom, marque_vehicule, modele_vehicule, denomination_commerciale")
        .eq("id", projectId)
        .single();

      if (error) {
        console.error("Erreur chargement projet:", error);
        return;
      }

      if (data) {
        // Construire le nom du projet
        const vehicleInfo = [data.marque_vehicule, data.modele_vehicule, data.denomination_commerciale]
          .filter(Boolean)
          .join(" ");
        const projectName = vehicleInfo || data.nom || "Aménagement fourgon";

        setProjectInfo({
          projectName,
          clientName: data.nom_proprietaire || "",
        });
      }
    } catch (err) {
      console.error("Erreur chargement infos projet:", err);
    }
  };

  const loadExpenses = async () => {
    try {
      const result: any = await (supabase as any).from("project_expenses").select("*").eq("scenario_id", scenario.id);

      const { data, error } = result;

      if (error) {
        console.error("Erreur chargement dépenses:", error);
        return;
      }

      const filteredData = (data || []).filter((e: any) => e.est_archive !== true);
      setExpenses(filteredData);
      calculateTotaux(filteredData);
      calculateBilanEnergie(filteredData);
    } catch (err) {
      console.error("Erreur chargement dépenses:", err);
    }
  };

  const calculateTotaux = (expenses: any[]) => {
    const total_achat = expenses.reduce((sum, exp) => sum + (exp.prix || 0) * (exp.quantite || 1), 0);
    const total_vente = expenses.reduce((sum, exp) => sum + (exp.prix_vente_ttc || 0) * (exp.quantite || 1), 0);
    const marge_pourcent = total_achat > 0 ? ((total_vente - total_achat) / total_achat) * 100 : 0;

    setTotaux({
      total_achat,
      total_vente,
      marge_pourcent,
      nombre_articles: expenses.length,
    });
  };

  const calculateBilanEnergie = (expenses: any[]) => {
    // Calculer la production solaire - utiliser type_electrique et puissance_watts
    const production = expenses
      .filter((e) => e.type_electrique === "producteur")
      .reduce((sum, e) => {
        // Utiliser le champ puissance_watts de la DB
        const puissance = e.puissance_watts || 0;
        return sum + puissance * (e.quantite || 1);
      }, 0);

    // Calculer le stockage batterie - utiliser type_electrique
    const stockageItems = expenses.filter((e) => e.type_electrique === "stockage");

    // Calculer Ah depuis intensite_amperes ou extraire du nom si pas disponible
    const stockage_ah = stockageItems.reduce((sum, e) => {
      // Priorité au champ intensite_amperes (qui peut stocker les Ah pour les batteries)
      if (e.intensite_amperes) {
        return sum + e.intensite_amperes * (e.quantite || 1);
      }
      // Fallback: extraire du nom si format "XXXAh"
      const match = e.nom_accessoire?.match(/(\d+)\s*ah/i);
      if (match) {
        return sum + parseInt(match[1]) * (e.quantite || 1);
      }
      return sum;
    }, 0);

    const stockage_wh = stockage_ah * 12;
    const autonomie_jours =
      production > 0 && stockage_wh > 0 ? Math.round((stockage_wh / (production * 5)) * 10) / 10 : 0;

    if (production > 0 || stockage_ah > 0) {
      setBilanEnergie({
        production_w: production,
        stockage_ah,
        stockage_wh,
        autonomie_jours,
      });
    } else {
      setBilanEnergie(null);
    }
  };

  useEffect(() => {
    loadExpenses();
    loadProjectInfo();
  }, [scenario.id, projectId]);

  return (
    <Card
      className="h-full flex flex-col"
      style={{
        borderColor: scenario.couleur,
        borderWidth: scenario.est_principal ? "3px" : "1px",
      }}
    >
      {/* Header du scénario - avec infos projet pour export Evoliz */}
      <ScenarioHeader
        scenario={scenario}
        onScenarioChange={onScenarioChange}
        isLocked={isLocked}
        projectName={projectInfo.projectName}
        clientName={projectInfo.clientName}
      />

      {/* Corps avec scroll */}
      <ScrollArea className="flex-1" style={{ height: "calc(100vh - 400px)" }}>
        <div className="p-3 space-y-3">
          <CompactExpensesList
            projectId={projectId}
            scenarioId={scenario.id}
            isLocked={isLocked}
            onExpenseChange={() => {
              loadExpenses();
              onExpenseChange();
            }}
          />
        </div>
      </ScrollArea>

      {/* Footer avec bilan et totaux */}
      <div className="border-t p-3 space-y-2 bg-muted/30">
        {/* Bilan énergétique */}
        {bilanEnergie && (
          <Card className="p-2.5 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">⚡ Bilan Énergétique</h4>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div>
                <span className="text-muted-foreground">Production:</span>
                <p className="font-semibold">{bilanEnergie.production_w}W</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stockage:</span>
                <p className="font-semibold">{bilanEnergie.stockage_ah}Ah</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Autonomie:</span>
                <p className="font-semibold text-blue-600 dark:text-blue-400">
                  ~{bilanEnergie.autonomie_jours} jour(s)
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Totaux */}
        <Card className="p-2.5 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">💰 Totaux</h4>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Articles:</span>
              <span className="font-semibold">{totaux.nombre_articles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Achat HT:</span>
              <span className="font-semibold">{totaux.total_achat.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vente TTC:</span>
              <span className="font-semibold">{totaux.total_vente.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between pt-0.5 border-t">
              <span className="text-muted-foreground">Marge:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {totaux.marge_pourcent.toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
};

export default ScenarioColumn;
