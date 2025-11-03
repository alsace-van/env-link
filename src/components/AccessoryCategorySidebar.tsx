import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronRight, ChevronDown, Edit2, Check, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
}

interface AccessoryCategorySidebarProps {
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

const AccessoryCategorySidebar = ({
  selectedCategories,
  onCategoryChange,
  isOpen,
  onClose,
}: AccessoryCategorySidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [showAddSub, setShowAddSub] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("*").order("nom");

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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("categories").insert({
      nom: newCategoryName.trim(),
      parent_id: newCategoryParentId,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout de la catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie ajoutée");
      setNewCategoryName("");
      setNewCategoryParentId(null);
      setShowAddRoot(false);
      loadCategories();
      // Si on a ajouté une sous-catégorie, expand le parent
      if (newCategoryParentId) {
        setExpandedCategories((prev) => new Set(prev).add(newCategoryParentId));
      }
    }
  };

  const handleAddSubCategory = async (parentId: string) => {
    if (!newSubCategoryName.trim()) {
      toast.error("Le nom de la sous-catégorie ne peut pas être vide");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      setExpandedCategories((prev) => new Set(prev).add(parentId));
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
      onCategoryChange(selectedCategories.filter((catId) => catId !== id));
    }
    setDeleteId(null);
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category.id);
    setEditName(category.nom);
    setEditParentId(category.parent_id);
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditName("");
    setEditParentId(null);
  };

  const saveEdit = async () => {
    if (!editingCategory) return;

    if (!editName.trim()) {
      toast.error("Le nom de la catégorie ne peut pas être vide");
      return;
    }

    // Vérifier qu'on ne crée pas de boucle circulaire
    if (editParentId && isDescendant(editingCategory, editParentId)) {
      toast.error("Impossible de déplacer une catégorie vers l'une de ses sous-catégories");
      return;
    }

    const { error } = await supabase
      .from("categories")
      .update({
        nom: editName.trim(),
        parent_id: editParentId,
      })
      .eq("id", editingCategory);

    if (error) {
      toast.error("Erreur lors de la modification");
      console.error(error);
    } else {
      toast.success("Catégorie modifiée");
      cancelEdit();
      loadCategories();
    }
  };

  const isDescendant = (parentId: string, childId: string): boolean => {
    const children = categories.filter((cat) => cat.parent_id === parentId);
    if (children.some((cat) => cat.id === childId)) return true;
    return children.some((cat) => isDescendant(cat.id, childId));
  };

