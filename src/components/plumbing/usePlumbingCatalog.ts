// ============================================
// HOOK: usePlumbingCatalog
// Intégration catalogue et devis pour plomberie
// VERSION: 1.0e - Utilise project_expenses avec nom_accessoire
// ============================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PlumbingBlockData,
  PlumbingCategory,
  WaterType,
  ElectricalType,
  ThreadType,
  PipeDiameter,
  CableSection,
  decodeHtmlEntities,
  CATEGORY_ICONS,
} from "./types";

// ============================================
// TYPES
// ============================================

export interface CatalogItem {
  id: string;
  nom: string;
  description?: string;
  marque?: string;
  reference_fabricant?: string;
  image_url?: string;
  prix_vente_ttc?: number;
  type_plomberie?: string;
  capacite_litres?: number;
  debit_lpm?: number;
  diametre_mm?: number;
  filetage?: string;
  type_electrique?: string;
  puissance_watts?: number;
  tension_volts?: number;
  section_cable?: number;
}

export interface QuoteItem {
  id: string;
  accessory_id: string;
  quantity: number;
  prix_unitaire: number;
  nom: string;
  description?: string;
  image_url?: string;
  puissance_watts?: number;
  capacite_litres?: number;
  type_plomberie?: string;
  type_electrique?: string;
}

// ============================================
// HELPERS
// ============================================

function inferPlumbingCategory(item: CatalogItem | QuoteItem): PlumbingCategory {
  const nom = (item.nom || "").toLowerCase();
  const typePlomb = ("type_plomberie" in item ? item.type_plomberie : "") || "";

  if (typePlomb.includes("source") || nom.includes("pompe")) return "source";
  if (typePlomb.includes("stockage") || nom.includes("réservoir") || nom.includes("chauffe")) return "storage";
  if (typePlomb.includes("distribution") || nom.includes("robinet") || nom.includes("douche") || nom.includes("évier")) return "distribution";
  if (typePlomb.includes("raccord") || nom.includes("té") || nom.includes("vanne") || nom.includes("coude")) return "fitting";
  if (typePlomb.includes("filtre") || nom.includes("filtre") || nom.includes("uv")) return "filter";

  return "other";
}

function inferElectricalType(item: CatalogItem): ElectricalType {
  const tension = item.tension_volts;
  const typeElec = (item.type_electrique || "").toLowerCase();

  if (typeElec.includes("230") || tension === 230 || tension === 220) return "230v";
  if (typeElec.includes("12") || tension === 12) return "12v";
  if (item.puissance_watts && item.puissance_watts > 0) return "12v";

  return "none";
}

function inferWaterConnections(
  category: PlumbingCategory,
  nom: string
): PlumbingBlockData["waterConnections"] {
  const nameLower = nom.toLowerCase();

  switch (category) {
    case "source":
      return {
        inputs: nameLower.includes("submersible") ? [] : [{ id: "in1", waterType: "cold", position: "left" }],
        outputs: [{ id: "out1", waterType: "cold", position: "right" }],
      };
    case "storage":
      if (nameLower.includes("chauffe") || nameLower.includes("boiler")) {
        return {
          inputs: [{ id: "in1", waterType: "cold", position: "left" }],
          outputs: [{ id: "out1", waterType: "hot", position: "right" }],
        };
      }
      if (nameLower.includes("gris")) {
        return {
          inputs: [{ id: "in1", waterType: "waste", position: "top" }],
          outputs: [{ id: "out1", waterType: "waste", position: "bottom" }],
        };
      }
      return {
        inputs: [{ id: "in1", waterType: "cold", position: "top" }],
        outputs: [{ id: "out1", waterType: "cold", position: "bottom" }],
      };
    case "distribution":
      if (nameLower.includes("mitigeur") || nameLower.includes("évier") || nameLower.includes("douche")) {
        return {
          inputs: [
            { id: "in1", waterType: "cold", position: "left" },
            { id: "in2", waterType: "hot", position: "left" },
          ],
          outputs: nameLower.includes("robinet") ? [] : [{ id: "out1", waterType: "waste", position: "bottom" }],
        };
      }
      return {
        inputs: [{ id: "in1", waterType: "cold", position: "left" }],
        outputs: [],
      };
    case "fitting":
      if (nameLower.includes("té")) {
        return {
          inputs: [{ id: "in1", waterType: "cold", position: "left" }],
          outputs: [
            { id: "out1", waterType: "cold", position: "right" },
            { id: "out2", waterType: "cold", position: "bottom" },
          ],
        };
      }
      return {
        inputs: [{ id: "in1", waterType: "cold", position: "left" }],
        outputs: [{ id: "out1", waterType: "cold", position: "right" }],
      };
    case "filter":
      return {
        inputs: [{ id: "in1", waterType: "cold", position: "left" }],
        outputs: [{ id: "out1", waterType: "cold", position: "right" }],
      };
    default:
      return {
        inputs: [{ id: "in1", waterType: "cold", position: "left" }],
        outputs: [{ id: "out1", waterType: "cold", position: "right" }],
      };
  }
}

