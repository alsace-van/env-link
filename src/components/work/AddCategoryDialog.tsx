import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; color: string; icon: string; isTemplate: boolean }) => void;
}

const ICONS = [
  { emoji: "🔨", label: "Marteau" },
  { emoji: "🔌", label: "Électricité" },
  { emoji: "🛏️", label: "Lit" },
  { emoji: "💧", label: "Eau" },
  { emoji: "🎨", label: "Peinture" },
  { emoji: "🪟", label: "Fenêtre" },
  { emoji: "🚪", label: "Porte" },
  { emoji: "💡", label: "Lumière" },
  { emoji: "🔧", label: "Clé" },
  { emoji: "📦", label: "Boîte" },
];

const COLORS = [
  { value: "#8b5cf6", label: "Violet" },
  { value: "#eab308", label: "Jaune" },
  { value: "#3b82f6", label: "Bleu" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#10b981", label: "Vert" },
  { value: "#f97316", label: "Orange" },
  { value: "#ef4444", label: "Rouge" },
  { value: "#ec4899", label: "Rose" },
];

export const AddCategoryDialog = ({ open, onOpenChange, onSubmit }: AddCategoryDialogProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState("🔨");
  const [isTemplate, setIsTemplate] = useState(false);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit({ name, color, icon, isTemplate });
      setName("");
      setColor("#3b82f6");
      setIcon("🔨");
      setIsTemplate(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle catégorie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              placeholder="Ex: Préparation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Icône</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICONS.map((item) => (
                  <SelectItem key={item.emoji} value={item.emoji}>
                    {item.emoji} {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`h-10 rounded-md border-2 transition-all ${
                    color === c.value ? "border-foreground scale-110" : "border-border"
                  }`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-template"
              checked={isTemplate}
              onCheckedChange={(checked) => setIsTemplate(checked as boolean)}
            />
            <label htmlFor="is-template" className="text-sm font-medium">
              💾 Sauvegarder comme template
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit}>
            ✓ Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};