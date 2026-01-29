// ============================================
// COMPOSANT: PlumbingConnectorConfigModal
// Modale de configuration des connecteurs
// VERSION: 1.0
// ============================================

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Droplets, Zap, MoveHorizontal, MoveVertical } from "lucide-react";
import {
  ConnectorConfig,
  WaterConnector,
  ElectricalConnector,
  WaterType,
  ElectricalConnectorType,
  ConnectorSide,
  ConnectorDirection,
  WATER_COLORS,
  WATER_TYPE_LABELS,
  ELECTRICAL_CONNECTOR_LABELS,
  ELECTRICAL_CONNECTOR_COLORS,
  SIDE_LABELS,
  DIRECTION_LABELS,
} from "./types";

interface PlumbingConnectorConfigModalProps {
  open: boolean;
  onClose: () => void;
  config: ConnectorConfig;
  onSave: (config: ConnectorConfig) => void;
  nodeLabel: string;
}

// Générer un ID unique
const generateId = () => `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function PlumbingConnectorConfigModal({
  open,
  onClose,
  config,
  onSave,
  nodeLabel,
}: PlumbingConnectorConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<ConnectorConfig>(config);
  const [activeTab, setActiveTab] = useState<"water" | "electrical">("water");

  // Reset local config when modal opens
  useEffect(() => {
    if (open) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
    }
  }, [open, config]);

  // ============================================
  // HANDLERS EAU
  // ============================================

  const addWaterConnector = () => {
    const newConnector: WaterConnector = {
      id: generateId(),
      waterType: "cold",
      side: "left",
      direction: "in",
    };
    setLocalConfig((prev) => ({
      ...prev,
      water: [...prev.water, newConnector],
    }));
  };

  const updateWaterConnector = (index: number, field: keyof WaterConnector, value: any) => {
    setLocalConfig((prev) => ({
      ...prev,
      water: prev.water.map((conn, i) => (i === index ? { ...conn, [field]: value } : conn)),
    }));
  };

  const removeWaterConnector = (index: number) => {
    setLocalConfig((prev) => ({
      ...prev,
      water: prev.water.filter((_, i) => i !== index),
    }));
  };

  // ============================================
  // HANDLERS ÉLECTRIQUE
  // ============================================

  const addElectricalConnector = () => {
    const newConnector: ElectricalConnector = {
      id: generateId(),
      type: "12v+",
      side: "left",
      direction: "in",
    };
    setLocalConfig((prev) => ({
      ...prev,
      electrical: [...prev.electrical, newConnector],
    }));
  };

  const updateElectricalConnector = (index: number, field: keyof ElectricalConnector, value: any) => {
    setLocalConfig((prev) => ({
      ...prev,
      electrical: prev.electrical.map((conn, i) => (i === index ? { ...conn, [field]: value } : conn)),
    }));
  };

  const removeElectricalConnector = (index: number) => {
    setLocalConfig((prev) => ({
      ...prev,
      electrical: prev.electrical.filter((_, i) => i !== index),
    }));
  };

  // ============================================
  // PRESETS RAPIDES
  // ============================================

  const applyPreset = (preset: string) => {
    switch (preset) {
      case "pump-12v":
        setLocalConfig({
          water: [
            { id: generateId(), waterType: "cold", side: "left", direction: "in" },
            { id: generateId(), waterType: "cold", side: "right", direction: "out" },
          ],
          electrical: [
            { id: generateId(), type: "12v+", side: "bottom", direction: "in" },
            { id: generateId(), type: "12v-", side: "bottom", direction: "in" },
          ],
        });
        break;
      case "heater-230v":
        setLocalConfig({
          water: [
            { id: generateId(), waterType: "cold", side: "left", direction: "in" },
            { id: generateId(), waterType: "hot", side: "right", direction: "out" },
          ],
          electrical: [
            { id: generateId(), type: "230v-L", side: "bottom", direction: "in" },
            { id: generateId(), type: "230v-N", side: "bottom", direction: "in" },
            { id: generateId(), type: "230v-PE", side: "bottom", direction: "in" },
          ],
        });
        break;
      case "tank":
        setLocalConfig({
          water: [
            { id: generateId(), waterType: "cold", side: "top", direction: "in" },
            { id: generateId(), waterType: "cold", side: "bottom", direction: "out" },
          ],
          electrical: [],
        });
        break;
      case "faucet":
        setLocalConfig({
          water: [
            { id: generateId(), waterType: "cold", side: "left", direction: "in" },
            { id: generateId(), waterType: "hot", side: "left", direction: "in" },
            { id: generateId(), waterType: "waste", side: "bottom", direction: "out" },
          ],
          electrical: [],
        });
        break;
      case "tee":
        setLocalConfig({
          water: [
            { id: generateId(), waterType: "cold", side: "left", direction: "bidirectional" },
            { id: generateId(), waterType: "cold", side: "right", direction: "bidirectional" },
            { id: generateId(), waterType: "cold", side: "bottom", direction: "bidirectional" },
          ],
          electrical: [],
        });
        break;
      case "clear":
        setLocalConfig({ water: [], electrical: [] });
        break;
    }
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  // ============================================
  // PREVIEW VISUEL
  // ============================================

  const renderPreview = () => {
    const sides: ConnectorSide[] = ["top", "right", "bottom", "left"];
    const connectorsBySide: Record<ConnectorSide, Array<{ color: string; type: "water" | "electrical"; label: string }>> = {
      top: [],
      right: [],
      bottom: [],
      left: [],
    };

    localConfig.water.forEach((conn) => {
      connectorsBySide[conn.side].push({
        color: WATER_COLORS[conn.waterType],
        type: "water",
        label: `${conn.direction === "in" ? "→" : "←"} ${conn.waterType}`,
      });
    });

    localConfig.electrical.forEach((conn) => {
      connectorsBySide[conn.side].push({
        color: ELECTRICAL_CONNECTOR_COLORS[conn.type],
        type: "electrical",
        label: conn.type,
      });
    });

    return (
      <div className="relative w-32 h-32 mx-auto my-4 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600">
        {/* Label central */}
        <div className="absolute inset-0 flex items-center justify-center text-xs text-center px-2 text-slate-600 dark:text-slate-300">
          {nodeLabel}
        </div>

        {/* Connecteurs par côté */}
        {sides.map((side) => {
          const conns = connectorsBySide[side];
          if (conns.length === 0) return null;

          const isHorizontal = side === "top" || side === "bottom";
          const positionClasses: Record<ConnectorSide, string> = {
            top: "top-0 left-1/2 -translate-x-1/2 -translate-y-full flex-row",
            bottom: "bottom-0 left-1/2 -translate-x-1/2 translate-y-full flex-row",
            left: "left-0 top-1/2 -translate-y-1/2 -translate-x-full flex-col",
            right: "right-0 top-1/2 -translate-y-1/2 translate-x-full flex-col",
          };

          return (
            <div key={side} className={`absolute flex gap-1 ${positionClasses[side]}`}>
              {conns.map((conn, idx) => (
                <div
                  key={idx}
                  className={`${conn.type === "water" ? "w-3 h-3 rounded-full" : "w-2.5 h-2.5 rounded-sm"}`}
                  style={{ backgroundColor: conn.color }}
                  title={conn.label}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⚙️</span>
            Configuration des connecteurs - {nodeLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
          <Label className="text-sm font-medium">Aperçu</Label>
          {renderPreview()}
          <div className="flex justify-center gap-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-400" /> Eau
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-600" /> Électrique
            </span>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          <Label className="w-full text-sm">Presets rapides :</Label>
          <Button variant="outline" size="sm" onClick={() => applyPreset("pump-12v")}>
            Pompe 12V
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("heater-230v")}>
            Chauffe-eau 230V
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("tank")}>
            Réservoir
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("faucet")}>
            Robinet mitigeur
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("tee")}>
            Té
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("clear")}>
            Vider tout
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "water" | "electrical")}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="water" className="flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Eau ({localConfig.water.length})
            </TabsTrigger>
            <TabsTrigger value="electrical" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Électrique ({localConfig.electrical.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Eau */}
          <TabsContent value="water" className="space-y-3">
            {localConfig.water.map((conn, index) => (
              <div key={conn.id} className="flex items-center gap-2 p-2 border rounded-lg bg-white dark:bg-slate-800">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: WATER_COLORS[conn.waterType] }}
                />

                {/* Type d'eau */}
                <Select
                  value={conn.waterType}
                  onValueChange={(v) => updateWaterConnector(index, "waterType", v as WaterType)}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WATER_TYPE_LABELS) as WaterType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {WATER_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Côté */}
                <Select
                  value={conn.side}
                  onValueChange={(v) => updateWaterConnector(index, "side", v as ConnectorSide)}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SIDE_LABELS) as ConnectorSide[]).map((side) => (
                      <SelectItem key={side} value={side}>
                        {SIDE_LABELS[side]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Direction */}
                <Select
                  value={conn.direction}
                  onValueChange={(v) => updateWaterConnector(index, "direction", v as ConnectorDirection)}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DIRECTION_LABELS) as ConnectorDirection[]).map((dir) => (
                      <SelectItem key={dir} value={dir}>
                        {DIRECTION_LABELS[dir]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeWaterConnector(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addWaterConnector} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter connecteur eau
            </Button>
          </TabsContent>

          {/* Tab Électrique */}
          <TabsContent value="electrical" className="space-y-3">
            {localConfig.electrical.map((conn, index) => (
              <div key={conn.id} className="flex items-center gap-2 p-2 border rounded-lg bg-white dark:bg-slate-800">
                <div
                  className="w-4 h-4 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: ELECTRICAL_CONNECTOR_COLORS[conn.type] }}
                />

                {/* Type électrique */}
                <Select
                  value={conn.type}
                  onValueChange={(v) => updateElectricalConnector(index, "type", v as ElectricalConnectorType)}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ELECTRICAL_CONNECTOR_LABELS) as ElectricalConnectorType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {ELECTRICAL_CONNECTOR_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Côté */}
                <Select
                  value={conn.side}
                  onValueChange={(v) => updateElectricalConnector(index, "side", v as ConnectorSide)}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SIDE_LABELS) as ConnectorSide[]).map((side) => (
                      <SelectItem key={side} value={side}>
                        {SIDE_LABELS[side]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Direction */}
                <Select
                  value={conn.direction}
                  onValueChange={(v) => updateElectricalConnector(index, "direction", v as ConnectorDirection)}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DIRECTION_LABELS) as ConnectorDirection[]).map((dir) => (
                      <SelectItem key={dir} value={dir}>
                        {DIRECTION_LABELS[dir]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeElectricalConnector(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addElectricalConnector} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter connecteur électrique
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PlumbingConnectorConfigModal;
