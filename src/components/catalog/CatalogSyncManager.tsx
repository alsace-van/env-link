// ============================================
// CatalogSyncManager.tsx
// Synchronisation bidirectionnelle du catalogue avec Evoliz
// Import / Export / Gestion des doublons
// ============================================

import { useState, useEffect, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2,
  RefreshCw,
  Download,
  Upload,
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Filter,
  CheckSquare,
  Square,
  Info,
  ArrowRight,
  Copy,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { evolizApi } from "@/services/evolizService";

// Fonction pour nettoyer le HTML des textes Evoliz
const cleanHtmlText = (text: string | null | undefined): string => {
  if (!text) return "";
  return (
    text
      // Remplacer les entités HTML courantes
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      // Supprimer les balises HTML
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<p>/gi, "")
      .replace(/<[^>]*>/g, "")
      // Nettoyer les espaces multiples
      .replace(/\s+/g, " ")
      .trim()
  );
};

// Types
interface LocalCatalogItem {
  id: string;
  nom: string;
  reference_fabricant: string | null;
  prix_vente_ttc: number | null;
  prix_reference: number | null;
  marge_pourcent: number | null;
  fournisseur: string | null;
  description: string | null;
  created_at: string;
  evoliz_article_id?: number | null;
}

interface EvolizArticle {
  articleid: number;
  reference: string;
  designation: string;
  unit_price_vat_exclude: number;
  purchase_unit_price_vat_exclude?: number | null;
  vat_rate?: number;
  unit: string | null;
  comment: string | null;
}

type SyncStatus = "local_only" | "evoliz_only" | "synced" | "conflict" | "price_diff";

interface SyncItem {
  id: string;
  localItem: LocalCatalogItem | null;
  evolizItem: EvolizArticle | null;
  status: SyncStatus;
  selected: boolean;
  matchedBy: "reference" | "name" | "evoliz_id" | null;
  priceDiff?: number; // Différence de prix en €
}

interface CatalogSyncManagerProps {
  onComplete?: () => void;
}

// Formater montant
function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

// Normaliser une chaîne pour comparaison
function normalize(str: string | null | undefined): string {
  if (!str) return "";
  // Nettoyer le HTML d'abord, puis normaliser
  return cleanHtmlText(str).toLowerCase().trim().replace(/\s+/g, " ");
}

