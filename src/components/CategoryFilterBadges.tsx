import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
}

interface Accessory {
  id: string;
  category_id?: string | null;
}

interface CategoryFilterBadgesProps {
  categories: Category[];
  accessories: Accessory[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
}

export const CategoryFilterBadges = ({
  categories,
  accessories,
  selectedCategories,
  onCategoryChange,
}: CategoryFilterBadgesProps) => {
  // Calculer le nombre d'accessoires par catégorie principale
  const getCategoryCount = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return 0;

    // Si c'est une catégorie parente, compter aussi les sous-catégories
    const subCategoryIds = categories
      .filter((c) => c.parent_id === categoryId)
      .map((c) => c.id);

    return accessories.filter(
      (acc) =>
        acc.category_id === categoryId ||
        subCategoryIds.includes(acc.category_id || "")
    ).length;
  };

  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      onCategoryChange([...selectedCategories, categoryId]);
    }
  };

  // Ne montrer que les catégories principales (sans parent)
  const mainCategories = categories.filter((cat) => !cat.parent_id);

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <Badge
          variant={selectedCategories.length === 0 ? "default" : "outline"}
          className="cursor-pointer hover:bg-primary/90"
          onClick={() => onCategoryChange([])}
        >
          Toutes ({accessories.length})
        </Badge>

        {mainCategories.map((category) => {
          const count = getCategoryCount(category.id);
          const isSelected = selectedCategories.includes(category.id);

          return (
            <Badge
              key={category.id}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/90"
              onClick={() => toggleCategory(category.id)}
            >
              {category.nom} ({count})
            </Badge>
          );
        })}
      </div>
    </ScrollArea>
  );
};
