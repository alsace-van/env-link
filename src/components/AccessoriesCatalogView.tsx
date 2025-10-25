import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, ExternalLink, Edit, Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import AccessoryCatalogFormDialog from "./AccessoryCatalogFormDialog";
import CategoryFilter from "./CategoryFilter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  category_id?: string | null;
  prix_reference: number | null;
  description: string | null;
  fournisseur: string | null;
  url_produit: string | null;
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
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  useEffect(() => {
    loadAccessories();
  }, []);

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
      <div className="w-64 flex-shrink-0">
        <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtres
                  </CardTitle>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <CategoryFilter
                  selectedCategories={selectedCategories}
                  onCategoryChange={setSelectedCategories}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un accessoire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un article
          </Button>
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
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccessories.map((accessory) => (
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
                ))}
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
          accessory={editingAccessory}
          onSuccess={() => {
            loadAccessories();
            setEditingAccessory(null);
          }}
        />
      </div>
    </div>
  );
};

export default AccessoriesCatalogView;
