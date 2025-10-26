import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
}

interface AccessorySelectorProps {
  projectId: string;
  onSelectAccessory: (accessory: Accessory, source: "expense" | "catalog") => void;
  onAddToCatalog?: (accessory: Accessory) => void;
}

export const AccessorySelector = ({ projectId, onSelectAccessory, onAddToCatalog }: AccessorySelectorProps) => {
  const [expenses, setExpenses] = useState<Accessory[]>([]);
  const [catalog, setCatalog] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, projectId]);

  const loadData = async () => {
    setLoading(true);

    // Charger les dépenses du projet
    const { data: expensesData, error: expensesError } = await supabase
      .from("project_expenses")
      .select("*")
      .eq("project_id", projectId)
      .order("nom_accessoire");

    if (expensesError) {
      console.error("Erreur lors du chargement des dépenses:", expensesError);
    } else {
      setExpenses(expensesData || []);
    }

    // Charger le catalogue
    const { data: catalogData, error: catalogError } = await supabase
      .from("accessories_catalog")
      .select("*, categories(nom)")
      .order("nom");

    if (catalogError) {
      console.error("Erreur lors du chargement du catalogue:", catalogError);
    } else {
      setCatalog(catalogData || []);
    }

    setLoading(false);
  };

  const handleAddToExpenses = async (accessory: Accessory) => {
    const { error } = await supabase
      .from("project_expenses")
      .insert({
        project_id: projectId,
        nom_accessoire: accessory.nom || "Accessoire",
        marque: accessory.marque,
        prix: accessory.prix_reference || 0,
        quantite: 1,
        fournisseur: accessory.fournisseur,
        categorie: accessory.categories?.nom || accessory.categorie,
        type_electrique: accessory.type_electrique,
        accessory_id: accessory.id,
        prix_vente_ttc: accessory.prix_vente_ttc,
        marge_pourcent: accessory.marge_pourcent,
      });

    if (error) {
      toast.error("Erreur lors de l'ajout aux dépenses");
      console.error(error);
    } else {
      toast.success("Accessoire ajouté aux dépenses");
      loadData();
      if (onAddToCatalog) {
        onAddToCatalog(accessory);
      }
    }
  };

  const renderAccessoryCard = (accessory: Accessory, source: "expense" | "catalog") => {
    const name = accessory.nom_accessoire || accessory.nom || "Sans nom";
    const categoryName = accessory.categories?.nom || accessory.categorie;
    const price = accessory.prix || accessory.prix_reference;

    return (
      <div
        key={accessory.id}
        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
      >
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
            {accessory.type_electrique && (
              <Badge variant="outline" className="text-xs">
                {accessory.type_electrique}
              </Badge>
            )}
          </div>
          {price && (
            <div className="text-sm text-muted-foreground mt-1">
              {price.toFixed(2)} €
              {accessory.quantite && source === "expense" && ` × ${accessory.quantite}`}
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-2">
          {source === "catalog" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddToExpenses(accessory)}
              title="Ajouter aux dépenses"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              onSelectAccessory(accessory, source);
              setOpen(false);
            }}
          >
            <Check className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="h-4 w-4 mr-2" />
          Accessoires
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Ajouter un Accessoire au Schéma</DialogTitle>
          <DialogDescription>
            Sélectionnez un accessoire depuis vos dépenses ou votre catalogue
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="expenses" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expenses">
              Dépenses ({expenses.length})
            </TabsTrigger>
            <TabsTrigger value="catalog">
              Catalogue ({catalog.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Chargement...</p>
              ) : expenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun accessoire dans les dépenses
                </p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((accessory) => renderAccessoryCard(accessory, "expense"))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="catalog" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Chargement...</p>
              ) : catalog.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun accessoire dans le catalogue
                </p>
              ) : (
                <div className="space-y-2">
                  {catalog.map((accessory) => renderAccessoryCard(accessory, "catalog"))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
