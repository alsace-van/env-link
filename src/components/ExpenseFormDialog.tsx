import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ExpenseFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingCategories: string[];
  onSuccess: () => void;
  scenarioId?: string; // ✅ AJOUTÉ pour les scénarios
  isLocked?: boolean; // ✅ AJOUTÉ pour le mode verrouillé
  expense?: {
    id: string;
    nom_accessoire: string;
    marque?: string;
    prix: number;
    prix_vente_ttc?: number;
    marge_pourcent?: number;
    quantite: number;
    date_achat: string;
    categorie: string;
    fournisseur?: string;
    notes?: string;
    accessory_id?: string;
    type_electrique?: string;
    poids_kg?: number;
    longueur_mm?: number;
    largeur_mm?: number;
    hauteur_mm?: number;
    puissance_watts?: number;
    intensite_amperes?: number;
  } | null;
}

const ExpenseFormDialog = ({
  isOpen,
  onClose,
  projectId,
  existingCategories,
  onSuccess,
  expense,
  scenarioId, // ✅ AJOUTÉ
  isLocked = false, // ✅ AJOUTÉ
}: ExpenseFormDialogProps) => {
  const [formData, setFormData] = useState({
    nom_accessoire: "",
    marque: "",
    prix_achat: "",
    prix_vente_ttc: "",
    marge_pourcent: "",
    quantite: "1",
    date_achat: new Date().toISOString().split("T")[0],
    categorie: "",
    fournisseur: "",
    notes: "",
    type_electrique: "",
    poids_kg: "",
    longueur_mm: "",
    largeur_mm: "",
    hauteur_mm: "",
    puissance_watts: "",
    intensite_amperes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [existingMarques, setExistingMarques] = useState<string[]>([]);
  const [showMarqueList, setShowMarqueList] = useState(false);
  const [filteredMarques, setFilteredMarques] = useState<string[]>([]);

  // Fournisseurs (autocomplete)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [catalogCategories, setCatalogCategories] = useState<{ id: string; nom: string }[]>([]);
  const [isNewCatalogCategory, setIsNewCatalogCategory] = useState(false);
  const [catalogCategoryId, setCatalogCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddToCatalog, setShowAddToCatalog] = useState(false);

  // Catalogue suggestions
  const [catalogAccessories, setCatalogAccessories] = useState<any[]>([]);
  const [filteredAccessories, setFilteredAccessories] = useState<any[]>([]);
  const [showAccessoriesList, setShowAccessoriesList] = useState(false);
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string | null>(null);

  // Options disponibles et sélectionnées
  const [availableOptions, setAvailableOptions] = useState<Array<{ id: string; nom: string; prix: number }>>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadExistingMarques();
      loadCatalogCategories();
      loadCatalogAccessories();
      loadSuppliers();

      // Load expense data if editing
      if (expense) {
        setFormData({
          nom_accessoire: expense.nom_accessoire,
          marque: expense.marque || "",
          prix_achat: expense.prix.toString(),
          prix_vente_ttc: expense.prix_vente_ttc?.toString() || "",
          marge_pourcent: expense.marge_pourcent?.toString() || "",
          quantite: expense.quantite.toString(),
          date_achat: expense.date_achat,
          categorie: expense.categorie,
          fournisseur: expense.fournisseur || "",
          notes: expense.notes || "",
          type_electrique: expense.type_electrique || "",
          poids_kg: expense.poids_kg?.toString() || "",
          longueur_mm: expense.longueur_mm?.toString() || "",
          largeur_mm: expense.largeur_mm?.toString() || "",
          hauteur_mm: expense.hauteur_mm?.toString() || "",
          puissance_watts: expense.puissance_watts?.toString() || "",
          intensite_amperes: expense.intensite_amperes?.toString() || "",
        });
        setSelectedAccessoryId(expense.accessory_id || null);

        // Charger les options si l'accessoire est lié au catalogue
        if (expense.accessory_id) {
          loadOptionsForExpense(expense.id, expense.accessory_id);
        }
      } else {
        // Reset form for new expense
        setFormData({
          nom_accessoire: "",
          marque: "",
          prix_achat: "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          quantite: "1",
          date_achat: new Date().toISOString().split("T")[0],
          categorie: "",
          fournisseur: "",
          notes: "",
          type_electrique: "",
          poids_kg: "",
          longueur_mm: "",
          largeur_mm: "",
          hauteur_mm: "",
          puissance_watts: "",
          intensite_amperes: "",
        });
        setSelectedAccessoryId(null);
        setAvailableOptions([]);
        setSelectedOptions([]);
      }
    }
  }, [isOpen, expense]);

  useEffect(() => {
    if (formData.marque) {
      const filtered = existingMarques.filter((m) => m.toLowerCase().includes(formData.marque.toLowerCase()));
      setFilteredMarques(filtered);
    } else {
      setFilteredMarques([]);
    }
  }, [formData.marque, existingMarques]);

  // Filter accessories based on search
  useEffect(() => {
    if (formData.nom_accessoire && formData.nom_accessoire.length >= 2) {
      const searchTerm = formData.nom_accessoire.toLowerCase();
      const filtered = catalogAccessories.filter(
        (acc) =>
          acc.nom.toLowerCase().includes(searchTerm) ||
          (acc.description && acc.description.toLowerCase().includes(searchTerm)) ||
          (acc.fournisseur && acc.fournisseur.toLowerCase().includes(searchTerm)),
      );
      setFilteredAccessories(filtered.slice(0, 5)); // Limit to 5 suggestions
    } else {
      setFilteredAccessories([]);
    }
  }, [formData.nom_accessoire, catalogAccessories]);

  const loadExistingMarques = async () => {
    const { data: expensesData } = (await supabase
      .from("project_expenses")
      .select("marque")
      .not("marque", "is", null)) as any;

    const { data: catalogData } = await supabase.from("accessories_catalog").select("nom").not("nom", "is", null);

    const marques = new Set<string>();
    expensesData?.forEach((e: any) => e.marque && marques.add(e.marque));
    catalogData?.forEach((c) => {
      const match = c.nom.match(/^([A-Z][a-zA-Z0-9]*)/);
      if (match) marques.add(match[1]);
    });

    setExistingMarques(Array.from(marques).sort());
  };

  const loadCatalogCategories = async () => {
    const { data } = await supabase.from("categories").select("id, nom").order("nom");

    if (data) {
      setCatalogCategories(data);
    }
  };

  const loadCatalogAccessories = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("accessories_catalog")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      // DEBUG
      console.log("[Catalogue] Accessoires chargés:", data.length);
      const electricItems = data.filter((a) => a.type_electrique);
      console.log(
        "[Catalogue] Accessoires avec type_electrique:",
        electricItems.map((a) => ({
          nom: a.nom,
          type_electrique: a.type_electrique,
          puissance_watts: a.puissance_watts,
        })),
      );
      setCatalogAccessories(data);
    }
  };

  // Charger les fournisseurs
  const loadSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name").order("name");
    if (data) {
      setSuppliers(data);
    }
  };

  // Filtrer les fournisseurs selon la recherche
  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes((formData.fournisseur || "").toLowerCase()),
  );

  const loadOptionsForExpense = async (expenseId: string, accessoryId: string) => {
    try {
      // Charger les options disponibles pour cet accessoire
      const { data: options, error: optionsError } = await supabase
        .from("accessory_options")
        .select("*")
        .eq("accessory_id", accessoryId)
        .order("created_at");

      if (!optionsError && options) {
        setAvailableOptions(
          options.map((opt) => ({
            id: opt.id,
            nom: opt.nom,
            prix: parseFloat(opt.prix_vente_ttc.toString()),
          })),
        );
      }

      // Charger les options déjà sélectionnées pour cette dépense
      const { data: selectedOpts, error: selectedError } = await supabase
        .from("expense_selected_options")
        .select("option_id")
        .eq("expense_id", expenseId);

      if (!selectedError && selectedOpts) {
        setSelectedOptions(selectedOpts.map((opt) => opt.option_id));
      }
    } catch (error) {
      console.error("Erreur lors du chargement des options:", error);
    }
  };

  const selectAccessoryFromCatalog = async (accessory: any) => {
    // DEBUG
    console.log("[Catalogue] Accessoire sélectionné:", {
      nom: accessory.nom,
      type_electrique: accessory.type_electrique,
      puissance_watts: accessory.puissance_watts,
      intensite_amperes: accessory.intensite_amperes,
    });

    setFormData({
      ...formData,
      nom_accessoire: accessory.nom,
      marque: accessory.marque || "",
      prix_achat: accessory.prix_reference?.toString() || "",
      prix_vente_ttc: accessory.prix_vente_ttc?.toString() || "",
      marge_pourcent: accessory.marge_pourcent?.toString() || "",
      fournisseur: accessory.fournisseur || "",
      notes: accessory.description || "",
      type_electrique: accessory.type_electrique || "",
      poids_kg: accessory.poids_kg?.toString() || "",
      longueur_mm: accessory.longueur_mm?.toString() || "",
      largeur_mm: accessory.largeur_mm?.toString() || "",
      hauteur_mm: accessory.hauteur_mm?.toString() || "",
      puissance_watts: accessory.puissance_watts?.toString() || "",
      intensite_amperes: accessory.intensite_amperes?.toString() || "",
    });
    setSelectedAccessoryId(accessory.id);
    setShowAccessoriesList(false);

    // Charger les options disponibles pour cet accessoire
    const { data: options, error } = await supabase
      .from("accessory_options")
      .select("*")
      .eq("accessory_id", accessory.id)
      .order("created_at");

    if (!error && options) {
      setAvailableOptions(
        options.map((opt) => ({ id: opt.id, nom: opt.nom, prix: parseFloat(opt.prix_vente_ttc.toString()) })),
      );
    }

    toast.success("Article du catalogue sélectionné et informations copiées");
  };

  const handlePricingChange = (field: "prix_achat" | "prix_vente_ttc" | "marge_pourcent", value: string) => {
    const newFormData = { ...formData, [field]: value };

    // Déterminer quels champs sont remplis (non vides et non zéro)
    const hasPrixAchat = newFormData.prix_achat && parseFloat(newFormData.prix_achat) > 0;
    const hasPrixVente = newFormData.prix_vente_ttc && parseFloat(newFormData.prix_vente_ttc) > 0;
    const hasMarge = newFormData.marge_pourcent && parseFloat(newFormData.marge_pourcent) !== 0;

    // Si on a 2 champs remplis, calculer le 3ème
    if (hasPrixAchat && hasPrixVente && field !== "marge_pourcent") {
      // Prix HT + Prix TTC remplis → calculer la marge
      const prixAchat = parseFloat(newFormData.prix_achat);
      const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
      newFormData.marge_pourcent = (((prixVenteTTC - prixAchat) / prixAchat) * 100).toFixed(2);
    } else if (hasPrixVente && hasMarge && field !== "prix_achat") {
      // Prix TTC + Marge remplis → calculer le prix HT
      const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
      const margePourcent = parseFloat(newFormData.marge_pourcent);
      newFormData.prix_achat = (prixVenteTTC / (1 + margePourcent / 100)).toFixed(2);
    } else if (hasPrixAchat && hasMarge && field !== "prix_vente_ttc") {
      // Prix HT + Marge remplis → calculer le prix TTC
      const prixAchat = parseFloat(newFormData.prix_achat);
      const margePourcent = parseFloat(newFormData.marge_pourcent);
      newFormData.prix_vente_ttc = (prixAchat * (1 + margePourcent / 100)).toFixed(2);
    }

    setFormData(newFormData);
  };

  const handleElectricalChange = (field: "puissance_watts" | "intensite_amperes", value: string) => {
    const newFormData = { ...formData, [field]: value };
    const voltage = 12; // 12V system

    if (field === "puissance_watts" && value) {
      // Calculate intensity from power: I = P / U
      const power = parseFloat(value);
      if (!isNaN(power) && power > 0) {
        newFormData.intensite_amperes = (power / voltage).toFixed(2);
      }
    } else if (field === "intensite_amperes" && value) {
      // Calculate power from intensity: P = U × I
      const intensity = parseFloat(value);
      if (!isNaN(intensity) && intensity > 0) {
        newFormData.puissance_watts = (intensity * voltage).toFixed(1);
      }
    }

    setFormData(newFormData);
  };

  const handleAddToCatalog = async () => {
    if (!formData.nom_accessoire || !formData.prix_achat) {
      toast.error("Le nom et le prix d'achat sont requis");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    // Si nouvelle catégorie, la créer d'abord
    let finalCategoryId = catalogCategoryId || null;
    if (isNewCatalogCategory && newCategoryName.trim()) {
      const { data: newCat, error: catError } = await supabase
        .from("categories")
        .insert({
          nom: newCategoryName.trim(),
          user_id: user.id,
        })
        .select()
        .single();

      if (catError) {
        toast.error("Erreur lors de la création de la catégorie");
        console.error(catError);
        return;
      }
      finalCategoryId = newCat.id;
    }

    const { error } = await supabase.from("accessories_catalog").insert({
      nom: formData.nom_accessoire,
      marque: formData.marque || null,
      category_id: finalCategoryId,
      prix_reference: parseFloat(formData.prix_achat),
      prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
      marge_pourcent: formData.marge_pourcent ? parseFloat(formData.marge_pourcent) : null,
      description: formData.notes || null,
      fournisseur: formData.fournisseur || null,
      type_electrique: formData.type_electrique || null,
      poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
      longueur_mm: formData.longueur_mm ? parseInt(formData.longueur_mm) : null,
      largeur_mm: formData.largeur_mm ? parseInt(formData.largeur_mm) : null,
      hauteur_mm: formData.hauteur_mm ? parseInt(formData.hauteur_mm) : null,
      puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
      intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout au catalogue");
      console.error(error);
    } else {
      toast.success("Accessoire ajouté au catalogue");
      setShowAddToCatalog(false);
      setCatalogCategoryId("");
      setNewCategoryName("");
      setIsNewCatalogCategory(false);
      loadCatalogCategories();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (expense) {
      // Mode édition
      const { error } = await supabase
        .from("project_expenses")
        .update({
          nom_accessoire: formData.nom_accessoire,
          marque: formData.marque || null,
          prix: parseFloat(formData.prix_achat),
          prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
          quantite: parseInt(formData.quantite),
          date_achat: formData.date_achat,
          categorie: formData.categorie,
          fournisseur: formData.fournisseur || null,
          notes: formData.notes || null,
          type_electrique: formData.type_electrique || null,
          poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
          puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
          intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
        })
        .eq("id", expense.id);

      if (error) {
        toast.error("Erreur lors de la modification");
        console.error(error);
      } else {
        // ✅ SYNCHRONISATION BIDIRECTIONNELLE : Mettre à jour le catalogue si lié
        if (expense.accessory_id) {
          const { error: syncError } = await supabase
            .from("accessories_catalog")
            .update({
              nom: formData.nom_accessoire,
              marque: formData.marque || null,
              prix_reference: parseFloat(formData.prix_achat),
              prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
              fournisseur: formData.fournisseur || null,
              type_electrique: formData.type_electrique || null,
              poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
              puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
              intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
            })
            .eq("id", expense.accessory_id);

          if (syncError) {
            console.warn("Erreur sync catalogue:", syncError);
          } else {
            console.log("[Dépense] Catalogue synchronisé");
          }
        }

        // Mettre à jour les options sélectionnées
        // Supprimer les anciennes
        await supabase.from("expense_selected_options").delete().eq("expense_id", expense.id);

        // Ajouter les nouvelles
        if (selectedOptions.length > 0) {
          const optionsToInsert = selectedOptions.map((optId) => {
            const option = availableOptions.find((opt) => opt.id === optId);
            return {
              expense_id: expense.id,
              option_id: optId,
              option_name: option?.nom || "",
              prix_vente_ttc: option?.prix || 0,
            };
          });
          await supabase.from("expense_selected_options").insert(optionsToInsert);
        }

        toast.success("Dépense modifiée avec succès");
        onSuccess();
      }
    } else {
      // Mode création
      let finalAccessoryId = selectedAccessoryId;

      // Si pas de lien sélectionné, chercher dans le catalogue
      if (!finalAccessoryId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: catalogItems } = await supabase.from("accessories_catalog").select("*").eq("user_id", user.id);

          if (catalogItems && catalogItems.length > 0) {
            const match = catalogItems.find((item) => {
              const nameMatch =
                item.nom.toLowerCase().includes(formData.nom_accessoire.toLowerCase()) ||
                formData.nom_accessoire.toLowerCase().includes(item.nom.toLowerCase());
              const priceMatch =
                item.prix_reference && Math.abs(item.prix_reference - parseFloat(formData.prix_achat)) < 0.01;
              const supplierMatch =
                item.fournisseur &&
                formData.fournisseur &&
                item.fournisseur.toLowerCase() === formData.fournisseur.toLowerCase();

              return nameMatch || priceMatch || supplierMatch;
            });

            if (match) {
              finalAccessoryId = match.id;
            }
          }
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data: newExpense, error } = await supabase
        .from("project_expenses")
        .insert({
          project_id: projectId,
          user_id: user.id,
          scenario_id: scenarioId || null, // ✅ AJOUTÉ pour les scénarios
          nom_accessoire: formData.nom_accessoire,
          marque: formData.marque || null,
          prix: parseFloat(formData.prix_achat),
          prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
          quantite: parseInt(formData.quantite),
          date_achat: formData.date_achat,
          categorie: formData.categorie,
          fournisseur: formData.fournisseur || null,
          notes: formData.notes || null,
          statut_paiement: "non_paye",
          statut_livraison: "commande",
          accessory_id: finalAccessoryId,
          type_electrique: formData.type_electrique || null,
          poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
          puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
          intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
        })
        .select()
        .single();

      if (error) {
        toast.error("Erreur lors de l'ajout de la dépense");
        console.error(error);
      } else {
        // Ajouter les options sélectionnées
        if (selectedOptions.length > 0 && newExpense) {
          const optionsToInsert = selectedOptions.map((optId) => {
            const option = availableOptions.find((opt) => opt.id === optId);
            return {
              expense_id: newExpense.id,
              option_id: optId,
              option_name: option?.nom || "",
              prix_vente_ttc: option?.prix || 0,
            };
          });
          await supabase.from("expense_selected_options").insert(optionsToInsert);
        }

        if (finalAccessoryId && !selectedAccessoryId) {
          toast.success("Dépense ajoutée et liée au catalogue");
        } else {
          toast.success("Dépense ajoutée avec succès");
        }
        setFormData({
          nom_accessoire: "",
          marque: "",
          prix_achat: "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          quantite: "1",
          date_achat: new Date().toISOString().split("T")[0],
          categorie: "",
          fournisseur: "",
          notes: "",
          type_electrique: "",
          poids_kg: "",
          longueur_mm: "",
          largeur_mm: "",
          hauteur_mm: "",
          puissance_watts: "",
          intensite_amperes: "",
        });
        setIsNewCategory(false);
        setShowAddToCatalog(false);
        setSelectedAccessoryId(null);
        setAvailableOptions([]);
        setSelectedOptions([]);
        onSuccess();
        onClose(); // Fermer la modale après succès
      }
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Modifier la dépense" : "Ajouter une dépense"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="nom">Nom de l'accessoire *</Label>
              <Input
                id="nom"
                required
                value={formData.nom_accessoire}
                onChange={(e) => {
                  setFormData({ ...formData, nom_accessoire: e.target.value });
                  setShowAccessoriesList(true);
                }}
                onFocus={() => setShowAccessoriesList(true)}
                onBlur={() => setTimeout(() => setShowAccessoriesList(false), 200)}
                placeholder="Rechercher dans le catalogue..."
              />
              {showAccessoriesList && filteredAccessories.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {filteredAccessories.map((accessory) => (
                    <button
                      key={accessory.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectAccessoryFromCatalog(accessory);
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="font-medium text-sm">{accessory.nom}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          {accessory.prix_reference && <span>Prix: {accessory.prix_reference}€</span>}
                          {accessory.fournisseur && <span>• {accessory.fournisseur}</span>}
                        </div>
                        {accessory.description && (
                          <div className="text-xs text-muted-foreground italic truncate">{accessory.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedAccessoryId && (
                <div className="text-xs text-green-600 mt-1">✓ Article du catalogue sélectionné</div>
              )}
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="marque">Marque</Label>
              <Input
                id="marque"
                value={formData.marque}
                onChange={(e) => {
                  setFormData({ ...formData, marque: e.target.value });
                  setShowMarqueList(true);
                }}
                onFocus={() => setShowMarqueList(true)}
                onBlur={() => setTimeout(() => setShowMarqueList(false), 200)}
              />
              {showMarqueList && filteredMarques.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredMarques.map((marque) => (
                    <button
                      key={marque}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, marque });
                        setShowMarqueList(false);
                      }}
                    >
                      {marque}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type_electrique">Type électrique</Label>
              <Select
                value={formData.type_electrique || "none"}
                onValueChange={(value) => setFormData({ ...formData, type_electrique: value === "none" ? "" : value })}
              >
                <SelectTrigger id="type_electrique">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non applicable</SelectItem>
                  <SelectItem value="producteur">🟡 Producteur (panneau)</SelectItem>
                  <SelectItem value="stockage">🟢 Stockage (batterie)</SelectItem>
                  <SelectItem value="regulateur">🔵 Régulateur (MPPT)</SelectItem>
                  <SelectItem value="convertisseur">🟣 Convertisseur (DC/AC)</SelectItem>
                  <SelectItem value="chargeur">🟠 Chargeur (230V, booster)</SelectItem>
                  <SelectItem value="consommateur">🔴 Consommateur</SelectItem>
                  <SelectItem value="neutre">⚪ Accessoire (fusible, bornier...)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="puissance">Puissance (W) - 12V</Label>
              <Input
                id="puissance"
                type="number"
                step="0.1"
                value={formData.puissance_watts}
                onChange={(e) => handleElectricalChange("puissance_watts", e.target.value)}
                placeholder="Ex: 400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intensite">Intensité (A) - 12V</Label>
              <Input
                id="intensite"
                type="number"
                step="0.1"
                value={formData.intensite_amperes}
                onChange={(e) => handleElectricalChange("intensite_amperes", e.target.value)}
                placeholder="Ex: 33.3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poids">Poids (kg)</Label>
              <Input
                id="poids"
                type="number"
                step="0.01"
                value={formData.poids_kg}
                onChange={(e) => setFormData({ ...formData, poids_kg: e.target.value })}
                placeholder="Ex: 12.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dimensions (mm)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="longueur" className="text-xs text-muted-foreground">
                  Longueur
                </Label>
                <Input
                  id="longueur"
                  type="number"
                  value={formData.longueur_mm}
                  onChange={(e) => setFormData({ ...formData, longueur_mm: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="largeur" className="text-xs text-muted-foreground">
                  Largeur
                </Label>
                <Input
                  id="largeur"
                  type="number"
                  value={formData.largeur_mm}
                  onChange={(e) => setFormData({ ...formData, largeur_mm: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hauteur" className="text-xs text-muted-foreground">
                  Hauteur
                </Label>
                <Input
                  id="hauteur"
                  type="number"
                  value={formData.hauteur_mm}
                  onChange={(e) => setFormData({ ...formData, hauteur_mm: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-base font-semibold">Calcul de prix (remplir 2 sur 3)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prix_achat">Prix d'achat (€) *</Label>
                <Input
                  id="prix_achat"
                  type="number"
                  step="0.01"
                  required
                  value={formData.prix_achat}
                  onChange={(e) => handlePricingChange("prix_achat", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prix_vente">Prix de vente TTC (€)</Label>
                <Input
                  id="prix_vente"
                  type="number"
                  step="0.01"
                  value={formData.prix_vente_ttc}
                  onChange={(e) => handlePricingChange("prix_vente_ttc", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marge">Marge (%)</Label>
                <Input
                  id="marge"
                  type="number"
                  step="0.01"
                  value={formData.marge_pourcent}
                  onChange={(e) => handlePricingChange("marge_pourcent", e.target.value)}
                />
              </div>
            </div>
          </div>

          {availableOptions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-base font-semibold">Options disponibles</Label>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez les options souhaitées. Le prix total sera automatiquement calculé.
                </p>
                <div className="space-y-2 border rounded-md p-3">
                  {availableOptions.map((option) => (
                    <div key={option.id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`option-${option.id}`}
                          checked={selectedOptions.includes(option.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedOptions([...selectedOptions, option.id]);
                            } else {
                              setSelectedOptions(selectedOptions.filter((id) => id !== option.id));
                            }
                          }}
                        />
                        <label htmlFor={`option-${option.id}`} className="text-sm font-medium cursor-pointer">
                          {option.nom}
                        </label>
                      </div>
                      <span className="text-sm font-semibold">+{option.prix.toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
                {selectedOptions.length > 0 && (
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-md">
                    <span className="font-semibold">Prix total avec options:</span>
                    <span className="text-lg font-bold">
                      {(
                        parseFloat(formData.prix_vente_ttc || "0") +
                        selectedOptions.reduce((sum, optId) => {
                          const opt = availableOptions.find((o) => o.id === optId);
                          return sum + (opt?.prix || 0);
                        }, 0)
                      ).toFixed(2)}{" "}
                      €
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie *</Label>
              {isNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    id="categorie"
                    required
                    placeholder="Nom de la catégorie"
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsNewCategory(false);
                      setFormData({ ...formData, categorie: "" });
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.categorie}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setIsNewCategory(true);
                      setFormData({ ...formData, categorie: "" });
                    } else {
                      setFormData({ ...formData, categorie: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner ou créer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">+ Nouvelle catégorie</SelectItem>
                    {existingCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantite">Quantité *</Label>
              <Input
                id="quantite"
                type="number"
                min="1"
                required
                value={formData.quantite}
                onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date d'achat</Label>
              <Input
                id="date"
                type="date"
                value={formData.date_achat}
                onChange={(e) => setFormData({ ...formData, date_achat: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fournisseur">Fournisseur</Label>
              <div className="relative">
                <Input
                  id="fournisseur"
                  value={formData.fournisseur}
                  onChange={(e) => {
                    setFormData({ ...formData, fournisseur: e.target.value });
                    setShowSupplierDropdown(true);
                  }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                  placeholder="Rechercher un fournisseur..."
                  autoComplete="off"
                />
                {showSupplierDropdown && formData.fournisseur && filteredSuppliers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredSuppliers.slice(0, 10).map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData({ ...formData, fournisseur: supplier.name });
                          setShowSupplierDropdown(false);
                        }}
                      >
                        {supplier.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {showAddToCatalog && (
            <>
              <Separator />
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold">Ajouter au catalogue d'accessoires</h3>
                <div className="space-y-2">
                  <Label>Catégorie du catalogue</Label>
                  {isNewCatalogCategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nom de la catégorie"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsNewCatalogCategory(false);
                          setNewCategoryName("");
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={catalogCategoryId || "none"}
                      onValueChange={(value) => {
                        if (value === "__new__") {
                          setIsNewCatalogCategory(true);
                          setNewCategoryName("");
                        } else if (value === "none") {
                          setCatalogCategoryId("");
                        } else {
                          setCatalogCategoryId(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner ou créer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">+ Nouvelle catégorie</SelectItem>
                        <SelectItem value="none">Aucune catégorie</SelectItem>
                        {catalogCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={handleAddToCatalog}>
                    Confirmer l'ajout au catalogue
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddToCatalog(false);
                      setCatalogCategoryId("");
                      setNewCategoryName("");
                      setIsNewCatalogCategory(false);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddToCatalog(!showAddToCatalog)}>
              <Plus className="h-4 w-4 mr-2" />
              {showAddToCatalog ? "Masquer" : "Ajouter au catalogue"}
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Ajout..." : "Ajouter"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseFormDialog;
