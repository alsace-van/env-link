// components/workScenarios/AddWorkTaskDialog.tsx
// Dialog pour ajouter une nouvelle tâche à un scénario

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Euro, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkScenarios } from "@/hooks/useWorkScenarios";
import { toast } from "sonner";

interface WorkCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface AddWorkTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  scenarioId: string;
  onCreated: () => void;
}

const AddWorkTaskDialog = ({
  open,
  onOpenChange,
  projectId,
  scenarioId,
  onCreated,
}: AddWorkTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [forfaitHT, setForfaitHT] = useState("");
  const [tvaRate, setTvaRate] = useState("20");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createTask } = useWorkScenarios(projectId);

  // Charger les catégories
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("work_categories")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order");

      if (!error && data) {
        setCategories(data);
        if (data.length > 0 && !categoryId) {
          setCategoryId(data[0].id);
        }
      }
    };

    if (open) {
      loadCategories();
    }
  }, [projectId, open]);

  // Reset form
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setForfaitHT("");
      setTvaRate("20");
      setEstimatedHours("");
    }
  }, [open]);

  // Calcul TTC preview
  const previewTTC = forfaitHT 
    ? parseFloat(forfaitHT) * (1 + parseFloat(tvaRate || "20") / 100)
    : null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }

    if (!categoryId) {
      toast.error("Veuillez sélectionner une catégorie");
      return;
    }

    setIsSubmitting(true);

    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId,
        scenarioId,
        forfaitHT: forfaitHT ? parseFloat(forfaitHT) : undefined,
        tvaRate: tvaRate ? parseFloat(tvaRate) : undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      });

      onOpenChange(false);
      onCreated();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouvelle tâche
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Titre */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Installation plancher"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails optionnels..."
              rows={2}
            />
          </div>

          {/* Catégorie */}
          <div className="space-y-2">
            <Label>Catégorie *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-xs text-amber-600">
                Aucune catégorie. Créez-en une d'abord dans la fiche de travaux.
              </p>
            )}
          </div>

          {/* Forfait */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="forfaitHT" className="flex items-center gap-1">
                <Euro className="h-3 w-3" />
                Forfait HT
              </Label>
              <Input
                id="forfaitHT"
                type="number"
                step="0.01"
                value={forfaitHT}
                onChange={(e) => setForfaitHT(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tvaRate">TVA %</Label>
              <Select value={tvaRate} onValueChange={setTvaRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5.5">5.5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview TTC */}
          {previewTTC && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Montant TTC</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">
                {new Intl.NumberFormat('fr-FR', { 
                  style: 'currency', 
                  currency: 'EUR' 
                }).format(previewTTC)}
              </p>
            </div>
          )}

          {/* Heures estimées */}
          <div className="space-y-2">
            <Label htmlFor="estimatedHours" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Heures estimées
            </Label>
            <Input
              id="estimatedHours"
              type="number"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !categoryId}>
            <Plus className="h-4 w-4 mr-2" />
            Créer la tâche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddWorkTaskDialog;
