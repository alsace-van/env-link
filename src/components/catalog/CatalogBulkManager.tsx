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
  ChevronDown,
  ChevronRight,
  Zap,
  Tag,
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
  // Champs supplémentaires pour l'édition
  category_id: string | null;
  type_electrique: string | null;
  marque: string | null;
  puissance_watts: number | null;
  capacite_ah: number | null;
  reference_fabricant: string | null;
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

  // État pour l'édition des prix d'achat
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>("");
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);

  // Sauvegarder le prix d'achat et recalculer la marge
  const savePurchasePrice = async (itemId: string, newPrice: number | null) => {
    setSavingPriceId(itemId);
    try {
      // Trouver l'article pour récupérer le prix de vente
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      // Calculer la marge si on a les deux prix
      let margePourcent: number | null = null;
      let margeNette: number | null = null;

      if (newPrice !== null && newPrice > 0 && item.prix_vente_ttc) {
        const prixVenteHT = item.prix_vente_ttc / 1.2;
        margePourcent = ((prixVenteHT - newPrice) / prixVenteHT) * 100;
        margeNette = prixVenteHT - newPrice;
      }

      const { error } = await supabase
        .from("accessories_catalog")
        .update({
          prix_reference: newPrice,
          marge_pourcent: margePourcent ? Math.round(margePourcent * 100) / 100 : null,
          marge_nette: margeNette ? Math.round(margeNette * 100) / 100 : null,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Mettre à jour localement
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                prix_reference: newPrice,
                marge_pourcent: margePourcent ? Math.round(margePourcent * 100) / 100 : null,
              }
            : i,
        ),
      );

      toast.success("Prix d'achat mis à jour");
    } catch (error: any) {
      console.error("Erreur mise à jour prix:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSavingPriceId(null);
      setEditingPriceId(null);
    }
  };

  // Gérer la validation de l'édition
  const handlePriceKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === "Enter") {
      const value = editingPriceValue.replace(",", ".").trim();
      const numValue = value === "" ? null : parseFloat(value);
      if (value !== "" && isNaN(numValue as number)) {
        toast.error("Veuillez entrer un nombre valide");
        return;
      }
      savePurchasePrice(itemId, numValue);
    } else if (e.key === "Escape") {
      setEditingPriceId(null);
    }
  };

  // Gérer le blur (perte de focus)
  const handlePriceBlur = (itemId: string) => {
    const value = editingPriceValue.replace(",", ".").trim();
    const numValue = value === "" ? null : parseFloat(value);
    if (value !== "" && isNaN(numValue as number)) {
      setEditingPriceId(null);
      return;
    }
    savePurchasePrice(itemId, numValue);
  };

  // État pour l'expansion d'une ligne (édition détaillée)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Options pour type électrique (compact)
  const typeElectriqueOptions = [
    { value: "", label: "-", title: "Non défini" },
    { value: "producteur", label: "⚡P", title: "Producteur" },
    { value: "consommateur", label: "🔌C", title: "Consommateur" },
    { value: "stockage", label: "🔋S", title: "Stockage" },
    { value: "gestion", label: "📊G", title: "Gestion" },
    { value: "distribution", label: "🔀D", title: "Distribution" },
    { value: "protection", label: "🛡️P", title: "Protection" },
  ];

  // Mettre à jour un champ quelconque
  const updateField = async (itemId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("accessories_catalog")
        .update({ [field]: value || null })
        .eq("id", itemId);

      if (error) throw error;

      // Mettre à jour localement
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, [field]: value || null } : i)));
    } catch (error: any) {
      console.error(`Erreur mise à jour ${field}:`, error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  // État pour le fournisseur en masse
  const [showBulkFournisseur, setShowBulkFournisseur] = useState(false);
  const [bulkFournisseurValue, setBulkFournisseurValue] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  // Appliquer le fournisseur aux articles sélectionnés
  const applyBulkFournisseur = async () => {
    if (selectedIds.size === 0) return;

    setSavingBulk(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("accessories_catalog")
        .update({ fournisseur: bulkFournisseurValue || null })
        .in("id", ids);

      if (error) throw error;

      // Mettre à jour localement
      setItems((prev) =>
        prev.map((i) => (selectedIds.has(i.id) ? { ...i, fournisseur: bulkFournisseurValue || null } : i)),
      );

      toast.success(`Fournisseur mis à jour sur ${ids.length} article(s)`);
      setShowBulkFournisseur(false);
      setBulkFournisseurValue("");
    } catch (error: any) {
      console.error("Erreur mise à jour fournisseur:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSavingBulk(false);
    }
  };

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
        .select(
          "id, nom, prix_vente_ttc, prix_reference, marge_pourcent, fournisseur, created_at, description, category_id, type_electrique, marque, puissance_watts, capacite_ah, reference_fabricant",
        )
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

          {/* Datalist pour autocomplétion fournisseurs */}
          <datalist id="fournisseurs-list">
            {uniqueFournisseurs.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

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
              <div className="flex items-center gap-2">
                {/* Fournisseur en masse */}
                {showBulkFournisseur ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      value={bulkFournisseurValue}
                      onChange={(e) => setBulkFournisseurValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyBulkFournisseur();
                        if (e.key === "Escape") setShowBulkFournisseur(false);
                      }}
                      className="h-8 w-32 text-sm"
                      placeholder="Fournisseur..."
                      list="fournisseurs-list"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={applyBulkFournisseur}
                      disabled={savingBulk}
                      className="h-8 px-2"
                    >
                      {savingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowBulkFournisseur(false)}
                      className="h-8 px-2"
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkFournisseur(true)}
                    title="Définir le fournisseur pour les articles sélectionnés"
                  >
                    <Tag className="h-4 w-4 mr-1" />
                    Fournisseur
                  </Button>
                )}

                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer ({selectedIds.size})
                </Button>
              </div>
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
                <div className="grid grid-cols-[auto_auto_1fr_90px_90px_60px_50px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                  <div></div>
                  <div></div>
                  <div>Nom</div>
                  <div className="text-right">Vente TTC</div>
                  <div className="text-right">Achat HT ✏️</div>
                  <div className="text-right">Marge</div>
                  <div className="text-center">Type</div>
                </div>

                {/* Lignes */}
                <div className="divide-y">
                  {filteredItems.map((item) => (
                    <div key={item.id}>
                      {/* Ligne principale */}
                      <div
                        className={`grid grid-cols-[auto_auto_1fr_90px_90px_60px_50px] gap-2 items-center px-3 py-2 hover:bg-muted/20 cursor-pointer ${
                          selectedIds.has(item.id) ? "bg-blue-50" : ""
                        } ${expandedId === item.id ? "bg-muted/30" : ""}`}
                      >
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />

                        {/* Bouton expansion */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(expandedId === item.id ? null : item.id);
                          }}
                          className="p-1 hover:bg-muted rounded"
                          title="Modifier les détails"
                        >
                          {expandedId === item.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        <div className="truncate text-sm" title={item.nom} onClick={() => toggleSelect(item.id)}>
                          {item.nom}
                        </div>

                        <div className="text-sm text-right" onClick={() => toggleSelect(item.id)}>
                          {formatAmount(item.prix_vente_ttc)}
                        </div>

                        {/* Prix d'achat éditable */}
                        <div className="text-sm text-right" onClick={(e) => e.stopPropagation()}>
                          {editingPriceId === item.id ? (
                            <Input
                              type="text"
                              value={editingPriceValue}
                              onChange={(e) => setEditingPriceValue(e.target.value)}
                              onKeyDown={(e) => handlePriceKeyDown(e, item.id)}
                              onBlur={() => handlePriceBlur(item.id)}
                              className="h-7 w-16 text-right text-sm px-1"
                              placeholder="0.00"
                              autoFocus
                            />
                          ) : savingPriceId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingPriceId(item.id);
                                setEditingPriceValue(
                                  item.prix_reference !== null ? item.prix_reference.toString().replace(".", ",") : "",
                                );
                              }}
                              className={`hover:bg-muted px-1 py-0.5 rounded transition-colors text-xs ${
                                item.prix_reference !== null
                                  ? "text-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              title="Cliquer pour modifier"
                            >
                              {item.prix_reference !== null ? formatAmount(item.prix_reference) : "Saisir..."}
                            </button>
                          )}
                        </div>

                        <div className="text-sm text-right" onClick={() => toggleSelect(item.id)}>
                          {item.marge_pourcent !== null ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                item.marge_pourcent >= 30
                                  ? "text-green-600 border-green-300"
                                  : item.marge_pourcent >= 15
                                    ? "text-orange-600 border-orange-300"
                                    : "text-red-600 border-red-300"
                              }`}
                            >
                              {item.marge_pourcent.toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>

                        {/* Type électrique - select compact */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <select
                            value={item.type_electrique || ""}
                            onChange={(e) => updateField(item.id, "type_electrique", e.target.value)}
                            className="text-xs bg-transparent border-0 p-0 cursor-pointer hover:bg-muted rounded w-full focus:ring-0 focus:outline-none text-center"
                            title={
                              typeElectriqueOptions.find((o) => o.value === (item.type_electrique || ""))?.title ||
                              "Type électrique"
                            }
                          >
                            {typeElectriqueOptions.map((opt) => (
                              <option key={opt.value} value={opt.value} title={opt.title}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Zone d'expansion - détails éditables */}
                      {expandedId === item.id && (
                        <div className="bg-muted/20 px-4 py-3 border-t" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Fournisseur */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Fournisseur</Label>
                              <Input
                                type="text"
                                defaultValue={item.fournisseur || ""}
                                onBlur={(e) => updateField(item.id, "fournisseur", e.target.value)}
                                className="h-8 text-sm mt-1"
                                placeholder="Non défini"
                                list="fournisseurs-list"
                              />
                            </div>

                            {/* Marque */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Marque</Label>
                              <Input
                                type="text"
                                defaultValue={item.marque || ""}
                                onBlur={(e) => updateField(item.id, "marque", e.target.value)}
                                className="h-8 text-sm mt-1"
                                placeholder="Non défini"
                              />
                            </div>

                            {/* Référence */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Référence</Label>
                              <Input
                                type="text"
                                defaultValue={item.reference_fabricant || ""}
                                onBlur={(e) => updateField(item.id, "reference_fabricant", e.target.value)}
                                className="h-8 text-sm mt-1"
                                placeholder="Non défini"
                              />
                            </div>

                            {/* Puissance */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Puissance (W)</Label>
                              <Input
                                type="number"
                                defaultValue={item.puissance_watts || ""}
                                onBlur={(e) =>
                                  updateField(
                                    item.id,
                                    "puissance_watts",
                                    e.target.value ? parseFloat(e.target.value) : null,
                                  )
                                }
                                className="h-8 text-sm mt-1"
                                placeholder="0"
                              />
                            </div>

                            {/* Capacité */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Capacité (Ah)</Label>
                              <Input
                                type="number"
                                defaultValue={item.capacite_ah || ""}
                                onBlur={(e) =>
                                  updateField(
                                    item.id,
                                    "capacite_ah",
                                    e.target.value ? parseFloat(e.target.value) : null,
                                  )
                                }
                                className="h-8 text-sm mt-1"
                                placeholder="0"
                              />
                            </div>

                            {/* Date d'ajout (lecture seule) */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Ajouté le</Label>
                              <div className="h-8 text-sm mt-1 px-3 py-1.5 text-muted-foreground">
                                {formatDateTime(item.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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
              Vous êtes sur le point de supprimer <strong>{selectedIds.size} article(s)</strong> du catalogue. Cette
              action est irréversible.
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
                      <span className="whitespace-nowrap">{item.nom}</span>
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
