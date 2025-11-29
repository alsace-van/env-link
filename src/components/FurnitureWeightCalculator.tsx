import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Scale, Copy, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface WoodEntry {
  id: string;
  plywoodType: string;
  customName: string;
  customDensity: number;
  thickness: number;
  customThickness: number;
  surfaceM2: number;
}

interface HardwareEntry {
  id: string;
  type: string;
  quantity: number;
}

interface FurnitureColumn {
  id: string;
  name: string;
  woodEntries: WoodEntry[];
  hardware: HardwareEntry[];
}

interface CustomWoodType {
  id: string;
  name: string;
  density: number;
}

interface CustomHardwareType {
  id: string;
  name: string;
  weight: number;
}

// Types de contreplaqué par défaut avec leur masse volumique (kg/m³)
const defaultPlywoodTypes = [
  { id: "peuplier", name: "Peuplier", density: 450 },
  { id: "okoume", name: "Okoumé", density: 500 },
  { id: "pin", name: "Pin Maritime", density: 600 },
  { id: "bouleau", name: "Bouleau", density: 680 },
  { id: "eucalyptus", name: "Eucalyptus filmé", density: 700 },
];

// Épaisseurs standards (mm)
const standardThicknesses = [3, 5, 6, 8, 9, 10, 12, 15, 18, 21, 24, 27, 30];

// Quincaillerie par défaut avec poids approximatifs (grammes)
const defaultHardwareTypes = [
  { id: "coulisse_300", name: "Coulisse 300mm", weight: 300 },
  { id: "coulisse_400", name: "Coulisse 400mm", weight: 400 },
  { id: "coulisse_500", name: "Coulisse 500mm", weight: 500 },
  { id: "coulisse_heavy", name: "Coulisse lourde", weight: 800 },
  { id: "charniere_35", name: "Charnière 35mm", weight: 50 },
  { id: "charniere_soft", name: "Charnière soft", weight: 80 },
  { id: "charniere_piano", name: "Piano /m", weight: 400 },
  { id: "compas", name: "Compas abattant", weight: 200 },
  { id: "verin", name: "Vérin gaz", weight: 150 },
  { id: "serrure", name: "Push-lock", weight: 30 },
  { id: "loqueteau", name: "Loqueteau", weight: 20 },
  { id: "pied", name: "Pied réglable", weight: 100 },
  { id: "equerre", name: "Équerre", weight: 50 },
];

const WOOD_STORAGE_KEY = "furniture_custom_wood_types";
const HARDWARE_STORAGE_KEY = "furniture_custom_hardware_types";

const createDefaultColumn = (): FurnitureColumn => ({
  id: Date.now().toString(),
  name: "Meuble",
  woodEntries: [
    {
      id: "1",
      plywoodType: "okoume",
      customName: "",
      customDensity: 500,
      thickness: 15,
      customThickness: 15,
      surfaceM2: 0,
    },
  ],
  hardware: [],
});

