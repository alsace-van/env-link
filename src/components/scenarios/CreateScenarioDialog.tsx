// components/scenarios/CreateScenarioDialog.tsx
// Dialog pour créer un nouveau scénario (vide, dupliqué, template)

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Copy, Package } from 'lucide-react';
import { useScenarios } from '@/hooks/useScenarios';
import { toast } from 'sonner';
import type { Scenario } from '@/types/scenarios';

interface CreateScenarioDialogProps {
  projectId: string;
  scenarios: Scenario[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type CreationMode = 'vide' | 'dupliquer' | 'template';

const CreateScenarioDialog = ({
  projectId,
  scenarios,
  isOpen,
  onClose,
  onCreated
}: CreateScenarioDialogProps) => {
  const { createScenario, duplicateScenario } = useScenarios(projectId);
  const [mode, setMode] = useState<CreationMode>('vide');
  const [nom, setNom] = useState('');
  const [scenarioSource, setScenarioSource] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!nom.trim()) {
      toast.error('Veuillez saisir un nom');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'vide') {
        await createScenario(nom);
      } else if (mode === 'dupliquer') {
        if (!scenarioSource) {
          toast.error('Veuillez sélectionner un scénario à dupliquer');
          setIsLoading(false);
          return;
        }
        await duplicateScenario(scenarioSource, nom);
      } else if (mode === 'template') {
        // Pour l'instant, créer vide (à implémenter plus tard avec des templates)
        await createScenario(nom);
        toast.info('Templates à venir - Scénario vide créé');
      }

      onCreated();
      onClose();
      setNom('');
      setMode('vide');
      setScenarioSource('');
    } catch (error) {
      console.error('Erreur création:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer un nouveau scénario</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nom du scénario */}
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du scénario</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Configuration économique, Option premium..."
              autoFocus
            />
          </div>

          {/* Mode de création */}
          <div className="space-y-3">
            <Label>Type de création</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as CreationMode)}>
              {/* Scénario vide */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="vide" id="vide" className="mt-1" />
                <label htmlFor="vide" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Scénario vide</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Partir de zéro et ajouter les dépenses manuellement
                  </p>
                </label>
              </div>

              {/* Dupliquer */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="dupliquer" id="dupliquer" className="mt-1" />
                <label htmlFor="dupliquer" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Copy className="h-4 w-4" />
                    <span className="font-medium">Dupliquer un scénario existant</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Copier toutes les dépenses d'un scénario existant
                  </p>
                  {mode === 'dupliquer' && (
                    <Select value={scenarioSource} onValueChange={setScenarioSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un scénario" />
                      </SelectTrigger>
                      <SelectContent>
                        {scenarios.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.icone} {s.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </label>
              </div>

              {/* Template (désactivé pour l'instant) */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border opacity-50 cursor-not-allowed">
                <RadioGroupItem value="template" id="template" disabled className="mt-1" />
                <label htmlFor="template" className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Depuis un template</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    À venir - Templates prédéfinis de configurations
                  </p>
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'Création...' : 'Créer le scénario'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateScenarioDialog;
