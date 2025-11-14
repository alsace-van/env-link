import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Grid3x3, List, SlidersHorizontal } from "lucide-react";
import { useCartContext } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSidebar } from "@/components/shop/CartSidebar";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { SearchWithSuggestions } from "@/components/shop/SearchWithSuggestions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ShopPublic() {
  const { getTotalItems, setCartOpen, addToCart } = useCartContext();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedCategory, searchQuery]);

  const loadData = async () => {
    setLoading(true);

    const { data: categoriesData } = await supabase
      .from("shop_categories" as any)
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (categoriesData) {
      setCategories(categoriesData);
    }

    let query = supabase
      .from("shop_products" as any)
      .select("*")
      .eq("is_active", true);

    if (selectedCategory && selectedCategory !== "all") {
      query = query.eq("category_id", selectedCategory);
    }

    if (searchQuery) {
      query = query.or(`nom.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const { data: productsData } = await query.order("nom");

    if (productsData) {
      setProducts(productsData);
    }

    setLoading(false);
  };

  const handleAddToCart = async (productId: string, price: number) => {
    await addToCart(productId, price);
    setCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold">Boutique</h1>
            <Button 
              variant="outline" 
              size="icon"
              className="relative"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {getTotalItems() > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {getTotalItems()}
                </span>
              )}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchWithSuggestions
                value={searchQuery}
                onChange={setSearchQuery}
                onSelectProduct={(id) => setDetailProductId(id)}
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
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

            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Aucun produit trouvé</p>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "flex flex-col gap-4"
            }
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                onViewDetails={setDetailProductId}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </main>

      <CartSidebar />
      <ProductDetailModal
        productId={detailProductId}
        onClose={() => setDetailProductId(null)}
      />
    </div>
  );
}
