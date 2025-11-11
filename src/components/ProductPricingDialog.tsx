import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, TrendingDown, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TieredPrice {
  id?: string;
  article_position: number;
  discount_percent: number;
}

interface ProductPricingDialogProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  basePrice: number;
}

export const ProductPricingDialog = ({
  open,
  onClose,
  productId,
  productName,
  basePrice,
}: ProductPricingDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [promoActive, setPromoActive] = useState(false);
  const [promoPrice, setPromoPrice] = useState("");
  const [promoStartDate, setPromoStartDate] = useState("");
  const [promoEndDate, setPromoEndDate] = useState("");
  const [tieredPrices, setTieredPrices] = useState<TieredPrice[]>([]);

  useEffect(() => {
    if (open) {
      loadPricingData();
    }
  }, [open, productId]);

  const loadPricingData = async () => {
    setLoading(true);

    // Charger les données de promotion
    const { data: productData } = await supabase
      .from("shop_products" as any)
      .select("promo_active, promo_price, promo_start_date, promo_end_date")
      .eq("id", productId)
      .single();

    if (productData) {
      setPromoActive((productData as any).promo_active || false);
      setPromoPrice((productData as any).promo_price?.toString() || "");
      setPromoStartDate(
        (productData as any).promo_start_date
          ? new Date((productData as any).promo_start_date).toISOString().slice(0, 16)
          : ""
      );
      setPromoEndDate(
        (productData as any).promo_end_date
          ? new Date((productData as any).promo_end_date).toISOString().slice(0, 16)
          : ""
      );
    }

    // Charger les prix dégressifs
    const { data: tieredData } = await supabase
      .from("product_tiered_pricing" as any)
      .select("id, article_position, discount_percent")
      .eq("product_id", productId)
      .order("article_position");

    if (tieredData) {
      setTieredPrices(tieredData as any);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);

    // Sauvegarder la promotion
    const { error: promoError } = await supabase
      .from("shop_products" as any)
      .update({
        promo_active: promoActive,
        promo_price: promoActive && promoPrice ? parseFloat(promoPrice) : null,
        promo_start_date: promoActive && promoStartDate ? new Date(promoStartDate).toISOString() : null,
        promo_end_date: promoActive && promoEndDate ? new Date(promoEndDate).toISOString() : null,
      } as any)
      .eq("id", productId);

    if (promoError) {
      console.error("Erreur promotion:", promoError);
      toast.error("Erreur lors de la sauvegarde de la promotion");
      setLoading(false);
      return;
    }

    // Supprimer les anciens prix dégressifs
    await supabase
      .from("product_tiered_pricing" as any)
      .delete()
      .eq("product_id", productId);

    // Sauvegarder les nouveaux prix dégressifs
    const validTiers = tieredPrices.filter(
      (t) => t.article_position > 0 && t.discount_percent > 0
    );

    if (validTiers.length > 0) {
      const { error: tiersError } = await supabase
        .from("product_tiered_pricing" as any)
        .insert(
          validTiers.map((t) => ({
            product_id: productId,
            article_position: t.article_position,
            discount_percent: t.discount_percent,
          }))
        );

      if (tiersError) {
        console.error("Erreur prix dégressifs:", tiersError);
        toast.error("Erreur lors de la sauvegarde des prix dégressifs");
        setLoading(false);
        return;
      }
    }

    toast.success("Tarification mise à jour");
    setLoading(false);
    onClose();
  };

  const addTier = () => {
    const nextPosition = tieredPrices.length > 0 
      ? Math.max(...tieredPrices.map(t => t.article_position)) + 1 
      : 2;
    setTieredPrices([...tieredPrices, { article_position: nextPosition, discount_percent: 0 }]);
  };

  const removeTier = (index: number) => {
    setTieredPrices(tieredPrices.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof TieredPrice, value: number) => {
    const newTiers = [...tieredPrices];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTieredPrices(newTiers);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarification - {productName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Prix de base</p>
              <p className="text-2xl font-bold">{basePrice.toFixed(2)} €</p>
            </div>

            {/* Promotion */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Promotion</h3>
                </div>
                <Switch checked={promoActive} onCheckedChange={setPromoActive} />
              </div>

              {promoActive && (
                <div className="space-y-3 pl-7">
                  <div className="space-y-2">
                    <Label htmlFor="promo-price">Prix promotionnel (€)</Label>
                    <Input
                      id="promo-price"
                      type="number"
                      step="0.01"
                      value={promoPrice}
                      onChange={(e) => setPromoPrice(e.target.value)}
                      placeholder={basePrice.toFixed(2)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="promo-start">Date de début</Label>
                      <Input
                        id="promo-start"
                        type="datetime-local"
                        value={promoStartDate}
                        onChange={(e) => setPromoStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="promo-end">Date de fin</Label>
                      <Input
                        id="promo-end"
                        type="datetime-local"
                        value={promoEndDate}
                        onChange={(e) => setPromoEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {promoPrice && parseFloat(promoPrice) < basePrice && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Réduction de {(((basePrice - parseFloat(promoPrice)) / basePrice) * 100).toFixed(0)}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Prix dégressifs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Prix dégressifs par article</h3>
                </div>
                <Button type="button" onClick={addTier} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>

              {tieredPrices.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-7">
                  Aucun prix dégressif configuré. Exemple: 5% sur le 2ème article, 10% sur le 3ème, etc.
                </p>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Position</TableHead>
                        <TableHead className="w-32">Réduction %</TableHead>
                        <TableHead>Prix unitaire</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tieredPrices.map((tier, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={tier.article_position}
                              onChange={(e) =>
                                updateTier(index, "article_position", parseInt(e.target.value) || 1)
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={tier.discount_percent}
                              onChange={(e) =>
                                updateTier(index, "discount_percent", parseFloat(e.target.value) || 0)
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {(basePrice * (1 - tier.discount_percent / 100)).toFixed(2)} €
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTier(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
