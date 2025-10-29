import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Trash2, Edit, Plus, Settings, LayoutGrid, LayoutList, ChevronDown, ChevronRight, Store } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import AccessoryCategorySidebar from "@/components/AccessoryCategorySidebar";
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
  available_in_shop?: boolean;
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('accessories-view-mode');
    return (saved as 'list' | 'grid') || 'list';
  });
  const [expandedMainCategories, setExpandedMainCategories] = useState<Set<string>>(new Set());
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAccessories();
    loadCategories();
    // Expand all categories by default on first load
    const mainCats = new Set<string>();
    const subCats = new Set<string>();
    categories.forEach(cat => {
      if (!cat.parent_id) {
        mainCats.add(cat.nom);
      } else {
        const parent = categories.find(c => c.id === cat.parent_id);
        if (parent) {
          subCats.add(`${parent.nom}-${cat.nom}`);
        }
      }
    });
    setExpandedMainCategories(mainCats);
    setExpandedSubCategories(subCats);
  }, []);

  useEffect(() => {
    localStorage.setItem('accessories-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    let filtered = accessories;

    // Filtrer par recherche
    if (searchTerm) {
      filtered = filtered.filter(
        (acc) =>
          acc.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.marque?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.fournisseur?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.categories?.nom.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrer par catégories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((acc) =>
        acc.category_id && selectedCategories.includes(acc.category_id)
      );
    }

    setFilteredAccessories(filtered);
  }, [searchTerm, accessories, selectedCategories]);

  // Grouper les accessoires par catégorie principale puis sous-catégories
  const groupedAccessories = () => {
    interface CategoryGroup {
      mainCategory: string;
      mainCategoryId: string | null;
      subGroups: Map<string, Accessory[]>;
    }
    
    const mainGroups = new Map<string, CategoryGroup>();
    
    filteredAccessories.forEach((accessory) => {
      if (!accessory.category_id) {
        // Accessoires sans catégorie
        if (!mainGroups.has("Sans catégorie")) {
          mainGroups.set("Sans catégorie", {
            mainCategory: "Sans catégorie",
            mainCategoryId: null,
            subGroups: new Map([["Sans catégorie", []]]),
          });
        }
        mainGroups.get("Sans catégorie")!.subGroups.get("Sans catégorie")!.push(accessory);
        return;
      }
      
      const category = accessory.categories;
      if (!category) return;
      
      // Trouver la catégorie principale
      const mainCategory = category.parent_id 
        ? categories.find(c => c.id === category.parent_id)
        : category;
      
      if (!mainCategory) return;
      
      const mainCategoryName = mainCategory.nom;
      
      if (!mainGroups.has(mainCategoryName)) {
        mainGroups.set(mainCategoryName, {
          mainCategory: mainCategoryName,
          mainCategoryId: mainCategory.id,
          subGroups: new Map(),
        });
      }
      
      const subCategoryName = category.parent_id ? category.nom : "Général";
      const group = mainGroups.get(mainCategoryName)!;
      
      if (!group.subGroups.has(subCategoryName)) {
        group.subGroups.set(subCategoryName, []);
      }
      
      group.subGroups.get(subCategoryName)!.push(accessory);
    });
    
    // Trier les catégories principales (Sans catégorie en dernier)
    const sortedMainGroups = Array.from(mainGroups.entries()).sort(([a], [b]) => {
      if (a === "Sans catégorie") return 1;
      if (b === "Sans catégorie") return -1;
      return a.localeCompare(b);
    });
    
    return sortedMainGroups;
  };

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
      .select("*, categories!category_id(*)")
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

  const handleToggleShopAvailability = async (accessoryId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from("accessories_catalog")
      .update({ available_in_shop: !currentValue })
      .eq("id", accessoryId);

    if (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(currentValue ? "Retiré de la boutique" : "Ajouté à la boutique");
      loadAccessories();
    }
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

  const handleAccessoryDrop = async (accessoryId: string, categoryId: string | null) => {
    const { error } = await supabase
      .from("accessories_catalog")
      .update({ category_id: categoryId })
      .eq("id", accessoryId);

    if (error) {
      toast.error("Erreur lors du changement de catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie mise à jour");
      loadAccessories();
    }
  };

  const toggleMainCategory = (categoryName: string) => {
    setExpandedMainCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const toggleSubCategory = (mainCategoryName: string, subCategoryName: string) => {
    const key = `${mainCategoryName}-${subCategoryName}`;
    setExpandedSubCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  return (
    <div className="relative">
      <AccessoryCategorySidebar
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        onAccessoryDrop={handleAccessoryDrop}
      />
      
      <Card className="ml-96">
        <CardHeader>
          <CardTitle>Catalogue d'Accessoires</CardTitle>
          <CardDescription>Votre catalogue personnel partagé entre tous vos projets</CardDescription>
        </CardHeader>
        <CardContent>
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
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
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
      ) : viewMode === 'list' ? (
        <div className="space-y-8">
          {groupedAccessories().map(([mainCategoryName, categoryGroup]) => {
            const isMainExpanded = expandedMainCategories.has(mainCategoryName);
            return (
              <div key={mainCategoryName} className="space-y-4">
                {/* En-tête de catégorie principale */}
                <div 
                  className="bg-primary/10 border-l-4 border-primary px-4 py-3 rounded-r-lg cursor-pointer hover:bg-primary/15 transition-colors flex items-center justify-between"
                  onClick={() => toggleMainCategory(mainCategoryName)}
                >
                  <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    {isMainExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    {mainCategoryName}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({Array.from(categoryGroup.subGroups.values()).reduce((sum, items) => sum + items.length, 0)} articles)
                    </span>
                  </h2>
                </div>
                
                {/* Sous-catégories */}
                {isMainExpanded && (
                  <div className="space-y-4 pl-4 animate-fade-in">
                    {Array.from(categoryGroup.subGroups.entries()).map(([subCategoryName, categoryAccessories]) => {
                      const subKey = `${mainCategoryName}-${subCategoryName}`;
                      const isSubExpanded = expandedSubCategories.has(subKey);
                      return (
                        <div key={subCategoryName} className="space-y-2">
                          <h3 
                            className="text-lg font-semibold text-muted-foreground border-b pb-1 cursor-pointer hover:text-foreground transition-colors flex items-center gap-2"
                            onClick={() => toggleSubCategory(mainCategoryName, subCategoryName)}
                          >
                            {isSubExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {subCategoryName} ({categoryAccessories.length})
                          </h3>
                          {isSubExpanded && (
                            <div className="space-y-2 animate-fade-in">
                              {categoryAccessories.map((accessory) => (
                  <Card 
                    key={accessory.id} 
                    className="hover:bg-muted/50 transition-colors cursor-move"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("accessoryId", accessory.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                          <div className="md:col-span-2">
                            <div className="font-semibold">{accessory.nom}</div>
                            {accessory.marque && (
                              <div className="text-sm text-muted-foreground">{accessory.marque}</div>
                            )}
                          </div>
                          <div className="md:col-span-1">
                            {accessory.categories ? (
                              <Badge variant="secondary">{accessory.categories.nom}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Sans catégorie</span>
                            )}
                          </div>
                          <div className="md:col-span-1 text-sm">
                            {accessory.prix_reference && (
                              <div>
                                <span className="text-muted-foreground">HT: </span>
                                {accessory.prix_reference.toFixed(2)} €
                              </div>
                            )}
                            {accessory.prix_vente_ttc && (
                              <div>
                                <span className="text-muted-foreground">TTC: </span>
                                {accessory.prix_vente_ttc.toFixed(2)} €
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-1 text-sm">
                            {accessory.puissance_watts && (
                              <div>
                                <span className="text-muted-foreground">P: </span>
                                {accessory.puissance_watts} W
                              </div>
                            )}
                            {accessory.intensite_amperes && (
                              <div>
                                <span className="text-muted-foreground">I: </span>
                                {accessory.intensite_amperes} A
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-1 text-sm text-muted-foreground">
                            {accessory.fournisseur && <div>{accessory.fournisseur}</div>}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <div 
                            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer"
                            title={accessory.available_in_shop ? "Retirer de la boutique" : "Ajouter à la boutique"}
                            onClick={() => handleToggleShopAvailability(accessory.id, accessory.available_in_shop || false)}
                          >
                            <Store className={`h-4 w-4 ${accessory.available_in_shop ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
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
                    </CardContent>
                  </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedAccessories().map(([mainCategoryName, categoryGroup]) => {
            const isMainExpanded = expandedMainCategories.has(mainCategoryName);
            return (
              <div key={mainCategoryName} className="space-y-4">
                {/* En-tête de catégorie principale */}
                <div 
                  className="bg-primary/10 border-l-4 border-primary px-4 py-3 rounded-r-lg cursor-pointer hover:bg-primary/15 transition-colors flex items-center justify-between"
                  onClick={() => toggleMainCategory(mainCategoryName)}
                >
                  <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    {isMainExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    {mainCategoryName}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({Array.from(categoryGroup.subGroups.values()).reduce((sum, items) => sum + items.length, 0)} articles)
                    </span>
                  </h2>
                </div>
                
                {/* Sous-catégories en grille */}
                {isMainExpanded && (
                  <div className="space-y-4 pl-4 animate-fade-in">
                    {Array.from(categoryGroup.subGroups.entries()).map(([subCategoryName, categoryAccessories]) => {
                      const subKey = `${mainCategoryName}-${subCategoryName}`;
                      const isSubExpanded = expandedSubCategories.has(subKey);
                      return (
                        <div key={subCategoryName} className="space-y-2">
                          <h3 
                            className="text-lg font-semibold text-muted-foreground border-b pb-1 cursor-pointer hover:text-foreground transition-colors flex items-center gap-2"
                            onClick={() => toggleSubCategory(mainCategoryName, subCategoryName)}
                          >
                            {isSubExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {subCategoryName} ({categoryAccessories.length})
                          </h3>
                          {isSubExpanded && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                              {categoryAccessories.map((accessory) => (
                  <Card 
                    key={accessory.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("accessoryId", accessory.id)}
                    className="cursor-move"
                  >
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
                          <div 
                            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer"
                            title={accessory.available_in_shop ? "Retirer de la boutique" : "Ajouter à la boutique"}
                            onClick={() => handleToggleShopAvailability(accessory.id, accessory.available_in_shop || false)}
                          >
                            <Store className={`h-4 w-4 ${accessory.available_in_shop ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
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
                            <span className="text-muted-foreground">Prix achat HT:</span>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoriesCatalogView;
