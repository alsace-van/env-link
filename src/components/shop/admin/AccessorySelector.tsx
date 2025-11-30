import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Accessory {
  id: string;
  nom_accessoire?: string;
  nom?: string;
  marque?: string;
  categorie?: string;
  type_electrique?: string;
  prix?: number;
  prix_reference?: number;
  prix_vente_ttc?: number;
  marge_pourcent?: number;
  fournisseur?: string;
  quantite?: number;
  category_id?: string;
  categories?: { nom: string };
  poids_kg?: number;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  puissance_watts?: number;
  intensite_amperes?: number;
  image_url?: string | null;
  url_produit?: string | null;
}

interface AccessorySelectorProps {
  selectedAccessories: any[];
  onChange: (accessories: any[]) => void;
  productType: string;
}

export const AccessorySelector = ({ selectedAccessories, onChange, productType }: AccessorySelectorProps) => {
  const [catalog, setCatalog] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("accessories_catalog")
      .select("*, categories!category_id(nom)")
      .order("nom");

    if (error) {
      console.error("Erreur lors du chargement du catalogue:", error);
    } else {
      setCatalog(data || []);
    }
    setLoading(false);
  };

  const handleToggleAccessory = (accessory: Accessory) => {
    const isSelected = selectedAccessories.some((a) => a.id === accessory.id);
    if (isSelected) {
      onChange(selectedAccessories.filter((a) => a.id !== accessory.id));
    } else {
      onChange([...selectedAccessories, accessory]);
    }
  };

  const renderAccessoryCard = (accessory: Accessory) => {
    const name = accessory.nom_accessoire || accessory.nom || "Sans nom";
    const categoryName = accessory.categories?.nom || accessory.categorie;
    const price = accessory.prix || accessory.prix_reference;
    const isSelected = selectedAccessories.some((a) => a.id === accessory.id);

    return (
      <div
        key={accessory.id}
        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
          isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
        }`}
        onClick={() => handleToggleAccessory(accessory)}
      >
        {accessory.image_url && (
          <img src={accessory.image_url} alt={name} className="w-12 h-12 object-contain rounded border flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{name}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {accessory.marque && (
              <Badge variant="secondary" className="text-xs">
                {accessory.marque}
              </Badge>
            )}
            {categoryName && (
              <Badge variant="outline" className="text-xs">
                {categoryName}
              </Badge>
            )}
          </div>
          {price && (
            <div className="text-sm text-muted-foreground mt-1">
              {price.toFixed(2)} €
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {isSelected && <Check className="h-5 w-5 text-primary" />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Sélectionnez les accessoires inclus dans ce {productType === "kit" ? "kit" : "produit"}
      </div>
      <ScrollArea className="h-[300px] pr-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Chargement...</p>
        ) : catalog.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun accessoire dans le catalogue</p>
        ) : (
          <div className="space-y-2">{catalog.map((accessory) => renderAccessoryCard(accessory))}</div>
        )}
      </ScrollArea>
      {selectedAccessories.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedAccessories.length} accessoire(s) sélectionné(s)
        </div>
      )}
    </div>
  );
};
