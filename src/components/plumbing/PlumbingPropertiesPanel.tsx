// ============================================
// COMPOSANT: PlumbingPropertiesPanel
// Panneau de propriétés pour élément sélectionné
// VERSION: 1.3 - Sélecteur d'icône et miniature accessoire
// ============================================

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, ChevronDown, ChevronRight, Droplets, Zap, Settings, Package, ShoppingCart, Trash2, Copy, Plug, Smile } from "lucide-react";
import {
  PlumbingBlockData,
  PlumbingEdgeData,
  PlumbingNodeType,
  PlumbingEdgeType,
  PIPE_DIAMETERS,
  CABLE_SECTIONS,
  THREAD_TYPES,
  WATER_COLORS,
  COLORS_12V,
  COLORS_230V,
  CATEGORY_COLORS,
  PipeDiameter,
  CableSection,
  ThreadType,
  WaterType,
  ElectricalType,
  ConnectorConfig,
  getConnectorConfig,
} from "./types";
import { PlumbingConnectorConfigModal } from "./PlumbingConnectorConfigModal";

// Réserve d'icônes disponibles
const AVAILABLE_ICONS = [
  // Eau & Plomberie
  "💧", "🚰", "🚿", "🛁", "🧴", "🪣", "🌊", "💦", "🏊", "🧊",
  // Stockage
  "🛢️", "🗑️", "📦", "🧰", "🗃️", "💼",
  // Électrique
  "⚡", "🔌", "🔋", "💡", "🔦", "🪫", "🔧", "⚙️", "🛠️",
  // Chauffage
  "🔥", "🌡️", "☀️", "❄️", "🌬️", "♨️",
  // Appareils
  "📟", "🖥️", "📱", "🎛️", "📡", "🔊", "📺", "🖨️",
  // Sécurité
  "🔒", "🔓", "🛡️", "🚨", "⚠️", "🚫",
  // Symboles techniques
  "●", "○", "◉", "◎", "⊕", "⊗", "⊤", "◄", "►", "▲", "▼",
  "➕", "➖", "✓", "✗", "★", "☆",
  // Connecteurs
  "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🟧", "🟨", "🟩", "🟦", "🟪",
  // Divers
  "🏠", "🚗", "🚐", "🏕️", "⛺", "🌍", "🔬", "📊", "📈",
  // Cuisine
  "🍽️", "🍳", "🥘", "☕", "🧊",
];

