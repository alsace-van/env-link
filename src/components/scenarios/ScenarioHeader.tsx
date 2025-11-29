// components/scenarios/ScenarioHeader.tsx
// Header d'un scénario avec nom, badge principal et menu actions

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Star, Copy, FileText, Trash2, Palette, Lock, Unlock, History } from "lucide-react";
import { useScenarios } from "@/hooks/useScenarios";
import { toast } from "sonner";
import type { Scenario } from "@/types/scenarios";

interface ScenarioHeaderProps {
  scenario: Scenario;
  onScenarioChange: () => void;
  isLocked: boolean;
}

const COULEURS_PREDEFINES = [
  { nom: "Bleu", valeur: "#3B82F6" },
  { nom: "Vert", valeur: "#10B981" },
  { nom: "Orange", valeur: "#F59E0B" },
  { nom: "Rouge", valeur: "#EF4444" },
  { nom: "Violet", valeur: "#8B5CF6" },
  { nom: "Rose", valeur: "#EC4899" },
];

const ICONES_PREDEFINIES = ["🔒", "📋", "⚡", "💰", "🎯", "⭐", "🚀", "💡"];

const ScenarioHeader = ({ scenario, onScenarioChange, isLocked }: ScenarioHeaderProps) => {
  const { updateScenario, deleteScenario, promoteScenario, duplicateScenario, unlockScenario, clearDevisHistory } =
    useScenarios(scenario.project_id);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [newName, setNewName] = useState(scenario.nom);
  const [selectedCouleur, setSelectedCouleur] = useState(scenario.couleur);
  const [selectedIcone, setSelectedIcone] = useState(scenario.icone);

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }

    const success = await updateScenario(scenario.id, { nom: newName });
    if (success) {
      setIsRenameDialogOpen(false);
      onScenarioChange();
    }
  };

  const handleCustomize = async () => {
    const success = await updateScenario(scenario.id, {
      couleur: selectedCouleur,
      icone: selectedIcone,
    });
    if (success) {
      setIsCustomizeDialogOpen(false);
      onScenarioChange();
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer le scénario "${scenario.nom}" et toutes ses dépenses ?`)) {
      return;
    }

    const success = await deleteScenario(scenario.id);
    if (success) {
      onScenarioChange();
    }
  };

  const handlePromote = async () => {
    if (!confirm(`Promouvoir "${scenario.nom}" en scénario principal ?`)) {
      return;
    }

    const success = await promoteScenario(scenario.id);
    if (success) {
      onScenarioChange();
    }
  };

  const handleDuplicate = async () => {
    const nouveauNom = `${scenario.nom} (copie)`;
    await duplicateScenario(scenario.id, nouveauNom);
    onScenarioChange();
  };

  const handleUnlock = async () => {
    if (!confirm(`Déverrouiller le scénario "${scenario.nom}" ? Cela permettra de le modifier à nouveau.`)) {
      return;
    }

    const success = await unlockScenario(scenario.id);
    if (success) {
      onScenarioChange();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm(`Effacer tout l'historique des devis de ce projet ? Cette action est irréversible.`)) {
      return;
    }

    const success = await clearDevisHistory();
    if (success) {
      onScenarioChange();
    }
  };

  return (
    <>
      <div
        className="p-4 border-b flex items-center justify-between"
        style={{ backgroundColor: `${scenario.couleur}15` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{scenario.icone}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{scenario.nom}</h3>
            {scenario.est_principal && (
              <Badge variant="default" className="mt-1">
                {isLocked ? <Lock className="h-3 w-3 mr-1" /> : null}
                Principal {isLocked ? "(Verrouillé)" : ""}
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenameDialogOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Renommer
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => setIsCustomizeDialogOpen(true)}>
              <Palette className="h-4 w-4 mr-2" />
              Personnaliser
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Dupliquer
            </DropdownMenuItem>

            {!scenario.est_principal && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handlePromote}>
                  <Star className="h-4 w-4 mr-2" />
                  Promouvoir en principal
                </DropdownMenuItem>
              </>
            )}

            {/* Options de test pour le scénario principal verrouillé */}
            {scenario.est_principal && isLocked && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleUnlock} className="text-orange-600">
                  <Unlock className="h-4 w-4 mr-2" />
                  🔧 Déverrouiller (test)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearHistory} className="text-orange-600">
                  <History className="h-4 w-4 mr-2" />
                  🔧 Effacer historique devis
                </DropdownMenuItem>
              </>
            )}

            {!scenario.est_principal && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog Renommer */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer le scénario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nouveau nom</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du scénario" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Personnaliser */}
      <Dialog open={isCustomizeDialogOpen} onOpenChange={setIsCustomizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personnaliser le scénario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Sélection couleur */}
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="grid grid-cols-6 gap-2">
                {COULEURS_PREDEFINES.map((c) => (
                  <button
                    key={c.valeur}
                    className={`h-10 rounded-md border-2 transition-all ${
                      selectedCouleur === c.valeur ? "border-black scale-110" : "border-gray-200"
                    }`}
                    style={{ backgroundColor: c.valeur }}
                    onClick={() => setSelectedCouleur(c.valeur)}
                    title={c.nom}
                  />
                ))}
              </div>
            </div>

            {/* Sélection icône */}
            <div className="space-y-2">
              <Label>Icône</Label>
              <div className="grid grid-cols-8 gap-2">
                {ICONES_PREDEFINIES.map((icone) => (
                  <button
                    key={icone}
                    className={`h-10 rounded-md border-2 text-2xl transition-all ${
                      selectedIcone === icone ? "border-black scale-110" : "border-gray-200"
                    }`}
                    onClick={() => setSelectedIcone(icone)}
                  >
                    {icone}
                  </button>
                ))}
              </div>
            </div>

            {/* Aperçu */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${selectedCouleur}15` }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedIcone}</span>
                <span className="font-semibold">{scenario.nom}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomizeDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCustomize}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScenarioHeader;
