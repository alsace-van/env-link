import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AccessorySelectorProps {
  selectedAccessories: any[];
  onChange: (accessories: any[]) => void;
  productType: string;
}

export const AccessorySelector = ({ selectedAccessories, onChange, productType }: AccessorySelectorProps) => {
  const [accessories, setAccessories] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [selectedCategory, searchQuery]);

  const loadData = async () => {
    const { data: categoriesData } = await supabase
      .from("categories" as any)
      .select("*")
      .order("nom");

    if (categoriesData) {
      setCategories(categoriesData);
    }

    let query = supabase
      .from("accessories_catalog" as any)
      .select("*")
      .eq("available_in_shop", true);

    if (selectedCategory && selectedCategory !== "all") {
      query = query.eq("category_id", selectedCategory);
    }

    if (searchQuery) {
      query = query.ilike("nom", `%${searchQuery}%`);
    }

    const { data: accessoriesData } = await query.order("nom");

    if (accessoriesData) {
      setAccessories(accessoriesData);
    }
  };

  const toggleAccessory = (accessory: any) => {
    const exists = selectedAccessories.find(a => a.accessory_id === accessory.id || a.id === accessory.id);
    
    if (exists) {
      onChange(selectedAccessories.filter(a => (a.accessory_id || a.id) !== accessory.id));
    } else {
      onChange([...selectedAccessories, {
        accessory_id: accessory.id,
        accessory,
        default_quantity: 1,
        is_required: true,
      }]);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const categoryAccessories = accessories.filter(a => a.category_id === categoryId);
    const allSelected = categoryAccessories.every(acc => 
      selectedAccessories.find(a => (a.accessory_id || a.id) === acc.id)
    );

    if (allSelected) {
      onChange(selectedAccessories.filter(a => !categoryAccessories.find(ca => ca.id === (a.accessory_id || a.id))));
    } else {
      const newAccessories = categoryAccessories.filter(acc => 
        !selectedAccessories.find(a => (a.accessory_id || a.id) === acc.id)
      ).map(acc => ({
        accessory_id: acc.id,
        accessory: acc,
        default_quantity: 1,
        is_required: true,
      }));
      onChange([...selectedAccessories, ...newAccessories]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un accessoire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        {selectedAccessories.length} accessoire(s) sélectionné(s)
      </div>

      <ScrollArea className="h-[400px] border rounded-lg p-4">
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryAccessories = accessories.filter(a => a.category_id === category.id);
            if (categoryAccessories.length === 0) return null;

            const allSelected = categoryAccessories.every(acc =>
              selectedAccessories.find(a => (a.accessory_id || a.id) === acc.id)
            );

            return (
              <div key={category.id}>
                <div className="flex items-center gap-2 mb-3 font-medium">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <span>{category.nom}</span>
                  <span className="text-sm text-muted-foreground">
                    ({categoryAccessories.length})
                  </span>
                </div>

                <div className="ml-6 space-y-2">
                  {categoryAccessories.map((accessory) => {
                    const isSelected = selectedAccessories.find(
                      a => (a.accessory_id || a.id) === accessory.id
                    );

                    return (
                      <div
                        key={accessory.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleAccessory(accessory);
                        }}
                      >
                        <Checkbox 
                          checked={!!isSelected}
                          onCheckedChange={() => toggleAccessory(accessory)}
                        />
                        <div className="w-10 h-10 bg-muted rounded flex-shrink-0">
                          {accessory.image_url ? (
                            <img
                              src={accessory.image_url}
                              alt={accessory.nom}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{accessory.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {accessory.prix_vente_ttc?.toFixed(2) || "0.00"} €
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
