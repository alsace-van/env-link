import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import CategoryManagementDialog from "./CategoryManagementDialog";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
}

interface CategoryFilterProps {
  selectedCategories: string[];
  onCategoryChange: (categoryIds: string[]) => void;
}

const CategoryFilter = ({ selectedCategories, onCategoryChange }: CategoryFilterProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

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

  const renderCategory = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategories.includes(category.id);

    return (
      <div key={category.id} style={{ marginLeft: `${level * 16}px` }}>
        <div className="flex items-center gap-2 py-1">
          {hasSubcategories && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleExpanded(category.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          {!hasSubcategories && <div className="w-6" />}
          <Badge
            variant={isSelected ? "default" : "outline"}
            className="cursor-pointer hover:bg-accent"
            onClick={() => toggleCategory(category.id)}
          >
            {category.nom}
          </Badge>
        </div>
        {hasSubcategories && isExpanded && (
          <div>
            {subcategories.map(sub => renderCategory(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootCategories = getSubcategories(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Catégories</h3>
        <div className="flex gap-2">
          {selectedCategories.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              <X className="h-4 w-4 mr-1" />
              Effacer
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManageDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Gérer
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {rootCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune catégorie. Cliquez sur "Gérer" pour en créer.
          </p>
        ) : (
          rootCategories.map(cat => renderCategory(cat))
        )}
      </div>

      <CategoryManagementDialog
        isOpen={isManageDialogOpen}
        onClose={() => setIsManageDialogOpen(false)}
        onSuccess={() => {
          loadCategories();
          setIsManageDialogOpen(false);
        }}
        categories={categories}
      />
    </div>
  );
};

export default CategoryFilter;
