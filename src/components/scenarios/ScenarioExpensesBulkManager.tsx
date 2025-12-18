// ============================================
// ScenarioExpensesBulkManager.tsx
// Gestion en masse des dépenses d'un scénario
// Sélection, suppression, changement de catégorie
// VERSION: 3.3 - Catégories chargées depuis le catalogue (accessories_catalog)
// ============================================

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Trash2,
  Search,
  Package,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

// Fonction pour décoder les entités HTML
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

// Tronquer le texte si trop long
const truncateText = (text: string, maxLength: number = 60): string => {
  const decoded = decodeHtmlEntities(text);
  if (decoded.length <= maxLength) return decoded;
  return decoded.substring(0, maxLength) + "...";
};

interface ExpenseItem {
  id: string;
  nom_accessoire: string;
  quantite: number;
  prix: number | null;
  prix_vente_ttc: number | null;
  categorie: string | null;
  created_at: string;
}

interface CatalogCategory {
  id: string;
  nom: string;
}

interface ScenarioExpensesBulkManagerProps {
  scenarioId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

// Formater montant
function formatAmount(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

// Formater date/heure
function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Formater date courte
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ScenarioExpensesBulkManager({
  scenarioId,
  projectId,
  open,
  onOpenChange,
  onComplete,
}: ScenarioExpensesBulkManagerProps) {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategorie, setFilterCategorie] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);

