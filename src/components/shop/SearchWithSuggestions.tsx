import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchWithSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  onSelectProduct?: (productId: string) => void;
}

export const SearchWithSuggestions = ({
  value,
  onChange,
  onSelectProduct,
}: SearchWithSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedSearch = useDebounce(value, 300);

  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 2) {
      loadSuggestions(debouncedSearch);
    } else {
      setSuggestions([]);
    }
  }, [debouncedSearch]);

  const loadSuggestions = async (search: string) => {
    const { data } = await supabase
      .from("shop_products" as any)
      .select("id, nom, prix_base, image_url")
      .eq("is_active", true)
      .ilike("nom", `%${search}%`)
      .limit(5);

    if (data) {
      setSuggestions(data);
      setShowSuggestions(true);
    }
  };

  const handleSelect = (productId: string) => {
    setShowSuggestions(false);
    onSelectProduct?.(productId);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="pl-10"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-background border rounded-lg shadow-lg z-50">
          <ScrollArea className="max-h-80">
            {suggestions.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer"
                onClick={() => handleSelect(product.id)}
              >
                <div className="w-12 h-12 bg-muted rounded flex-shrink-0">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.nom}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{product.nom}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.prix_base.toFixed(2)} €
                  </p>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
