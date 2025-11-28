// components/scenarios/ComparisonTableFullscreen.tsx
// Mode plein écran du tableau comparatif

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Scenario } from '@/types/scenarios';

interface ExpenseComparison {
  nom: string;
  categorie: string;
  byScenario: Record<string, {
    prix: number;
    quantite: number;
    total: number;
    marque?: string;
  } | null>;
}

interface ComparisonTableFullscreenProps {
  scenarios: Scenario[];
  comparisons: ExpenseComparison[];
  totaux: Record<string, any>;
  onClose: () => void;
}

const ComparisonTableFullscreen = ({
  scenarios,
  comparisons,
  totaux,
  onClose
}: ComparisonTableFullscreenProps) => {
  const categories = Array.from(new Set(comparisons.map(c => c.categorie)));
  const scenarioRef = scenarios.find(s => s.est_principal);

  const getComparisonColor = (value: number, refValue: number) => {
    if (value < refValue) return 'text-green-600';
    if (value > refValue) return 'text-red-600';
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6">
        <div>
          <h1 className="text-2xl font-bold">Comparaison des scénarios</h1>
          <p className="text-sm text-muted-foreground">
            Appuyez sur Échap pour quitter le plein écran
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => toast.info('Export PDF à venir')}
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tableau */}
      <div className="h-[calc(100vh-4rem)] overflow-auto p-6">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-background shadow-sm">
            <tr className="border-b-2">
              <th className="p-4 text-left font-bold text-lg sticky left-0 bg-background">
                Article
              </th>
              {scenarios.map((scenario) => (
                <th 
                  key={scenario.id} 
                  className="p-4 text-center font-bold text-lg min-w-[200px]"
                  style={{ color: scenario.couleur }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl">{scenario.icone}</span>
                    <span>{scenario.nom}</span>
                    {scenario.est_principal && (
                      <Badge variant="outline">Référence</Badge>
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
                      className="p-3 font-bold text-lg sticky left-0"
                    >
                      📦 {categorie.toUpperCase()}
                    </td>
                  </tr>
                  
                  {/* Articles */}
                  {itemsInCategory.map((item, idx) => (
                    <tr key={`${categorie}-${idx}`} className="border-b hover:bg-muted/30">
                      <td className="p-4 sticky left-0 bg-background">
                        <div className="font-semibold text-base">{item.nom}</div>
                      </td>
                      {scenarios.map((scenario) => {
                        const data = item.byScenario[scenario.id];
                        const refData = scenarioRef ? item.byScenario[scenarioRef.id] : null;
                        
                        return (
                          <td key={scenario.id} className="p-4 text-center">
                            {data ? (
                              <div className="space-y-2">
                                {data.marque && (
                                  <div className="text-sm text-muted-foreground">
                                    {data.marque}
                                  </div>
                                )}
                                <div className="text-base">
                                  {data.prix.toFixed(2)}€ × {data.quantite}
                                </div>
                                <div 
                                  className={`font-bold text-lg ${
                                    refData && scenario.id !== scenarioRef?.id
                                      ? getComparisonColor(data.total, refData.total)
                                      : ''
                                  }`}
                                >
                                  {data.total.toFixed(2)}€
                                </div>
                                {refData && scenario.id !== scenarioRef?.id && data.total !== refData.total && (
                                  <div className="text-sm font-semibold">
                                    {data.total > refData.total ? '+' : ''}
                                    {(data.total - refData.total).toFixed(2)}€
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-lg">-</span>
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
            <tr className="border-t-4 bg-muted/50 font-bold">
              <td className="p-4 sticky left-0 bg-muted/50 text-lg">TOTAUX</td>
              {scenarios.map((scenario) => {
                const data = totaux[scenario.id] || {};
                const refData = scenarioRef ? totaux[scenarioRef.id] : null;
                
                return (
                  <td key={scenario.id} className="p-4 text-center">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {data.nb_articles || 0} articles
                      </div>
                      <div className="text-base">
                        Achat HT: {(data.total_achat || 0).toFixed(2)}€
                      </div>
                      <div className="text-base">
                        Vente TTC: {(data.total_vente || 0).toFixed(2)}€
                      </div>
                      <div className="text-green-600 text-lg">
                        Marge: {(data.marge || 0).toFixed(1)}%
                      </div>
                      {refData && scenario.id !== scenarioRef?.id && (
                        <div 
                          className={`text-sm font-bold ${
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
    </div>
  );
};

export default ComparisonTableFullscreen;

// Petit hack React
const React = { Fragment: ({ children }: any) => <>{children}</> };
