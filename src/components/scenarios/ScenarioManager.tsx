// components/scenarios/ScenarioManager.tsx
// Gestionnaire principal de la vue en colonnes avec scénarios

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Table2, History, Lock } from 'lucide-react';
import { useScenarios } from '@/hooks/useScenarios';
import ScenarioColumn from './ScenarioColumn';
import CreateScenarioDialog from './CreateScenarioDialog';
import ComparisonTable from './ComparisonTable';
import ExpensesHistory from './ExpensesHistory';
import LockProjectDialog from './LockProjectDialog';
import type { ProjectWithStatus } from '@/types/scenarios';

interface ScenarioManagerProps {
  projectId: string;
  project: ProjectWithStatus;
  onExpenseChange?: () => void;
}

const ScenarioManager = ({ projectId, project, onExpenseChange }: ScenarioManagerProps) => {
  const { scenarios, principalScenario, isLoading, reloadScenarios } = useScenarios(projectId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);

  const isLocked = project?.statut_financier === 'devis_accepte' || 
                   project?.statut_financier === 'en_cours' || 
                   project?.statut_financier === 'termine';

  // Compter les modifications depuis validation
  const [modificationsCount, setModificationsCount] = useState(0);

  if (isLoading) {
    return <div className="text-center py-8">Chargement des scénarios...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header avec statut et actions */}
      <div className="flex justify-between items-start gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">Gestion des dépenses</h3>
          
          {isLocked && (
            <div className="space-y-2">
              <Badge variant="secondary" className="gap-2">
                <Lock className="h-3 w-3" />
                Devis validé le {project.date_validation_devis ? 
                  new Date(project.date_validation_devis).toLocaleDateString('fr-FR') : 
                  'N/A'}
              </Badge>
              
              {project.montant_acompte && (
                <p className="text-sm text-muted-foreground">
                  Acompte: {project.montant_acompte.toFixed(2)} € encaissé
                </p>
              )}
              
              {modificationsCount > 0 && (
                <Badge variant="destructive" className="gap-2">
                  ⚠️ {modificationsCount} modification(s) depuis validation
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isLocked && principalScenario && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLockDialogOpen(true)}
              className="gap-2"
            >
              <Lock className="h-4 w-4" />
              Verrouiller le devis
            </Button>
          )}

          {isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryOpen(true)}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Historique
              {modificationsCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {modificationsCount}
                </Badge>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsComparisonOpen(true)}
            disabled={scenarios.length < 2}
            className="gap-2"
          >
            <Table2 className="h-4 w-4" />
            Tableau comparatif
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouveau scénario
          </Button>
        </div>
      </div>

      {/* Vue en colonnes avec scroll horizontal */}
      <div className="relative">
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ minWidth: 'min-content' }}>
            {scenarios.map((scenario) => (
              <div key={scenario.id} style={{ minWidth: '380px', maxWidth: '380px' }}>
                <ScenarioColumn
                  scenario={scenario}
                  projectId={projectId}
                  isLocked={isLocked && scenario.est_principal}
                  onExpenseChange={() => {
                    onExpenseChange?.();
                    reloadScenarios();
                  }}
                  onScenarioChange={reloadScenarios}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Dialogs */}
      <CreateScenarioDialog
        projectId={projectId}
        scenarios={scenarios}
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={reloadScenarios}
      />

      {isComparisonOpen && (
        <ComparisonTable
          projectId={projectId}
          scenarios={scenarios}
          onClose={() => setIsComparisonOpen(false)}
        />
      )}

      {isHistoryOpen && (
        <ExpensesHistory
          projectId={projectId}
          onClose={() => setIsHistoryOpen(false)}
          onCountChange={setModificationsCount}
        />
      )}

      {isLockDialogOpen && principalScenario && (
        <LockProjectDialog
          projectId={projectId}
          scenarioId={principalScenario.id}
          onClose={() => setIsLockDialogOpen(false)}
          onLocked={() => {
            setIsLockDialogOpen(false);
            window.location.reload(); // Recharger pour mettre à jour le statut
          }}
        />
      )}
    </div>
  );
};

export default ScenarioManager;
