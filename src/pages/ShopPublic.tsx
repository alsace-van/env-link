import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Grid3x3, List, ShoppingBag, ArrowLeft } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSidebar } from "@/components/shop/CartSidebar";
import { useCart } from "@/hooks/useCart";
import logo from "@/assets/logo.png";

interface Product {
  id: string;
  nom: string;
  description?: string;
  prix_base: number;
  image_url?: string;
  product_type: string;
  shop_category_id?: string;
}

interface Category {
  id: string;
  nom: string;
  icon: string;
}

const ShopPublic = () => {
  const navigate = useNavigate();
  const { setIsOpen, itemCount } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load categories
    const { data: categoriesData } = await supabase
      .from("shop_categories" as any)
      .select("id, nom, icon")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("display_order");

    if (categoriesData) {
      setCategories(categoriesData as any);
    }

    // Load products
    const { data: productsData } = await supabase
      .from("shop_products" as any)
      .select("*")
      .eq("is_active", true)
      .order("nom");

    if (productsData) {
      setProducts(productsData as any);
    }

    setLoading(false);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.shop_category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleViewDetails = (productId: string) => {
    // TODO: Open product details modal
    console.log("View details:", productId);
  };

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (product.product_type === "custom_kit") {
      // TODO: Open configuration dialog
      console.log("Configure kit:", productId);
    } else {
      // TODO: Add simple product to cart
      console.log("Add to cart:", productId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={logo} alt="Logo" className="h-10" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Boutique</h1>
                <p className="text-sm text-muted-foreground">
                  Découvrez nos produits
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={() => setIsOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge
                  className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0"
                  variant="destructive"
                >
                  {itemCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-5 w-5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 flex-wrap">
          <Badge
            className="cursor-pointer px-4 py-2"
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
          >
            Toutes
          </Badge>
          {categories.map((category) => (
            <Badge
              key={category.id}
              className="cursor-pointer px-4 py-2"
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.icon} {category.nom}
            </Badge>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun produit trouvé</p>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            }
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetails={handleViewDetails}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>

      <CartSidebar />
    </div>
  );
};

export default ShopPublic;
