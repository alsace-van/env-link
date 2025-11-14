import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useCartContext } from "@/contexts/CartContext";

export default function ShopPublic() {
  const { getTotalItems, setCartOpen } = useCartContext();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-3xl font-bold mb-4">Boutique en construction</h2>
          <p className="text-muted-foreground">
            La boutique sera bientôt disponible avec tous les produits
          </p>
        </div>
      </main>
    </div>
  );
}
