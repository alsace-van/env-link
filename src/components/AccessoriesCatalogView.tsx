import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, ExternalLink, Edit, Plus, FileDown, FileUp, Zap, Plug, FileText, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import AccessoryCatalogFormDialog from "./AccessoryCatalogFormDialog";
import CategoryFilterSidebar from "./CategoryFilterSidebar";
import AccessoryImportExportDialog from "./AccessoryImportExportDialog";
import { NoticeUploadDialog } from "./NoticeUploadDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  notice_id?: string | null;
  notices_database?: {
    id: string;
    titre: string;
    url_notice: string;
  } | null;
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
  const [noticeDialogAccessoryId, setNoticeDialogAccessoryId] = useState<string>("");

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
          acc.marque?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        ),
        notices_database (
          id,
          titre,
          url_notice
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
    <div className="relative flex w-full">
      {/* Sidebar Filter - Overlay mode */}
      <div className="absolute left-0 top-0 bottom-0 z-20">
        <CategoryFilterSidebar
          selectedCategories={selectedCategories}
          onCategoryChange={setSelectedCategories}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full space-y-6 pl-14">{/* pl-14 for collapsed sidebar space */}
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
          <div className="space-y-6">
            {/* Grouper par catégorie */}
            {(() => {
              // Grouper les accessoires par catégorie
              const grouped: Record<string, typeof filteredAccessories> = {};
              filteredAccessories.forEach((acc) => {
                const categoryName = acc.categories?.nom || "Sans catégorie";
                if (!grouped[categoryName]) {
                  grouped[categoryName] = [];
                }
                grouped[categoryName].push(acc);
              });

              return Object.entries(grouped).map(([categoryName, items]) => (
                <div key={categoryName} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{categoryName}</h3>
                    <Badge variant="secondary">{items.length} article{items.length > 1 ? 's' : ''}</Badge>
                  </div>
                  
                  <div className="border rounded-lg">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[180px] pl-[4.5rem]">Nom</TableHead>
                            <TableHead className="min-w-[80px]">Marque</TableHead>
                            <TableHead className="min-w-[70px]">Prix réf.</TableHead>
                            <TableHead className="min-w-[70px]">Prix TTC</TableHead>
                            <TableHead className="min-w-[65px]">Marge €</TableHead>
                            <TableHead className="min-w-[65px]">Marge %</TableHead>
                            <TableHead className="min-w-[100px]">Fournisseur</TableHead>
                            <TableHead className="min-w-[40px] text-center">
                              <Zap className="h-4 w-4 mx-auto" />
                            </TableHead>
                            <TableHead className="min-w-[60px]">Poids</TableHead>
                            <TableHead className="min-w-[90px]">Dim.</TableHead>
                            <TableHead className="min-w-[50px] text-center">Notice</TableHead>
                            <TableHead className="min-w-[130px]">Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((accessory) => {
                            const margeEuros = accessory.prix_vente_ttc && accessory.prix_reference
                              ? (accessory.prix_vente_ttc / 1.20) - accessory.prix_reference
                              : null;

                            return (
                              <TableRow key={accessory.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() => setEditingAccessory(accessory)}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                                      onClick={() => setDeleteId(accessory.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <span>{accessory.nom}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {accessory.marque || (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {accessory.prix_reference ? (
                                    <span className="text-sm whitespace-nowrap">{accessory.prix_reference.toFixed(2)} €</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {accessory.prix_vente_ttc ? (
                                    <span className="text-sm whitespace-nowrap">{accessory.prix_vente_ttc.toFixed(2)} €</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {margeEuros !== null ? (
                                    <span className={`text-sm whitespace-nowrap ${margeEuros >= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {margeEuros.toFixed(2)} €
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {accessory.marge_pourcent !== null ? (
                                    <span className={`text-sm whitespace-nowrap ${accessory.marge_pourcent >= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {accessory.marge_pourcent.toFixed(1)} %
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">
                                    {accessory.fournisseur || (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {accessory.type_electrique ? (
                                    <div className="flex justify-center" title={accessory.type_electrique === "consommateur" ? "Consommateur" : "Producteur"}>
                                      {accessory.type_electrique === "consommateur" ? (
                                        <Plug className="h-4 w-4 text-orange-500" />
                                      ) : (
                                        <Zap className="h-4 w-4 text-green-500" />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {accessory.poids_kg ? (
                                    <span className="text-sm whitespace-nowrap">{accessory.poids_kg} kg</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {accessory.longueur_mm && accessory.largeur_mm && accessory.hauteur_mm ? (
                                    <span className="text-xs whitespace-nowrap">
                                      {accessory.longueur_mm}×{accessory.largeur_mm}×{accessory.hauteur_mm} mm
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => {
                                            if (accessory.notice_id && accessory.notices_database) {
                                              window.open(accessory.notices_database.url_notice, "_blank");
                                            } else {
                                              setNoticeDialogAccessoryId(accessory.id);
                                            }
                                          }}
                                        >
                                          {accessory.notice_id ? (
                                            <FileText className="h-4 w-4 text-primary" />
                                          ) : (
                                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          {accessory.notice_id 
                                            ? `Ouvrir la notice: ${accessory.notices_database?.titre}` 
                                            : "Lier une notice"}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[150px]">
                                    {accessory.description ? (
                                      <span className="text-xs line-clamp-2">
                                        {accessory.description}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                    {accessory.url_produit && (
                                      <a
                                        href={accessory.url_produit}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline inline-flex items-center gap-1 text-xs mt-1"
                                      >
                                        Lien
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ));
            })()}
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

        {noticeDialogAccessoryId && (
          <NoticeUploadDialog
            preselectedAccessoryId={noticeDialogAccessoryId}
            onSuccess={() => {
              loadAccessories();
              setNoticeDialogAccessoryId("");
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AccessoriesCatalogView;
