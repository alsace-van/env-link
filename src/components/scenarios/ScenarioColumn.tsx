// components/scenarios/ScenarioColumn.tsx
// Une colonne représentant un scénario avec ses dépenses

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import ScenarioHeader from './ScenarioHeader';
import ExpensesList from '@/components/ExpensesList';
import type { Scenario } from '@/types/scenarios';

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

const ScenarioColumn = ({ 
  scenario, 
  projectId, 
  isLocked,
  onExpenseChange,
  onScenarioChange 
}: ScenarioColumnProps) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [bilanEnergie, setBilanEnergie] = useState<BilanEnergie | null>(null);
  const [totaux, setTotaux] = useState<Totaux>({
    total_achat: 0,
    total_vente: 0,
    marge_pourcent: 0,
    nombre_articles: 0
  });

  const loadExpenses = async () => {
    try {
      // Essayer d'abord avec la fonction RPC si elle existe
      let data: any[] | null = null;
      let error: any = null;

      const rpcResult = await (supabase.rpc as any)('get_scenario_expenses', { p_scenario_id: scenario.id });
      
      if (rpcResult.error) {
        // Si la fonction RPC n'existe pas, utiliser une requête directe
        const queryResult: any = await (supabase as any)
          .from('project_expenses')
          .select('*')
          .eq('scenario_id', scenario.id);
        
        data = queryResult.data;
        error = queryResult.error;
      } else {
        data = rpcResult.data;
      }

      if (error) {
        console.error('Erreur chargement dépenses:', error);
        return;
      }

      // Filtrer les dépenses archivées si la colonne existe
      const filteredData = (data || []).filter((e: any) => e.est_archive !== true);
      setExpenses(filteredData);
      calculateTotaux(filteredData);
      calculateBilanEnergie(filteredData);
    } catch (err) {
      console.error('Erreur chargement dépenses:', err);
    }
  };

  const calculateTotaux = (expenses: any[]) => {
    const total_achat = expenses.reduce((sum, exp) => sum + (exp.prix * exp.quantite), 0);
    const total_vente = expenses.reduce((sum, exp) => sum + ((exp.prix_vente_ttc || 0) * exp.quantite), 0);
    const marge_pourcent = total_achat > 0 ? ((total_vente - total_achat) / total_achat * 100) : 0;

    setTotaux({
      total_achat,
      total_vente,
      marge_pourcent,
      nombre_articles: expenses.length
    });
  };

  const calculateBilanEnergie = (expenses: any[]) => {
    // Calculer la production solaire
    const production = expenses
      .filter(e => e.categorie?.toLowerCase().includes('électrique') || 
                   e.categorie?.toLowerCase().includes('panneau') ||
                   e.nom_accessoire?.toLowerCase().includes('panneau'))
      .reduce((sum, e) => {
        // Essayer d'extraire la puissance du nom (ex: "Panneau 150W")
        const match = e.nom_accessoire?.match(/(\d+)\s*w/i);
        if (match) {
          return sum + (parseInt(match[1]) * e.quantite);
        }
        return sum;
      }, 0);

    // Calculer le stockage batterie
    const stockage_ah = expenses
      .filter(e => e.nom_accessoire?.toLowerCase().includes('batterie'))
      .reduce((sum, e) => {
        const match = e.nom_accessoire?.match(/(\d+)\s*ah/i);
        if (match) {
          return sum + (parseInt(match[1]) * e.quantite);
        }
        return sum;
      }, 0);

    const stockage_wh = stockage_ah * 12; // Approximation 12V
    const autonomie_jours = production > 0 && stockage_wh > 0 
      ? Math.round((stockage_wh / (production * 5)) * 10) / 10 // 5h d'ensoleillement moyen
      : 0;

    if (production > 0 || stockage_ah > 0) {
      setBilanEnergie({
        production_w: production,
        stockage_ah,
        stockage_wh,
        autonomie_jours
      });
    } else {
      setBilanEnergie(null);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [scenario.id]);

  return (
    <Card 
      className="h-full flex flex-col"
      style={{ 
        borderColor: scenario.couleur,
        borderWidth: scenario.est_principal ? '3px' : '1px'
      }}
    >
      {/* Header du scénario */}
      <ScenarioHeader
        scenario={scenario}
        onScenarioChange={onScenarioChange}
        isLocked={isLocked}
      />

      {/* Corps avec scroll */}
      <ScrollArea className="flex-1" style={{ height: 'calc(100vh - 400px)' }}>
        <div className="p-4 space-y-4">
          {/* Liste des dépenses - Réutiliser le composant existant */}
          <ExpensesList
            projectId={projectId}
            onExpenseChange={() => {
              loadExpenses();
              onExpenseChange();
            }}
            scenarioId={scenario.id}
            isLocked={isLocked}
          />
        </div>
      </ScrollArea>

      {/* Footer avec bilan et totaux */}
      <div className="border-t p-4 space-y-3 bg-muted/30">
        {/* Bilan énergétique */}
        {bilanEnergie && (
          <Card className="p-3 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              ⚡ Bilan Énergétique
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Production:</span>
                <p className="font-semibold">{bilanEnergie.production_w}W</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stockage:</span>
                <p className="font-semibold">{bilanEnergie.stockage_ah}Ah</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Autonomie estimée:</span>
                <p className="font-semibold text-blue-600 dark:text-blue-400">
                  ~{bilanEnergie.autonomie_jours} jour(s)
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Totaux */}
        <Card className="p-3 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            💰 Totaux
          </h4>
          <div className="space-y-1 text-xs">
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
            <div className="flex justify-between pt-1 border-t">
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
