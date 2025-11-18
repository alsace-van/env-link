import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  { emoji: "🪚", label: "Scie" },
  { emoji: "🔩", label: "Boulon" },
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

export const CategoryManagementDialog = ({ open, onOpenChange }: CategoryManagementDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "🔨",
    color: "#3b82f6",
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["work-categories", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_categories")
        .select("*")
        .eq("is_template", true)
        .order("display_order");

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; icon: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("work_categories").insert({
        name: data.name,
        icon: data.icon,
        color: data.color,
        is_template: true,
        user_id: user?.id,
        display_order: (categories?.length || 0) + 1,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-categories"] });
      toast({ title: "✓ Catégorie créée" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; icon: string; color: string } }) => {
      const { error } = await supabase
        .from("work_categories")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-categories"] });
      toast({ title: "✓ Catégorie modifiée" });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("work_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-categories"] });
      toast({ title: "Catégorie supprimée" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer une catégorie contenant des tâches",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: "", icon: "🔨", color: "#3b82f6" });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (category: any) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      icon: category.icon,
      color: category.color,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette catégorie ?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gestion des catégories de tâches</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Formulaire */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">
              {editingId ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                placeholder="Ex: Préparation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Icône</Label>
              <Select value={formData.icon} onValueChange={(icon) => setFormData({ ...formData, icon })}>
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
                      formData.color === c.value ? "border-foreground scale-110" : "border-border"
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setFormData({ ...formData, color: c.value })}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {editingId && (
                <Button variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
              )}
              <Button onClick={handleSubmit} className="flex-1">
                {editingId ? "✓ Modifier" : <><Plus className="h-4 w-4 mr-2" /> Créer</>}
              </Button>
            </div>
          </div>

          {/* Liste des catégories */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Catégories existantes</h3>
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div>Chargement...</div>
              ) : (
                <div className="space-y-2">
                  {categories?.map((category) => (
                    <Card key={category.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center"
                              style={{ backgroundColor: category.color }}
                            >
                              <span>{category.icon}</span>
                            </div>
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(category.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
