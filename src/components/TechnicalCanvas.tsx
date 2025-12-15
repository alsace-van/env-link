import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  display_order: number;
}

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryUpdated: () => void;
}

const colorOptions = [
  { value: "blue", label: "Bleu", class: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "green", label: "Vert", class: "bg-green-100 text-green-800 border-green-200" },
  { value: "purple", label: "Violet", class: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "orange", label: "Orange", class: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "red", label: "Rouge", class: "bg-red-100 text-red-800 border-red-200" },
  { value: "yellow", label: "Jaune", class: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "pink", label: "Rose", class: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "gray", label: "Gris", class: "bg-gray-100 text-gray-800 border-gray-200" },
];

const emojiOptions = ["📄", "🚐", "📋", "🔧", "✅", "📝", "🔐", "⚙️", "📊", "🏢", "💼", "📌"];

export function CategoryManagementDialog({ open, onOpenChange, onCategoryUpdated }: CategoryManagementDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: "gray",
    icon: "📄",
  });

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("official_document_categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error("Erreur lors du chargement des catégories:", error);
      toast.error("Impossible de charger les catégories");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error("Le nom de la catégorie est requis");
      return;
    }

    try {
      const { error } = await supabase.from("official_document_categories").insert({
        name: newCategory.name.trim(),
        color: newCategory.color,
        icon: newCategory.icon,
        display_order: categories.length,
      });

      if (error) throw error;

      toast.success("Catégorie ajoutée avec succès");
      setNewCategory({ name: "", color: "gray", icon: "📄" });
      loadCategories();
      onCategoryUpdated();
    } catch (error: any) {
      console.error("Erreur lors de l'ajout:", error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      const { error } = await supabase
        .from("official_document_categories")
        .update({
          name: editingCategory.name,
          color: editingCategory.color,
          icon: editingCategory.icon,
        })
        .eq("id", editingCategory.id);

      if (error) throw error;

      toast.success("Catégorie modifiée avec succès");
      setEditingCategory(null);
      loadCategories();
      onCategoryUpdated();
    } catch (error: any) {
      console.error("Erreur lors de la modification:", error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;

    try {
      // Vérifier si des documents utilisent cette catégorie
      const { data: documents, error: checkError } = await supabase
        .from("official_documents")
        .select("id")
        .eq("category", categories.find((c) => c.id === deleteCategoryId)?.name)
        .limit(1);

      if (checkError) throw checkError;

      if (documents && documents.length > 0) {
        toast.error("Impossible de supprimer une catégorie utilisée par des documents");
        setDeleteCategoryId(null);
        return;
      }

      const { error } = await supabase.from("official_document_categories").delete().eq("id", deleteCategoryId);

      if (error) throw error;

      toast.success("Catégorie supprimée avec succès");
      loadCategories();
      onCategoryUpdated();
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setDeleteCategoryId(null);
    }
  };

  const getCategoryColorClass = (color: string) => {
    const colorOption = colorOptions.find((c) => c.value === color);
    return colorOption?.class || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gérer les catégories</DialogTitle>
            <DialogDescription>Créez, modifiez ou supprimez les catégories de documents officiels</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Formulaire d'ajout */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">Nouvelle catégorie</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="category-name">Nom</Label>
                  <Input
                    id="category-name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="Ex: Sécurité"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category-color">Couleur</Label>
                  <Select
                    value={newCategory.color}
                    onValueChange={(value) => setNewCategory({ ...newCategory, color: value })}
                  >
                    <SelectTrigger id="category-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${color.class}`} />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icône</Label>
                <div className="flex gap-2 flex-wrap">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setNewCategory({ ...newCategory, icon: emoji })}
                      className={`text-2xl p-2 rounded border-2 transition-all ${
                        newCategory.icon === emoji
                          ? "border-primary bg-primary/10 scale-110"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleAddCategory} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter la catégorie
              </Button>
            </div>

            {/* Liste des catégories */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Catégories existantes</h3>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune catégorie disponible</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:border-primary/50 transition-all"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-2xl">{category.icon}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColorClass(
                          category.color,
                        )}`}
                      >
                        {category.name}
                      </span>
                      <div className="ml-auto flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingCategory(category)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteCategoryId(category.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier la catégorie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom</Label>
                <Input
                  id="edit-name"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Couleur</Label>
                <Select
                  value={editingCategory.color}
                  onValueChange={(value) => setEditingCategory({ ...editingCategory, color: value })}
                >
                  <SelectTrigger id="edit-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Icône</Label>
                <div className="flex gap-2 flex-wrap">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setEditingCategory({ ...editingCategory, icon: emoji })}
                      className={`text-2xl p-2 rounded border-2 transition-all ${
                        editingCategory.icon === emoji
                          ? "border-primary bg-primary/10 scale-110"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingCategory(null)}>
                  Annuler
                </Button>
                <Button onClick={handleUpdateCategory}>Enregistrer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette catégorie ? Cette action est irréversible. Les documents
              utilisant cette catégorie devront être réassignés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
