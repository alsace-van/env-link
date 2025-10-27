import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Edit } from "lucide-react";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
}

interface CategoryManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
}

const CategoryManagementDialog = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
}: CategoryManagementDialogProps) => {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editParentCategoryId, setEditParentCategoryId] = useState<string | null>(null);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Veuillez entrer un nom de catégorie");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("Vous devez être connecté");
      return;
    }

    const { error } = await supabase.from("categories").insert({
      nom: newCategoryName.trim(),
      parent_id: parentCategoryId,
      user_id: userData.user.id,
    });

    if (error) {
      toast.error("Erreur lors de la création de la catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie créée");
      setNewCategoryName("");
      setParentCategoryId(null);
      onSuccess();
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Catégorie supprimée");
      onSuccess();
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) {
      toast.error("Veuillez entrer un nom de catégorie");
      return;
    }

    // Vérifier qu'on ne crée pas une boucle (catégorie parente = elle-même ou descendante)
    if (editParentCategoryId === editingCategory.id) {
      toast.error("Une catégorie ne peut pas être sa propre parente");
      return;
    }

    const { error } = await supabase
      .from("categories")
      .update({
        nom: editCategoryName.trim(),
        parent_id: editParentCategoryId,
      })
      .eq("id", editingCategory.id);

    if (error) {
      toast.error("Erreur lors de la modification");
      console.error(error);
    } else {
      toast.success("Catégorie modifiée");
      setEditingCategory(null);
      setEditCategoryName("");
      setEditParentCategoryId(null);
      onSuccess();
    }
  };

  const getSubcategories = (parentId: string | null) => {
    return categories.filter(cat => cat.parent_id === parentId);
  };

  const renderCategoryTree = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    
    return (
      <div key={category.id}>
        <div
          className="flex items-center justify-between py-2 px-2 hover:bg-accent rounded"
          style={{ marginLeft: `${level * 16}px` }}
        >
          <span className="text-sm">{category.nom}</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingCategory(category);
                setEditCategoryName(category.nom);
                setEditParentCategoryId(category.parent_id);
              }}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteCategory(category.id)}
              className="h-8 w-8 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {subcategories.map(sub => renderCategoryTree(sub, level + 1))}
      </div>
    );
  };

  const rootCategories = getSubcategories(null);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gérer les catégories</DialogTitle>
          <DialogDescription>
            Créez et organisez vos catégories et sous-catégories
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {editingCategory ? (
            <div className="space-y-4 p-4 border rounded-lg bg-accent/50">
              <h4 className="font-semibold">Modifier la catégorie</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-category-name">Nom de la catégorie</Label>
                  <Input
                    id="edit-category-name"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleEditCategory();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingCategory(null);
                        setEditCategoryName("");
                        setEditParentCategoryId(null);
                      }
                    }}
                    placeholder="Ex: Électronique"
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="edit-parent-category">Catégorie parente</Label>
                  <Select
                    value={editParentCategoryId || "none"}
                    onValueChange={(value) => setEditParentCategoryId(value === "none" ? null : value)}
                  >
                    <SelectTrigger id="edit-parent-category">
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune (catégorie principale)</SelectItem>
                      {categories
                        .filter(cat => cat.parent_id === null && cat.id !== editingCategory.id)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleEditCategory}
                    className="flex-1"
                  >
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingCategory(null);
                      setEditCategoryName("");
                      setEditParentCategoryId(null);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-semibold">Nouvelle catégorie</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="category-name">Nom de la catégorie</Label>
                  <Input
                    id="category-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setNewCategoryName("");
                        setParentCategoryId(null);
                      }
                    }}
                    placeholder="Ex: Électronique, Plomberie..."
                  />
                </div>

                <div>
                  <Label htmlFor="parent-category">Catégorie parente (optionnel)</Label>
                  <Select
                    value={parentCategoryId || "none"}
                    onValueChange={(value) => setParentCategoryId(value === "none" ? null : value)}
                  >
                    <SelectTrigger id="parent-category">
                      <SelectValue placeholder="Aucune (catégorie principale)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune (catégorie principale)</SelectItem>
                      {categories
                        .filter(cat => cat.parent_id === null)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleAddCategory} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la catégorie
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-semibold">Catégories existantes</h4>
            {rootCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune catégorie pour le moment
              </p>
            ) : (
              <div className="border rounded-lg p-2">
                {rootCategories.map(cat => renderCategoryTree(cat))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryManagementDialog;
