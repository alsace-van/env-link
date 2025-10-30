import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ShoppingCart } from "lucide-react";

interface Option {
  id: string;
  nom: string;
  prix_vente_ttc: number;
}

interface Accessory {
  id: string;
  nom: string;
  image_url?: string;
}

interface SimpleProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  basePrice: number;
  onAddToCart: (totalPrice: number, selectedOptions: string[]) => void;
}

export const SimpleProductDialog = ({
  open,
  onOpenChange,
  productId,
  productName,
  basePrice,
  onAddToCart,
}: SimpleProductDialogProps) => {
  const [options, setOptions] = useState<Option[]>([]);
  const [accessory, setAccessory] = useState<Accessory | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadOptions();
      setSelectedOptions([]);
    }
  }, [open, productId]);

  const loadOptions = async () => {
    setLoading(true);
    
    // Récupérer l'accessoire du produit simple
    const { data: productItems, error: itemsError } = await supabase
      .from("shop_product_items")
      .select("accessory_id")
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();

    if (itemsError || !productItems) {
      console.error("Erreur lors du chargement de l'accessoire:", itemsError);
      setLoading(false);
      return;
    }

    // Récupérer les informations de l'accessoire avec l'image
    const { data: accessoryData } = await supabase
      .from("accessories_catalog")
      .select("id, nom, image_url")
      .eq("id", productItems.accessory_id)
      .single();

    if (accessoryData) {
      setAccessory(accessoryData);
    }

    // Récupérer les options de l'accessoire
    const { data: optionsData, error: optionsError } = await supabase
      .from("accessory_options")
      .select("id, nom, prix_vente_ttc")
      .eq("accessory_id", productItems.accessory_id)
      .order("nom");

    if (optionsError) {
      console.error("Erreur lors du chargement des options:", optionsError);
    } else {
      setOptions(optionsData || []);
    }
    
    setLoading(false);
  };

  const handleOptionToggle = (optionId: string) => {
    if (selectedOptions.includes(optionId)) {
      setSelectedOptions(selectedOptions.filter(id => id !== optionId));
    } else {
      setSelectedOptions([...selectedOptions, optionId]);
    }
  };

  const calculateTotalPrice = () => {
    let total = basePrice;
    selectedOptions.forEach(optionId => {
      const option = options.find(o => o.id === optionId);
      if (option) {
        total += option.prix_vente_ttc;
      }
    });
    return total;
  };

  const handleAddToCart = () => {
    onAddToCart(calculateTotalPrice(), selectedOptions);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>
            Sélectionnez les options que vous souhaitez ajouter
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`grid gap-4 ${accessory?.image_url ? 'grid-cols-[200px,1fr]' : 'grid-cols-1'}`}>
            {accessory?.image_url && (
              <div className="rounded-md overflow-hidden border bg-muted/50 h-48">
                <img
                  src={accessory.image_url}
                  alt={accessory.nom}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">Prix de base</span>
                  <span className="text-lg font-bold">{basePrice.toFixed(2)} €</span>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Chargement des options...
                </div>
              ) : options.length > 0 ? (
                <div>
                  <Label className="mb-3 block">Options disponibles</Label>
                  <div className="border rounded-md p-4 space-y-3 max-h-[300px] overflow-y-auto">
                    {options.map((option) => (
                      <div key={option.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`option-${option.id}`}
                          checked={selectedOptions.includes(option.id)}
                          onCheckedChange={() => handleOptionToggle(option.id)}
                          className="mt-1 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`option-${option.id}`}
                            className="text-sm font-medium leading-snug cursor-pointer block break-words whitespace-normal"
                          >
                            {option.nom}
                          </label>
                        </div>
                        <Badge variant="secondary" className="shrink-0 ml-2">
                          +{option.prix_vente_ttc.toFixed(2)} €
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Aucune option disponible pour ce produit
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold">Prix total</span>
                  <span className="text-2xl font-bold text-primary">
                    {calculateTotalPrice().toFixed(2)} €
                  </span>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleAddToCart}
                  disabled={loading}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Ajouter au panier
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};