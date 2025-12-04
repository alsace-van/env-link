import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ShopFilterSidebarProps {
  categories: any[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  selectedTypes: string[];
  onTypeChange: (types: string[]) => void;
  showInStock: boolean;
  onStockChange: (show: boolean) => void;
  onClearAll: () => void;
  activeFiltersCount: number;
}

export const ShopFilterSidebar = ({
  categories,
  selectedCategories,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  selectedTypes,
  onTypeChange,
  showInStock,
  onStockChange,
  onClearAll,
  activeFiltersCount,
}: ShopFilterSidebarProps) => {
  const productTypes = [
    { id: "simple", label: "Produit simple" },
    { id: "bundle", label: "Bundle" },
    { id: "custom_kit", label: "Kit sur-mesure" },
  ];

  const handleCategoryToggle = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      onCategoryChange([...selectedCategories, categoryId]);
    }
  };

  const handleTypeToggle = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onTypeChange(selectedTypes.filter((id) => id !== typeId));
    } else {
      onTypeChange([...selectedTypes, typeId]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="font-semibold text-lg">Filtres</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center px-1.5">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Tout effacer
          </Button>
        )}
      </div>

      <Separator />

      {/* Filters */}
      <Accordion type="multiple" defaultValue={["categories", "price", "type", "stock"]} className="w-full">
        {/* Categories */}
        <AccordionItem value="categories" className="border-none">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <span className="font-medium">Catégories</span>
              {selectedCategories.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {selectedCategories.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pt-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cat-${category.id}`}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => handleCategoryToggle(category.id)}
                  />
                  <Label
                    htmlFor={`cat-${category.id}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {category.nom}
                  </Label>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune catégorie disponible</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <Separator />

        {/* Price Range */}
        <AccordionItem value="price" className="border-none">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <span className="font-medium">Fourchette de prix</span>
              {(priceRange[0] !== 0 || priceRange[1] !== 10000) && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {priceRange[0]}-{priceRange[1]}€
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 pt-2">
              <Slider
                min={0}
                max={10000}
                step={50}
                value={priceRange}
                onValueChange={(value) => onPriceRangeChange(value as [number, number])}
                className="w-full"
              />
              <div className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Min</span>
                  <span className="font-semibold">{priceRange[0]} €</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs text-muted-foreground">Max</span>
                  <span className="font-semibold">{priceRange[1]} €</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <Separator />

        {/* Product Type */}
        <AccordionItem value="type" className="border-none">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <span className="font-medium">Type de produit</span>
              {selectedTypes.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {selectedTypes.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pt-2">
              {productTypes.map((type) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type.id}`}
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={() => handleTypeToggle(type.id)}
                  />
                  <Label
                    htmlFor={`type-${type.id}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <Separator />

        {/* Stock */}
        <AccordionItem value="stock" className="border-none">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <span className="font-medium">Disponibilité</span>
              {showInStock && (
                <Badge variant="secondary" className="h-5 px-2 text-xs">
                  En stock
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="in-stock"
                  checked={showInStock}
                  onCheckedChange={(checked) => onStockChange(checked as boolean)}
                />
                <Label htmlFor="in-stock" className="text-sm font-normal cursor-pointer flex-1">
                  Afficher uniquement les produits en stock
                </Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Clear All Button */}
      {activeFiltersCount > 0 && (
        <>
          <Separator />
          <Button
            variant="outline"
            className="w-full"
            onClick={onClearAll}
          >
            <X className="h-4 w-4 mr-2" />
            Réinitialiser tous les filtres
          </Button>
        </>
      )}
    </div>
  );
};
