import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Package, FolderTree, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProductsList } from "@/components/shop/admin/ProductsList";
import { CategoriesManager } from "@/components/shop/admin/CategoriesManager";

export default function ShopAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("products");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Administration Boutique</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produits
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              Catégories
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Commandes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductsList />
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesManager />
          </TabsContent>

          <TabsContent value="orders">
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Gestion des commandes</p>
              <p className="text-sm">À implémenter prochainement</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
