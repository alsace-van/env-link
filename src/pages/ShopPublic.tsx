import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Grid3x3, List, ArrowLeft, Settings, Filter, X, SortAsc } from "lucide-react";
import { useCartContext } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSidebar } from "@/components/shop/CartSidebar";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import CustomKitConfigDialog from "@/components/CustomKitConfigDialog";
import { SearchWithSuggestions } from "@/components/shop/SearchWithSuggestions";
import { ShopFilterSidebar } from "@/components/shop/ShopFilterSidebar";
import { QuickViewModal } from "@/components/shop/QuickViewModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PRODUCTS_PER_PAGE = 12;

export default function ShopPublic() {
  const navigate = useNavigate();
  const { getTotalItems, setCartOpen, addToCart } = useCartContext();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showInStock, setShowInStock] = useState(false);
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [configKitId, setConfigKitId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    loadData();
    checkAdminRole();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, selectedCategories, priceRange, selectedTypes, showInStock, sortBy]);

  const checkAdminRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = (await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()) as any;

    setIsAdmin(!!roleData);
  };

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

    const { data: productsData } = await supabase
      .from("shop_products" as any)
      .select("*")
      .eq("is_active", true);

    if (productsData) {
      setProducts(productsData);
    }

    setLoading(false);
  };

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.nom?.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query),
      );
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.includes(p.category_id));
    }

    // Apply price range filter
    result = result.filter((p) => p.prix_base >= priceRange[0] && p.prix_base <= priceRange[1]);

    // Apply type filter
    if (selectedTypes.length > 0) {
      result = result.filter((p) => selectedTypes.includes(p.product_type));
    }

    // Apply stock filter
    if (showInStock) {
      result = result.filter((p) => p.stock_quantity > 0);
    }

    // Apply sorting
    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => a.nom.localeCompare(b.nom));
        break;
      case "name-desc":
        result.sort((a, b) => b.nom.localeCompare(a.nom));
        break;
      case "price-asc":
        result.sort((a, b) => a.prix_base - b.prix_base);
        break;
      case "price-desc":
        result.sort((a, b) => b.prix_base - a.prix_base);
        break;
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [products, searchQuery, selectedCategories, priceRange, selectedTypes, showInStock, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredAndSortedProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE,
  );

  const handleAddToCart = async (productId: string, price: number) => {
    await addToCart(productId, price);
    setCartOpen(true);
  };

  const activeFiltersCount =
    selectedCategories.length +
    selectedTypes.length +
    (showInStock ? 1 : 0) +
    (priceRange[0] !== 0 || priceRange[1] !== 10000 ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedTypes([]);
    setShowInStock(false);
    setPriceRange([0, 10000]);
    setSearchQuery("");
  };

  const filterSidebar = (
    <ShopFilterSidebar
      categories={categories}
      selectedCategories={selectedCategories}
      onCategoryChange={setSelectedCategories}
      priceRange={priceRange}
      onPriceRangeChange={setPriceRange}
      selectedTypes={selectedTypes}
      onTypeChange={setSelectedTypes}
      showInStock={showInStock}
      onStockChange={setShowInStock}
      onClearAll={clearAllFilters}
      activeFiltersCount={activeFiltersCount}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Boutique</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredAndSortedProducts.length} produit{filteredAndSortedProducts.length > 1 ? "s" : ""} trouvé
                  {filteredAndSortedProducts.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate("/admin/shop")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button variant="outline" size="icon" className="relative" onClick={() => setCartOpen(true)}>
                <ShoppingCart className="h-5 w-5" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-semibold">
                    {getTotalItems()}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Search and controls */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchWithSuggestions
                value={searchQuery}
                onChange={setSearchQuery}
                onSelectProduct={(id) => setQuickViewId(id)}
              />
            </div>

            <div className="flex gap-2 flex-wrap md:flex-nowrap">
              {/* Mobile filter button */}
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="flex-1 md:hidden relative">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtres
                    {activeFiltersCount > 0 && (
                      <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">{activeFiltersCount}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filtres</SheetTitle>
                    <SheetDescription>Affinez votre recherche</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">{filterSidebar}</div>
                </SheetContent>
              </Sheet>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SortAsc className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nom (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Nom (Z-A)</SelectItem>
                  <SelectItem value="price-asc">Prix croissant</SelectItem>
                  <SelectItem value="price-desc">Prix décroissant</SelectItem>
                  <SelectItem value="newest">Plus récents</SelectItem>
                </SelectContent>
              </Select>

              {/* View mode */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  title="Vue grille"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  title="Vue liste"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Active filters badges */}
          {activeFiltersCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Filtres actifs :</span>
              {selectedCategories.map((catId) => {
                const cat = categories.find((c) => c.id === catId);
                return (
                  <Badge key={catId} variant="secondary" className="gap-1">
                    {cat?.nom}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setSelectedCategories(selectedCategories.filter((id) => id !== catId))}
                    />
                  </Badge>
                );
              })}
              {selectedTypes.map((type) => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {type === "simple" ? "Simple" : type === "bundle" ? "Bundle" : "Kit"}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedTypes(selectedTypes.filter((t) => t !== type))}
                  />
                </Badge>
              ))}
              {showInStock && (
                <Badge variant="secondary" className="gap-1">
                  En stock
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setShowInStock(false)} />
                </Badge>
              )}
              {(priceRange[0] !== 0 || priceRange[1] !== 10000) && (
                <Badge variant="secondary" className="gap-1">
                  {priceRange[0]} € - {priceRange[1]} €
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setPriceRange([0, 10000])} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
                Tout effacer
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24">{filterSidebar}</div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                <p className="mt-4 text-muted-foreground">Chargement des produits...</p>
              </div>
            ) : filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-4">Aucun produit trouvé</p>
                <Button variant="outline" onClick={clearAllFilters}>
                  Réinitialiser les filtres
                </Button>
              </div>
            ) : (
              <>
                <div
                  className={
                    viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"
                  }
                >
                  {paginatedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onViewDetails={setDetailProductId}
                      onQuickView={setQuickViewId}
                      onConfigureKit={setConfigKitId}
                      viewMode={viewMode}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Précédent
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first, last, current, and adjacent pages
                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                          return (
                            <Button
                              key={page}
                              variant={page === currentPage ? "default" : "outline"}
                              size="icon"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <span key={page} className="px-2">
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Suivant
                    </Button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      <CartSidebar />
      <ProductDetailModal
        productId={detailProductId}
        onClose={() => setDetailProductId(null)}
        onConfigure={(id) => {
          setDetailProductId(null);
          setConfigKitId(id);
        }}
      />
      <QuickViewModal
        productId={quickViewId}
        onClose={() => setQuickViewId(null)}
        onAddToCart={handleAddToCart}
        onViewFull={(id) => {
          setQuickViewId(null);
          setDetailProductId(id);
        }}
      />
      <CustomKitConfigDialog 
        productId={configKitId || ""} 
        productName="" 
        basePrice={0}
        open={!!configKitId} 
        onOpenChange={(open) => !open && setConfigKitId(null)} 
      />
    </div>
  );
}