interface PlumbingPropertiesPanelProps {
  selectedNode: PlumbingNodeType | null;
  selectedEdge: PlumbingEdgeType | null;
  onUpdateNode: (nodeId: string, data: Partial<PlumbingBlockData>) => void;
  onUpdateEdge: (edgeId: string, data: Partial<PlumbingEdgeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onAddToQuote: (node: PlumbingNodeType) => void;
  isInQuote: (accessoryId: string) => boolean;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function PlumbingPropertiesPanel({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onDuplicateNode,
  onAddToQuote,
  isInQuote,
  onClose,
  containerRef,
}: PlumbingPropertiesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true,
    connectors: true,
    water: false,
    electrical: false,
    catalog: false,
  });
  const [connectorModalOpen, setConnectorModalOpen] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="w-64 bg-white border-l p-4 flex flex-col items-center justify-center text-gray-500">
        <Settings className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">Sélectionnez un élément pour voir ses propriétés</p>
      </div>
    );
  }

  // Edge properties
  if (selectedEdge) {
    const data = selectedEdge.data;
    const isWater = data?.connectionType === "water";

    return (
      <div className="w-64 bg-white border-l flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            {isWater ? <Droplets className="h-5 w-5 text-blue-500" /> : <Zap className="h-5 w-5 text-yellow-500" />}
            <h3 className="font-medium text-sm">{isWater ? "Tuyau" : "Câble"}</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {isWater && (
              <>
                <div>
                  <Label className="text-xs">Type d'eau</Label>
                  <Select
                    value={data?.waterType || "cold"}
                    onValueChange={(v) => onUpdateEdge(selectedEdge.id, { waterType: v as WaterType })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cold"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: WATER_COLORS.cold }} />Eau froide</div></SelectItem>
                      <SelectItem value="hot"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: WATER_COLORS.hot }} />Eau chaude</div></SelectItem>
                      <SelectItem value="waste"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: WATER_COLORS.waste }} />Eau usée</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Diamètre (mm)</Label>
                  <Select
                    value={data?.pipe_diameter?.toString() || "12"}
                    onValueChange={(v) => onUpdateEdge(selectedEdge.id, { pipe_diameter: Number(v) as PipeDiameter })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PIPE_DIAMETERS.map((d) => <SelectItem key={d} value={d.toString()}>Ø{d} mm</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {!isWater && (
              <>
                <div>
                  <Label className="text-xs">Tension</Label>
                  <Select
                    value={data?.electricalType || "12v"}
                    onValueChange={(v) => onUpdateEdge(selectedEdge.id, { electricalType: v as ElectricalType })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12v">12V DC</SelectItem>
                      <SelectItem value="230v">230V AC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Section câble (mm²)</Label>
                  <Select
                    value={data?.cable_section?.toString() || "1.5"}
                    onValueChange={(v) => onUpdateEdge(selectedEdge.id, { cable_section: Number(v) as CableSection })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CABLE_SECTIONS.map((s) => <SelectItem key={s} value={s.toString()}>{s} mm²</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Label (optionnel)</Label>
              <Input
                value={data?.label || ""}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDeleteEdge(selectedEdge.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Supprimer
          </Button>
        </div>
      </div>
    );
  }

  // Node properties
  if (selectedNode) {
    const data = selectedNode.data;
    const inQuote = data.accessory_id ? isInQuote(data.accessory_id) : false;

    return (
      <div className="w-72 bg-white border-l flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">{data.icon}</span>
            <div>
              <h3 className="font-medium text-sm truncate max-w-[180px]">{data.label}</h3>
              <Badge variant="outline" className="text-[10px] mt-0.5" style={{ borderColor: CATEGORY_COLORS[data.category] }}>
                {data.category}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* Général */}
            <Collapsible open={expandedSections.general}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium" onClick={() => toggleSection("general")}>
                {expandedSections.general ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Settings className="h-4 w-4" />
                Général
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <div>
                  <Label className="text-xs">Nom</Label>
                  <Input value={data.label} onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })} className="h-8 text-sm" />
                </div>
                
                {/* Sélecteur d'icône */}
                <div>
                  <Label className="text-xs">Icône</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-8 justify-start text-sm">
                        <span className="text-xl mr-2">{data.icon}</span>
                        <span className="text-gray-500 text-xs">Changer l'icône</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-2" align="start">
                      <div className="grid grid-cols-10 gap-1">
                        {AVAILABLE_ICONS.map((icon, idx) => (
                          <button
                            key={idx}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-lg ${data.icon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''}`}
                            onClick={() => onUpdateNode(selectedNode.id, { icon })}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Miniature accessoire du catalogue */}
                {data.image_url && (
                  <div>
                    <Label className="text-xs">Image catalogue</Label>
                    <div className="mt-1 rounded border overflow-hidden">
                      <img 
                        src={data.image_url} 
                        alt={data.label}
                        className="w-full h-20 object-contain bg-gray-50"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  </div>
                )}

                {(data.category === "storage" || data.capacity_liters !== undefined) && (
                  <div>
                    <Label className="text-xs">Capacité (L)</Label>
                    <Input type="number" value={data.capacity_liters || ""} onChange={(e) => onUpdateNode(selectedNode.id, { capacity_liters: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-sm" />
                  </div>
                )}
                {(data.category === "source" || data.flow_rate_lpm !== undefined) && (
                  <div>
                    <Label className="text-xs">Débit (L/min)</Label>
                    <Input type="number" value={data.flow_rate_lpm || ""} onChange={(e) => onUpdateNode(selectedNode.id, { flow_rate_lpm: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-sm" />
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Connecteurs - Configuration flexible */}
            <Collapsible open={expandedSections.connectors}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium" onClick={() => toggleSection("connectors")}>
                {expandedSections.connectors ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Plug className="h-4 w-4 text-purple-500" />
                Connecteurs
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {/* Bouton configuration */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-8 text-xs"
                  onClick={() => setConnectorModalOpen(true)}
                >
                  <Settings className="h-3 w-3 mr-2" />
                  Configurer les connecteurs
                </Button>

                {/* Résumé des connecteurs actuels */}
                {(() => {
                  const config = getConnectorConfig(data);
                  return (
                    <div className="space-y-2">
                      {/* Eau */}
                      {config.water.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Droplets className="h-3 w-3 text-blue-500" />
                            Eau ({config.water.length})
                          </Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {config.water.map((conn, idx) => (
                              <Badge 
                                key={idx} 
                                variant="outline" 
                                className="text-[10px]" 
                                style={{ borderColor: WATER_COLORS[conn.waterType] }}
                              >
                                {conn.direction === "in" ? "→" : conn.direction === "out" ? "←" : "↔"} {conn.waterType} ({conn.side[0].toUpperCase()})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Électrique */}
                      {config.electrical.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Zap className="h-3 w-3 text-yellow-500" />
                            Électrique ({config.electrical.length})
                          </Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {config.electrical.map((conn, idx) => (
                              <Badge 
                                key={idx} 
                                variant="outline" 
                                className="text-[10px]"
                                style={{ 
                                  borderColor: conn.type.startsWith("12v") 
                                    ? (conn.type === "12v+" ? "#DC2626" : "#171717")
                                    : (conn.type === "230v-L" ? "#92400E" : conn.type === "230v-N" ? "#1D4ED8" : "#84CC16")
                                }}
                              >
                                {conn.type} ({conn.side[0].toUpperCase()})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {config.water.length === 0 && config.electrical.length === 0 && (
                        <p className="text-xs text-gray-400 italic">Aucun connecteur configuré</p>
                      )}
                    </div>
                  );
                })()}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Plomberie - Propriétés supplémentaires */}
            <Collapsible open={expandedSections.water}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium" onClick={() => toggleSection("water")}>
                {expandedSections.water ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Droplets className="h-4 w-4 text-blue-500" />
                Tuyauterie
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <div>
                  <Label className="text-xs">Diamètre tuyau (mm)</Label>
                  <Select value={data.pipe_diameter?.toString() || "unset"} onValueChange={(v) => onUpdateNode(selectedNode.id, { pipe_diameter: v === "unset" ? undefined : Number(v) as PipeDiameter })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Non défini" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Non défini</SelectItem>
                      {PIPE_DIAMETERS.map((d) => <SelectItem key={d} value={d.toString()}>Ø{d} mm</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Filetage</Label>
                  <Select value={data.thread_type || "none"} onValueChange={(v) => onUpdateNode(selectedNode.id, { thread_type: v as ThreadType })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THREAD_TYPES.map((t) => <SelectItem key={t} value={t}>{t === "none" ? "Aucun" : `${t}"`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Électrique - Propriétés supplémentaires */}
            <Collapsible open={expandedSections.electrical}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium" onClick={() => toggleSection("electrical")}>
                {expandedSections.electrical ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Zap className="h-4 w-4 text-yellow-500" />
                Électrique
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <div>
                  <Label className="text-xs">Puissance (W)</Label>
                  <Input type="number" value={data.power_watts || ""} onChange={(e) => onUpdateNode(selectedNode.id, { power_watts: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Section câble (mm²)</Label>
                  <Select value={data.cable_section?.toString() || "unset"} onValueChange={(v) => onUpdateNode(selectedNode.id, { cable_section: v === "unset" ? undefined : Number(v) as CableSection })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Non défini" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Non défini</SelectItem>
                      {CABLE_SECTIONS.map((s) => <SelectItem key={s} value={s.toString()}>{s} mm²</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Catalogue */}
            {(data.accessory_id || data.marque || data.prix_unitaire) && (
              <>
                <Separator />
                <Collapsible open={expandedSections.catalog}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium" onClick={() => toggleSection("catalog")}>
                    {expandedSections.catalog ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Package className="h-4 w-4 text-purple-500" />
                    Catalogue
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-2">
                    {data.marque && <div className="flex justify-between text-xs"><span className="text-gray-500">Marque</span><span>{data.marque}</span></div>}
                    {data.reference && <div className="flex justify-between text-xs"><span className="text-gray-500">Référence</span><span>{data.reference}</span></div>}
                    {data.prix_unitaire && <div className="flex justify-between text-xs"><span className="text-gray-500">Prix</span><span className="font-medium">{data.prix_unitaire.toFixed(2)}€</span></div>}
                    {data.accessory_id && !inQuote && (
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => onAddToQuote(selectedNode)}>
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Ajouter au devis
                      </Button>
                    )}
                    {inQuote && <Badge className="w-full justify-center bg-green-500">Dans le devis</Badge>}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => onDuplicateNode(selectedNode.id)}>
            <Copy className="h-3 w-3 mr-1" />
            Dupliquer
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDeleteNode(selectedNode.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Modale de configuration des connecteurs */}
        <PlumbingConnectorConfigModal
          open={connectorModalOpen}
          onClose={() => setConnectorModalOpen(false)}
          config={getConnectorConfig(data)}
          nodeLabel={data.label}
          onSave={(newConfig) => {
            onUpdateNode(selectedNode.id, { connectorConfig: newConfig });
          }}
          containerRef={containerRef}
        />
      </div>
    );
  }

  return null;
}

export default PlumbingPropertiesPanel;
