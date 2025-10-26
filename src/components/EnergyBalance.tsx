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
    
    if (numValue !== null && (numValue < 0 || numValue > 24)) {
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
      toast.success("Temps mis à jour");
      loadElectricalItems();
    }
  };

  const renderItemsTable = (itemsList: ElectricalItem[], title: string, icon: React.ReactNode, showTimeField: 'production' | 'utilisation' | null) => {
    if (itemsList.length === 0) return null;

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
                    Temps {showTimeField === 'production' ? 'de production' : "d'utilisation"} (h/24h)
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
                        max="24"
                        step="0.5"
                        placeholder="0-24h"
                        value={showTimeField === 'production' 
                          ? (item.temps_production_heures ?? '') 
                          : (item.temps_utilisation_heures ?? '')}
                        onChange={(e) => handleTimeUpdate(
                          item.id,
                          showTimeField === 'production' ? 'temps_production_heures' : 'temps_utilisation_heures',
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
            <strong>Note :</strong> Ce bilan liste les équipements électriques présents dans vos dépenses.
            Pour un calcul de consommation détaillé, ajoutez les puissances de chaque équipement dans les propriétés des accessoires.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
