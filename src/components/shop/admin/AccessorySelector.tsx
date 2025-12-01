import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface AccessorySelectorProps {
  selectedAccessories: any[];
  onChange: (accessories: any[]) => void;
  productType: string;
}

export const AccessorySelector = ({ selectedAccessories, onChange, productType }: AccessorySelectorProps) => {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_reference, image_url, categories!category_id(nom)")
      .order("nom");

    if (error) {
      console.error("Erreur lors du chargement du catalogue:", error);
    } else {
      setCatalog(data || []);
    }
    setLoading(false);
  };

  const handleAdd = (accessory: any) => {
    if (!selectedAccessories.find((a) => a.id === accessory.id)) {
      onChange([...selectedAccessories, accessory]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(selectedAccessories.filter((a) => a.id !== id));
  };

  const filteredCatalog = catalog.filter((acc) => {
    const searchLower = search.toLowerCase();
    return (
      acc.nom?.toLowerCase().includes(searchLower) ||
      acc.marque?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Accessoires sélectionnés ({selectedAccessories.length})</h4>
        {selectedAccessories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun accessoire sélectionné</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedAccessories.map((acc) => (
              <Badge key={acc.id} variant="secondary" className="flex items-center gap-1">
                {acc.nom || "Sans nom"}
                <button onClick={() => handleRemove(acc.id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <Input
          placeholder="Rechercher un accessoire..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <h4 className="text-sm font-medium mb-2">Catalogue ({filteredCatalog.length})</h4>
        <ScrollArea className="h-[300px] border rounded-md p-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Chargement...</p>
          ) : filteredCatalog.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Aucun accessoire trouvé</p>
          ) : (
            <div className="space-y-2">
              {filteredCatalog.map((accessory) => {
                const isSelected = selectedAccessories.some((a) => a.id === accessory.id);
                return (
                  <div
                    key={accessory.id}
                    className={`flex items-center gap-3 p-2 border rounded-lg ${isSelected ? "bg-muted" : "hover:bg-muted/50"}`}
                  >
                    {accessory.image_url && (
                      <img src={accessory.image_url} alt={accessory.nom} className="w-10 h-10 object-contain rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{accessory.nom || "Sans nom"}</div>
                      {accessory.marque && <div className="text-xs text-muted-foreground">{accessory.marque}</div>}
                      {accessory.prix_reference && (
                        <div className="text-xs text-muted-foreground">{accessory.prix_reference.toFixed(2)} €</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? "secondary" : "outline"}
                      onClick={() => (isSelected ? handleRemove(accessory.id) : handleAdd(accessory))}
                    >
                      {isSelected ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