export function CatalogSyncManager({ onComplete }: CatalogSyncManagerProps) {
  const { isConfigured } = useEvolizConfig();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"import" | "export" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");

  // Données
  const [localItems, setLocalItems] = useState<LocalCatalogItem[]>([]);
  const [evolizItems, setEvolizItems] = useState<EvolizArticle[]>([]);
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);

  // Filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Options de synchronisation
  const [updatePricesOnImport, setUpdatePricesOnImport] = useState(true);
  const [linkOnSync, setLinkOnSync] = useState(true);

  // Charger les données
  const loadData = async () => {
    setLoading(true);
    try {
      // Charger le catalogue local
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Note: evoliz_article_id existe dans la DB mais peut ne pas être dans les types générés
      const { data: localData, error: localError } = (await supabase
        .from("accessories_catalog")
        .select(
          "id, nom, reference_fabricant, prix_vente_ttc, prix_reference, marge_pourcent, fournisseur, description, created_at, evoliz_article_id",
        )
        .eq("user_id", user.id)
        .order("nom")) as { data: LocalCatalogItem[] | null; error: any };

      if (localError) throw localError;
      setLocalItems(localData || []);

      // Charger le catalogue Evoliz (toutes les pages)
      if (isConfigured) {
        const allEvolizItems: EvolizArticle[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          try {
            const response = await evolizApi.getArticles({ page, per_page: 100 });
            if (response.data && response.data.length > 0) {
              allEvolizItems.push(...response.data);
              page++;
              hasMore = response.data.length === 100;
            } else {
              hasMore = false;
            }
          } catch (err) {
            console.error("Erreur chargement page Evoliz:", err);
            hasMore = false;
          }
        }

        setEvolizItems(allEvolizItems);

        // Analyser et matcher les articles
        analyzeSync(localData || [], allEvolizItems);
      }
    } catch (error: any) {
      console.error("Erreur chargement données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // Analyser la synchronisation
  const analyzeSync = (local: LocalCatalogItem[], evoliz: EvolizArticle[]) => {
    const items: SyncItem[] = [];
    const matchedEvolizIds = new Set<number>();
    const matchedLocalIds = new Set<string>();

    // 1. Matcher par evoliz_article_id (lien direct)
    for (const localItem of local) {
      if (!localItem.evoliz_article_id) continue;

      const evolizMatch = evoliz.find((e) => e.articleid === localItem.evoliz_article_id);

      if (evolizMatch) {
        matchedEvolizIds.add(evolizMatch.articleid);
        matchedLocalIds.add(localItem.id);

        const localPriceHT = (localItem.prix_vente_ttc || 0) / 1.2;
        const priceDiff = Math.abs(localPriceHT - evolizMatch.unit_price_vat_exclude);
        const hasConflict = priceDiff > 0.01;

        items.push({
          id: `${localItem.id}-${evolizMatch.articleid}`,
          localItem,
          evolizItem: evolizMatch,
          status: hasConflict ? "price_diff" : "synced",
          selected: false,
          matchedBy: "evoliz_id",
          priceDiff: hasConflict ? priceDiff : undefined,
        });
      }
    }

    // 2. Matcher par référence
    for (const localItem of local) {
      if (matchedLocalIds.has(localItem.id)) continue;
      if (!localItem.reference_fabricant) continue;

      const evolizMatch = evoliz.find(
        (e) =>
          !matchedEvolizIds.has(e.articleid) && normalize(e.reference) === normalize(localItem.reference_fabricant),
      );

      if (evolizMatch) {
        matchedEvolizIds.add(evolizMatch.articleid);
        matchedLocalIds.add(localItem.id);

        const localPriceHT = (localItem.prix_vente_ttc || 0) / 1.2;
        const priceDiff = Math.abs(localPriceHT - evolizMatch.unit_price_vat_exclude);
        const hasConflict = priceDiff > 0.01;

        items.push({
          id: `${localItem.id}-${evolizMatch.articleid}`,
          localItem,
          evolizItem: evolizMatch,
          status: hasConflict ? "price_diff" : "synced",
          selected: false,
          matchedBy: "reference",
          priceDiff: hasConflict ? priceDiff : undefined,
        });
      }
    }

    // 3. Matcher par nom (pour ceux non matchés)
    for (const localItem of local) {
      if (matchedLocalIds.has(localItem.id)) continue;

      const evolizMatch = evoliz.find(
        (e) => !matchedEvolizIds.has(e.articleid) && normalize(e.designation) === normalize(localItem.nom),
      );

      if (evolizMatch) {
        matchedEvolizIds.add(evolizMatch.articleid);
        matchedLocalIds.add(localItem.id);

        const localPriceHT = (localItem.prix_vente_ttc || 0) / 1.2;
        const priceDiff = Math.abs(localPriceHT - evolizMatch.unit_price_vat_exclude);
        const hasConflict = priceDiff > 0.01;

        items.push({
          id: `${localItem.id}-${evolizMatch.articleid}`,
          localItem,
          evolizItem: evolizMatch,
          status: hasConflict ? "price_diff" : "synced",
          selected: false,
          matchedBy: "name",
          priceDiff: hasConflict ? priceDiff : undefined,
        });
      }
    }

    // 4. Articles locaux sans correspondance
    for (const localItem of local) {
      if (matchedLocalIds.has(localItem.id)) continue;

      items.push({
        id: `local-${localItem.id}`,
        localItem,
        evolizItem: null,
        status: "local_only",
        selected: false,
        matchedBy: null,
      });
    }

    // 5. Articles Evoliz sans correspondance
    for (const evolizItem of evoliz) {
      if (matchedEvolizIds.has(evolizItem.articleid)) continue;

      items.push({
        id: `evoliz-${evolizItem.articleid}`,
        localItem: null,
        evolizItem,
        status: "evoliz_only",
        selected: false,
        matchedBy: null,
      });
    }

    // Trier par statut puis par nom
    items.sort((a, b) => {
      const statusOrder = { evoliz_only: 0, local_only: 1, price_diff: 2, synced: 3 };
      const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;

      const nameA = a.localItem?.nom || a.evolizItem?.designation || "";
      const nameB = b.localItem?.nom || b.evolizItem?.designation || "";
      return nameA.localeCompare(nameB);
    });

    setSyncItems(items);
  };

  // Ouvrir et charger
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Filtrer les items
  const filteredItems = useMemo(() => {
    let filtered = syncItems;

    // Filtre par statut
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    // Filtre par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const localName = item.localItem?.nom?.toLowerCase() || "";
        const evolizName = cleanHtmlText(item.evolizItem?.designation)?.toLowerCase() || "";
        const reference =
          item.localItem?.reference_fabricant?.toLowerCase() ||
          cleanHtmlText(item.evolizItem?.reference)?.toLowerCase() ||
          "";
        return localName.includes(search) || evolizName.includes(search) || reference.includes(search);
      });
    }

    // Filtrer selon l'onglet actif
    if (activeTab === "import") {
      filtered = filtered.filter((item) => item.status === "evoliz_only" || item.status === "price_diff");
    } else if (activeTab === "export") {
      filtered = filtered.filter((item) => item.status === "local_only" || item.status === "price_diff");
    }

    return filtered;
  }, [syncItems, statusFilter, searchTerm, activeTab]);

  // Statistiques
  const stats = useMemo(() => {
    return {
      total: syncItems.length,
      synced: syncItems.filter((i) => i.status === "synced").length,
      localOnly: syncItems.filter((i) => i.status === "local_only").length,
      evolizOnly: syncItems.filter((i) => i.status === "evoliz_only").length,
      priceDiff: syncItems.filter((i) => i.status === "price_diff").length,
    };
  }, [syncItems]);

  // Sélection
  const toggleSelect = (id: string) => {
    setSyncItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const selectAll = () => {
    const filteredIds = new Set(filteredItems.map((i) => i.id));
    setSyncItems((prev) => prev.map((item) => (filteredIds.has(item.id) ? { ...item, selected: true } : item)));
  };

  const selectNone = () => {
    const filteredIds = new Set(filteredItems.map((i) => i.id));
    setSyncItems((prev) => prev.map((item) => (filteredIds.has(item.id) ? { ...item, selected: false } : item)));
  };

  const selectedCount = filteredItems.filter((i) => i.selected).length;

  // Import depuis Evoliz
  const importFromEvoliz = async () => {
    const toImport = filteredItems.filter((i) => i.selected && i.evolizItem);
    if (toImport.length === 0) {
      toast.error("Aucun article sélectionné");
      return;
    }

    setSyncing(true);
    setSyncProgress(0);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      let imported = 0;
      let updated = 0;
      let errors = 0;

      for (let i = 0; i < toImport.length; i++) {
        const item = toImport[i];
        const evolizArticle = item.evolizItem!;
        const cleanedDesignation = cleanHtmlText(evolizArticle.designation);
        setSyncMessage(`Import: ${cleanedDesignation}`);

        try {
          const prixVenteHT = evolizArticle.unit_price_vat_exclude;
          const prixVenteTTC = prixVenteHT * 1.2;
          const prixAchatHT = evolizArticle.purchase_unit_price_vat_exclude || null;

          let margePourcent: number | null = null;
          let margeNette: number | null = null;

          if (prixAchatHT && prixAchatHT > 0) {
            margePourcent = ((prixVenteHT - prixAchatHT) / prixVenteHT) * 100;
            margeNette = prixVenteHT - prixAchatHT;
          }

          if (item.status === "evoliz_only") {
            // Nouvel article
            const catalogData = {
              user_id: user.id,
              nom: cleanedDesignation,
              reference_fabricant: cleanHtmlText(evolizArticle.reference) || null,
              prix_vente_ttc: prixVenteTTC,
              prix_public_ttc: prixVenteTTC,
              prix_reference: prixAchatHT,
              marge_pourcent: margePourcent ? Math.round(margePourcent * 100) / 100 : null,
              marge_nette: margeNette ? Math.round(margeNette * 100) / 100 : null,
              description: cleanHtmlText(evolizArticle.comment) || null,
              fournisseur: "Import Evoliz",
            };

            const { error } = await (supabase as any).from("accessories_catalog").insert({
              ...catalogData,
              evoliz_article_id: linkOnSync ? evolizArticle.articleid : null,
            });

            if (error) throw error;
            imported++;
          } else if (item.status === "price_diff" && item.localItem && updatePricesOnImport) {
            // Mise à jour du prix
            const updateData: any = {
              prix_vente_ttc: prixVenteTTC,
              prix_public_ttc: prixVenteTTC,
            };

            if (prixAchatHT) {
              updateData.prix_reference = prixAchatHT;
              updateData.marge_pourcent = margePourcent ? Math.round(margePourcent * 100) / 100 : null;
              updateData.marge_nette = margeNette ? Math.round(margeNette * 100) / 100 : null;
            }

            if (linkOnSync && !item.localItem.evoliz_article_id) {
              updateData.evoliz_article_id = evolizArticle.articleid;
            }

            const { error } = await (supabase as any)
              .from("accessories_catalog")
              .update(updateData)
              .eq("id", item.localItem.id);

            if (error) throw error;
            updated++;
          }
        } catch (err) {
          console.error("Erreur import article:", err);
          errors++;
        }

        setSyncProgress(((i + 1) / toImport.length) * 100);
      }

      toast.success(
        `Import terminé : ${imported} créés, ${updated} mis à jour${errors > 0 ? `, ${errors} erreurs` : ""}`,
      );
      loadData();
      onComplete?.();
    } catch (error: any) {
      console.error("Erreur import:", error);
      toast.error("Erreur lors de l'import");
    } finally {
      setSyncing(false);
      setSyncProgress(0);
      setSyncMessage("");
    }
  };

  // Export vers Evoliz
  const exportToEvoliz = async () => {
    const toExport = filteredItems.filter((i) => i.selected && i.localItem);
    if (toExport.length === 0) {
      toast.error("Aucun article sélectionné");
      return;
    }

    setSyncing(true);
    setSyncProgress(0);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (let i = 0; i < toExport.length; i++) {
        const item = toExport[i];
        const localArticle = item.localItem!;
        setSyncMessage(`Export: ${localArticle.nom}`);

        try {
          const prixVenteHT = (localArticle.prix_vente_ttc || 0) / 1.2;

          const articleData = {
            reference: localArticle.reference_fabricant || `VPB-${localArticle.id.slice(0, 8)}`,
            designation: localArticle.nom,
            unit_price_vat_exclude: Math.round(prixVenteHT * 100) / 100,
            vat_rate: 20,
            unit: "u",
            comment: localArticle.description || null,
          };

          if (item.status === "local_only") {
            // Créer dans Evoliz
            const result = await evolizApi.createArticle(articleData);

            // Lier l'article local à Evoliz
            if (linkOnSync && result?.articleid) {
              await (supabase as any)
                .from("accessories_catalog")
                .update({ evoliz_article_id: result.articleid })
                .eq("id", localArticle.id);
            }

            created++;
          } else if (item.status === "price_diff" && item.evolizItem) {
            // Mettre à jour dans Evoliz
            await evolizApi.updateArticle(item.evolizItem.articleid, articleData);
            updated++;
          }
        } catch (err) {
          console.error("Erreur export article:", err);
          errors++;
        }

        setSyncProgress(((i + 1) / toExport.length) * 100);
      }

      toast.success(
        `Export terminé : ${created} créés, ${updated} mis à jour${errors > 0 ? `, ${errors} erreurs` : ""}`,
      );
      loadData();
    } catch (error: any) {
      console.error("Erreur export:", error);
      toast.error("Erreur lors de l'export");
    } finally {
      setSyncing(false);
      setSyncProgress(0);
      setSyncMessage("");
    }
  };

  // Rendu status badge
  const StatusBadge = ({ status, priceDiff }: { status: SyncStatus; priceDiff?: number }) => {
    switch (status) {
      case "synced":
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            OK
          </Badge>
        );
      case "local_only":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
            <Upload className="h-3 w-3 mr-1" />
            Local
          </Badge>
        );
      case "evoliz_only":
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
            <Download className="h-3 w-3 mr-1" />
            Evoliz
          </Badge>
        );
      case "price_diff":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Prix ≠
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Différence de {formatAmount(priceDiff)} HT</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return null;
    }
  };

  const MatchBadge = ({ matchedBy }: { matchedBy: SyncItem["matchedBy"] }) => {
    if (!matchedBy) return <span className="text-xs text-muted-foreground">-</span>;

    const labels = {
      evoliz_id: "🔗 Lié",
      reference: "📋 Réf",
      name: "📝 Nom",
    };

    return <span className="text-xs text-muted-foreground">{labels[matchedBy]}</span>;
  };

  const handleClose = () => {
    setOpen(false);
    setSearchTerm("");
    setStatusFilter("all");
  };

  if (!isConfigured) {
    return (
      <Button variant="outline" disabled title="Configurez Evoliz d'abord">
        <ArrowLeftRight className="h-4 w-4 mr-2" />
        Sync Evoliz
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="h-4 w-4 mr-2" />
        Sync Evoliz
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Synchronisation Catalogue ↔ Evoliz
            </DialogTitle>
            <DialogDescription>Comparez et synchronisez votre catalogue local avec Evoliz</DialogDescription>
          </DialogHeader>

          {/* Statistiques */}
          <div className="flex flex-wrap gap-3 py-2 text-sm border-b">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{stats.synced} synchronisés</span>
            </div>
            <div className="flex items-center gap-1">
              <Upload className="h-4 w-4 text-blue-600" />
              <span>{stats.localOnly} locaux seuls</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="h-4 w-4 text-orange-600" />
              <span>{stats.evolizOnly} Evoliz seuls</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>{stats.priceDiff} prix différents</span>
            </div>
            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>

          {/* Onglets */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="flex items-center gap-2">
                Tout ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Download className="h-4 w-4" />À importer
                {stats.evolizOnly + stats.priceDiff > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {stats.evolizOnly + stats.priceDiff}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />À exporter
                {stats.localOnly + stats.priceDiff > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {stats.localOnly + stats.priceDiff}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-3">
              {/* Barre de recherche et filtres */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom ou référence..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="evoliz_only">Evoliz seul</SelectItem>
                    <SelectItem value="local_only">Local seul</SelectItem>
                    <SelectItem value="price_diff">Prix différent</SelectItem>
                    <SelectItem value="synced">Synchronisé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Options */}
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={updatePricesOnImport}
                    onCheckedChange={(c) => setUpdatePricesOnImport(c as boolean)}
                  />
                  <span>Mettre à jour les prix existants</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={linkOnSync} onCheckedChange={(c) => setLinkOnSync(c as boolean)} />
                  <span>Lier les articles après sync</span>
                </label>
              </div>

              {/* Boutons de sélection */}
              <div className="flex items-center justify-between">
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
                    {selectedCount} / {filteredItems.length}
                  </span>
                </div>
              </div>

              {/* Barre de progression */}
              {syncing && (
                <div className="space-y-1">
                  <Progress value={syncProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {syncMessage} ({Math.round(syncProgress)}%)
                  </p>
                </div>
              )}

              {/* Liste des articles */}
              <div className="border rounded-lg max-h-[350px] overflow-auto">
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
                  <>
                    {/* En-tête */}
                    <div className="grid grid-cols-[auto_1fr_100px_100px_70px_60px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                      <div></div>
                      <div>Article</div>
                      <div className="text-right">Local TTC</div>
                      <div className="text-right">Evoliz TTC</div>
                      <div>Statut</div>
                      <div>Match</div>
                    </div>

                    {/* Lignes */}
                    <div className="divide-y">
                      {filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[auto_1fr_100px_100px_70px_60px] gap-2 items-center px-3 py-2 hover:bg-muted/20 cursor-pointer ${
                            item.selected ? "bg-blue-50 dark:bg-blue-950/30" : ""
                          }`}
                          onClick={() => toggleSelect(item.id)}
                        >
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleSelect(item.id)}
                            onClick={(e) => e.stopPropagation()}
                          />

                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {item.localItem?.nom || cleanHtmlText(item.evolizItem?.designation)}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.localItem?.reference_fabricant ||
                                cleanHtmlText(item.evolizItem?.reference) ||
                                "Sans référence"}
                            </div>
                          </div>

                          <div
                            className={`text-sm text-right ${item.status === "price_diff" ? "text-amber-600 font-medium" : ""}`}
                          >
                            {item.localItem ? formatAmount(item.localItem.prix_vente_ttc) : "-"}
                          </div>

                          <div
                            className={`text-sm text-right ${item.status === "price_diff" ? "text-amber-600 font-medium" : ""}`}
                          >
                            {item.evolizItem ? formatAmount(item.evolizItem.unit_price_vat_exclude * 1.2) : "-"}
                          </div>

                          <div>
                            <StatusBadge status={item.status} priceDiff={item.priceDiff} />
                          </div>

                          <div>
                            <MatchBadge matchedBy={item.matchedBy} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Tabs>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={handleClose}>
              Fermer
            </Button>

            {(activeTab === "import" || activeTab === "all") && (
              <Button
                variant="outline"
                onClick={importFromEvoliz}
                disabled={
                  selectedCount === 0 || syncing || filteredItems.filter((i) => i.selected && i.evolizItem).length === 0
                }
              >
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Importer
              </Button>
            )}

            {(activeTab === "export" || activeTab === "all") && (
              <Button
                onClick={exportToEvoliz}
                disabled={
                  selectedCount === 0 || syncing || filteredItems.filter((i) => i.selected && i.localItem).length === 0
                }
              >
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Exporter
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
