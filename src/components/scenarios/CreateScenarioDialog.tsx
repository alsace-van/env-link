// components/scenarios/CreateScenarioDialog.tsx
// Dialog pour créer un nouveau scénario

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScenarios } from '@/hooks/useScenarios';
import type { Scenario } from '@/types/scenarios';

interface CreateScenarioDialogProps {
  projectId: string;
  scenarios: Scenario[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const colorOptions = [
  { value: '#3B82F6', label: 'Bleu' },
  { value: '#10B981', label: 'Vert' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#EF4444', label: 'Rouge' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#EC4899', label: 'Rose' },
  { value: '#6B7280', label: 'Gris' },
];

const iconOptions = ['📋', '🔧', '⚡', '🏠', '🚐', '💡', '🔌', '🛠️', '📦', '🎯'];

const CreateScenarioDialog = ({ 
  projectId, 
  scenarios, 
  isOpen, 
  onClose, 
  onCreated 
}: CreateScenarioDialogProps) => {
  const { createScenario, duplicateScenario } = useScenarios(projectId);
  const [nom, setNom] = useState('');
  const [couleur, setCouleur] = useState('#3B82F6');
  const [icone, setIcone] = useState('📋');
  const [duplicateFromId, setDuplicateFromId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;

    setIsSubmitting(true);

    if (duplicateFromId) {
      await duplicateScenario(duplicateFromId, nom.trim());
    } else {
      await createScenario(nom.trim(), couleur, icone);
    }

    setNom('');
    setCouleur('#3B82F6');
    setIcone('📋');
    setDuplicateFromId(null);
    setIsSubmitting(false);
    onClose();
    await onCreated();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau scénario</DialogTitle>
          <DialogDescription>
            Créez un nouveau scénario pour comparer différentes options de dépenses.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du scénario</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Option économique"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Icône</Label>
            <div className="flex gap-2 flex-wrap">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setIcone(icon)}
                  className={`text-2xl p-2 rounded border-2 transition-all ${
                    icone === icon
                      ? 'border-primary bg-primary/10 scale-110'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setCouleur(color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    couleur === color.value
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:border-muted-foreground'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {scenarios.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="duplicate">Dupliquer depuis (optionnel)</Label>
              <Select
                value={duplicateFromId || 'none'}
                onValueChange={(value) => setDuplicateFromId(value === 'none' ? null : value)}
              >
                <SelectTrigger id="duplicate">
                  <SelectValue placeholder="Créer vide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Créer vide</SelectItem>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.icone} {scenario.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || !nom.trim()}>
              {isSubmitting ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateScenarioDialog;
