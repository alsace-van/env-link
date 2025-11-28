// components/scenarios/ExpensesHistory.tsx
// Affichage de l'historique des modifications après verrouillage

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { X, Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ExpensesHistory as ExpensesHistoryType } from '@/types/scenarios';

interface ExpensesHistoryProps {
  projectId: string;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

const ExpensesHistory = ({ projectId, onClose, onCountChange }: ExpensesHistoryProps) => {
  const [history, setHistory] = useState<ExpensesHistoryType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const loadHistory = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('project_expenses_history' as any)
      .select('*')
      .eq('project_id', projectId)
      .order('date_modification', { ascending: false });

    if (error) {
      console.error('Erreur chargement historique:', error);
      // Si la table n'existe pas, ne pas afficher d'erreur
    } else {
      const historyData = (data || []) as unknown as ExpensesHistoryType[];
      setHistory(historyData);
      onCountChange?.(historyData.length);
    }
    
    setIsLoading(false);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ajout': return <Plus className="h-4 w-4" />;
      case 'modification': return <Edit className="h-4 w-4" />;
      case 'suppression': return <Trash2 className="h-4 w-4" />;
      case 'remplacement': return <RefreshCw className="h-4 w-4" />;
      default: return null;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'ajout': return 'bg-green-100 text-green-800 border-green-200';
      case 'modification': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'suppression': return 'bg-red-100 text-red-800 border-red-200';
      case 'remplacement': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'ajout': return 'Ajout';
      case 'modification': return 'Modification';
      case 'suppression': return 'Suppression';
      case 'remplacement': return 'Remplacement';
      default: return action;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Historique des modifications</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            Chargement de l'historique...
          </div>
        ) : history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Aucune modification enregistrée
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-3 p-4">
              {history.map((entry) => {
                const oldData = entry.ancienne_depense_json || {};
                
                return (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icône d'action */}
                      <div className={`p-2 rounded-full ${getActionColor(entry.action)}`}>
                        {getActionIcon(entry.action)}
                      </div>

                      {/* Contenu */}
                      <div className="flex-1 space-y-2">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={getActionColor(entry.action)}>
                              {getActionLabel(entry.action)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(entry.date_modification)}
                            </span>
                          </div>
                        </div>

                        {/* Article */}
                        <div>
                          <p className="font-semibold">
                            {oldData.nom_accessoire || 'Article inconnu'}
                          </p>
                          {oldData.marque && (
                            <p className="text-sm text-muted-foreground">
                              {oldData.marque}
                            </p>
                          )}
                        </div>

                        {/* Détails */}
                        <div className="text-sm space-y-1">
                          {entry.action === 'suppression' && oldData.prix && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">Prix supprimé:</span>
                              <span className="font-medium">
                                {oldData.prix?.toFixed(2)}€ × {oldData.quantite || 1}
                              </span>
                            </div>
                          )}

                          {entry.action === 'ajout' && oldData.prix && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">Prix ajouté:</span>
                              <span className="font-medium">
                                {oldData.prix?.toFixed(2)}€ × {oldData.quantite || 1}
                              </span>
                            </div>
                          )}

                          {entry.action === 'modification' && (
                            <div className="text-muted-foreground">
                              Article modifié
                            </div>
                          )}

                          {oldData.categorie && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">Catégorie:</span>
                              <span>{oldData.categorie}</span>
                            </div>
                          )}
                        </div>

                        {/* Raison */}
                        {entry.raison_changement && (
                          <div className="mt-2 p-2 bg-muted rounded-md">
                            <p className="text-xs text-muted-foreground mb-1">
                              Raison du changement:
                            </p>
                            <p className="text-sm">{entry.raison_changement}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {history.length} modification(s) enregistrée(s)
          </div>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpensesHistory;
