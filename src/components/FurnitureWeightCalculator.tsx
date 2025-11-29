import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Scale, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Hardware {
  id: string;
  type: string;
  quantity: number;
}

interface WoodEntry {
  id: string;
  plywoodType: string;
  customName: string;
  customDensity: number;
  thickness: number;
  customThickness: number;
  surfaceM2: number;
}

// Types de contreplaqué avec leur masse volumique (kg/m³)
const plywoodTypes = [
  { id: "peuplier", name: "Peuplier", density: 450, description: "Léger, économique, bon pour meubles intérieurs" },
  { id: "okoume", name: "Okoumé", density: 500, description: "Bon compromis poids/résistance, idéal pour vans" },
  { id: "pin", name: "Pin Maritime", density: 600, description: "Résistant, utilisé en construction" },
  { id: "bouleau", name: "Bouleau", density: 680, description: "Très résistant, finition qualitative, plus lourd" },
  {
    id: "eucalyptus",
    name: "Eucalyptus filmé",
    density: 700,
    description: "Très dur, résistant à l'humidité, coffrage",
  },
  { id: "custom", name: "🔧 Personnalisé...", density: 0, description: "Définir manuellement" },
];

// Épaisseurs standards (mm)
const standardThicknesses = [3, 5, 6, 8, 9, 10, 12, 15, 18, 21, 24, 27, 30];

// Quincaillerie avec poids approximatifs (grammes)
const hardwareTypes = [
  { id: "coulisse_250", name: "Coulisse tiroir 250mm (paire)", weight: 250 },
  { id: "coulisse_300", name: "Coulisse tiroir 300mm (paire)", weight: 300 },
  { id: "coulisse_350", name: "Coulisse tiroir 350mm (paire)", weight: 350 },
  { id: "coulisse_400", name: "Coulisse tiroir 400mm (paire)", weight: 400 },
  { id: "coulisse_450", name: "Coulisse tiroir 450mm (paire)", weight: 450 },
  { id: "coulisse_500", name: "Coulisse tiroir 500mm (paire)", weight: 500 },
  { id: "coulisse_heavy", name: "Coulisse charge lourde (paire)", weight: 800 },
  { id: "charniere_35", name: "Charnière 35mm standard", weight: 50 },
  { id: "charniere_soft", name: "Charnière soft-close", weight: 80 },
  { id: "charniere_piano", name: "Charnière piano (par mètre)", weight: 400 },
  { id: "compas_abattant", name: "Compas pour abattant (paire)", weight: 200 },
  { id: "verin_gaz", name: "Vérin à gaz", weight: 150 },
  { id: "serrure_push", name: "Serrure push-lock", weight: 30 },
  { id: "loqueteau", name: "Loqueteau magnétique", weight: 20 },
  { id: "pied_reglable", name: "Pied réglable", weight: 100 },
  { id: "equerre", name: "Équerre de renfort", weight: 50 },
  { id: "tasseaux_ml", name: "Tasseaux (par mètre linéaire)", weight: 200 },
];