function inferThreadType(filetage?: string): ThreadType | undefined {
  if (!filetage) return undefined;
  const f = filetage.toLowerCase();
  if (f.includes("3/8")) return "3/8";
  if (f.includes("1/2")) return "1/2";
  if (f.includes("3/4")) return "3/4";
  if (f.includes("1\"") || f === "1") return "1";
  return undefined;
}

// ============================================
// HOOK
// ============================================

export function usePlumbingCatalog(options: { projectId?: string | null } = {}) {
  const { projectId } = options;

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // ============================================
  // CATALOGUE
  // ============================================

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    console.log("[PlumbingCatalog v1.0e] Chargement catalogue...");
    try {
      const { data, error } = await supabase
        .from("accessories_catalog")
        .select("id, nom, description, marque, reference_fabricant, image_url, prix_vente_ttc, puissance_watts, tension_volts, filetage")
        .order("nom")
        .limit(100);

      if (error) {
        console.error("[PlumbingCatalog v1.0e] Erreur:", error);
        toast.error("Erreur chargement catalogue");
        return;
      }

      setCatalogItems(data || []);
      console.log(`[PlumbingCatalog v1.0e] ${data?.length || 0} articles catalogue chargés`);
    } catch (err) {
      console.error("[PlumbingCatalog] Erreur:", err);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  const searchCatalog = useCallback(async (query: string): Promise<CatalogItem[]> => {
    if (!query || query.length < 2) return [];

    try {
      const { data, error } = await supabase
        .from("accessories_catalog")
        .select("id, nom, description, marque, reference_fabricant, image_url, prix_vente_ttc, puissance_watts, tension_volts, filetage")
        .or(`nom.ilike.%${query}%,marque.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(20);

      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  }, []);

  // ============================================
  // DEVIS
  // ============================================

  const loadQuote = useCallback(async () => {
    if (!projectId) {
      console.log("[PlumbingCatalog v1.0e] Pas de projectId, skip loadQuote");
      return;
    }
    setIsLoadingQuote(true);
    console.log("[PlumbingCatalog v1.0e] loadQuote pour projet:", projectId);

    try {
      // Utiliser project_expenses avec nom_accessoire (pas de jointure car accessory_id est NULL)
      const { data, error } = await supabase
        .from("project_expenses")
        .select("id, nom_accessoire, description, quantite, prix_vente_ttc, prix_unitaire, category, statut_livraison")
        .eq("project_id", projectId)
        .not("nom_accessoire", "is", null);

      if (error) {
        console.error("[PlumbingCatalog v1.0e] Erreur project_expenses:", error);
        setQuoteItems([]);
        return;
      }

      console.log("[PlumbingCatalog v1.0e] project_expenses trouvés:", data?.length || 0);

      // Si pas de résultats avec nom_accessoire, essayer avec description non vide
      let items: QuoteItem[] = [];
      
      if (data && data.length > 0) {
        items = data.map((item: any) => ({
          id: item.id,
          accessory_id: item.id, // Utiliser l'id comme référence
          quantity: item.quantite || 1,
          prix_unitaire: item.prix_unitaire || item.prix_vente_ttc,
          nom: item.nom_accessoire || item.description || "Article",
          description: item.description,
          image_url: undefined,
          puissance_watts: undefined,
        }));
      } else {
        // Fallback: récupérer toutes les dépenses avec une description
        const { data: data2, error: error2 } = await supabase
          .from("project_expenses")
          .select("id, nom_accessoire, description, quantite, prix_vente_ttc, prix_unitaire, category, statut_livraison")
          .eq("project_id", projectId)
          .not("description", "is", null)
          .neq("description", "");

        if (!error2 && data2) {
          console.log("[PlumbingCatalog v1.0e] Fallback description:", data2.length);
          items = data2.map((item: any) => ({
            id: item.id,
            accessory_id: item.id,
            quantity: item.quantite || 1,
            prix_unitaire: item.prix_unitaire || item.prix_vente_ttc,
            nom: item.nom_accessoire || item.description || "Article",
            description: item.description,
            image_url: undefined,
            puissance_watts: undefined,
          }));
        }
      }

      console.log("[PlumbingCatalog v1.0e] QuoteItems finaux:", items.length);
      setQuoteItems(items);
    } catch (err) {
      console.error("[PlumbingCatalog v1.0e] Erreur:", err);
      setQuoteItems([]);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [projectId]);

  const addToQuote = useCallback(
    async (item: CatalogItem | PlumbingBlockData, quantity: number = 1): Promise<boolean> => {
      if (!projectId) {
        toast.error("Aucun projet sélectionné");
        return false;
      }

      const accessoryId = "accessory_id" in item ? item.accessory_id : (item as CatalogItem).id;
      if (!accessoryId) {
        toast.error("Article sans référence catalogue");
        return false;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Utilisateur non connecté");
          return false;
        }

        const existing = quoteItems.find((q) => q.accessory_id === accessoryId);

        if (existing) {
          await (supabase as any)
            .from("project_accessories")
            .update({ quantity: existing.quantity + quantity })
            .eq("id", existing.id);

          setQuoteItems((prev) =>
            prev.map((q) => (q.id === existing.id ? { ...q, quantity: q.quantity + quantity } : q))
          );
          toast.success("Quantité mise à jour");
        } else {
          const prix = "prix_vente_ttc" in item ? (item as CatalogItem).prix_vente_ttc : (item as PlumbingBlockData).prix_unitaire;

          const { data } = await (supabase as any)
            .from("project_accessories")
            .insert({
              project_id: projectId,
              user_id: user.id,
              accessory_id: accessoryId,
              quantity,
              prix_unitaire: prix || 0,
            })
            .select()
            .single();

          if (data) {
            setQuoteItems((prev) => [...prev, {
              id: data.id,
              accessory_id: accessoryId,
              quantity,
              prix_unitaire: prix || 0,
              nom: "nom" in item ? (item as CatalogItem).nom : (item as PlumbingBlockData).label,
              image_url: item.image_url,
            }]);
            toast.success("Article ajouté au devis");
          }
        }
        return true;
      } catch (err) {
        toast.error("Erreur ajout au devis");
        return false;
      }
    },
    [projectId, quoteItems]
  );

  const isInQuote = useCallback(
    (accessoryId: string): boolean => quoteItems.some((q) => q.accessory_id === accessoryId),
    [quoteItems]
  );

  // ============================================
  // CONVERSION
  // ============================================

  const catalogToBlockData = useCallback((item: CatalogItem): PlumbingBlockData => {
    const category = inferPlumbingCategory(item);
    const electricalType = inferElectricalType(item);

    return {
      label: decodeHtmlEntities(item.nom),
      category,
      icon: CATEGORY_ICONS[category],
      description: item.description,
      capacity_liters: item.capacite_litres,
      flow_rate_lpm: item.debit_lpm,
      waterConnections: inferWaterConnections(category, item.nom),
      electricalType,
      power_watts: item.puissance_watts,
      voltage: item.tension_volts,
      thread_type: inferThreadType(item.filetage),
      pipe_diameter: item.diametre_mm as PipeDiameter | undefined,
      cable_section: item.section_cable as CableSection | undefined,
      accessory_id: item.id,
      image_url: item.image_url,
      prix_unitaire: item.prix_vente_ttc,
      marque: item.marque,
      reference: item.reference_fabricant,
    };
  }, []);

  const quoteToBlockData = useCallback((item: QuoteItem): PlumbingBlockData => {
    const category = inferPlumbingCategory(item);
    const electricalType = (item.type_electrique as ElectricalType) || "none";

    return {
      label: decodeHtmlEntities(item.nom),
      category,
      icon: CATEGORY_ICONS[category],
      description: item.description,
      capacity_liters: item.capacite_litres,
      waterConnections: inferWaterConnections(category, item.nom),
      electricalType,
      power_watts: item.puissance_watts,
      accessory_id: item.accessory_id,
      image_url: item.image_url,
      prix_unitaire: item.prix_unitaire,
      in_quote: true,
    };
  }, []);

  // Charger le devis au montage et quand projectId change
  useEffect(() => {
    if (projectId) {
      console.log("[PlumbingCatalog v1.0e] Chargement devis pour projet:", projectId);
      loadQuote();
    }
  }, [projectId]);

  // Charger le catalogue automatiquement au montage
  useEffect(() => {
    console.log("[PlumbingCatalog v1.0e] Chargement catalogue auto");
    loadCatalog();
  }, []);

  return {
    catalogItems,
    quoteItems,
    isLoadingCatalog,
    isLoadingQuote,
    loadCatalog,
    searchCatalog,
    addToQuote,
    isInQuote,
    catalogToBlockData,
    quoteToBlockData,
  };
}

export default usePlumbingCatalog;
