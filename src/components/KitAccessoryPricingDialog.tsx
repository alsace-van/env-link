import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, TrendingDown, Tag, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Accessory {
  id: string;
  nom: string;
  categorie: string;
  prix_vente_ttc: number;
  promo_active?: boolean;
  promo_price?: number;
  promo_start_date?: string;
  promo_end_date?: string;
}

interface TieredPrice {
  id?: string;
  article_position: number;
  discount_percent: number;
}

interface KitAccessoryPricingDialogProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

export const KitAccessoryPricingDialog = ({
  open,
  onClose,
  productId,
  productName,
}: KitAccessoryPricingDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selectedAccessory, setSelectedAccessory] = useState<string | null>(null);
  const [accessoryPricing, setAccessoryPricing] = useState<{
    [key: string]: {
      promoActive: boolean;
      promoPrice: string;
      promoStartDate: string;
      promoEndDate: string;
      tieredPrices: TieredPrice[];
    };
  }>({});

  useEffect(() => {
    if (open) {
      loadKitAccessories();
    }
  }, [open, productId]);

  const loadKitAccessories = async () => {
    setLoading(true);

    // Récupérer les catégories autorisées pour ce kit
    const { data: kitData } = await supabase
      .from("shop_custom_kits")
      .select("allowed_category_ids")
      .eq("product_id", productId)
      .single();

    if (!kitData || !kitData.allowed_category_ids) {
      setLoading(false);
      return;
    }

    // Récupérer les accessoires des catégories autorisées
    const { data: accessoriesData } = await supabase
      .from("accessories_catalog")
      .select("*")
      .in("category_id", kitData.allowed_category_ids)
      .eq("available_in_shop", true) as any;

    if (accessoriesData) {
      setAccessories(accessoriesData as any);

      // Charger les tarifs pour chaque accessoire
      const pricingData: any = {};
      for (const acc of accessoriesData) {
        const { data: tieredData } = await supabase
          .from("accessory_tiered_pricing")
          .select("id, article_position, discount_percent")
          .eq("accessory_id", (acc as any).id)
          .order("article_position");

        pricingData[(acc as any).id] = {
          promoActive: (acc as any).promo_active || false,
          promoPrice: (acc as any).promo_price?.toString() || "",
          promoStartDate: (acc as any).promo_start_date
            ? new Date((acc as any).promo_start_date).toISOString().slice(0, 16)
            : "",
          promoEndDate: (acc as any).promo_end_date
            ? new Date((acc as any).promo_end_date).toISOString().slice(0, 16)
            : "",
          tieredPrices: tieredData || [],
        };
      }
      setAccessoryPricing(pricingData);
    }

    setLoading(false);
  };

  const handleSave = async (accessoryId: string) => {
    setLoading(true);
    const pricing = accessoryPricing[accessoryId];

    // Sauvegarder la promotion
    const { error: promoError } = await supabase
      .from("accessories_catalog")
      .update({
        promo_active: pricing.promoActive,
        promo_price: pricing.promoActive && pricing.promoPrice ? parseFloat(pricing.promoPrice) : null,
        promo_start_date: pricing.promoActive && pricing.promoStartDate ? new Date(pricing.promoStartDate).toISOString() : null,
        promo_end_date: pricing.promoActive && pricing.promoEndDate ? new Date(pricing.promoEndDate).toISOString() : null,
      } as any)
      .eq("id", accessoryId);

    if (promoError) {
      console.error("Erreur promotion:", promoError);
      toast.error("Erreur lors de la sauvegarde de la promotion");
      setLoading(false);
      return;
    }

    // Supprimer les anciens prix dégressifs
    await supabase
      .from("accessory_tiered_pricing")
      .delete()
      .eq("accessory_id", accessoryId);

    // Sauvegarder les nouveaux prix dégressifs
    const validTiers = pricing.tieredPrices.filter(
      (t) => t.article_position > 0 && t.discount_percent > 0
    );

    if (validTiers.length > 0) {
      const { error: tiersError } = await supabase
        .from("accessory_tiered_pricing")
        .insert(
          validTiers.map((t) => ({
            accessory_id: accessoryId,
            article_position: t.article_position,
            discount_percent: t.discount_percent,
          })) as any
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
  };

  const updateAccessoryPricing = (accessoryId: string, field: string, value: any) => {
    setAccessoryPricing({
      ...accessoryPricing,
      [accessoryId]: {
        ...accessoryPricing[accessoryId],
        [field]: value,
      },
    });
  };

  const addTier = (accessoryId: string) => {
    const pricing = accessoryPricing[accessoryId];
    const nextPosition = pricing.tieredPrices.length > 0 
      ? Math.max(...pricing.tieredPrices.map(t => t.article_position)) + 1 
      : 2;
    updateAccessoryPricing(accessoryId, "tieredPrices", [
      ...pricing.tieredPrices,
      { article_position: nextPosition, discount_percent: 0 },
    ]);
  };

  const removeTier = (accessoryId: string, index: number) => {
    const pricing = accessoryPricing[accessoryId];
    updateAccessoryPricing(
      accessoryId,
      "tieredPrices",
      pricing.tieredPrices.filter((_, i) => i !== index)
    );
  };

  const updateTier = (accessoryId: string, index: number, field: keyof TieredPrice, value: number) => {
    const pricing = accessoryPricing[accessoryId];
    const newTiers = [...pricing.tieredPrices];
    newTiers[index] = { ...newTiers[index], [field]: value };
    updateAccessoryPricing(accessoryId, "tieredPrices", newTiers);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Tarification des accessoires - {productName}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : accessories.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              Aucun accessoire disponible pour ce kit
            </p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {accessories.map((accessory) => {
              const pricing = accessoryPricing[accessory.id];
              if (!pricing) return null;

              return (
                <AccordionItem key={accessory.id} value={accessory.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="text-left">
                        <p className="font-semibold">{accessory.nom}</p>
                        <p className="text-sm text-muted-foreground">
                          {accessory.categorie} • {accessory.prix_vente_ttc?.toFixed(2)} €
                        </p>
                      </div>
                      {(pricing.promoActive || pricing.tieredPrices.length > 0) && (
                        <div className="flex gap-1">
                          {pricing.promoActive && (
                            <Tag className="h-4 w-4 text-orange-500" />
                          )}
                          {pricing.tieredPrices.length > 0 && (
                            <TrendingDown className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Prix de base</p>
                        <p className="text-xl font-bold">{accessory.prix_vente_ttc?.toFixed(2)} €</p>
                      </div>

                      {/* Promotion */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Promotion</h3>
                          </div>
                          <Switch
                            checked={pricing.promoActive}
                            onCheckedChange={(checked) =>
                              updateAccessoryPricing(accessory.id, "promoActive", checked)
                            }
                          />
                        </div>

                        {pricing.promoActive && (
                          <div className="space-y-3 pl-7">
                            <div className="space-y-2">
                              <Label>Prix promotionnel (€)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={pricing.promoPrice}
                                onChange={(e) =>
                                  updateAccessoryPricing(accessory.id, "promoPrice", e.target.value)
                                }
                                placeholder={accessory.prix_vente_ttc?.toFixed(2)}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Date de début</Label>
                                <Input
                                  type="datetime-local"
                                  value={pricing.promoStartDate}
                                  onChange={(e) =>
                                    updateAccessoryPricing(accessory.id, "promoStartDate", e.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Date de fin</Label>
                                <Input
                                  type="datetime-local"
                                  value={pricing.promoEndDate}
                                  onChange={(e) =>
                                    updateAccessoryPricing(accessory.id, "promoEndDate", e.target.value)
                                  }
                                />
                              </div>
                            </div>

                            {pricing.promoPrice &&
                              parseFloat(pricing.promoPrice) < (accessory.prix_vente_ttc || 0) && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                    Réduction de{" "}
                                    {(
                                      (((accessory.prix_vente_ttc || 0) - parseFloat(pricing.promoPrice)) /
                                        (accessory.prix_vente_ttc || 1)) *
                                      100
                                    ).toFixed(0)}
                                    %
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
                            <h3 className="font-semibold">Prix dégressifs par article</h3>
                          </div>
                          <Button
                            type="button"
                            onClick={() => addTier(accessory.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Ajouter
                          </Button>
                        </div>

                        {pricing.tieredPrices.length === 0 ? (
                          <p className="text-sm text-muted-foreground pl-7">
                            Aucun prix dégressif configuré
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
                                {pricing.tieredPrices.map((tier, index) => (
                                  <TableRow key={index}>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={tier.article_position}
                                        onChange={(e) =>
                                          updateTier(
                                            accessory.id,
                                            index,
                                            "article_position",
                                            parseInt(e.target.value) || 1
                                          )
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
                                          updateTier(
                                            accessory.id,
                                            index,
                                            "discount_percent",
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        className="w-24"
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {(
                                        (accessory.prix_vente_ttc || 0) *
                                        (1 - tier.discount_percent / 100)
                                      ).toFixed(2)}{" "}
                                      €
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeTier(accessory.id, index)}
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

                      <div className="flex justify-end pt-4">
                        <Button onClick={() => handleSave(accessory.id)} disabled={loading}>
                          {loading ? "Sauvegarde..." : "Enregistrer"}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
};
