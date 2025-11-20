import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<{ id: string; name: string; icon: string }>;
  onSubmit: (data: {
    title: string;
    description?: string;
    categoryId: string;
    estimatedHours?: number;
    isGlobal: boolean;
  }) => void;
  isAdmin?: boolean;
  initialData?: {
    title: string;
    description?: string;
    categoryId: string;
    estimatedHours?: number;
    isGlobal: boolean;
  };
}

export const CreateTemplateDialog = ({ 
  open, 
  onOpenChange, 
  categories, 
  onSubmit,
  isAdmin = false,
  initialData
}: CreateTemplateDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || "");
      setCategoryId(initialData.categoryId);
      setEstimatedHours(initialData.estimatedHours?.toString() || "");
      setIsGlobal(initialData.isGlobal);
    } else {
      setTitle("");
      setDescription("");
      setCategoryId("");
      setEstimatedHours("");
      setIsGlobal(false);
    }
  }, [initialData, open]);

  const handleSubmit = () => {
    if (title.trim() && categoryId) {
      onSubmit({
        title,
        description: description.trim() || undefined,
        categoryId,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        isGlobal,
      });
      setTitle("");
      setDescription("");
      setCategoryId("");
      setEstimatedHours("");
      setIsGlobal(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "✏️ Modifier le template" : "💾 Nouveau template de tâche"}</DialogTitle>
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

          <div className="space-y-2">
            <Label htmlFor="estimated-hours">Temps estimé (heures)</Label>
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

          {isAdmin && (
            <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50">
              <Checkbox
                id="is-global"
                checked={isGlobal}
                onCheckedChange={(checked) => setIsGlobal(checked as boolean)}
              />
              <div className="flex-1">
                <label htmlFor="is-global" className="text-sm font-medium">
                  🌍 Rendre disponible globalement
                </label>
                <p className="text-xs text-muted-foreground">
                  Ce template sera accessible à tous les utilisateurs
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !categoryId}>
            {initialData ? "✓ Modifier" : "✓ Créer le template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};