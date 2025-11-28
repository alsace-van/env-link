// components/scenarios/ComparisonTable.tsx
// Tableau comparatif lecture seule avec mode plein écran

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Maximize2, Download, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ComparisonTableFullscreen from './ComparisonTableFullscreen';
import type { Scenario } from '@/types/scenarios';

interface ComparisonTableProps {
  projectId: string;
  scenarios: Scenario[];
  onClose: () => void;
}

interface ExpenseComparison {
  nom: string;
  categorie: string;
  byScenario: Record<string, {
    prix: number;
    quantite: number;
    total: number;
    marque?: string;
    details?: string;
  } | null>;
}

const ComparisonTable = ({ projectId, scenarios, onClose }: ComparisonTableProps) => {
  const [comparisons, setComparisons] = useState<ExpenseComparison[]>([]);
  const [totaux, setTotaux] = useState<Record<string, any>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComparisons();
  }, [scenarios]);

  const loadComparisons = async () => {
    setIsLoading(true);
    
    // Charger les dépenses de tous les scénarios
    const allExpenses: Record<string, any[]> = {};
    
    for (const scenario of scenarios) {
      const result: any = await supabase.from('project_expenses').select('*').eq('project_id', projectId);
      const { data, error } = result;

      if (error) {
        console.error('Erreur chargement:', error);
        continue;
      }

      // Filtrer les dépenses archivées
      allExpenses[scenario.id] = (data || []).filter((e: any) => e.est_archive !== true);
    }

    // Créer la structure de comparaison
    const comparisonMap = new Map<string, ExpenseComparison>();
    
    // Parcourir toutes les dépenses de tous les scénarios
    Object.entries(allExpenses).forEach(([scenarioId, expenses]) => {
      expenses.forEach((expense) => {
        const key = `${expense.categorie || 'Autre'}_${expense.nom_accessoire}`;
        
        if (!comparisonMap.has(key)) {
          comparisonMap.set(key, {
            nom: expense.nom_accessoire,
            categorie: expense.categorie || 'Autre',
            byScenario: {}
          });
        }

        const comp = comparisonMap.get(key)!;
        comp.byScenario[scenarioId] = {
          prix: expense.prix,
          quantite: expense.quantite,
          total: expense.prix * expense.quantite,
          marque: expense.marque,
          details: expense.notes
        };
      });
    });

    // Calculer les totaux par scénario
    const totauxByScenario: Record<string, any> = {};
    scenarios.forEach((scenario) => {
      const expenses = allExpenses[scenario.id] || [];
      const total_achat = expenses.reduce((sum, e) => sum + (e.prix * e.quantite), 0);
      const total_vente = expenses.reduce((sum, e) => sum + ((e.prix_vente_ttc || 0) * e.quantite), 0);
      const marge = total_achat > 0 ? ((total_vente - total_achat) / total_achat * 100) : 0;

      totauxByScenario[scenario.id] = {
        total_achat,
        total_vente,
        marge,
        nb_articles: expenses.length
      };
    });

    setComparisons(Array.from(comparisonMap.values()));
    setTotaux(totauxByScenario);
    setIsLoading(false);
  };

  // Grouper par catégorie
  const categories = Array.from(new Set(comparisons.map(c => c.categorie)));

  // Scénario de référence (principal)
  const scenarioRef = scenarios.find(s => s.est_principal);

  const getComparisonColor = (value: number, refValue: number) => {
    if (value < refValue) return 'text-green-600';
    if (value > refValue) return 'text-red-600';
    return '';
  };

  if (isFullscreen) {
    return (
      <ComparisonTableFullscreen
        scenarios={scenarios}
        comparisons={comparisons}
        totaux={totaux}
        onClose={() => setIsFullscreen(false)}
      />
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Tableau comparatif des scénarios</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullscreen(true)}
                title="Plein écran"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            Chargement de la comparaison...
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4">
              {/* Tableau */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2">
                    <th className="p-3 text-left font-semibold sticky left-0 bg-background">
                      Article
                    </th>
                    {scenarios.map((scenario) => (
                      <th 
                        key={scenario.id} 
                        className="p-3 text-center font-semibold min-w-[150px]"
                        style={{ color: scenario.couleur }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-2xl">{scenario.icone}</span>
                          <span>{scenario.nom}</span>
                          {scenario.est_principal && (
                            <Badge variant="outline" className="text-xs">Référence</Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((categorie) => {
                    const itemsInCategory = comparisons.filter(c => c.categorie === categorie);
                    
                    return (
                      <React.Fragment key={categorie}>
                        {/* Header catégorie */}
                        <tr className="bg-muted/50">
                          <td 
                            colSpan={scenarios.length + 1} 
                            className="p-2 font-semibold sticky left-0"
                          >
                            📦 {categorie.toUpperCase()}
                          </td>
                        </tr>
                        
                        {/* Articles de la catégorie */}
                        {itemsInCategory.map((item, idx) => (
                          <tr key={`${categorie}-${idx}`} className="border-b hover:bg-muted/30">
                            <td className="p-3 sticky left-0 bg-background">
                              <div className="font-medium">{item.nom}</div>
                            </td>
                            {scenarios.map((scenario) => {
                              const data = item.byScenario[scenario.id];
                              const refData = scenarioRef ? item.byScenario[scenarioRef.id] : null;
                              
                              return (
                                <td key={scenario.id} className="p-3 text-center">
                                  {data ? (
                                    <div className="space-y-1">
                                      {data.marque && (
                                        <div className="text-xs text-muted-foreground">
                                          {data.marque}
                                        </div>
                                      )}
                                      <div className="text-sm">
                                        {data.prix.toFixed(2)}€ × {data.quantite}
                                      </div>
                                      <div 
                                        className={`font-semibold ${
                                          refData && scenario.id !== scenarioRef?.id
                                            ? getComparisonColor(data.total, refData.total)
                                            : ''
                                        }`}
                                      >
                                        {data.total.toFixed(2)}€
                                      </div>
                                      {refData && scenario.id !== scenarioRef?.id && data.total !== refData.total && (
                                        <div className="text-xs">
                                          {data.total > refData.total ? '+' : ''}
                                          {(data.total - refData.total).toFixed(2)}€
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Totaux */}
                  <tr className="border-t-2 bg-muted/50 font-semibold">
                    <td className="p-3 sticky left-0 bg-muted/50">TOTAUX</td>
                    {scenarios.map((scenario) => {
                      const data = totaux[scenario.id] || {};
                      const refData = scenarioRef ? totaux[scenarioRef.id] : null;
                      
                      return (
                        <td key={scenario.id} className="p-3 text-center">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                              {data.nb_articles || 0} articles
                            </div>
                            <div className="text-sm">
                              Achat: {(data.total_achat || 0).toFixed(2)}€
                            </div>
                            <div className="text-sm">
                              Vente: {(data.total_vente || 0).toFixed(2)}€
                            </div>
                            <div className="text-green-600">
                              Marge: {(data.marge || 0).toFixed(1)}%
                            </div>
                            {refData && scenario.id !== scenarioRef?.id && (
                              <div 
                                className={`text-xs font-semibold ${
                                  getComparisonColor(data.total_achat, refData.total_achat)
                                }`}
                              >
                                Écart: {data.total_achat > refData.total_achat ? '+' : ''}
                                {(data.total_achat - refData.total_achat).toFixed(2)}€
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => toast.info('Export PDF à venir')}>
            <Download className="h-4 w-4 mr-2" />
            Exporter PDF
          </Button>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComparisonTable;