export const FurnitureWeightCalculator = () => {
  const [columns, setColumns] = useState<FurnitureColumn[]>([createDefaultColumn()]);
  const [customWoodTypes, setCustomWoodTypes] = useState<CustomWoodType[]>([]);
  const [customHardwareTypes, setCustomHardwareTypes] = useState<CustomHardwareType[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"wood" | "hardware">("wood");
  const [newWoodName, setNewWoodName] = useState("");
  const [newWoodDensity, setNewWoodDensity] = useState(500);
  const [newHardwareName, setNewHardwareName] = useState("");
  const [newHardwareWeight, setNewHardwareWeight] = useState(100);

  // Charger les données personnalisées au démarrage
  useEffect(() => {
    const savedWood = localStorage.getItem(WOOD_STORAGE_KEY);
    if (savedWood) {
      try {
        setCustomWoodTypes(JSON.parse(savedWood));
      } catch (e) {
        console.error("Erreur chargement essences:", e);
      }
    }
    const savedHardware = localStorage.getItem(HARDWARE_STORAGE_KEY);
    if (savedHardware) {
      try {
        setCustomHardwareTypes(JSON.parse(savedHardware));
      } catch (e) {
        console.error("Erreur chargement quincaillerie:", e);
      }
    }
  }, []);

  // Sauvegarder les essences personnalisées
  useEffect(() => {
    localStorage.setItem(WOOD_STORAGE_KEY, JSON.stringify(customWoodTypes));
  }, [customWoodTypes]);

  // Sauvegarder la quincaillerie personnalisée
  useEffect(() => {
    localStorage.setItem(HARDWARE_STORAGE_KEY, JSON.stringify(customHardwareTypes));
  }, [customHardwareTypes]);

  // Liste complète des essences (défaut + personnalisées)
  const allWoodTypes = [
    ...defaultPlywoodTypes,
    ...customWoodTypes.map((c) => ({ id: `custom_${c.id}`, name: c.name, density: c.density })),
  ];

  // Liste complète de la quincaillerie (défaut + personnalisée)
  const allHardwareTypes = [
    ...defaultHardwareTypes,
    ...customHardwareTypes.map((c) => ({ id: `custom_${c.id}`, name: c.name, weight: c.weight })),
  ];

  const addCustomWoodType = () => {
    if (!newWoodName.trim()) {
      toast.error("Veuillez entrer un nom d'essence");
      return;
    }
    if (newWoodDensity <= 0) {
      toast.error("La densité doit être supérieure à 0");
      return;
    }

    const newType: CustomWoodType = {
      id: Date.now().toString(),
      name: newWoodName.trim(),
      density: newWoodDensity,
    };

    setCustomWoodTypes([...customWoodTypes, newType]);
    setNewWoodName("");
    setNewWoodDensity(500);
    toast.success(`Essence "${newType.name}" ajoutée`);
  };

  const removeCustomWoodType = (id: string) => {
    setCustomWoodTypes(customWoodTypes.filter((c) => c.id !== id));
    toast.success("Essence supprimée");
  };

  const addCustomHardwareType = () => {
    if (!newHardwareName.trim()) {
      toast.error("Veuillez entrer un nom");
      return;
    }
    if (newHardwareWeight <= 0) {
      toast.error("Le poids doit être supérieur à 0");
      return;
    }

    const newType: CustomHardwareType = {
      id: Date.now().toString(),
      name: newHardwareName.trim(),
      weight: newHardwareWeight,
    };

    setCustomHardwareTypes([...customHardwareTypes, newType]);
    setNewHardwareName("");
    setNewHardwareWeight(100);
    toast.success(`"${newType.name}" ajouté`);
  };

  const removeCustomHardwareType = (id: string) => {
    setCustomHardwareTypes(customHardwareTypes.filter((c) => c.id !== id));
    toast.success("Élément supprimé");
  };

  const calculateWoodWeight = (entries: WoodEntry[]) => {
    return entries.reduce((total, entry) => {
      const selectedPlywood = allWoodTypes.find((p) => p.id === entry.plywoodType);
      const density = selectedPlywood?.density || 500;
      const thickness = entry.thickness === -1 ? entry.customThickness : entry.thickness;
      return total + entry.surfaceM2 * (thickness / 1000) * density;
    }, 0);
  };

  const calculateHardwareWeight = (hardware: HardwareEntry[]) => {
    return hardware.reduce((total, h) => {
      const hwType = allHardwareTypes.find((t) => t.id === h.type);
      return total + ((hwType?.weight || 0) * h.quantity) / 1000;
    }, 0);
  };

  const addColumn = () => {
    const newCol = createDefaultColumn();
    newCol.name = `Meuble ${columns.length + 1}`;
    setColumns([...columns, newCol]);
  };

  const duplicateColumn = (colId: string) => {
    const col = columns.find((c) => c.id === colId);
    if (col) {
      const newCol: FurnitureColumn = {
        ...col,
        id: Date.now().toString(),
        name: `${col.name} (copie)`,
        woodEntries: col.woodEntries.map((w) => ({ ...w, id: Date.now().toString() + Math.random() })),
        hardware: col.hardware.map((h) => ({ ...h, id: Date.now().toString() + Math.random() })),
      };
      setColumns([...columns, newCol]);
    }
  };

  const removeColumn = (colId: string) => {
    if (columns.length > 1) {
      setColumns(columns.filter((c) => c.id !== colId));
    }
  };

  const updateColumn = (colId: string, field: keyof FurnitureColumn, value: any) => {
    setColumns(columns.map((c) => (c.id === colId ? { ...c, [field]: value } : c)));
  };

  const addWoodEntry = (colId: string) => {
    setColumns(
      columns.map((c) => {
        if (c.id === colId) {
          return {
            ...c,
            woodEntries: [
              ...c.woodEntries,
              {
                id: Date.now().toString(),
                plywoodType: "okoume",
                customName: "",
                customDensity: 500,
                thickness: 15,
                customThickness: 15,
                surfaceM2: 0,
              },
            ],
          };
        }
        return c;
      }),
    );
  };

  const removeWoodEntry = (colId: string, entryId: string) => {
    setColumns(
      columns.map((c) => {
        if (c.id === colId && c.woodEntries.length > 1) {
          return { ...c, woodEntries: c.woodEntries.filter((w) => w.id !== entryId) };
        }
        return c;
      }),
    );
  };

  const updateWoodEntry = (colId: string, entryId: string, field: keyof WoodEntry, value: any) => {
    setColumns(
      columns.map((c) => {
        if (c.id === colId) {
          return {
            ...c,
            woodEntries: c.woodEntries.map((w) => (w.id === entryId ? { ...w, [field]: value } : w)),
          };
        }
        return c;
      }),
    );
  };

  const addHardware = (colId: string) => {
    setColumns(
      columns.map((c) => {
        if (c.id === colId) {
          return {
            ...c,
            hardware: [...c.hardware, { id: Date.now().toString(), type: "coulisse_400", quantity: 1 }],
          };
        }
        return c;
      }),
    );
  };

  const removeHardware = (colId: string, hwId: string) => {
    setColumns(
      columns.map((c) => {
        if (c.id === colId) {
          return { ...c, hardware: c.hardware.filter((h) => h.id !== hwId) };
        }
        return c;
      }),
    );
  };

  const updateHardware = (colId: string, hwId: string, field: keyof HardwareEntry, value: any) => {
    setColumns(
      columns.map((c) => {
        if (c.id === colId) {
          return {
            ...c,
            hardware: c.hardware.map((h) => (h.id === hwId ? { ...h, [field]: value } : h)),
          };
        }
        return c;
      }),
    );
  };

  const totalAllColumns = columns.reduce((total, col) => {
    return total + calculateWoodWeight(col.woodEntries) + calculateHardwareWeight(col.hardware);
  }, 0);

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Calculateur de poids</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettingsDialog(true)}>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gérer bois et quincaillerie</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter un meuble
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((col) => {
            const woodWeight = calculateWoodWeight(col.woodEntries);
            const hwWeight = calculateHardwareWeight(col.hardware);
            const colTotal = woodWeight + hwWeight;

            return (
              <div
                key={col.id}
                className="min-w-[280px] max-w-[320px] flex-shrink-0 border rounded-lg p-3 bg-muted/30 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  <Input
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, "name", e.target.value)}
                    className="h-8 text-sm font-semibold"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateColumn(col.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Dupliquer</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {columns.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeColumn(col.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Bois */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">BOIS</Label>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addWoodEntry(col.id)}>
                      <Plus className="h-3 w-3 mr-1" />
                    </Button>
                  </div>

                  {col.woodEntries.map((entry, idx) => (
                    <div key={entry.id} className="space-y-1 p-2 bg-background rounded border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Panneau {idx + 1}</span>
                        {col.woodEntries.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => removeWoodEntry(col.id, entry.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <Select
                        value={entry.plywoodType}
                        onValueChange={(v) => updateWoodEntry(col.id, entry.id, "plywoodType", v)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allWoodTypes.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.name} ({p.density} kg/m³)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="grid grid-cols-2 gap-1">
                        <Select
                          value={entry.thickness.toString()}
                          onValueChange={(v) => updateWoodEntry(col.id, entry.id, "thickness", Number(v))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {standardThicknesses.map((t) => (
                              <SelectItem key={t} value={t.toString()} className="text-xs">
                                {t}mm
                              </SelectItem>
                            ))}
                            <SelectItem value="-1" className="text-xs">
                              Autre
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {entry.thickness === -1 ? (
                          <Input
                            type="number"
                            value={entry.customThickness}
                            onChange={(e) =>
                              updateWoodEntry(col.id, entry.id, "customThickness", Number(e.target.value))
                            }
                            placeholder="mm"
                            className="h-7 text-xs"
                          />
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            value={entry.surfaceM2 || ""}
                            onChange={(e) => updateWoodEntry(col.id, entry.id, "surfaceM2", Number(e.target.value))}
                            placeholder="m²"
                            className="h-7 text-xs"
                          />
                        )}
                      </div>

                      {entry.thickness === -1 && (
                        <Input
                          type="number"
                          step="0.01"
                          value={entry.surfaceM2 || ""}
                          onChange={(e) => updateWoodEntry(col.id, entry.id, "surfaceM2", Number(e.target.value))}
                          placeholder="Surface m²"
                          className="h-7 text-xs"
                        />
                      )}
                    </div>
                  ))}

                  {woodWeight > 0 && (
                    <div className="text-xs text-right text-blue-600 font-medium">Bois: {woodWeight.toFixed(2)} kg</div>
                  )}
                </div>

                {/* Quincaillerie */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">QUINCAILLERIE</Label>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addHardware(col.id)}>
                      <Plus className="h-3 w-3 mr-1" />
                    </Button>
                  </div>

                  {col.hardware.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-1">-</p>
                  ) : (
                    col.hardware.map((h) => (
                      <div key={h.id} className="flex items-center gap-1">
                        <Select value={h.type} onValueChange={(v) => updateHardware(col.id, h.id, "type", v)}>
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allHardwareTypes.map((t) => (
                              <SelectItem key={t.id} value={t.id} className="text-xs">
                                {t.name} ({t.weight}g)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="1"
                          value={h.quantity}
                          onChange={(e) => updateHardware(col.id, h.id, "quantity", Number(e.target.value))}
                          className="h-7 w-12 text-xs text-center"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeHardware(col.id, h.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}

                  {hwWeight > 0 && (
                    <div className="text-xs text-right text-orange-600 font-medium">
                      Quincaillerie: {hwWeight.toFixed(2)} kg
                    </div>
                  )}
                </div>

                {/* Total colonne */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <Badge variant="default" className="text-sm">
                      {colTotal.toFixed(2)} kg
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total global */}
        {columns.length > 1 && (
          <div className="mt-4 p-3 rounded-lg border-2 border-primary bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                <span className="font-semibold">Total tous meubles</span>
              </div>
              <span className="text-2xl font-bold text-primary">{totalAllColumns.toFixed(2)} kg</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Dialog pour gérer bois et quincaillerie */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Paramètres du calculateur</DialogTitle>
            <DialogDescription>Gérez vos essences de bois et quincaillerie personnalisées</DialogDescription>
          </DialogHeader>

          {/* Onglets */}
          <div className="flex gap-2 border-b pb-2">
            <Button
              variant={settingsTab === "wood" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSettingsTab("wood")}
            >
              🪵 Essences de bois
            </Button>
            <Button
              variant={settingsTab === "hardware" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSettingsTab("hardware")}
            >
              🔩 Quincaillerie
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* ONGLET BOIS */}
            {settingsTab === "wood" && (
              <>
                {/* Liste des essences par défaut */}
                <div>
                  <Label className="text-xs text-muted-foreground">Essences par défaut</Label>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {defaultPlywoodTypes.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-sm py-1 px-2 bg-muted/50 rounded"
                      >
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">{p.density} kg/m³</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Liste des essences personnalisées */}
                {customWoodTypes.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Vos essences personnalisées</Label>
                    <div className="mt-2 space-y-1">
                      {customWoodTypes.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-sm py-1 px-2 bg-blue-50 dark:bg-blue-950 rounded"
                        >
                          <span>{p.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{p.density} kg/m³</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeCustomWoodType(p.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulaire d'ajout bois */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Ajouter une nouvelle essence</Label>
                  <div className="mt-2 grid grid-cols-[1fr,100px,auto] gap-2">
                    <Input
                      value={newWoodName}
                      onChange={(e) => setNewWoodName(e.target.value)}
                      placeholder="Nom (ex: Chêne, MDF...)"
                      className="h-9"
                    />
                    <Input
                      type="number"
                      value={newWoodDensity}
                      onChange={(e) => setNewWoodDensity(Number(e.target.value))}
                      placeholder="kg/m³"
                      className="h-9"
                    />
                    <Button onClick={addCustomWoodType} size="sm" className="h-9">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Densité en kg/m³ (ex: MDF≈750, Chêne≈700, Frêne≈650)
                  </p>
                </div>
              </>
            )}

            {/* ONGLET QUINCAILLERIE */}
            {settingsTab === "hardware" && (
              <>
                {/* Liste quincaillerie par défaut */}
                <div>
                  <Label className="text-xs text-muted-foreground">Quincaillerie par défaut</Label>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {defaultHardwareTypes.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between text-sm py-1 px-2 bg-muted/50 rounded"
                      >
                        <span>{h.name}</span>
                        <span className="text-muted-foreground">{h.weight} g</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Liste quincaillerie personnalisée */}
                {customHardwareTypes.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Votre quincaillerie personnalisée</Label>
                    <div className="mt-2 space-y-1">
                      {customHardwareTypes.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between text-sm py-1 px-2 bg-orange-50 dark:bg-orange-950 rounded"
                        >
                          <span>{h.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{h.weight} g</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeCustomHardwareType(h.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulaire d'ajout quincaillerie */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Ajouter une quincaillerie</Label>
                  <div className="mt-2 grid grid-cols-[1fr,80px,auto] gap-2">
                    <Input
                      value={newHardwareName}
                      onChange={(e) => setNewHardwareName(e.target.value)}
                      placeholder="Nom (ex: Poignée inox...)"
                      className="h-9"
                    />
                    <Input
                      type="number"
                      value={newHardwareWeight}
                      onChange={(e) => setNewHardwareWeight(Number(e.target.value))}
                      placeholder="g"
                      className="h-9"
                    />
                    <Button onClick={addCustomHardwareType} size="sm" className="h-9">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Poids en grammes (ex: Poignée≈150g, Vis lot≈50g)</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
