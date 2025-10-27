import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronRight, ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";
import { toast } from "sonner";
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

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
}

interface AccessoryCategorySidebarProps {
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
}

const AccessoryCategorySidebar = ({
  selectedCategories,
  onCategoryChange,
}: AccessoryCategorySidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [showAddSub, setShowAddSub] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("nom");

    if (error) {
      toast.error("Erreur lors du chargement des catégories");
      console.error(error);
    } else {
      setCategories(data || []);
    }
  };

  const handleAddRootCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Le nom de la catégorie ne peut pas être vide");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("categories").insert({
      nom: newCategoryName.trim(),
      parent_id: null,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout de la catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie ajoutée");
      setNewCategoryName("");
      setShowAddRoot(false);
      loadCategories();
    }
  };

  const handleAddSubCategory = async (parentId: string) => {
    if (!newSubCategoryName.trim()) {
      toast.error("Le nom de la sous-catégorie ne peut pas être vide");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("categories").insert({
      nom: newSubCategoryName.trim(),
      parent_id: parentId,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout de la sous-catégorie");
      console.error(error);
    } else {
      toast.success("Sous-catégorie ajoutée");
      setNewSubCategoryName("");
      setShowAddSub(null);
      loadCategories();
      setExpandedCategories(prev => new Set(prev).add(parentId));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Catégorie supprimée");
      loadCategories();
      onCategoryChange(selectedCategories.filter(catId => catId !== id));
    }
    setDeleteId(null);
  };

  const toggleCategory = (categoryId: string) => {
    const newSelected = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    onCategoryChange(newSelected);
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const getSubcategories = (parentId: string | null) => {
    return categories.filter(cat => cat.parent_id === parentId);
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategories.includes(category.id);
    const isAddingSubHere = showAddSub === category.id;

    return (
      <div key={category.id} className="select-none">
        <div
          className="flex items-center gap-1 py-1 hover:bg-accent/50 rounded group"
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => hasSubcategories && toggleExpanded(category.id)}
          >
            {hasSubcategories ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            ) : (
              <div className="h-3 w-3" />
            )}
          </Button>

          <button
            onClick={() => toggleCategory(category.id)}
            className={`flex-1 text-left text-sm px-2 py-1 rounded ${
              isSelected ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {category.nom}
          </button>

          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowAddSub(category.id)}
              title="Ajouter une sous-catégorie"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(category.id)}
              title="Supprimer"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isAddingSubHere && (
          <div
            className="flex items-center gap-2 py-2"
            style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
          >
            <Input
              placeholder="Nom de la sous-catégorie"
              value={newSubCategoryName}
              onChange={(e) => setNewSubCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSubCategory(category.id);
                if (e.key === "Escape") {
                  setShowAddSub(null);
                  setNewSubCategoryName("");
                }
              }}
              className="h-7 text-sm"
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => handleAddSubCategory(category.id)}
              className="h-7"
            >
              OK
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddSub(null);
                setNewSubCategoryName("");
              }}
              className="h-7"
            >
              Annuler
            </Button>
          </div>
        )}

        {isExpanded &&
          hasSubcategories &&
          subcategories.map(sub => renderCategory(sub, level + 1))}
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsCollapsed(false)}
        className="fixed left-4 top-24 z-50"
        title="Afficher les catégories"
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Card className="w-80 h-[calc(100vh-8rem)] fixed left-4 top-24 z-40 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Catégories</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            title="Masquer"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col h-[calc(100%-5rem)]">
        <div className="px-4 pb-3 border-b">
          {showAddRoot ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nouvelle catégorie"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddRootCategory();
                  if (e.key === "Escape") {
                    setShowAddRoot(false);
                    setNewCategoryName("");
                  }
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={handleAddRootCategory} className="h-8">
                OK
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddRoot(false);
                  setNewCategoryName("");
                }}
                className="h-8"
              >
                Annuler
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddRoot(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle catégorie
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {categories.filter(cat => !cat.parent_id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune catégorie
              </p>
            ) : (
              categories
                .filter(cat => !cat.parent_id)
                .map(cat => renderCategory(cat))
            )}
          </div>
        </ScrollArea>

        {selectedCategories.length > 0 && (
          <div className="border-t p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCategoryChange([])}
              className="w-full"
            >
              Effacer les filtres ({selectedCategories.length})
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette catégorie ? Les sous-catégories seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDeleteCategory(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AccessoryCategorySidebar;