  // Charger les dépenses
  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_expenses")
        .select("id, nom_accessoire, quantite, prix, prix_vente_ttc, categorie, created_at")
        .eq("scenario_id", scenarioId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error("Erreur chargement dépenses:", error);
      toast.error("Erreur lors du chargement des dépenses");
    } finally {
      setLoading(false);
    }
  };

  // Charger les catégories du catalogue (accessories_catalog)
  const loadCatalogCategories = async () => {
    try {
      // Récupérer les catégories distinctes du catalogue
      const { data, error } = await supabase
        .from("accessories_catalog")
        .select("categorie")
        .not("categorie", "is", null)
        .not("categorie", "eq", "");

      if (data) {
        // Extraire les catégories uniques
        const uniqueCats = new Set<string>();
        data.forEach((item: any) => {
          if (item.categorie) {
            uniqueCats.add(item.categorie);
          }
        });
        // Convertir en format attendu par le composant
        const categoriesArray = Array.from(uniqueCats)
          .sort()
          .map((nom, index) => ({ id: `cat-${index}`, nom }));
        setCatalogCategories(categoriesArray);
      }
    } catch (error: any) {
      console.error("Erreur chargement catégories catalogue:", error);
    }
  };

  // Charger quand on ouvre
  useEffect(() => {
    if (open) {
      loadItems();
      loadCatalogCategories();
      setSelectedIds(new Set());
      setSearchTerm("");
      setFilterCategorie("all");
      setFilterDate("all");
      setShowDeleteConfirm(false);
    }
  }, [open, scenarioId]);

  // Extraire les catégories uniques des articles existants
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    items.forEach((item) => {
      if (item.categorie) {
        categories.add(item.categorie);
      }
    });
    return Array.from(categories).sort();
  }, [items]);

  // Extraire les dates uniques (par jour)
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    items.forEach((item) => {
      const date = formatDate(item.created_at);
      dates.add(date);
    });
    return Array.from(dates).sort().reverse();
  }, [items]);

  // Filtrer les articles
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtre recherche
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNom = item.nom_accessoire?.toLowerCase().includes(term);
        const matchCategorie = item.categorie?.toLowerCase().includes(term);
        if (!matchNom && !matchCategorie) {
          return false;
        }
      }

      // Filtre catégorie
      if (filterCategorie !== "all") {
        if (filterCategorie === "none") {
          if (item.categorie) return false;
        } else {
          if (item.categorie !== filterCategorie) return false;
        }
      }

      // Filtre date
      if (filterDate !== "all") {
        const itemDate = formatDate(item.created_at);
        if (itemDate !== filterDate) return false;
      }

      return true;
    });
  }, [items, searchTerm, filterCategorie, filterDate]);

  // Toggle sélection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Tout sélectionner (filtré)
  const selectAll = () => {
    setSelectedIds(new Set(filteredItems.map((item) => item.id)));
  };

  // Tout désélectionner
  const selectNone = () => {
    setSelectedIds(new Set());
  };

  // Inverser la sélection
  const invertSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      filteredItems.forEach((item) => {
        if (!prev.has(item.id)) {
          next.add(item.id);
        }
      });
      return next;
    });
  };

  // Mettre à jour la catégorie d'un seul article (instantané)
  const updateItemCategory = async (itemId: string, newCategory: string | null) => {
    try {
      const { error } = await supabase.from("project_expenses").update({ categorie: newCategory }).eq("id", itemId);

      if (error) throw error;

      // Mise à jour locale pour réactivité immédiate
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, categorie: newCategory } : item)));

      // Invalider le cache
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });

      // Confirmation visuelle
      toast.success(`Catégorie → "${newCategory || "Aucune"}"`);
    } catch (error: any) {
      console.error("Erreur changement catégorie:", error);
      toast.error("Erreur lors du changement de catégorie");
    }
  };

  // Mettre à jour la catégorie de plusieurs articles en masse (via dropdown)
  const bulkUpdateCategory = async (newCategory: string) => {
    const idsToUpdate = Array.from(selectedIds);
    if (idsToUpdate.length === 0) return;

    try {
      const { error } = await supabase
        .from("project_expenses")
        .update({ categorie: newCategory })
        .in("id", idsToUpdate);

      if (error) throw error;

      // Mise à jour locale
      setItems((prev) => prev.map((item) => (selectedIds.has(item.id) ? { ...item, categorie: newCategory } : item)));

      // Invalider le cache
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });

      toast.success(`${idsToUpdate.length} article(s) → "${newCategory}"`);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Erreur changement catégorie en masse:", error);
      toast.error("Erreur lors du changement de catégorie");
    }
  };

  // Supprimer les sélectionnés
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const idsToDelete = Array.from(selectedIds);
      if (idsToDelete.length === 0) return 0;

      const { error } = await supabase.from("project_expenses").delete().in("id", idsToDelete);

      if (error) throw error;
      return idsToDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["scenarios", projectId] });
      toast.success(`${count} article(s) supprimé(s) du scénario`);
      setShowDeleteConfirm(false);
      setSelectedIds(new Set());
      loadItems();
      onComplete?.();
    },
    onError: (error: any) => {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    },
  });

  // Calcul du total sélectionné
  const totalSelected = useMemo(() => {
    return filteredItems
      .filter((item) => selectedIds.has(item.id))
      .reduce((sum, item) => sum + (item.prix_vente_ttc || 0) * item.quantite, 0);
  }, [filteredItems, selectedIds]);

  return (
    <>
      <Dialog
        open={open && !showDeleteConfirm}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            onComplete?.(); // Rafraîchir les données à la fermeture
          }
          onOpenChange(newOpen);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestion du scénario ({items.length} articles)
            </DialogTitle>
            <DialogDescription>
              Sélectionnez les articles pour les supprimer ou changer leur catégorie
            </DialogDescription>
          </DialogHeader>

          {/* Barre de filtres */}
          <div className="flex flex-wrap gap-3 py-2">
            {/* Recherche */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtre catégorie */}
            <Select value={filterCategorie} onValueChange={setFilterCategorie}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="none">Sans catégorie</SelectItem>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtre date */}
            <Select value={filterDate} onValueChange={setFilterDate}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes dates</SelectItem>
                {uniqueDates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Barre d'actions sélection */}
          <div className="flex items-center justify-between py-2 border-y">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Tout
              </Button>
              <Button variant="outline" size="sm" onClick={selectNone}>
                <Square className="h-4 w-4 mr-1" />
                Aucun
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                {selectedIds.size} / {filteredItems.length} • {formatAmount(totalSelected)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Changement catégorie en masse */}
              {selectedIds.size > 0 && (
                <>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value === "__new__") {
                        const newCat = prompt("Nom de la nouvelle catégorie :");
                        if (newCat && newCat.trim()) {
                          bulkUpdateCategory(newCat.trim());
                        }
                      } else if (value && !value.startsWith("__")) {
                        bulkUpdateCategory(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <FolderOpen className="h-3 w-3 mr-1" />
                      <span>Catégorie ({selectedIds.size})</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new__" className="text-blue-600 font-medium">
                        + Nouvelle catégorie...
                      </SelectItem>
                      <div className="h-px bg-border my-1" />
                      {catalogCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nom}>
                          {cat.nom}
                        </SelectItem>
                      ))}
                      {uniqueCategories
                        .filter((c) => !catalogCategories.find((cc) => cc.nom === c))
                        .map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer ({selectedIds.size})
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Liste des articles */}
          <div className="flex-1 overflow-y-auto max-h-[450px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun article trouvé</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                {/* En-tête tableau */}
                <div className="grid grid-cols-[auto_1fr_60px_90px_150px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                  <div></div>
                  <div>Nom</div>
                  <div className="text-center">Qté</div>
                  <div className="text-right">Prix TTC</div>
                  <div>Catégorie</div>
                </div>

                {/* Lignes */}
                <div className="divide-y">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[auto_1fr_60px_90px_150px] gap-2 items-center px-3 py-1.5 hover:bg-muted/20 ${
                        selectedIds.has(item.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />

                      <div
                        className="flex items-center gap-2 min-w-0 cursor-pointer"
                        onClick={() => toggleSelect(item.id)}
                      >
                        <span className="truncate text-sm" title={decodeHtmlEntities(item.nom_accessoire)}>
                          {truncateText(item.nom_accessoire, 45)}
                        </span>
                      </div>

                      <div className="text-sm text-center">{item.quantite}</div>

                      <div className="text-sm text-right font-medium">{formatAmount(item.prix_vente_ttc)}</div>

                      {/* Dropdown catégorie inline */}
                      <Select
                        value={item.categorie || "__none__"}
                        onValueChange={(value) => {
                          if (value === "__new__") {
                            const newCat = prompt("Nom de la nouvelle catégorie :");
                            if (newCat && newCat.trim()) {
                              updateItemCategory(item.id, newCat.trim());
                            }
                          } else {
                            updateItemCategory(item.id, value === "__none__" ? null : value);
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__new__" className="text-blue-600 font-medium">
                            + Nouveau...
                          </SelectItem>
                          <div className="h-px bg-border my-1" />
                          <SelectItem value="__none__">
                            <span className="text-yellow-600">Non classé</span>
                          </SelectItem>
                          {/* Catégories du catalogue */}
                          {catalogCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.nom}>
                              {cat.nom}
                            </SelectItem>
                          ))}
                          {/* Catégories existantes non dans le catalogue */}
                          {uniqueCategories
                            .filter((c) => !catalogCategories.find((cc) => cc.nom === c))
                            .map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer <strong>{selectedIds.size} article(s)</strong> du scénario pour un
              total de <strong>{formatAmount(totalSelected)}</strong>. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden py-4">
            <p className="text-sm text-muted-foreground mb-2">Articles sélectionnés :</p>
            <div className="max-h-[250px] overflow-y-auto overflow-x-auto border rounded-lg p-3 bg-muted/30">
              <ul className="text-sm space-y-1 min-w-0">
                {filteredItems
                  .filter((item) => selectedIds.has(item.id))
                  .map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="text-red-500 flex-shrink-0">•</span>
                      <span className="truncate" title={decodeHtmlEntities(item.nom_accessoire)}>
                        {truncateText(item.nom_accessoire, 50)}
                      </span>
                      <span className="text-muted-foreground flex-shrink-0">×{item.quantite}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer ({selectedIds.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
