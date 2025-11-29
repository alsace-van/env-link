// components/scenarios/ScenarioManager.tsx
// Gestionnaire principal de la vue en colonnes avec scénarios
// ✅ AMÉLIORATIONS: Colonnes plus larges + Carrousel + Checkboxes visibilité
// ✅ FIX: Correction de l'erreur useState ligne 66

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Table2, History, Lock, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useScenarios } from "@/hooks/useScenarios";
import ScenarioColumn from "./ScenarioColumn";
import CreateScenarioDialog from "./CreateScenarioDialog";
import ComparisonTable from "./ComparisonTable";
import ExpensesHistory from "./ExpensesHistory";
import LockProjectDialog from "./LockProjectDialog";
import type { ProjectWithStatus } from "@/types/scenarios";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [modificationsCount, setModificationsCount] = useState(0);

  // ✅ Gestion de la visibilité des scénarios
  const [visibleScenarios, setVisibleScenarios] = useState<Record<string, boolean>>({});

  // ✅ Référence pour le carrousel
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isLocked =
    project?.statut_financier === "devis_accepte" ||
    project?.statut_financier === "en_cours" ||
    project?.statut_financier === "termine";

  // ✅ FIX: Utiliser useEffect au lieu de useState pour mettre à jour la visibilité
  useEffect(() => {
    if (scenarios.length > 0) {
      setVisibleScenarios((prev) => {
        const newVisibility = { ...prev };
        scenarios.forEach((s) => {
          if (!(s.id in newVisibility)) {
            newVisibility[s.id] = true;
          }
        });
        return newVisibility;
      });
    }
  }, [scenarios]);

  // ✅ Fonctions de navigation du carrousel
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -470, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 470, behavior: "smooth" });
    }
  };

  // ✅ Toggle visibilité d'un scénario
  const toggleVisibility = (scenarioId: string) => {
    setVisibleScenarios((prev) => ({
      ...prev,
      [scenarioId]: !prev[scenarioId],
    }));
  };

  // Filtrer les scénarios visibles
  const displayedScenarios = scenarios.filter((s) => visibleScenarios[s.id] !== false);

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
                Devis validé le{" "}
                {project.date_validation_devis
                  ? new Date(project.date_validation_devis).toLocaleDateString("fr-FR")
                  : "N/A"}
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

        <div className="flex gap-2 flex-wrap">
          {/* ✅ Bouton visibilité des scénarios */}
          {scenarios.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Affichage ({displayedScenarios.length}/{scenarios.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Scénarios visibles</h4>
                  <div className="space-y-3">
                    {scenarios.map((scenario) => (
                      <div key={scenario.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`visible-${scenario.id}`}
                          checked={visibleScenarios[scenario.id] !== false}
                          onCheckedChange={() => toggleVisibility(scenario.id)}
                          disabled={scenario.est_principal}
                        />
                        <Label
                          htmlFor={`visible-${scenario.id}`}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <span className="text-lg">{scenario.icone}</span>
                          <span className="flex-1">{scenario.nom}</span>
                          {scenario.est_principal && (
                            <Badge variant="outline" className="text-xs">
                              Principal
                            </Badge>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {!isLocked && principalScenario && (
            <Button variant="outline" size="sm" onClick={() => setIsLockDialogOpen(true)} className="gap-2">
              <Lock className="h-4 w-4" />
              Verrouiller le devis
            </Button>
          )}

          {isLocked && (
            <Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(true)} className="gap-2">
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

          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau scénario
          </Button>
        </div>
      </div>

      {/* ✅ Vue en carrousel avec navigation */}
      <div className="relative">
        {/* Boutons de navigation */}
        {displayedScenarios.length > 2 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 shadow-lg"
              onClick={scrollLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 shadow-lg"
              onClick={scrollRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Conteneur scrollable */}
        <div ref={scrollContainerRef} className="overflow-x-auto pb-4 scroll-smooth" style={{ scrollbarWidth: "thin" }}>
          <div className="flex gap-4" style={{ minWidth: "min-content" }}>
            {displayedScenarios.map((scenario) => (
              <div key={scenario.id} style={{ minWidth: "450px", maxWidth: "450px" }}>
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
        </div>
      </div>

      {/* Message si aucun scénario visible */}
      {displayedScenarios.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Aucun scénario visible. Cliquez sur "Affichage" pour en afficher.
        </div>
      )}

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
          scenarios={displayedScenarios}
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
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default ScenarioManager;
