import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers } from "lucide-react";

interface Scenario {
  id: string;
  nom: string;
  icone: string;
  couleur: string;
  est_principal: boolean;
}

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<{ id: string; name: string; icon: string }>;
  scenarios?: Scenario[];
  defaultScenarioId?: string;
  onSubmit: (data: {
    title: string;
    description?: string;
    categoryId: string;
    scheduledDate?: string;
    estimatedHours?: number;
    saveAsTemplate: boolean;
    scenarioId?: string;
  }) => void;
}

export const AddTaskDialog = ({
  open,
  onOpenChange,
  categories,
  scenarios,
  defaultScenarioId,
  onSubmit,
}: AddTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [scenarioId, setScenarioId] = useState<string>("");

  // Initialiser le scénario par défaut quand le dialog s'ouvre
  useEffect(() => {
    if (open && defaultScenarioId) {
      setScenarioId(defaultScenarioId);
    }
  }, [open, defaultScenarioId]);

  const handleSubmit = () => {
    if (title.trim() && categoryId) {
      onSubmit({
        title,
        description: description.trim() || undefined,
        categoryId,
        scheduledDate: scheduledDate || undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        saveAsTemplate,
        scenarioId: scenarioId || undefined,
      });
      setTitle("");
      setDescription("");
      setCategoryId("");
      setScheduledDate("");
      setEstimatedHours("");
      setSaveAsTemplate(false);
      setScenarioId("");
      onOpenChange(false);
    }
  };

  const selectedScenario = scenarios?.find((s) => s.id === scenarioId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              placeholder="Ex: Installation éclairage LED"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Détails de la tâche..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Catégorie *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sélecteur de scénario */}
          {scenarios && scenarios.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Scénario
              </Label>
              <Select value={scenarioId} onValueChange={setScenarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un scénario">
                    {selectedScenario && (
                      <span className="flex items-center gap-2">
                        {selectedScenario.icone} {selectedScenario.nom}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      <span className="flex items-center gap-2">
                        {scenario.icone} {scenario.nom}
                        {scenario.est_principal && (
                          <Badge variant="outline" className="text-xs ml-1">
                            Principal
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Date prévue</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated-hours">Temps estimé (h)</Label>
              <Input
                id="estimated-hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="Ex: 4"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="save-template"
              checked={saveAsTemplate}
              onCheckedChange={(checked) => setSaveAsTemplate(checked as boolean)}
            />
            <label htmlFor="save-template" className="text-sm font-medium">
              💾 Sauvegarder comme template
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !categoryId}>
            ✓ Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