  const toggleCategory = (categoryId: string) => {
    const newSelected = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId];
    onCategoryChange(newSelected);
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) => {
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
    return categories.filter((cat) => cat.parent_id === parentId);
  };

  const getAvailableParents = (currentCategoryId: string) => {
    // Retourner toutes les catégories sauf elle-même et ses descendants
    return categories.filter((cat) => {
      if (cat.id === currentCategoryId) return false;
      if (isDescendant(currentCategoryId, cat.id)) return false;
      return true;
    });
  };

  const renderCategory = (category: Category, level = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategories.includes(category.id);

    return (
      <div key={category.id} className="group">
        <div
          className="hover:bg-blue-500/10 dark:hover:bg-blue-500/15 rounded-md transition-colors"
          style={{ paddingLeft: `${level * 1.5}rem` }}
        >
          {editingCategory === category.id ? (
            // Mode édition
            <div className="flex flex-col gap-2 p-2">
              <Input
                placeholder="Nom de la catégorie"
                value={editName}
                onChange={(e) => {
                  e.stopPropagation();
                  setEditName(e.target.value);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-7 text-sm"
                autoFocus
                autoComplete="off"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Parent:</span>
                <Select
                  value={editParentId || "root"}
                  onValueChange={(value) => setEditParentId(value === "root" ? null : value)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Racine</SelectItem>
                    {getAvailableParents(category.id).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={saveEdit} className="h-7 flex-1" title="Enregistrer">
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 flex-1" title="Annuler">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            // Mode normal
            <div className="flex items-center gap-1 p-1.5">
              {/* Bouton expand/collapse */}
              {hasSubcategories ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(category.id);
                  }}
                  className="h-6 w-6 flex items-center justify-center hover:bg-blue-500/10 rounded flex-shrink-0"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <div className="w-6" />
              )}

              {/* Nom de la catégorie cliquable */}
              <button
                onClick={() => toggleCategory(category.id)}
                className={`flex-1 text-left text-sm px-2 py-1 rounded hover:bg-blue-500/10 transition-colors ${
                  isSelected ? "font-medium text-primary" : ""
                }`}
              >
                {category.nom}
              </button>

              {/* Bouton modifier */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditCategory(category)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 flex-shrink-0"
                title="Modifier"
              >
                <Edit2 className="h-3 w-3" />
              </Button>

              {/* Bouton ajouter sous-catégorie */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddSub(category.id);
                  setExpandedCategories((prev) => new Set(prev).add(category.id));
                }}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 flex-shrink-0"
                title="Ajouter une sous-catégorie"
              >
                <Plus className="h-3 w-3" />
              </Button>

              {/* Bouton supprimer */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteId(category.id)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 flex-shrink-0"
                title="Supprimer"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {/* Formulaire d'ajout de sous-catégorie */}
        {showAddSub === category.id && (
          <div className="flex items-center gap-2 p-2" style={{ paddingLeft: `${(level + 1) * 1.5 + 0.5}rem` }}>
            <Input
              placeholder="Nom de la sous-catégorie"
              value={newSubCategoryName}
              onChange={(e) => {
                e.stopPropagation();
                setNewSubCategoryName(e.target.value);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSubCategory(category.id);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setShowAddSub(null);
                  setNewSubCategoryName("");
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-7 text-sm"
              autoFocus
              autoComplete="off"
            />
            <Button size="sm" onClick={() => handleAddSubCategory(category.id)} className="h-7 w-7 p-0" title="Ajouter">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddSub(null);
                setNewSubCategoryName("");
              }}
              className="h-7 w-7 p-0"
              title="Annuler"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Sous-catégories */}
        {isExpanded && hasSubcategories && (
          <div className="group">{subcategories.map((sub) => renderCategory(sub, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 overflow-hidden">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Catégories</SheetTitle>
          </SheetHeader>

          <div className="h-[calc(100vh-80px)] flex flex-col">
            <div className="px-6 py-4 border-b">
              {showAddRoot ? (
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Nom de la catégorie"
                    value={newCategoryName}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewCategoryName(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddRootCategory();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setShowAddRoot(false);
                        setNewCategoryName("");
                        setNewCategoryParentId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 text-sm"
                    autoFocus
                    autoComplete="off"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Parent:</span>
                    <Select
                      value={newCategoryParentId || "root"}
                      onValueChange={(value) => setNewCategoryParentId(value === "root" ? null : value)}
                    >
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="root">Racine</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleAddRootCategory} className="h-8 flex-1" title="Ajouter">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAddRoot(false);
                        setNewCategoryName("");
                        setNewCategoryParentId(null);
                      }}
                      className="h-8 flex-1"
                      title="Annuler"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowAddRoot(true)} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle catégorie
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="px-6 py-4 group">
                {categories.filter((cat) => !cat.parent_id).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune catégorie</p>
                ) : (
                  categories.filter((cat) => !cat.parent_id).map((cat) => renderCategory(cat))
                )}
              </div>
            </ScrollArea>

            {selectedCategories.length > 0 && (
              <div className="border-t px-6 py-4">
                <Button variant="outline" size="sm" onClick={() => onCategoryChange([])} className="w-full">
                  Effacer les filtres ({selectedCategories.length})
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  );
};

export default AccessoryCategorySidebar;
