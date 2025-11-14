import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, Plus, Minus, Trash2, X } from "lucide-react";
import { useCart } from "@/hooks/useCart";

export const CartSidebar = () => {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, total, itemCount } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-background/95 backdrop-blur">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Panier ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
            <ShoppingBag className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">Votre panier est vide</p>
            <p className="text-sm">Ajoutez des produits depuis le catalogue</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6 mt-6" style={{ height: "calc(100vh - 200px)" }}>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 rounded-lg border bg-card">
                    <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.nom}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{item.product?.nom}</h4>
                      <p className="text-sm text-muted-foreground">
                        {item.price_at_addition.toFixed(2)} €
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold">
                        {(item.price_at_addition * item.quantity).toFixed(2)} €
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 mt-2"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{total.toFixed(2)} €</span>
              </div>

              <Button className="w-full" size="lg">
                Commander
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
