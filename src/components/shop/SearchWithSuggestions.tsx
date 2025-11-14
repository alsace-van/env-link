import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchProduct {
  id: string;
  nom: string;
  description?: string;
  prix_base: number;
  image_url?: string;
  product_type: string;
}

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
  const [suggestions, setSuggestions] = useState<SearchProduct[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedSearch = useDebounce(value, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      searchProducts(debouncedSearch);
    } else {
      setSuggestions([]);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchProducts = async (query: string) => {
    const { data } = await supabase
      .from("shop_products" as any)
      .select("id, nom, description, prix_base, image_url, product_type")
      .eq("is_active", true)
      .or(`nom.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(5);

    if (data) {
      setSuggestions(data as any);
      setShowSuggestions(true);
    }
  };

  const handleSelectProduct = (productId: string) => {
    setShowSuggestions(false);
    if (onSelectProduct) {
      onSelectProduct(productId);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="pl-10"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute z-50 w-full mt-2 p-2 max-h-96 overflow-auto shadow-lg">
          <div className="space-y-1">
            {suggestions.map((product) => (
              <div
                key={product.id}
                onClick={() => handleSelectProduct(product.id)}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 bg-muted rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.nom}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium truncate">{product.nom}</p>
                    <Badge variant="outline" className="capitalize text-xs flex-shrink-0">
                      {product.product_type === "custom_kit"
                        ? "Kit"
                        : product.product_type === "bundle"
                        ? "Bundle"
                        : "Simple"}
                    </Badge>
                  </div>
                  {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                      {product.description}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-primary mt-1">
                    {product.product_type === "custom_kit" ? "À partir de " : ""}
                    {product.prix_base.toFixed(2)} €
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
