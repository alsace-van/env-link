// ============================================
// SchemaTemplates.tsx
// Composant pour gérer les templates de circuit
// VERSION: 1.0
// ============================================

import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutTemplate,
  Save,
  Download,
  Trash2,
  Globe,
  Lock,
  Search,
  X,
  Loader2,
  ChevronDown,
  Layers,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ElectricalItem {
  id: string;
  nom_accessoire: string;
  type_electrique: string;
  puissance_watts?: number;
  capacite_ah?: number;
}

interface SchemaEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string | null;
  target_handle?: string | null;
  color?: string;
  strokeWidth?: number;
}

interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

interface Position {
  x: number;
  y: number;
}

interface BlockHandles {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TemplateBlock {
  tempId: string;
  type_electrique: string;
  label: string;
  relativePosition: Position;
  handles: BlockHandles;
  layerId?: string;
}

interface TemplateCable {
  sourceTempId: string;
  targetTempId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  color: string;
  strokeWidth?: number;
  layerId?: string;
}

interface TemplateLayer {
  tempId: string;
  name: string;
  color: string;
}

interface SchemaTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  blocks: TemplateBlock[];
  cables: TemplateCable[];
  layers: TemplateLayer[];
  created_at: string;
  updated_at: string;
}

interface MappingItem {
  tempId: string;
  type_electrique: string;
  label: string;
  selectedItemId: string | null;
}

interface SchemaTemplatesProps {
  // Données actuelles du schéma
  items: ElectricalItem[];
  edges: SchemaEdge[];
  layers: Layer[];
  positions: Record<string, Position>;
  nodeHandles: Record<string, BlockHandles>;
  
  // Articles disponibles pour le mapping
  scenarioItems: any[];
  
  // Callbacks
  onInsertTemplate: (
    blocks: Array<{ item: any; position: Position; handles: BlockHandles; layerId: string }>,
    cables: Array<Omit<SchemaEdge, "id">>,
    newLayers: Layer[]
  ) => void;
  
  // État
  isOpen: boolean;
  onClose: () => void;
  mode: "save" | "load";
}

