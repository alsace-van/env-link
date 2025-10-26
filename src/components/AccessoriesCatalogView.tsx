import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Trash2, Edit, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AccessoryCatalogFormDialog from "@/components/AccessoryCatalogFormDialog";
import CategoryManagementDialog from "@/components/CategoryManagementDialog";
import AccessoryImportExportDialog from "@/components/AccessoryImportExportDialog";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
}

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  category_id?: string | null;
  prix_reference?: number;
  prix_vente_ttc?: number;
  marge_pourcent?: number;
  fournisseur?: string;
  description?: string;
  url_produit?: string;
  type_electrique?: string;
  poids_kg?: number;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  puissance_watts?: number;
  intensite_amperes?: number;
  categories?: Category;
}

const AccessoriesCatalogView = () => {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [filteredAccessories, setFilteredAccessories] = useState<Accessory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  useEffect(() => {
    loadAccessories();
    loadCategories();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredAccessories(
        accessories.filter(
          (acc) =>
            acc.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.marque?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.fournisseur?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.categories?.nom.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredAccessories(accessories);
    }
  }, [searchTerm, accessories]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("nom");

    if (!error && data) {
      setCategories(data);
    }
  };

  const loadAccessories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("*, categories(*)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement du catalogue");
      console.error(error);
    } else {
      setAccessories(data || []);
      setFilteredAccessories(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("accessories_catalog")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Accessoire supprimé du catalogue");
      loadAccessories();
    }
    setDeleteId(null);
  };

  const handleEdit = (accessory: Accessory) => {
    setSelectedAccessory(accessory);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedAccessory(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedAccessory(null);
  };

  const handleFormSuccess = () => {
    loadAccessories();
    handleFormClose();
  };

  return (
    <div>
      <div className="mb-6 flex gap-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un accessoire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setIsCategoryManagementOpen(true)} variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Catégories
        </Button>
        <Button onClick={() => setIsImportExportOpen(true)} variant="outline">
          Import/Export
        </Button>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un accessoire
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : filteredAccessories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? "Aucun accessoire trouvé"
                : "Aucun accessoire dans le catalogue"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre catalogue d'accessoires personnel pour faciliter l'ajout aux projets
            </p>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter le premier accessoire
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccessories.map((accessory) => (
            <Card key={accessory.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">
                      {accessory.nom}
                    </CardTitle>
                    {accessory.marque && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {accessory.marque}
                      </p>
                    )}
                    {accessory.categories && (
                      <Badge variant="secondary" className="mb-2">
                        {accessory.categories.nom}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(accessory)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(accessory.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {accessory.description && (
                  <CardDescription className="line-clamp-2">
                    {accessory.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {accessory.prix_reference && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prix référence:</span>
                      <span className="font-medium">
                        {accessory.prix_reference.toFixed(2)} €
                      </span>
                    </div>
                  )}
                  {accessory.prix_vente_ttc && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prix vente TTC:</span>
                      <span className="font-medium">
                        {accessory.prix_vente_ttc.toFixed(2)} €
                      </span>
                    </div>
                  )}
                  {accessory.marge_pourcent !== null && accessory.marge_pourcent !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Marge:</span>
                      <span className="font-medium">
                        {accessory.marge_pourcent.toFixed(1)} %
                      </span>
                    </div>
                  )}
                  {accessory.puissance_watts && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Puissance:</span>
                      <span>{accessory.puissance_watts} W</span>
                    </div>
                  )}
                  {accessory.intensite_amperes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Intensité:</span>
                      <span>{accessory.intensite_amperes} A</span>
                    </div>
                  )}
                  {accessory.fournisseur && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fournisseur:</span>
                      <span>{accessory.fournisseur}</span>
                    </div>
                  )}
                  {accessory.url_produit && (
                    <div>
                      <a
                        href={accessory.url_produit}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        Voir le produit
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet accessoire du catalogue ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccessoryCatalogFormDialog
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        accessory={selectedAccessory}
      />

      <CategoryManagementDialog
        isOpen={isCategoryManagementOpen}
        onClose={() => setIsCategoryManagementOpen(false)}
        onSuccess={() => {
          loadCategories();
          loadAccessories();
        }}
        categories={categories}
      />

      <AccessoryImportExportDialog
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onSuccess={loadAccessories}
        categories={categories}
      />
    </div>
  );
};

export default AccessoriesCatalogView;
