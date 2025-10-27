import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronRight, ChevronDown, PanelLeftClose, PanelLeft, GripVertical } from "lucide-react";
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
  onAccessoryDrop?: (accessoryId: string, categoryId: string | null) => void;
}

const AccessoryCategorySidebar = ({
  selectedCategories,
  onCategoryChange,
  onAccessoryDrop,
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
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

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

  const handleCategoryDragStart = (e: React.DragEvent, categoryId: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", categoryId); // Pour compatibilité
    e.dataTransfer.setData("application/x-category-id", categoryId); // Type custom
    setDraggedCategory(categoryId);
    console.log("Drag started:", categoryId);
  };

  const handleCategoryDragOver = (e: React.DragEvent, categoryId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Vérifier si c'est un drag de catégorie
    if (draggedCategory) {
      e.dataTransfer.dropEffect = "move";
      setDragOverCategory(categoryId);
    }
  };

  const handleCategoryDragLeave = () => {
    setDragOverCategory(null);
  };

  const isDescendant = (parentId: string, childId: string): boolean => {
    const children = categories.filter(cat => cat.parent_id === parentId);
    if (children.some(cat => cat.id === childId)) return true;
    return children.some(cat => isDescendant(cat.id, childId));
  };

  const handleCategoryDrop = async (e: React.DragEvent, newParentId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Drop event triggered", { draggedCategory, newParentId });

    if (!draggedCategory) {
      console.log("No dragged category");
      setDragOverCategory(null);
      return;
    }

    if (draggedCategory === newParentId) {
      console.log("Cannot drop on itself");
      setDraggedCategory(null);
      setDragOverCategory(null);
      return;
    }

    // Vérifier qu'on ne crée pas de boucle circulaire
    if (newParentId && isDescendant(draggedCategory, newParentId)) {
      toast.error("Impossible de déplacer une catégorie vers l'une de ses sous-catégories");
      setDraggedCategory(null);
      setDragOverCategory(null);
      return;
    }

    console.log("Updating category", draggedCategory, "with parent", newParentId);

    // Effectuer la mise à jour
    const { error } = await supabase
      .from("categories")
      .update({ parent_id: newParentId })
      .eq("id", draggedCategory);

    if (error) {
      toast.error("Erreur lors du déplacement de la catégorie");
      console.error("Drop error:", error);
    } else {
      const draggedCat = categories.find((c) => c.id === draggedCategory);
      const targetCat = newParentId ? categories.find((c) => c.id === newParentId) : null;

      if (newParentId && targetCat) {
        toast.success(`"${draggedCat?.nom}" déplacée dans "${targetCat.nom}"`);
      } else {
        toast.success(`"${draggedCat?.nom}" déplacée à la racine`);
      }

      // Recharger et expand si nécessaire
      await loadCategories();
      if (newParentId) {
        setExpandedCategories((prev) => new Set(prev).add(newParentId));
      }
    }

    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  const handleAccessoryDragOver = (e: React.DragEvent, categoryId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCategory(categoryId);
  };

  const handleAccessoryDrop = async (e: React.DragEvent, categoryId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    const accessoryId = e.dataTransfer.getData("accessoryId");
    if (!accessoryId) {
      setDragOverCategory(null);
      return;
    }

    if (onAccessoryDrop) {
      onAccessoryDrop(accessoryId, categoryId);
    }

    setDragOverCategory(null);
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategories.includes(category.id);
    const isAddingSubHere = showAddSub === category.id;
    const isDragOver = dragOverCategory === category.id;
    const isDragging = draggedCategory === category.id;

    return (
      <div key={category.id} className="select-none">
        <div
          draggable={!isAddingSubHere}
          onDragStart={(e) => handleCategoryDragStart(e, category.id)}
          onDragOver={(e) => handleCategoryDragOver(e, category.id)}
          onDragLeave={handleCategoryDragLeave}
          onDrop={(e) => handleCategoryDrop(e, category.id)}
          className={`flex items-center gap-1 py-1.5 rounded group transition-all ${
            isDragging ? "opacity-40" : "hover:bg-accent/50"
          } ${isDragOver && draggedCategory ? "bg-primary/20 ring-2 ring-primary" : ""} ${
            level > 0 ? "border-l-2 border-muted ml-2" : ""
          }`}
          style={{ paddingLeft: `${level * 24 + 8}px` }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              if (hasSubcategories) {
                toggleExpanded(category.id);
              }
            }}
          >
            {hasSubcategories ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCategory(category.id);
            }}
            className={`flex-1 text-left text-sm px-3 py-1.5 rounded transition-colors ${
              isSelected ? "bg-primary text-primary-foreground font-medium" : ""
            } ${level > 0 ? "text-muted-foreground" : "font-medium"}`}
          >
            {category.nom}
          </button>

          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddSub(category.id);
                // Auto-expand quand on ajoute une sous-catégorie
                if (!isExpanded) {
                  setExpandedCategories((prev) => new Set(prev).add(category.id));
                }
              }}
              title="Ajouter une sous-catégorie"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(category.id);
              }}
              title="Supprimer"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isAddingSubHere && (
          <div 
            className="flex items-center gap-2 py-2 border-l-2 border-muted ml-2" 
            style={{ paddingLeft: `${(level + 1) * 24 + 8}px` }}
          >
            <Input
              placeholder="Nom de la sous-catégorie"
              type="text"
              value={newSubCategoryName}
              onChange={(e) => {
                setNewSubCategoryName(e.target.value);
              }}
              onKeyDown={(e) => {
                // Ne bloquer QUE Enter et Escape, laisser TOUT le reste passer
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddSubCategory(category.id);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddSub(null);
                  setNewSubCategoryName("");
                }
                // IMPORTANT : Ne pas appeler preventDefault() ou stopPropagation() pour les autres touches
                // Backspace, Delete, lettres, etc. doivent passer normalement
              }}
              onMouseDown={(e) => {
                // Empêcher le parent draggable d'intercepter
                e.stopPropagation();
              }}
              onClick={(e) => {
                // Empêcher le parent draggable d'intercepter
                e.stopPropagation();
              }}
              className="h-7 text-sm"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
            />
            <Button size="sm" onClick={() => handleAddSubCategory(category.id)} className="h-7">
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

        {isExpanded && hasSubcategories && subcategories.map((sub) => renderCategory(sub, level + 1))}
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsCollapsed(false)}
        className="fixed left-4 top-80 z-50"
        title="Afficher les catégories"
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Card className="w-80 h-[calc(100vh-24rem)] fixed left-4 top-80 z-40 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Catégories</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(true)} title="Masquer">
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
                type="text"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                }}
                onKeyDown={(e) => {
                  // Ne bloquer QUE Enter et Escape, laisser TOUT le reste passer
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddRootCategory();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddRoot(false);
                    setNewCategoryName("");
                  }
                  // IMPORTANT : Ne pas appeler preventDefault() ou stopPropagation() pour les autres touches
                  // Backspace, Delete, lettres, etc. doivent passer normalement
                }}
                onMouseDown={(e) => {
                  // Empêcher l'interception par des gestionnaires parents
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  // Empêcher l'interception par des gestionnaires parents
                  e.stopPropagation();
                }}
                className="h-8 text-sm"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
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
            <Button variant="outline" size="sm" onClick={() => setShowAddRoot(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle catégorie
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div
            className={`p-2 min-h-[300px] rounded transition-colors ${
              draggedCategory && dragOverCategory === null ? "bg-primary/10 ring-2 ring-primary ring-dashed" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggedCategory) {
                e.dataTransfer.dropEffect = "move";
                // Vérifier qu'on est bien dans la zone racine (pas sur une catégorie)
                if (e.target === e.currentTarget) {
                  setDragOverCategory(null);
                }
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              if (draggedCategory && e.target === e.currentTarget) {
                setDragOverCategory(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Drop on root zone");
              
              // Si c'est un drag de catégorie, déplacer à la racine
              if (draggedCategory) {
                handleCategoryDrop(e, null);
              } else {
                // Sinon c'est peut-être un accessoire
                const accessoryId = e.dataTransfer.getData("accessoryId");
                if (accessoryId && onAccessoryDrop) {
                  onAccessoryDrop(accessoryId, null);
                }
              }
            }}
          >
            {categories.filter((cat) => !cat.parent_id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune catégorie</p>
            ) : (
              categories.filter((cat) => !cat.parent_id).map((cat) => renderCategory(cat))
            )}

            {draggedCategory && (
              <div className="mt-4 p-4 text-xs text-center border-2 border-dashed rounded bg-muted/50 text-muted-foreground">
                💡 <strong>Astuce :</strong> Déposez ici (zone vide) pour déplacer à la racine
                <br />
                ou sur une catégorie pour créer une sous-catégorie
              </div>
            )}
          </div>
        </ScrollArea>

        {selectedCategories.length > 0 && (
          <div className="border-t p-4">
            <Button variant="outline" size="sm" onClick={() => onCategoryChange([])} className="w-full">
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