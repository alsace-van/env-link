// Sélecteur de fournisseur pour les scénarios
// Permet de choisir parmi les fournisseurs disponibles pour un même produit

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Package,
  Truck,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ============================================
// TYPES
// ============================================

interface SupplierOption {
  accessoryId: string;
  fournisseur: string;
  prix_reference: number;
  stock_status: string | null;
  url_produit: string | null;
  isDefault?: boolean;
}

interface SupplierSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productGroupId: string | null;
  currentAccessoryId?: string;
  onSelect: (accessoryId: string, fournisseur: string, prix: number) => void;
}

interface InlineSupplierSelectorProps {
  productGroupId: string | null;
  currentAccessoryId: string;
  currentFournisseur: string;
  currentPrix: number;
  onChange: (accessoryId: string, fournisseur: string, prix: number) => void;
  compact?: boolean;
}

// ============================================
// DIALOG SÉLECTEUR (pour ajout au scénario)
// ============================================

export const SupplierSelectorDialog = ({
  open,
  onOpenChange,
  productName,
  productGroupId,
  currentAccessoryId,
  onSelect,
}: SupplierSelectorDialogProps) => {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(currentAccessoryId || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && productGroupId) {
      loadSuppliers();
    }
  }, [open, productGroupId]);

  const loadSuppliers = async () => {
    if (!productGroupId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("accessories_catalog")
        .select("id, fournisseur, prix_reference, stock_status, url_produit")
        .eq("product_group_id", productGroupId)
        .order("prix_reference", { ascending: true });

      if (!error && data) {
        const options: SupplierOption[] = data.map((item: any, index: number) => ({
          accessoryId: item.id,
          fournisseur: item.fournisseur || "Sans nom",
          prix_reference: item.prix_reference || 0,
          stock_status: item.stock_status,
          url_produit: item.url_produit,
          isDefault: index === 0, // Le moins cher
        }));
        setSuppliers(options);
        
        // Sélectionner par défaut le moins cher ou le courant
        if (!selectedId && options.length > 0) {
          setSelectedId(currentAccessoryId || options[0].accessoryId);
        }
      }
    } catch (error) {
      console.error("Erreur chargement fournisseurs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    const selected = suppliers.find((s) => s.accessoryId === selectedId);
    if (selected) {
      onSelect(selected.accessoryId, selected.fournisseur, selected.prix_reference);
      onOpenChange(false);
    }
  };

  const cheapestPrice = suppliers.length > 0 ? suppliers[0].prix_reference : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Choisir le fournisseur
          </DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun fournisseur alternatif trouvé
          </div>
        ) : (
          <RadioGroup
            value={selectedId}
            onValueChange={setSelectedId}
            className="space-y-2"
          >
            {suppliers.map((supplier) => {
              const priceDiff = supplier.prix_reference - cheapestPrice;
              const isSelected = selectedId === supplier.accessoryId;

              return (
                <div
                  key={supplier.accessoryId}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedId(supplier.accessoryId)}
                >
                  <RadioGroupItem
                    value={supplier.accessoryId}
                    id={supplier.accessoryId}
                  />
                  <Label
                    htmlFor={supplier.accessoryId}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {supplier.fournisseur}
                        </span>
                        {supplier.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Moins cher
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold">
                          {supplier.prix_reference}€
                        </span>
                        {priceDiff > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (+{priceDiff}€)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <StockBadge status={supplier.stock_status} />
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            Sélectionner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// SÉLECTEUR INLINE (dans le tableau du scénario)
// ============================================

export const InlineSupplierSelector = ({
  productGroupId,
  currentAccessoryId,
  currentFournisseur,
  currentPrix,
  onChange,
  compact = false,
}: InlineSupplierSelectorProps) => {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (productGroupId) {
      loadSuppliers();
    }
  }, [productGroupId]);

  const loadSuppliers = async () => {
    if (!productGroupId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("accessories_catalog")
        .select("id, fournisseur, prix_reference, stock_status")
        .eq("product_group_id", productGroupId)
        .order("prix_reference", { ascending: true });

      if (!error && data) {
        setSuppliers(
          data.map((item: any) => ({
            accessoryId: item.id,
            fournisseur: item.fournisseur || "Sans nom",
            prix_reference: item.prix_reference || 0,
            stock_status: item.stock_status,
          }))
        );
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Si un seul fournisseur ou pas de groupe, afficher juste le nom
  if (!productGroupId || suppliers.length <= 1) {
    return (
      <span className="text-sm">{currentFournisseur}</span>
    );
  }

  const cheapestPrice = suppliers[0]?.prix_reference || 0;

  return (
    <Select
      value={currentAccessoryId}
      onValueChange={(newId) => {
        const selected = suppliers.find((s) => s.accessoryId === newId);
        if (selected) {
          onChange(selected.accessoryId, selected.fournisseur, selected.prix_reference);
        }
      }}
    >
      <SelectTrigger className={cn("w-auto", compact ? "h-7 text-xs" : "h-8 text-sm")}>
        <SelectValue>
          {currentFournisseur}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {suppliers.map((supplier) => {
          const priceDiff = supplier.prix_reference - cheapestPrice;
          
          return (
            <SelectItem
              key={supplier.accessoryId}
              value={supplier.accessoryId}
            >
              <div className="flex items-center justify-between gap-4">
                <span>{supplier.fournisseur}</span>
                <span className="font-medium">
                  {supplier.prix_reference}€
                  {priceDiff > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (+{priceDiff}€)
                    </span>
                  )}
                </span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

// ============================================
// BADGE DE STOCK
// ============================================

const StockBadge = ({ status }: { status: string | null }) => {
  if (!status) return null;

  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    in_stock: { label: "En stock", variant: "default" },
    low_stock: { label: "Stock faible", variant: "secondary" },
    out_of_stock: { label: "Rupture", variant: "destructive" },
    on_order: { label: "Sur commande", variant: "outline" },
  };

  const conf = config[status] || { label: status, variant: "secondary" as const };

  return (
    <Badge variant={conf.variant} className="text-xs">
      <Truck className="h-3 w-3 mr-1" />
      {conf.label}
    </Badge>
  );
};

export default SupplierSelectorDialog;
