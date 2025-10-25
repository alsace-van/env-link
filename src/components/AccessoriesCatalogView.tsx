import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, ExternalLink, Edit, Plus, FileDown, FileUp } from "lucide-react";
import { toast } from "sonner";
import AccessoryCatalogFormDialog from "./AccessoryCatalogFormDialog";
import CategoryFilterSidebar from "./CategoryFilterSidebar";
import AccessoryImportExportDialog from "./AccessoryImportExportDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
}

interface Accessory {
  id: string;
  nom: string;
  marque?: string | null;
  category_id?: string | null;
  prix_reference: number | null;
  prix_vente_ttc: number | null;
  marge_pourcent: number | null;
  description: string | null;
  fournisseur: string | null;
  url_produit: string | null;
  type_electrique?: string | null;
  poids_kg?: number | null;
  longueur_mm?: number | null;
  largeur_mm?: number | null;
  hauteur_mm?: number | null;
  created_at: string;
  categories?: Category | null;
}

const AccessoriesCatalogView = () => {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [filteredAccessories, setFilteredAccessories] = useState<Accessory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadAccessories();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("nom");

    if (!error && data) {
      setCategories(data);
    }
  };

  useEffect(() => {
    let filtered = accessories;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (acc) =>
          acc.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.fournisseur?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.categories?.nom.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((acc) => 
        acc.category_id && selectedCategories.includes(acc.category_id)
      );
    }

    setFilteredAccessories(filtered);
  }, [searchTerm, selectedCategories, accessories]);

  const loadAccessories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select(`
        *,
        categories (
          id,
          nom,
          parent_id
        )
      `)
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

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar Filter */}
      <div className="flex-shrink-0">
        <CategoryFilterSidebar
          selectedCategories={selectedCategories}
          onCategoryChange={setSelectedCategories}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un accessoire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsImportExportOpen(true)}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Import/Export
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un article
            </Button>
          </div>
        </div>

        {filteredAccessories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedCategories.length > 0
                ? "Aucun accessoire trouvé"
                : "Aucun accessoire dans le catalogue"}
            </p>
            <p className="text-sm text-muted-foreground">
              Ajoutez des accessoires depuis l'onglet "Dépenses" avec le bouton "Ajouter au catalogue"
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Prix réf.</TableHead>
                  <TableHead>Prix vente TTC</TableHead>
                  <TableHead>Marge €</TableHead>
                  <TableHead>Marge %</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccessories.map((accessory) => {
                  const margeEuros = accessory.prix_vente_ttc && accessory.prix_reference
                    ? (accessory.prix_vente_ttc / 1.20) - accessory.prix_reference
                    : null;

                  return (
                    <TableRow key={accessory.id}>
                      <TableCell className="font-medium">
                        {accessory.nom}
                      </TableCell>
                      <TableCell>
                        {accessory.categories && (
                          <Badge variant="secondary">
                            {accessory.categories.nom}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {accessory.prix_reference ? (
                          <span>{accessory.prix_reference.toFixed(2)} €</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {accessory.prix_vente_ttc ? (
                          <span>{accessory.prix_vente_ttc.toFixed(2)} €</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {margeEuros !== null ? (
                          <span className={margeEuros >= 0 ? "text-green-600" : "text-red-600"}>
                            {margeEuros.toFixed(2)} €
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {accessory.marge_pourcent !== null ? (
                          <span className={accessory.marge_pourcent >= 0 ? "text-green-600" : "text-red-600"}>
                            {accessory.marge_pourcent.toFixed(2)} %
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {accessory.fournisseur || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {accessory.description ? (
                            <span className="text-sm line-clamp-2">
                              {accessory.description}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {accessory.url_produit && (
                            <a
                              href={accessory.url_produit}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1 text-sm mt-1"
                            >
                              Lien produit
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingAccessory(accessory)}
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        accessory={null}
        onSuccess={() => {
          loadAccessories();
          setIsDialogOpen(false);
        }}
      />

        <AccessoryCatalogFormDialog
          isOpen={!!editingAccessory}
          onClose={() => setEditingAccessory(null)}
          accessory={editingAccessory ? {
            id: editingAccessory.id,
            nom: editingAccessory.nom,
            marque: editingAccessory.marque || undefined,
            category_id: editingAccessory.category_id,
            prix_reference: editingAccessory.prix_reference || undefined,
            prix_vente_ttc: editingAccessory.prix_vente_ttc || undefined,
            marge_pourcent: editingAccessory.marge_pourcent || undefined,
            fournisseur: editingAccessory.fournisseur || undefined,
            description: editingAccessory.description || undefined,
            url_produit: editingAccessory.url_produit || undefined,
            type_electrique: editingAccessory.type_electrique || undefined,
            poids_kg: editingAccessory.poids_kg || undefined,
            longueur_mm: editingAccessory.longueur_mm || undefined,
            largeur_mm: editingAccessory.largeur_mm || undefined,
            hauteur_mm: editingAccessory.hauteur_mm || undefined,
          } : null}
          onSuccess={() => {
            loadAccessories();
            setEditingAccessory(null);
          }}
        />

        <AccessoryImportExportDialog
          isOpen={isImportExportOpen}
          onClose={() => setIsImportExportOpen(false)}
          onSuccess={() => {
            loadAccessories();
            setIsImportExportOpen(false);
          }}
          categories={categories}
        />
      </div>
    </div>
  );
};

export default AccessoriesCatalogView;
