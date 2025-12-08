// ============================================
// CatalogBulkManager.tsx
// Gestion en masse des articles du catalogue
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

interface CatalogItem {
  id: string;
  nom: string;
  prix_vente_ttc: number | null;
  prix_reference: number | null;
  marge_pourcent: number | null;
  fournisseur: string | null;
  created_at: string;
  description: string | null;
}

interface CatalogBulkManagerProps {
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

export function CatalogBulkManager({ onComplete }: CatalogBulkManagerProps) {
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFournisseur, setFilterFournisseur] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Charger les articles
  const loadItems = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("accessories_catalog")
        .select("id, nom, prix_vente_ttc, prix_reference, marge_pourcent, fournisseur, created_at, description")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error("Erreur chargement catalogue:", error);
      toast.error("Erreur lors du chargement du catalogue");
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
      setFilterFournisseur("all");
      setFilterDate("all");
    }
  }, [open]);

  // Extraire les fournisseurs uniques
  const uniqueFournisseurs = useMemo(() => {
    const fournisseurs = new Set<string>();
    items.forEach((item) => {
      if (item.fournisseur) {
        fournisseurs.add(item.fournisseur);
      }
    });
    return Array.from(fournisseurs).sort();
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
        const matchNom = item.nom.toLowerCase().includes(term);
        const matchFournisseur = item.fournisseur?.toLowerCase().includes(term);
        const matchDescription = item.description?.toLowerCase().includes(term);
        if (!matchNom && !matchFournisseur && !matchDescription) {
          return false;
        }
      }

      // Filtre fournisseur
      if (filterFournisseur !== "all") {
        if (filterFournisseur === "none") {
          if (item.fournisseur) return false;
        } else {
          if (item.fournisseur !== filterFournisseur) return false;
        }
      }

      // Filtre date
      if (filterDate !== "all") {
        const itemDate = formatDate(item.created_at);
        if (itemDate !== filterDate) return false;
      }

      return true;
    });
  }, [items, searchTerm, filterFournisseur, filterDate]);

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

      const { error } = await supabase.from("accessories_catalog").delete().in("id", idsToDelete);

      if (error) throw error;
      return idsToDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["accessories-catalog"] });
      toast.success(`${count} article(s) supprimé(s)`);
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

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4 mr-2" />
        Gérer le catalogue
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestion du catalogue ({items.length} articles)
            </DialogTitle>
            <DialogDescription>Sélectionnez les articles à gérer ou supprimer en masse</DialogDescription>
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

            {/* Filtre fournisseur */}
            <Select value={filterFournisseur} onValueChange={setFilterFournisseur}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Fournisseur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les fournisseurs</SelectItem>
                <SelectItem value="none">Sans fournisseur</SelectItem>
                {uniqueFournisseurs.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
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
                {selectedIds.size} sélectionné(s) sur {filteredItems.length} affiché(s)
              </span>
            </div>

            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
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
                <div className="grid grid-cols-[auto_1fr_100px_100px_80px_140px_100px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                  <div></div>
                  <div>Nom</div>
                  <div className="text-right">Vente TTC</div>
                  <div className="text-right">Achat HT</div>
                  <div className="text-right">Marge</div>
                  <div>Ajouté le</div>
                  <div>Fournisseur</div>
                </div>

                {/* Lignes */}
                <div className="divide-y">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[auto_1fr_100px_100px_80px_140px_100px] gap-2 items-center px-3 py-2 hover:bg-muted/20 cursor-pointer ${
                        selectedIds.has(item.id) ? "bg-blue-50" : ""
                      }`}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="truncate text-sm" title={item.nom}>
                        {item.nom}
                      </div>

                      <div className="text-sm text-right">{formatAmount(item.prix_vente_ttc)}</div>

                      <div className="text-sm text-right text-muted-foreground">
                        {formatAmount(item.prix_reference)}
                      </div>

                      <div className="text-sm text-right">
                        {item.marge_pourcent !== null ? (
                          <Badge
                            variant="outline"
                            className={
                              item.marge_pourcent >= 30
                                ? "text-green-600 border-green-300"
                                : item.marge_pourcent >= 15
                                  ? "text-orange-600 border-orange-300"
                                  : "text-red-600 border-red-300"
                            }
                          >
                            {item.marge_pourcent.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</div>

                      <div className="text-xs truncate" title={item.fournisseur || ""}>
                        {item.fournisseur || "-"}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer <strong>{selectedIds.size} article(s)</strong> du catalogue. Cette
              action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">Articles sélectionnés :</p>
            <ul className="mt-2 max-h-[300px] overflow-y-auto text-sm space-y-1 border rounded-lg p-3 bg-muted/30">
              {filteredItems
                .filter((item) => selectedIds.has(item.id))
                .map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="text-red-500">•</span>
                    <span className="truncate flex-1">{item.nom}</span>
                  </li>
                ))}
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