export const FurnitureWeightCalculator = () => {
  const [woodEntries, setWoodEntries] = useState<WoodEntry[]>([
    {
      id: "1",
      plywoodType: "okoume",
      customName: "",
      customDensity: 500,
      thickness: 15,
      customThickness: 15,
      surfaceM2: 0,
    },
  ]);
  const [hardware, setHardware] = useState<Hardware[]>([]);

  // Calculer le poids pour une entrée de bois
  const calculateWoodEntryWeight = (entry: WoodEntry) => {
    const selectedPlywood = plywoodTypes.find((p) => p.id === entry.plywoodType);
    const density = entry.plywoodType === "custom" ? entry.customDensity : selectedPlywood?.density || 500;
    const thickness = entry.thickness === -1 ? entry.customThickness : entry.thickness;
    return entry.surfaceM2 * (thickness / 1000) * density;
  };

  // Calcul du poids total du bois en kg
  const woodWeight = woodEntries.reduce((total, entry) => total + calculateWoodEntryWeight(entry), 0);

  // Calcul du poids de la quincaillerie en kg
  const hardwareWeight = hardware.reduce((total, h) => {
    const hwType = hardwareTypes.find((t) => t.id === h.type);
    return total + ((hwType?.weight || 0) * h.quantity) / 1000;
  }, 0);

  // Poids total
  const totalWeight = woodWeight + hardwareWeight;

  const addWoodEntry = () => {
    setWoodEntries([
      ...woodEntries,
      {
        id: Date.now().toString(),
        plywoodType: "okoume",
        customName: "",
        customDensity: 500,
        thickness: 15,
        customThickness: 15,
        surfaceM2: 0,
      },
    ]);
  };

  const removeWoodEntry = (id: string) => {
    if (woodEntries.length > 1) {
      setWoodEntries(woodEntries.filter((w) => w.id !== id));
    }
  };

  const updateWoodEntry = (id: string, field: keyof WoodEntry, value: string | number) => {
    setWoodEntries(woodEntries.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  };

  const addHardware = () => {
    setHardware([...hardware, { id: Date.now().toString(), type: "coulisse_400", quantity: 1 }]);
  };

  const removeHardware = (id: string) => {
    setHardware(hardware.filter((h) => h.id !== id));
  };

  const updateHardware = (id: string, field: "type" | "quantity", value: string | number) => {
    setHardware(hardware.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Calculateur de poids de meuble</CardTitle>
        </div>
        <CardDescription>
          Estimez le poids de vos meubles en fonction du contreplaqué et de la quincaillerie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section Bois */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold">Panneaux de bois</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1 text-xs">
                      {plywoodTypes
                        .filter((p) => p.id !== "custom")
                        .map((p) => (
                          <p key={p.id}>
                            <strong>{p.name}</strong> ({p.density} kg/m³): {p.description}
                          </p>
                        ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button variant="outline" size="sm" onClick={addWoodEntry}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un panneau
            </Button>
          </div>

          <div className="space-y-3">
            {woodEntries.map((entry, index) => {
              const selectedPlywood = plywoodTypes.find((p) => p.id === entry.plywoodType);
              const density = entry.plywoodType === "custom" ? entry.customDensity : selectedPlywood?.density || 500;
              const thickness = entry.thickness === -1 ? entry.customThickness : entry.thickness;
              const entryWeight = calculateWoodEntryWeight(entry);

              return (
                <div key={entry.id} className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Panneau {index + 1}</span>
                    <div className="flex items-center gap-2">
                      {entry.surfaceM2 > 0 && <Badge variant="secondary">{entryWeight.toFixed(2)} kg</Badge>}
                      {woodEntries.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeWoodEntry(entry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Type de bois */}
                    <div className="space-y-1">
                      <Label className="text-xs">Essence</Label>
                      <Select
                        value={entry.plywoodType}
                        onValueChange={(v) => updateWoodEntry(entry.id, "plywoodType", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {plywoodTypes.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.density > 0 && `(${p.density} kg/m³)`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Champs personnalisés si essence custom */}
                    {entry.plywoodType === "custom" && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Nom de l'essence</Label>
                          <Input
                            value={entry.customName}
                            onChange={(e) => updateWoodEntry(entry.id, "customName", e.target.value)}
                            placeholder="Ex: Chêne, MDF..."
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Densité (kg/m³)</Label>
                          <Input
                            type="number"
                            min="100"
                            max="1500"
                            value={entry.customDensity}
                            onChange={(e) => updateWoodEntry(entry.id, "customDensity", Number(e.target.value))}
                            className="h-9"
                          />
                        </div>
                      </>
                    )}

                    {/* Épaisseur */}
                    <div className="space-y-1">
                      <Label className="text-xs">Épaisseur (mm)</Label>
                      <Select
                        value={entry.thickness.toString()}
                        onValueChange={(v) => updateWoodEntry(entry.id, "thickness", Number(v))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {standardThicknesses.map((t) => (
                            <SelectItem key={t} value={t.toString()}>
                              {t} mm
                            </SelectItem>
                          ))}
                          <SelectItem value="-1">🔧 Autre...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Épaisseur personnalisée */}
                    {entry.thickness === -1 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Épaisseur personnalisée (mm)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={entry.customThickness}
                          onChange={(e) => updateWoodEntry(entry.id, "customThickness", Number(e.target.value))}
                          className="h-9"
                        />
                      </div>
                    )}

                    {/* Surface */}
                    <div className="space-y-1">
                      <Label className="text-xs">Surface (m²)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.surfaceM2 || ""}
                        onChange={(e) => updateWoodEntry(entry.id, "surfaceM2", Number(e.target.value))}
                        placeholder="Ex: 1.5"
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Détail du calcul */}
                  {entry.surfaceM2 > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {entry.surfaceM2} m² × {thickness} mm × {density} kg/m³ ={" "}
                      <strong>{entryWeight.toFixed(2)} kg</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total bois */}
          {woodWeight > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Poids total du bois</span>
                <Badge variant="secondary" className="text-lg">
                  {woodWeight.toFixed(2)} kg
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Section Quincaillerie */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Quincaillerie</Label>
            <Button variant="outline" size="sm" onClick={addHardware}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>

          {hardware.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune quincaillerie ajoutée</p>
          ) : (
            <div className="space-y-2">
              {hardware.map((h) => {
                const hwType = hardwareTypes.find((t) => t.id === h.type);
                const itemWeight = ((hwType?.weight || 0) * h.quantity) / 1000;

                return (
                  <div key={h.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Select value={h.type} onValueChange={(v) => updateHardware(h.id, "type", v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hardwareTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.weight}g)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">×</span>
                      <Input
                        type="number"
                        min="1"
                        value={h.quantity}
                        onChange={(e) => updateHardware(h.id, "quantity", Number(e.target.value))}
                        className="w-16 text-center"
                      />
                    </div>
                    <Badge variant="outline" className="min-w-[70px] justify-center">
                      {itemWeight.toFixed(2)} kg
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => removeHardware(h.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {hardware.length > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Poids total quincaillerie</span>
                <Badge variant="secondary" className="text-lg">
                  {hardwareWeight.toFixed(2)} kg
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Résultat Total */}
        <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Poids total estimé</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{totalWeight.toFixed(2)} kg</div>
              <div className="text-xs text-muted-foreground">
                Bois: {woodWeight.toFixed(2)} kg + Quincaillerie: {hardwareWeight.toFixed(2)} kg
              </div>
            </div>
          </div>
        </div>

        {/* Tableau de référence */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-semibold mb-2">Masses volumiques des contreplaqués :</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {plywoodTypes
              .filter((p) => p.id !== "custom")
              .map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.name}:</span>
                  <span className="font-mono">{p.density} kg/m³</span>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