export function SchemaTemplates({
  items,
  edges,
  layers,
  positions,
  nodeHandles,
  scenarioItems,
  onInsertTemplate,
  isOpen,
  onClose,
  mode: initialMode,
}: SchemaTemplatesProps) {
  const [mode, setMode] = useState<"save" | "load">(initialMode);
  const [templates, setTemplates] = useState<SchemaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"mine" | "public">("mine");
  
  // État pour la sauvegarde
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveIsPublic, setSaveIsPublic] = useState(false);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  
  // État pour le chargement/mapping
  const [selectedTemplate, setSelectedTemplate] = useState<SchemaTemplate | null>(null);
  const [mapping, setMapping] = useState<MappingItem[]>([]);
  const [insertPosition, setInsertPosition] = useState<Position>({ x: 100, y: 100 });

  // Charger les templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Templates de l'utilisateur
      const { data: myTemplates, error: myError } = await supabase
        .from("schema_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (myError) throw myError;

      // Templates publics (d'autres utilisateurs)
      const { data: publicTemplates, error: publicError } = await supabase
        .from("schema_templates")
        .select("*")
        .eq("is_public", true)
        .neq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (publicError) throw publicError;

      setTemplates([...(myTemplates || []), ...(publicTemplates || [])]);
    } catch (error) {
      console.error("Erreur chargement templates:", error);
      toast.error("Erreur lors du chargement des templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setMode(initialMode);
      // Sélectionner tous les calques par défaut
      setSelectedLayerIds(layers.map(l => l.id));
    }
  }, [isOpen, initialMode, loadTemplates, layers]);

  // Sauvegarder un template
  const handleSave = async () => {
    if (!saveName.trim()) {
      toast.error("Veuillez entrer un nom pour le template");
      return;
    }

    if (selectedLayerIds.length === 0) {
      toast.error("Veuillez sélectionner au moins un calque");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Filtrer les items selon les calques sélectionnés
      const selectedItems = items.filter(item => {
        const itemLayerId = (item as any).layerId || "layer-default";
        return selectedLayerIds.includes(itemLayerId);
      });

      if (selectedItems.length === 0) {
        toast.error("Aucun bloc dans les calques sélectionnés");
        setLoading(false);
        return;
      }

      // Calculer la position de référence (bloc le plus en haut à gauche)
      let minX = Infinity, minY = Infinity;
      selectedItems.forEach(item => {
        const pos = positions[item.id];
        if (pos) {
          minX = Math.min(minX, pos.x);
          minY = Math.min(minY, pos.y);
        }
      });

      // Créer les blocs du template avec positions relatives
      const templateBlocks: TemplateBlock[] = selectedItems.map(item => {
        const pos = positions[item.id] || { x: 0, y: 0 };
        const handles = nodeHandles[item.id] || { top: 1, bottom: 1, left: 1, right: 1 };
        const itemLayerId = (item as any).layerId || "layer-default";
        
        return {
          tempId: item.id,
          type_electrique: item.type_electrique,
          label: item.nom_accessoire,
          relativePosition: {
            x: pos.x - minX,
            y: pos.y - minY,
          },
          handles,
          layerId: itemLayerId,
        };
      });

      // Filtrer les câbles qui connectent des blocs sélectionnés
      const selectedItemIds = new Set(selectedItems.map(i => i.id));
      const templateCables: TemplateCable[] = edges
        .filter(e => 
          selectedItemIds.has(e.source_node_id) && 
          selectedItemIds.has(e.target_node_id)
        )
        .map(e => ({
          sourceTempId: e.source_node_id,
          targetTempId: e.target_node_id,
          sourceHandle: e.source_handle || null,
          targetHandle: e.target_handle || null,
          color: e.color || "#ef4444",
          strokeWidth: e.strokeWidth,
          layerId: (e as any).layerId,
        }));

      // Créer les layers du template
      const usedLayerIds = new Set(templateBlocks.map(b => b.layerId).filter(Boolean));
      const templateLayers: TemplateLayer[] = layers
        .filter(l => usedLayerIds.has(l.id))
        .map(l => ({
          tempId: l.id,
          name: l.name,
          color: l.color,
        }));

      // Sauvegarder en base
      const { error } = await supabase
        .from("schema_templates")
        .insert({
          user_id: user.id,
          name: saveName.trim(),
          description: saveDescription.trim(),
          is_public: saveIsPublic,
          blocks: templateBlocks,
          cables: templateCables,
          layers: templateLayers,
        });

      if (error) throw error;

      toast.success("Template sauvegardé !");
      onClose();
    } catch (error) {
      console.error("Erreur sauvegarde template:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  // Sélectionner un template et préparer le mapping
  const handleSelectTemplate = (template: SchemaTemplate) => {
    setSelectedTemplate(template);
    
    // Créer le mapping initial
    const initialMapping: MappingItem[] = template.blocks.map(block => ({
      tempId: block.tempId,
      type_electrique: block.type_electrique,
      label: block.label,
      selectedItemId: null,
    }));
    
    // Auto-mapper si possible (premier article du même type)
    initialMapping.forEach(item => {
      const compatibleItems = scenarioItems.filter(
        si => si.type_electrique === item.type_electrique
      );
      if (compatibleItems.length === 1) {
        item.selectedItemId = compatibleItems[0].id;
      }
    });
    
    setMapping(initialMapping);
  };

  // Insérer le template
  const handleInsert = () => {
    if (!selectedTemplate) return;

    // Vérifier que tous les blocs sont mappés
    const unmapped = mapping.filter(m => !m.selectedItemId);
    if (unmapped.length > 0) {
      toast.error(`${unmapped.length} bloc(s) non assigné(s)`);
      return;
    }

    // Créer la correspondance tempId -> selectedItemId
    const idMapping: Record<string, string> = {};
    mapping.forEach(m => {
      if (m.selectedItemId) {
        idMapping[m.tempId] = m.selectedItemId;
      }
    });

    // Préparer les blocs à insérer
    const blocksToInsert = selectedTemplate.blocks.map(block => {
      const mappedItemId = idMapping[block.tempId];
      const scenarioItem = scenarioItems.find(si => si.id === mappedItemId);
      
      // Trouver ou créer le layer
      const templateLayer = selectedTemplate.layers.find(l => l.tempId === block.layerId);
      const layerId = templateLayer 
        ? `template-${templateLayer.tempId}-${Date.now()}`
        : "layer-default";
      
      return {
        item: scenarioItem,
        position: {
          x: insertPosition.x + block.relativePosition.x,
          y: insertPosition.y + block.relativePosition.y,
        },
        handles: block.handles,
        layerId,
      };
    });

    // Préparer les câbles avec les nouveaux IDs
    const cablesToInsert = selectedTemplate.cables.map(cable => ({
      source_node_id: idMapping[cable.sourceTempId],
      target_node_id: idMapping[cable.targetTempId],
      source_handle: cable.sourceHandle,
      target_handle: cable.targetHandle,
      color: cable.color,
      strokeWidth: cable.strokeWidth,
    }));

    // Créer les nouveaux calques
    const newLayers: Layer[] = selectedTemplate.layers.map(l => ({
      id: `template-${l.tempId}-${Date.now()}`,
      name: l.name,
      color: l.color,
      visible: true,
      locked: false,
    }));

    onInsertTemplate(blocksToInsert, cablesToInsert, newLayers);
    toast.success("Template inséré !");
    onClose();
  };

  // Supprimer un template
  const handleDelete = async (templateId: string) => {
    if (!confirm("Supprimer ce template ?")) return;

    try {
      const { error } = await supabase
        .from("schema_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Template supprimé");
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Filtrer les templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const { data: { user } } = supabase.auth.getUser() as any;
    const isMine = t.user_id === user?.id;
    
    if (activeTab === "mine") return matchesSearch && isMine;
    return matchesSearch && !isMine;
  });

  // Articles compatibles pour un type
  const getCompatibleItems = (type_electrique: string) => {
    return scenarioItems.filter(si => si.type_electrique === type_electrique);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5" />
            {mode === "save" ? "Sauvegarder comme template" : "Bibliothèque de templates"}
          </DialogTitle>
        </DialogHeader>

        {mode === "save" ? (
          // === MODE SAUVEGARDE ===
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom du template *</Label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Ex: Circuit solaire complet"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Décrivez ce template..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Calques à inclure</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {layers.map(layer => {
                  const itemCount = items.filter(
                    i => ((i as any).layerId || "layer-default") === layer.id
                  ).length;
                  
                  return (
                    <div key={layer.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`layer-${layer.id}`}
                        checked={selectedLayerIds.includes(layer.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLayerIds(prev => [...prev, layer.id]);
                          } else {
                            setSelectedLayerIds(prev => prev.filter(id => id !== layer.id));
                          }
                        }}
                      />
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: layer.color }}
                      />
                      <Label htmlFor={`layer-${layer.id}`} className="flex-1 cursor-pointer">
                        {layer.name}
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        {itemCount} bloc(s)
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="public"
                checked={saveIsPublic}
                onCheckedChange={(c) => setSaveIsPublic(!!c)}
              />
              <Label htmlFor="public" className="cursor-pointer flex items-center gap-1">
                <Globe className="w-4 h-4" />
                Partager avec tous les utilisateurs
              </Label>
            </div>
          </div>
        ) : selectedTemplate ? (
          // === MODE MAPPING ===
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTemplate(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <Label>Associer les équipements du devis</Label>
              {mapping.map((item, index) => {
                const compatibleItems = getCompatibleItems(item.type_electrique);
                
                return (
                  <div key={item.tempId} className="flex items-center gap-2">
                    <div className="w-1/3 text-sm truncate" title={item.label}>
                      {item.label}
                      <span className="text-xs text-gray-400 ml-1">
                        ({item.type_electrique})
                      </span>
                    </div>
                    <span className="text-gray-400">→</span>
                    <Select
                      value={item.selectedItemId || ""}
                      onValueChange={(value) => {
                        setMapping(prev => prev.map((m, i) =>
                          i === index ? { ...m, selectedItemId: value } : m
                        ));
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleItems.length === 0 ? (
                          <SelectItem value="" disabled>
                            Aucun article compatible
                          </SelectItem>
                        ) : (
                          compatibleItems.map(ci => (
                            <SelectItem key={ci.id} value={ci.id}>
                              {ci.nom_accessoire}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {item.selectedItemId && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Position X</Label>
                <Input
                  type="number"
                  value={insertPosition.x}
                  onChange={(e) => setInsertPosition(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Position Y</Label>
                <Input
                  type="number"
                  value={insertPosition.y}
                  onChange={(e) => setInsertPosition(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        ) : (
          // === MODE LISTE ===
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <div className="flex items-center gap-2 mb-3">
                <TabsList>
                  <TabsTrigger value="mine" className="gap-1">
                    <Lock className="w-3 h-3" />
                    Mes templates
                  </TabsTrigger>
                  <TabsTrigger value="public" className="gap-1">
                    <Globe className="w-3 h-3" />
                    Publics
                  </TabsTrigger>
                </TabsList>
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {activeTab === "mine"
                      ? "Aucun template sauvegardé"
                      : "Aucun template public disponible"}
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {template.name}
                            </span>
                            {template.is_public && (
                              <Globe className="w-3 h-3 text-blue-500" />
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-gray-500 truncate">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {template.blocks?.length || 0} blocs
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {template.cables?.length || 0} câbles
                            </Badge>
                          </div>
                        </div>
                        {activeTab === "mine" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(template.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          {mode === "save" ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                <Save className="w-4 h-4 mr-1" />
                Sauvegarder
              </Button>
            </>
          ) : selectedTemplate ? (
            <>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Retour
              </Button>
              <Button onClick={handleInsert}>
                <Download className="w-4 h-4 mr-1" />
                Insérer
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
              <Button variant="outline" onClick={() => setMode("save")}>
                <Save className="w-4 h-4 mr-1" />
                Sauvegarder un template
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
