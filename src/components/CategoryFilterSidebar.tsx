import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Plus, GripVertical, X, ChevronLeft, Filter } from "lucide-react";
import CategoryManagementDialog from "./CategoryManagementDialog";
import { toast } from "sonner";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
}

interface CategoryFilterSidebarProps {
  selectedCategories: string[];
  onCategoryChange: (categoryIds: string[]) => void;
}

const CategoryFilterSidebar = ({ selectedCategories, onCategoryChange }: CategoryFilterSidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<Category | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("nom");

    if (!error && data) {
      setCategories(data);
      // Auto-expand categories that have selected children
      const toExpand = new Set<string>();
      data.forEach(cat => {
        if (cat.parent_id && selectedCategories.includes(cat.id)) {
          toExpand.add(cat.parent_id);
        }
      });
      setExpandedCategories(toExpand);
    }
  };

  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onCategoryChange([...selectedCategories, categoryId]);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const clearFilters = () => {
    onCategoryChange([]);
  };

  const getSubcategories = (parentId: string | null) => {
    return categories.filter(cat => cat.parent_id === parentId);
  };

  const handleDragStart = (e: React.DragEvent, category: Category) => {
    setDraggedCategory(category);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, category: Category) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Prevent dropping on itself or its descendants
    if (draggedCategory && draggedCategory.id !== category.id) {
      setDragOverCategory(category.id);
    }
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: Category) => {
    e.preventDefault();
    setDragOverCategory(null);

    if (!draggedCategory || draggedCategory.id === targetCategory.id) {
      setDraggedCategory(null);
      return;
    }

    // Check if target is a descendant of dragged (would create a loop)
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = categories.filter(cat => cat.parent_id === parentId);
      if (children.some(c => c.id === childId)) return true;
      return children.some(c => isDescendant(c.id, childId));
    };

    if (isDescendant(draggedCategory.id, targetCategory.id)) {
      toast.error("Impossible de déplacer une catégorie dans sa propre sous-catégorie");
      setDraggedCategory(null);
      return;
    }

    // Update the dragged category's parent
    const { error } = await supabase
      .from("categories")
      .update({ parent_id: targetCategory.id })
      .eq("id", draggedCategory.id);

    if (error) {
      toast.error("Erreur lors du déplacement");
      console.error(error);
    } else {
      toast.success(`"${draggedCategory.nom}" déplacé dans "${targetCategory.nom}"`);
      loadCategories();
      // Auto-expand the target category
      setExpandedCategories(prev => new Set([...prev, targetCategory.id]));
    }

    setDraggedCategory(null);
  };

  const handleDropToRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCategory(null);

    if (!draggedCategory || draggedCategory.parent_id === null) {
      setDraggedCategory(null);
      return;
    }

    const { error } = await supabase
      .from("categories")
      .update({ parent_id: null })
      .eq("id", draggedCategory.id);

    if (error) {
      toast.error("Erreur lors du déplacement");
      console.error(error);
    } else {
      toast.success(`"${draggedCategory.nom}" déplacé à la racine`);
      loadCategories();
    }

    setDraggedCategory(null);
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategories.includes(category.id);
    const isDraggedOver = dragOverCategory === category.id;
    const isDragging = draggedCategory?.id === category.id;

    return (
      <div key={category.id} style={{ marginLeft: `${level * 12}px` }}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, category)}
          onDragOver={(e) => handleDragOver(e, category)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, category)}
          className={`
            flex items-center gap-1 py-1 px-2 rounded cursor-move
            ${isDraggedOver ? "bg-primary/20 border-2 border-primary border-dashed" : ""}
            ${isDragging ? "opacity-50" : ""}
            ${isSelected ? "bg-accent" : "hover:bg-accent/50"}
          `}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          
          {hasSubcategories ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpanded(category.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <div className="w-5" />
          )}
          
          <Badge
            variant={isSelected ? "default" : "outline"}
            className="cursor-pointer text-xs flex-1"
            onClick={() => toggleCategory(category.id)}
          >
            {category.nom}
          </Badge>
        </div>
        
        {hasSubcategories && isExpanded && (
          <div className="mt-1">
            {subcategories.map(sub => renderCategory(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootCategories = getSubcategories(null);

  return (
    <div className="relative">
      {/* Collapse Button - Always visible */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute z-10 h-8 w-8 transition-all duration-300 ${
          isCollapsed ? "left-2 top-2" : "right-2 top-2"
        }`}
      >
        {isCollapsed ? <Filter className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <Card className={`transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-72 opacity-100"
      }`}>
        <CardHeader className="pb-3 pt-12">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filtres par catégorie</CardTitle>
            <div className="flex gap-1">
              {selectedCategories.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 px-2"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsManageDialogOpen(true)}
                className="h-7 px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {selectedCategories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedCategories.length} catégorie(s) sélectionnée(s)
            </p>
          )}
        </CardHeader>
      
      <CardContent className="pt-0">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={handleDropToRoot}
          className={`
            min-h-[200px] p-2 rounded border-2 border-dashed
            ${draggedCategory && draggedCategory.parent_id !== null ? "border-primary/50 bg-primary/5" : "border-transparent"}
          `}
        >
          <ScrollArea className="h-[calc(100vh-300px)]">
            {rootCategories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-2">
                  Aucune catégorie
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManageDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une catégorie
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {rootCategories.map(cat => renderCategory(cat))}
              </div>
            )}
          </ScrollArea>
          
          {draggedCategory && draggedCategory.parent_id !== null && (
            <p className="text-xs text-muted-foreground text-center mt-2 p-2 bg-primary/10 rounded">
              Déposez ici pour déplacer à la racine
            </p>
          )}
        </div>
      </CardContent>

        <CategoryManagementDialog
          isOpen={isManageDialogOpen}
          onClose={() => setIsManageDialogOpen(false)}
          onSuccess={() => {
            loadCategories();
            setIsManageDialogOpen(false);
          }}
          categories={categories}
        />
      </Card>
    </div>
  );
};

export default CategoryFilterSidebar;
