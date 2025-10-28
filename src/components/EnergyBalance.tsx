import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Battery, Zap, TrendingUp, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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
}

interface EnergyBalanceProps {
  projectId: string;
  refreshTrigger?: number;
}

export const EnergyBalance = ({ projectId, refreshTrigger }: EnergyBalanceProps) => {
  const [items, setItems] = useState<ElectricalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadElectricalItems();
  }, [projectId, refreshTrigger]);

  const loadElectricalItems = async () => {
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

  const categorizeItems = () => {
    const producers = items.filter((item) => item.type_electrique === "producteur");
    const consumers = items.filter((item) => item.type_electrique === "consommateur");
    const storage = items.filter((item) => item.type_electrique === "stockage");
    const converters = items.filter((item) => item.type_electrique === "convertisseur");

    return { producers, consumers, storage, converters };
  };

  const { producers, consumers, storage, converters } = categorizeItems();

  // Calculate total consumption in Wh/day
  const calculateTotalConsumption = () => {
    return consumers.reduce((total, item) => {
      const power = item.puissance_watts || 0;
      const usageTime = item.temps_utilisation_heures || 0;
      const quantity = item.quantite || 1;
      return total + (power * usageTime * quantity);
    }, 0);
  };

  // Calculate total battery capacity in Wh
  const calculateBatteryCapacity = () => {
    return storage.reduce((total, item) => {
      const power = item.puissance_watts || 0;
      const autonomy = item.temps_production_heures || 0; // temps_production_heures stores autonomy for batteries
      const quantity = item.quantite || 1;
      return total + (power * autonomy * quantity);
    }, 0);
  };

  // Calculate total daily usage hours
  const calculateTotalUsageHours = () => {
    return consumers.reduce((total, item) => {
      const usageTime = item.temps_utilisation_heures || 0;
      return total + usageTime;
    }, 0);
  };

  // Calculate remaining autonomy in days
  const calculateRemainingAutonomy = () => {
    const totalConsumption = calculateTotalConsumption();
    const batteryCapacity = calculateBatteryCapacity();
    
    if (totalConsumption === 0) return null;
    
    // Autonomy in days = battery capacity (Wh) / daily consumption (Wh/day)
    return batteryCapacity / totalConsumption;
  };

  const totalConsumption = calculateTotalConsumption();
  const batteryCapacity = calculateBatteryCapacity();
  const remainingAutonomy = calculateRemainingAutonomy();
  const totalUsageHours = calculateTotalUsageHours();
  const cumulativeUsageHours = remainingAutonomy ? remainingAutonomy * totalUsageHours : null;

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

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bilan Énergétique</CardTitle>
          <CardDescription>Analyse de votre installation électrique 12V</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucun équipement électrique trouvé dans les dépenses.
              Ajoutez des équipements avec un type électrique (producteur, consommateur, stockage, convertisseur) pour voir le bilan énergétique.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleTimeUpdate = async (itemId: string, field: 'temps_utilisation_heures' | 'temps_production_heures', value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    
    // Pour l'autonomie (stockage), pas de limite de 24h
    const item = items.find(i => i.id === itemId);
    if (numValue !== null && numValue < 0) {
      toast.error("La valeur doit être positive");
      return;
    }
    
    if (numValue !== null && item?.type_electrique !== 'stockage' && numValue > 24) {
      toast.error("Le temps doit être entre 0 et 24 heures");
      return;
    }

    const { error } = await supabase
      .from("project_expenses")
      .update({ [field]: numValue })
      .eq("id", itemId);

    if (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(item?.type_electrique === 'stockage' ? "Autonomie mise à jour" : "Temps mis à jour");
      loadElectricalItems();
    }
  };

  const renderItemsTable = (itemsList: ElectricalItem[], title: string, icon: React.ReactNode, showTimeField: 'production' | 'utilisation' | 'autonomie' | null) => {
    if (itemsList.length === 0) return null;

    const getTimeLabel = () => {
      switch (showTimeField) {
        case 'production':
          return 'Temps de production (h/24h)';
        case 'utilisation':
          return "Temps d'utilisation (h/24h)";
        case 'autonomie':
          return "Durée d'autonomie (h)";
        default:
          return '';
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
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                {showTimeField && (
                  <TableHead className="text-right">
                    {getTimeLabel()}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsList.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nom_accessoire}</TableCell>
                  <TableCell className="text-right">{item.quantite}</TableCell>
                  {showTimeField && (
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        max={showTimeField === 'autonomie' ? undefined : 24}
                        step="0.5"
                        placeholder={showTimeField === 'autonomie' ? '0h' : '0-24h'}
                        value={showTimeField === 'utilisation' 
                          ? (item.temps_utilisation_heures ?? '') 
                          : (item.temps_production_heures ?? '')}
                        onChange={(e) => handleTimeUpdate(
                          item.id,
                          showTimeField === 'utilisation' ? 'temps_utilisation_heures' : 'temps_production_heures',
                          e.target.value
                        )}
                        className="w-24 ml-auto"
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bilan Énergétique</CardTitle>
        <CardDescription>
          Inventaire des équipements électriques du projet (12V)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                Producteurs
              </CardTitle>
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
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                Consommateurs
              </CardTitle>
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
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Stockage
              </CardTitle>
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
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">
                Convertisseurs
              </CardTitle>
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

        <Separator />

        {storage.length > 0 && totalConsumption > 0 && (
          <>
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Battery className="h-5 w-5 text-blue-600" />
                  Autonomie Restante
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Consommation quotidienne</div>
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">
                      {totalConsumption.toFixed(1)} Wh/jour
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Capacité batterie</div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {batteryCapacity.toFixed(1)} Wh
                    </div>
                  </div>
                </div>
                
                {remainingAutonomy !== null && (
                  <div className="pt-3 border-t">
                    <div className="text-sm text-muted-foreground mb-1">Autonomie estimée</div>
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {remainingAutonomy.toFixed(1)} jours
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Basée sur votre consommation quotidienne réelle
                      {cumulativeUsageHours !== null && totalUsageHours > 0 && (
                        <> · Durée cumulée : {cumulativeUsageHours.toFixed(1)}h d'utilisation</>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Separator />
          </>
        )}

        <div className="space-y-6">
          {renderItemsTable(
            producers,
            "Producteurs d'énergie",
            <TrendingUp className="h-5 w-5 text-green-600" />,
            'production'
          )}
          {renderItemsTable(
            consumers,
            "Consommateurs d'énergie",
            <Zap className="h-5 w-5 text-red-600" />,
            'utilisation'
          )}
          {renderItemsTable(
            storage,
            "Systèmes de stockage",
            <Battery className="h-5 w-5 text-blue-600" />,
            null
          )}
          {renderItemsTable(
            converters,
            "Convertisseurs",
            <Zap className="h-5 w-5 text-purple-600" />,
            null
          )}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Note :</strong> Pour calculer l'autonomie restante, ajoutez la puissance (W) de chaque équipement.
            L'autonomie est calculée en fonction de la consommation totale et de la capacité des batteries.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
