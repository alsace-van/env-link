// ============================================
// ScenarioExpensesBulkManager.tsx
// Gestion en masse des dépenses d'un scénario
// Sélection, suppression, filtrage
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
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

interface ExpenseItem {
  id: string;
  nom_accessoire: string;
  quantite: number;
  prix: number | null;
  prix_vente_ttc: number | null;
  categorie: string | null;
  created_at: string;
  imported_from_evoliz?: boolean;
}

interface ScenarioExpensesBulkManagerProps {
  scenarioId: string;
  projectId: string;
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
  onComplete 
}: ScenarioExpensesBulkManagerProps) {
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategorie, setFilterCategorie] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Charger les dépenses
  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_expenses")
        .select("id, nom_accessoire, quantite, prix, prix_vente_ttc, categorie, created_at, imported_from_evoliz")
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

  // Charger quand on ouvre
  useEffect(() => {
    if (open) {
      loadItems();
      setSelectedIds(new Set());
      setSearchTerm("");
      setFilterCategorie("all");
      setFilterDate("all");
    }
  }, [open, scenarioId]);

  // Extraire les catégories uniques
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
        } else if (filterCategorie === "evoliz") {
          if (!item.imported_from_evoliz) return false;
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

  // Tout sélectionner (filtrés)
  const selectAll = () => {
    setSelectedIds(new Set(filteredItems.map((item) => item.id)));
  };

  // Tout désélectionner
  const selectNone = () => {
    setSelectedIds(new Set());
  };

  // Inverser sélection
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

  // Supprimer les sélectionnés
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const idsToDelete = Array.from(selectedIds);
      if (idsToDelete.length === 0) return 0;

      const { error } = await supabase
        .from("project_expenses")
        .delete()
        .in("id", idsToDelete);

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

  const handleClose = () => {
    setOpen(false);
    setShowDeleteConfirm(false);
  };

  // Calcul du total sélectionné
  const totalSelected = useMemo(() => {
    return filteredItems
      .filter((item) => selectedIds.has(item.id))
      .reduce((sum, item) => sum + (item.prix_vente_ttc || 0) * item.quantite, 0);
  }, [filteredItems, selectedIds]);

  return (
    <>
      <DropdownMenuItem onClick={() => setOpen(true)}>
        <ListChecks className="h-4 w-4 mr-2" />
        Gérer les articles
      </DropdownMenuItem>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestion du scénario ({items.length} articles)
            </DialogTitle>
            <DialogDescription>
              Sélectionnez les articles à gérer ou supprimer en masse
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
                <SelectItem value="evoliz">Import Evoliz</SelectItem>
                {uniqueCategories.filter(c => c !== "Import Evoliz").map((c) => (
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
                <SelectItem value="all">Toutes les dates</SelectItem>
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
              <Button variant="outline" size="sm" onClick={invertSelection}>
                Inverser
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                {selectedIds.size} sélectionné(s) sur {filteredItems.length} • {formatAmount(totalSelected)}
              </span>
            </div>

            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer ({selectedIds.size})
              </Button>
            )}
          </div>

          {/* Liste des articles */}
          <div className="flex-1 overflow-y-auto max-h-[400px]">
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
                <div className="grid grid-cols-[auto_1fr_60px_100px_100px_140px_100px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                  <div></div>
                  <div>Nom</div>
                  <div className="text-center">Qté</div>
                  <div className="text-right">Prix HT</div>
                  <div className="text-right">Prix TTC</div>
                  <div>Ajouté le</div>
                  <div>Catégorie</div>
                </div>

                {/* Lignes */}
                <div className="divide-y">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[auto_1fr_60px_100px_100px_140px_100px] gap-2 items-center px-3 py-2 hover:bg-muted/20 cursor-pointer ${
                        selectedIds.has(item.id) ? "bg-blue-50" : ""
                      }`}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm" title={item.nom_accessoire}>
                          {item.nom_accessoire}
                        </span>
                        {item.imported_from_evoliz && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Evoliz
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-center">
                        {item.quantite}
                      </div>

                      <div className="text-sm text-right text-muted-foreground">
                        {formatAmount(item.prix)}
                      </div>

                      <div className="text-sm text-right font-medium">
                        {formatAmount(item.prix_vente_ttc)}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </div>

                      <div className="text-xs truncate" title={item.categorie || ""}>
                        {item.categorie || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
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
              Vous êtes sur le point de supprimer <strong>{selectedIds.size} article(s)</strong> du scénario
              pour un total de <strong>{formatAmount(totalSelected)}</strong>.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Articles sélectionnés :
            </p>
            <div className="max-h-[250px] overflow-y-auto overflow-x-auto border rounded-lg p-3 bg-muted/30">
              <ul className="text-sm space-y-1 min-w-0">
                {filteredItems
                  .filter((item) => selectedIds.has(item.id))
                  .map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="text-red-500 flex-shrink-0">•</span>
                      <span className="whitespace-nowrap">{item.nom_accessoire}</span>
                      <span className="text-muted-foreground">×{item.quantite}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
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
