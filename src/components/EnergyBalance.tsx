import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Battery, Zap, TrendingUp, AlertCircle, Plus, ShoppingCart, ArrowRight, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface ElectricalItem {
  id: string;
  nom_accessoire: string;
  type_electrique: string;
  quantite: number;
  puissance_watts?: number | null;
  intensite_amperes?: number | null;
  temps_utilisation_heures?: number | null;
  temps_production_heures?: number | null;
  prix_unitaire?: number | null;
}

interface DraftItem extends Omit<ElectricalItem, "id"> {
  id: string;
  is_draft: boolean;
  accessory_id?: string;
}

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  prix_vente_ttc?: number;
  puissance_watts?: number;
  category_id: string;
  type_electrique?: string;
}

interface Category {
  id: string;
  nom: string;
}

interface EnergyBalanceProps {
  projectId: string;
  refreshTrigger?: number;
}

export const EnergyBalance = ({ projectId, refreshTrigger }: EnergyBalanceProps) => {
  const [items, setItems] = useState<ElectricalItem[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("real");
  const [principalScenarioId, setPrincipalScenarioId] = useState<string | null>(null);

  // Dialog states
  const [addAccessoryDialogOpen, setAddAccessoryDialogOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedDraftItems, setSelectedDraftItems] = useState<Set<string>>(new Set());

  // Debounce ref for time updates
  const timeUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Charger le scénario principal d'abord
  useEffect(() => {
    loadPrincipalScenario();
  }, [projectId]);

  // Charger les items quand le scénario principal est chargé
  useEffect(() => {
    if (principalScenarioId) {
      loadElectricalItems();
    }
    loadDraftItems();
    loadCategories();
  }, [projectId, principalScenarioId, refreshTrigger]);

  const loadPrincipalScenario = async () => {
    const result: any = await (supabase as any)
      .from("project_scenarios")
      .select("id")
      .eq("project_id", projectId)
      .eq("est_principal", true)
      .single();

    const { data, error } = result;

    if (error) {
      console.error("Erreur lors du chargement du scénario principal:", error);
      // Fallback: charger toutes les dépenses du projet sans filtre scénario
      setPrincipalScenarioId(null);
      loadElectricalItemsWithoutScenario();
    } else if (data) {
      setPrincipalScenarioId(data.id);
    }
  };

  const loadElectricalItemsWithoutScenario = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_expenses")
      .select("*")
      .eq("project_id", projectId)
      .not("type_electrique", "is", null);

    if (error) {
      console.error("Erreur lors du chargement des équipements électriques:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("id, nom").order("nom");

    if (error) {
      console.error("Erreur lors du chargement des catégories:", error);
    } else {
      setCategories(data || []);
    }
  };

  const loadAccessoriesByCategory = async (categoryId: string) => {
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_vente_ttc, puissance_watts, category_id, type_electrique")
      .eq("category_id", categoryId)
      .not("type_electrique", "is", null);

    if (error) {
      console.error("Erreur lors du chargement des accessoires:", error);
    } else {
      setAccessories(data || []);
    }
  };

  const loadElectricalItems = async () => {
    if (!principalScenarioId) {
      loadElectricalItemsWithoutScenario();
      return;
    }

    setLoading(true);
    const result: any = await (supabase as any)
      .from("project_expenses")
      .select("*")
      .eq("scenario_id", principalScenarioId)
      .not("type_electrique", "is", null);

    const { data, error } = result;

    if (error) {
      console.error("Erreur lors du chargement des équipements électriques:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const loadDraftItems = async () => {
    // Charger depuis localStorage pour simplifier
    const stored = localStorage.getItem(`energy_draft_${projectId}`);
    if (stored) {
      setDraftItems(JSON.parse(stored));
    }
  };

  const saveDraftItems = (items: DraftItem[]) => {
    localStorage.setItem(`energy_draft_${projectId}`, JSON.stringify(items));
    setDraftItems(items);
  };

  const handleAddAccessoryToDraft = () => {
    if (!selectedAccessory) {
      toast.error("Veuillez sélectionner un accessoire");
      return;
    }

    const newDraftItem: DraftItem = {
      id: `draft-${Date.now()}-${Math.random()}`,
      nom_accessoire: `${selectedAccessory.nom}${selectedAccessory.marque ? ` - ${selectedAccessory.marque}` : ""}`,
      type_electrique: selectedAccessory.type_electrique || "consommateur",
      quantite: 1,
      puissance_watts: selectedAccessory.puissance_watts || null,
      intensite_amperes: null,
      temps_utilisation_heures: null,
      temps_production_heures: null,
      prix_unitaire: selectedAccessory.prix_vente_ttc || null,
      is_draft: true,
      accessory_id: selectedAccessory.id,
    };

    saveDraftItems([...draftItems, newDraftItem]);
    toast.success("Accessoire ajouté au brouillon");
    setAddAccessoryDialogOpen(false);
    setSelectedAccessory(null);
    setSelectedCategory("");
  };

  const handleDeleteDraftItem = (itemId: string) => {
    const updated = draftItems.filter((item) => item.id !== itemId);
    saveDraftItems(updated);
    toast.success("Élément supprimé du brouillon");
  };

  const handleUpdateDraftItem = (itemId: string, field: keyof DraftItem, value: any) => {
    const updated = draftItems.map((item) => (item.id === itemId ? { ...item, [field]: value } : item));
    saveDraftItems(updated);
  };

  const handleTransferToReal = async () => {
    if (selectedDraftItems.size === 0) {
      toast.error("Veuillez sélectionner au moins un élément à transférer");
      return;
    }

    if (!principalScenarioId) {
      toast.error("Aucun scénario principal trouvé");
      return;
    }

    const itemsToTransfer = draftItems.filter((item) => selectedDraftItems.has(item.id));

    // Insérer dans project_expenses avec le scenario_id
    const expensesToInsert = itemsToTransfer.map((item) => ({
      project_id: projectId,
      scenario_id: principalScenarioId,
      nom_accessoire: item.nom_accessoire,
      type_electrique: item.type_electrique,
      quantite: item.quantite,
      puissance_watts: item.puissance_watts,
      intensite_amperes: item.intensite_amperes,
      temps_utilisation_heures: item.temps_utilisation_heures,
      temps_production_heures: item.temps_production_heures,
      prix: item.prix_unitaire || 0,
      categorie: "Électrique",
    }));

    const { error } = await supabase.from("project_expenses").insert(expensesToInsert);

    if (error) {
      console.error("Erreur lors du transfert:", error);
      toast.error("Erreur lors du transfert vers le bilan réel");
    } else {
      // Supprimer les éléments transférés du brouillon
      const remaining = draftItems.filter((item) => !selectedDraftItems.has(item.id));
      saveDraftItems(remaining);
      setSelectedDraftItems(new Set());
      setTransferDialogOpen(false);
      toast.success(`${itemsToTransfer.length} élément(s) transféré(s) vers le bilan réel et les dépenses`);
      loadElectricalItems();
    }
  };

  const toggleDraftItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedDraftItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedDraftItems(newSelection);
  };

  const categorizeItems = (itemsList: ElectricalItem[]) => {
    const producers = itemsList.filter((item) => item.type_electrique === "producteur");
    const consumers = itemsList.filter((item) => item.type_electrique === "consommateur");
    const storage = itemsList.filter((item) => item.type_electrique === "stockage");
    const converters = itemsList.filter((item) => item.type_electrique === "convertisseur");

    return { producers, consumers, storage, converters };
  };

  const calculateTotalConsumption = (itemsList: ElectricalItem[]) => {
    const consumers = itemsList.filter((item) => item.type_electrique === "consommateur");
    return consumers.reduce((total, item) => {
      const power = item.puissance_watts || 0;
      const usageTime = item.temps_utilisation_heures || 0;
      const quantity = item.quantite || 1;
      return total + power * usageTime * quantity;
    }, 0);
  };

  const calculateTotalProduction = (itemsList: ElectricalItem[]) => {
    const producers = itemsList.filter((item) => item.type_electrique === "producteur");
    return producers.reduce((total, item) => {
      const power = item.puissance_watts || 0;
      const productionTime = item.temps_production_heures || 0;
      const quantity = item.quantite || 1;
      return total + power * productionTime * quantity;
    }, 0);
  };

  const calculateBatteryCapacity = (itemsList: ElectricalItem[]) => {
    const storage = itemsList.filter((item) => item.type_electrique === "stockage");
    return storage.reduce((total, item) => {
      // Pour les batteries, puissance_watts représente la capacité en Wh
      const capacity = item.puissance_watts || 0;
      const quantity = item.quantite || 1;
      return total + capacity * quantity;
    }, 0);
  };

  const calculateRemainingAutonomy = (itemsList: ElectricalItem[]) => {
    const totalConsumption = calculateTotalConsumption(itemsList);
    const totalProduction = calculateTotalProduction(itemsList);
    const batteryCapacity = calculateBatteryCapacity(itemsList);

    // Consommation nette = consommation - production
    const netConsumption = totalConsumption - totalProduction;

    if (netConsumption <= 0) return null; // Autonomie infinie si production >= consommation

    return batteryCapacity / netConsumption;
  };

  const handleTimeUpdate = (
    itemId: string,
    field: "temps_utilisation_heures" | "temps_production_heures",
    value: string,
  ) => {
    const numValue = value === "" ? null : parseFloat(value);

    const item = items.find((i) => i.id === itemId);
    if (numValue !== null && numValue < 0) {
      toast.error("La valeur doit être positive");
      return;
    }

    if (numValue !== null && item?.type_electrique !== "stockage" && numValue > 24) {
      toast.error("Le temps doit être entre 0 et 24 heures");
      return;
    }

    // Mise à jour immédiate de l'état local pour un retour visuel rapide
    setItems((prevItems) => prevItems.map((i) => (i.id === itemId ? { ...i, [field]: numValue } : i)));

    // Annuler le timeout précédent s'il existe
    const timeoutKey = `${itemId}-${field}`;
    if (timeUpdateTimeouts.current[timeoutKey]) {
      clearTimeout(timeUpdateTimeouts.current[timeoutKey]);
    }

    // Débounce de 800ms avant de sauvegarder en base de données
    timeUpdateTimeouts.current[timeoutKey] = setTimeout(async () => {
      const { error } = await supabase
        .from("project_expenses")
        .update({ [field]: numValue })
        .eq("id", itemId);

      if (error) {
        console.error("Erreur lors de la mise à jour:", error);
        toast.error("Erreur lors de la mise à jour");
        // Recharger les données en cas d'erreur pour retrouver l'état correct
        loadElectricalItems();
      }

      delete timeUpdateTimeouts.current[timeoutKey];
    }, 800);
  };

  const renderSummaryCards = (itemsList: ElectricalItem[]) => {
    const { producers, consumers, storage, converters } = categorizeItems(itemsList);

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Producteurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {producers.reduce((sum, item) => sum + item.quantite, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {producers.length} type{producers.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Consommateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {consumers.reduce((sum, item) => sum + item.quantite, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {consumers.length} type{consumers.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Stockage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {storage.reduce((sum, item) => sum + item.quantite, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {storage.length} type{storage.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 dark:bg-purple-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">Convertisseurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {converters.reduce((sum, item) => sum + item.quantite, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {converters.length} type{converters.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAutonomyCard = (itemsList: ElectricalItem[]) => {
    const { storage, producers } = categorizeItems(itemsList);
    const totalConsumption = calculateTotalConsumption(itemsList);
    const totalProduction = calculateTotalProduction(itemsList);
    const batteryCapacity = calculateBatteryCapacity(itemsList);
    const remainingAutonomy = calculateRemainingAutonomy(itemsList);
    const netConsumption = totalConsumption - totalProduction;

    if (storage.length === 0 || totalConsumption === 0) return null;

    return (
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Battery className="h-5 w-5 text-blue-600" />
            Autonomie Estimée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Consommation quotidienne</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {totalConsumption.toFixed(1)} Wh/jour
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Production quotidienne</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {totalProduction.toFixed(1)} Wh/jour
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Capacité batterie</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{batteryCapacity.toFixed(1)} Wh</div>
            </div>
          </div>

          {netConsumption > 0 && remainingAutonomy !== null && (
            <div className="pt-3 border-t">
              <div className="text-sm text-muted-foreground mb-1">
                Autonomie estimée (consommation nette: {netConsumption.toFixed(1)} Wh/jour)
              </div>
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {remainingAutonomy.toFixed(1)} jours
              </div>
            </div>
          )}

          {netConsumption <= 0 && producers.length > 0 && (
            <div className="pt-3 border-t">
              <div className="text-sm text-green-600 dark:text-green-400 mb-1">
                ⚡ Production excédentaire: {Math.abs(netConsumption).toFixed(1)} Wh/jour
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">Autonomie infinie</div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderItemsTable = (
    itemsList: ElectricalItem[] | DraftItem[],
    title: string,
    icon: React.ReactNode,
    showTimeField: "production" | "utilisation" | "autonomie" | null,
    isDraft: boolean = false,
  ) => {
    if (itemsList.length === 0) return null;

    const getTimeLabel = () => {
      switch (showTimeField) {
        case "production":
          return "Temps de production (h/24h)";
        case "utilisation":
          return "Temps d'utilisation (h/24h)";
        case "autonomie":
          return "Capacité (Wh)";
        default:
          return "";
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-lg font-semibold">{title}</h3>
          <span className="text-sm text-muted-foreground">({itemsList.length})</span>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {isDraft && <TableHead className="w-12"></TableHead>}
                <TableHead>Nom</TableHead>
                <TableHead className="text-center w-24">Quantité</TableHead>
                <TableHead className="text-center w-40">Puissance unitaire</TableHead>
                {showTimeField && <TableHead className="text-center w-48">{getTimeLabel()}</TableHead>}
                <TableHead className="text-center w-44">
                  {showTimeField === "production"
                    ? "Production totale"
                    : showTimeField === "utilisation"
                      ? "Consommation totale"
                      : showTimeField === "autonomie"
                        ? "Capacité totale"
                        : "Total"}
                </TableHead>
                {isDraft && <TableHead className="text-center w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsList.map((item) => {
                const power = item.puissance_watts || 0;
                const quantity = item.quantite || 1;
                const usageTime = item.temps_utilisation_heures || 0;
                const productionTime = item.temps_production_heures || 0;

                let totalValue = 0;
                if (showTimeField === "production") {
                  totalValue = power * productionTime * quantity;
                } else if (showTimeField === "utilisation") {
                  totalValue = power * usageTime * quantity;
                } else if (showTimeField === "autonomie") {
                  totalValue = power * quantity; // Capacité totale
                }

                return (
                  <TableRow key={item.id}>
                    {isDraft && (
                      <TableCell>
                        <Checkbox
                          checked={selectedDraftItems.has(item.id)}
                          onCheckedChange={() => toggleDraftItemSelection(item.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{item.nom_accessoire}</TableCell>
                    <TableCell className="text-center">
                      {isDraft ? (
                        <Input
                          type="number"
                          min="1"
                          value={item.quantite}
                          onChange={(e) => handleUpdateDraftItem(item.id, "quantite", parseInt(e.target.value) || 1)}
                          className="w-20 mx-auto"
                        />
                      ) : (
                        item.quantite
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {power > 0 ? `${power} W` : "-"}
                    </TableCell>
                    {showTimeField && showTimeField !== "autonomie" && (
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          placeholder="0-24h"
                          value={
                            showTimeField === "utilisation"
                              ? (item.temps_utilisation_heures ?? "")
                              : (item.temps_production_heures ?? "")
                          }
                          onChange={(e) => {
                            if (isDraft) {
                              handleUpdateDraftItem(
                                item.id,
                                showTimeField === "utilisation"
                                  ? "temps_utilisation_heures"
                                  : "temps_production_heures",
                                e.target.value === "" ? null : parseFloat(e.target.value),
                              );
                            } else {
                              handleTimeUpdate(
                                item.id,
                                showTimeField === "utilisation"
                                  ? "temps_utilisation_heures"
                                  : "temps_production_heures",
                                e.target.value,
                              );
                            }
                          }}
                          className="w-24 mx-auto"
                        />
                      </TableCell>
                    )}
                    {showTimeField === "autonomie" && (
                      <TableCell className="text-center">
                        <span className="text-muted-foreground">
                          {item.puissance_watts ? `${item.puissance_watts} Wh` : "Non renseigné"}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-center font-semibold">
                      {totalValue > 0 ? (
                        <span
                          className={
                            showTimeField === "production"
                              ? "text-green-600 dark:text-green-400"
                              : showTimeField === "utilisation"
                                ? "text-red-600 dark:text-red-400"
                                : "text-blue-600 dark:text-blue-400"
                          }
                        >
                          {showTimeField === "autonomie"
                            ? `${totalValue.toFixed(0)} Wh`
                            : `${totalValue.toFixed(1)} Wh/j`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {isDraft && (
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDraftItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bilan Énergétique</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bilan Énergétique</CardTitle>
          <CardDescription>Analyse de votre installation électrique 12V</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="real">Bilan Réel</TabsTrigger>
              <TabsTrigger value="draft">
                Brouillon
                {draftItems.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                    {draftItems.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ONGLET BILAN RÉEL */}
            <TabsContent value="real" className="space-y-6 mt-6">
              {items.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucun équipement électrique trouvé dans les dépenses. Ajoutez des équipements avec un type
                    électrique pour voir le bilan énergétique.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {renderSummaryCards(items)}
                  <Separator />
                  {renderAutonomyCard(items)}
                  {renderAutonomyCard(items) && <Separator />}
                  <div className="space-y-6">
                    {renderItemsTable(
                      categorizeItems(items).producers,
                      "Producteurs d'énergie",
                      <TrendingUp className="h-5 w-5 text-green-600" />,
                      "production",
                    )}
                    {renderItemsTable(
                      categorizeItems(items).consumers,
                      "Consommateurs d'énergie",
                      <Zap className="h-5 w-5 text-red-600" />,
                      "utilisation",
                    )}
                    {renderItemsTable(
                      categorizeItems(items).storage,
                      "Systèmes de stockage",
                      <Battery className="h-5 w-5 text-blue-600" />,
                      "autonomie",
                    )}
                    {renderItemsTable(
                      categorizeItems(items).converters,
                      "Convertisseurs",
                      <Zap className="h-5 w-5 text-purple-600" />,
                      null,
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ONGLET BROUILLON */}
            <TabsContent value="draft" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Faites des simulations sans modifier le bilan réel</p>
                <div className="flex gap-2">
                  <Button onClick={() => setAddAccessoryDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un accessoire
                  </Button>
                  {selectedDraftItems.size > 0 && (
                    <Button onClick={() => setTransferDialogOpen(true)} variant="default" size="sm">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Transférer ({selectedDraftItems.size})
                    </Button>
                  )}
                </div>
              </div>

              {draftItems.length === 0 ? (
                <Alert>
                  <ShoppingCart className="h-4 w-4" />
                  <AlertDescription>
                    Aucun accessoire dans le brouillon. Cliquez sur "Ajouter un accessoire" pour commencer.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {renderSummaryCards(draftItems as ElectricalItem[])}
                  <Separator />
                  {renderAutonomyCard(draftItems as ElectricalItem[])}
                  {renderAutonomyCard(draftItems as ElectricalItem[]) && <Separator />}
                  <div className="space-y-6">
                    {renderItemsTable(
                      (draftItems as ElectricalItem[]).filter((i) => i.type_electrique === "producteur"),
                      "Producteurs d'énergie",
                      <TrendingUp className="h-5 w-5 text-green-600" />,
                      "production",
                      true,
                    )}
                    {renderItemsTable(
                      (draftItems as ElectricalItem[]).filter((i) => i.type_electrique === "consommateur"),
                      "Consommateurs d'énergie",
                      <Zap className="h-5 w-5 text-red-600" />,
                      "utilisation",
                      true,
                    )}
                    {renderItemsTable(
                      (draftItems as ElectricalItem[]).filter((i) => i.type_electrique === "stockage"),
                      "Systèmes de stockage",
                      <Battery className="h-5 w-5 text-blue-600" />,
                      "autonomie",
                      true,
                    )}
                    {renderItemsTable(
                      (draftItems as ElectricalItem[]).filter((i) => i.type_electrique === "convertisseur"),
                      "Convertisseurs",
                      <Zap className="h-5 w-5 text-purple-600" />,
                      null,
                      true,
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog pour ajouter un accessoire */}
      <Dialog open={addAccessoryDialogOpen} onOpenChange={setAddAccessoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un accessoire au brouillon</DialogTitle>
            <DialogDescription>Sélectionnez un accessoire électrique depuis le catalogue</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value);
                  setSelectedAccessory(null);
                  loadAccessoriesByCategory(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCategory && (
              <div className="space-y-2">
                <Label>Accessoire</Label>
                <Select
                  value={selectedAccessory?.id || ""}
                  onValueChange={(value) => {
                    const acc = accessories.find((a) => a.id === value);
                    setSelectedAccessory(acc || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un accessoire" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {accessories.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Aucun accessoire électrique dans cette catégorie
                      </div>
                    ) : (
                      accessories.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{acc.nom}</span>
                            <span className="text-xs text-muted-foreground">
                              {acc.marque && `${acc.marque} • `}
                              {acc.puissance_watts && `${acc.puissance_watts}W • `}
                              Type: {acc.type_electrique}
                              {acc.prix_vente_ttc && ` • ${acc.prix_vente_ttc.toFixed(2)}€`}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedAccessory && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedAccessory.nom}</strong>
                  <br />
                  Type: {selectedAccessory.type_electrique}
                  {selectedAccessory.puissance_watts && ` • Puissance: ${selectedAccessory.puissance_watts}W`}
                  {selectedAccessory.prix_vente_ttc && ` • Prix: ${selectedAccessory.prix_vente_ttc.toFixed(2)}€`}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAddAccessoryDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleAddAccessoryToDraft} disabled={!selectedAccessory}>
                Ajouter au brouillon
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de transfert */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transférer vers le bilan réel</DialogTitle>
            <DialogDescription>
              Les {selectedDraftItems.size} élément(s) sélectionné(s) seront ajoutés au bilan énergétique réel et à la
              liste des dépenses du projet.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Cette action est irréversible. Les éléments seront supprimés du brouillon et ajoutés au projet.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleTransferToReal}>Confirmer le transfert</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
