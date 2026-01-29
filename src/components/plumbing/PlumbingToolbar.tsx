// ============================================
// COMPOSANT: PlumbingToolbar
// Barre d'outils pour le schéma plomberie
// VERSION: 1.1 - Ajout bouton plein écran
// ============================================

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Save, Download, Trash2, Undo, Redo, Plus, Search, Package,
  ShoppingCart, Droplets, ChevronDown, RefreshCw, Copy, FilePlus,
  Maximize, Minimize,
} from "lucide-react";
import {
  PlumbingBlockData,
  PlumbingCategory,
  PLUMBING_ELEMENTS,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
} from "./types";
import { CatalogItem, QuoteItem } from "./usePlumbingCatalog";

interface PlumbingToolbarProps {
  onAddElement: (data: PlumbingBlockData) => void;
  onSave: () => void;
  onExport: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  catalogItems: CatalogItem[];
  quoteItems: QuoteItem[];
  isLoadingCatalog: boolean;
  onLoadCatalog: () => void;
  onSearchCatalog: (query: string) => Promise<CatalogItem[]>;
  onAddFromCatalog: (item: CatalogItem) => void;
  onAddFromQuote: (item: QuoteItem) => void;
  catalogToBlockData: (item: CatalogItem) => PlumbingBlockData;
  quoteToBlockData: (item: QuoteItem) => PlumbingBlockData;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function PlumbingToolbar({
  onAddElement,
  onSave,
  onExport,
  onClear,
  onUndo,
  onRedo,
  onDeleteSelected,
  onDuplicateSelected,
  canUndo,
  canRedo,
  hasSelection,
  isSaving,
  hasUnsavedChanges,
  catalogItems,
  quoteItems,
  isLoadingCatalog,
  onLoadCatalog,
  onSearchCatalog,
  onAddFromCatalog,
  onAddFromQuote,
  isFullscreen,
  onToggleFullscreen,
}: PlumbingToolbarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PlumbingCategory | "all">("all");

  const filteredElements = useMemo(() => {
    if (activeCategory === "all") return PLUMBING_ELEMENTS;
    return PLUMBING_ELEMENTS.filter((el) => el.category === activeCategory);
  }, [activeCategory]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await onSearchCatalog(query);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const categories: Array<{ id: PlumbingCategory | "all"; label: string; count: number }> = [
    { id: "all", label: "Tous", count: PLUMBING_ELEMENTS.length },
    { id: "source", label: "Sources", count: PLUMBING_ELEMENTS.filter((e) => e.category === "source").length },
    { id: "storage", label: "Stockage", count: PLUMBING_ELEMENTS.filter((e) => e.category === "storage").length },
    { id: "distribution", label: "Distribution", count: PLUMBING_ELEMENTS.filter((e) => e.category === "distribution").length },
    { id: "fitting", label: "Raccords", count: PLUMBING_ELEMENTS.filter((e) => e.category === "fitting").length },
    { id: "filter", label: "Filtration", count: PLUMBING_ELEMENTS.filter((e) => e.category === "filter").length },
    { id: "other", label: "Autres", count: PLUMBING_ELEMENTS.filter((e) => e.category === "other").length },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 flex-wrap p-2 bg-gray-50 border-b">
        {/* Fichier */}
        <div className="flex items-center gap-1 mr-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving} className="h-8">
                <Save className={`h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
                {hasUnsavedChanges && <span className="ml-1 h-2 w-2 bg-orange-500 rounded-full" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sauvegarder (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onExport} className="h-8">
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Exporter</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onClear} className="h-8">
                <FilePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nouveau schéma</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Historique */}
        <div className="flex items-center gap-1 mx-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo} className="h-8">
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Annuler (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onRedo} disabled={!canRedo} className="h-8">
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refaire (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Sélection */}
        <div className="flex items-center gap-1 mx-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onDuplicateSelected} disabled={!hasSelection} className="h-8">
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dupliquer (Ctrl+D)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onDeleteSelected} disabled={!hasSelection} className="h-8 text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Supprimer (Suppr)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Ajouter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="default" size="sm" className="h-8 gap-1">
              <Plus className="h-4 w-4" />
              Ajouter
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Tabs defaultValue="elements" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="elements" className="text-xs">
                  <Droplets className="h-3 w-3 mr-1" />
                  Éléments
                </TabsTrigger>
                <TabsTrigger value="catalog" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  Catalogue
                </TabsTrigger>
                <TabsTrigger value="quote" className="text-xs">
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Devis
                  {quoteItems.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {quoteItems.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Éléments prédéfinis */}
              <TabsContent value="elements" className="p-2 m-0">
                <div className="flex flex-wrap gap-1 mb-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={activeCategory === cat.id ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.id !== "all" && <span className="mr-1">{CATEGORY_ICONS[cat.id as PlumbingCategory]}</span>}
                      {cat.label}
                    </Button>
                  ))}
                </div>

                <ScrollArea className="h-64">
                  <div className="grid grid-cols-2 gap-1">
                    {filteredElements.map((element, idx) => (
                      <Button
                        key={`${element.label}-${idx}`}
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 px-2 flex flex-col items-start text-left justify-start"
                        onClick={() => onAddElement(element as PlumbingBlockData)}
                      >
                        <div className="flex items-center gap-1 w-full">
                          <span className="text-base">{element.icon}</span>
                          <span className="text-xs font-medium truncate flex-1">{element.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {element.capacity_liters && (
                            <Badge variant="secondary" className="text-[9px] px-1 h-4">{element.capacity_liters}L</Badge>
                          )}
                          {element.power_watts && (
                            <Badge variant="secondary" className="text-[9px] px-1 h-4">{element.power_watts}W</Badge>
                          )}
                          {element.electricalType !== "none" && (
                            <Badge variant="outline" className="text-[9px] px-1 h-4">
                              {element.electricalType?.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Catalogue */}
              <TabsContent value="catalog" className="p-2 m-0">
                <div className="flex gap-1 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={onLoadCatalog} disabled={isLoadingCatalog} className="h-8">
                    <RefreshCw className={`h-4 w-4 ${isLoadingCatalog ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                <ScrollArea className="h-56">
                  {isSearching ? (
                    <div className="flex items-center justify-center h-20">
                      <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.map((item) => (
                        <Button
                          key={item.id}
                          variant="outline"
                          size="sm"
                          className="w-full h-auto py-2 px-2 flex items-center gap-2 text-left justify-start"
                          onClick={() => onAddFromCatalog(item)}
                        >
                          {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 object-cover rounded" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{item.nom}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {item.marque && <span className="text-[10px] text-gray-500">{item.marque}</span>}
                              {item.prix_vente_ttc && (
                                <Badge variant="outline" className="text-[9px] px-1 h-4">{item.prix_vente_ttc.toFixed(2)}€</Badge>
                              )}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <div className="text-center text-sm text-gray-500 py-4">Aucun résultat</div>
                  ) : catalogItems.length > 0 ? (
                    <div className="space-y-1">
                      {catalogItems.slice(0, 20).map((item) => (
                        <Button
                          key={item.id}
                          variant="outline"
                          size="sm"
                          className="w-full h-auto py-2 px-2 flex items-center gap-2 text-left justify-start"
                          onClick={() => onAddFromCatalog(item)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{item.nom}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-500 py-4">
                      Cliquez sur rafraîchir pour charger le catalogue
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Devis */}
              <TabsContent value="quote" className="p-2 m-0">
                <ScrollArea className="h-64">
                  {quoteItems.length > 0 ? (
                    <div className="space-y-1">
                      {quoteItems.map((item) => (
                        <Button
                          key={item.id}
                          variant="outline"
                          size="sm"
                          className="w-full h-auto py-2 px-2 flex items-center gap-2 text-left justify-start"
                          onClick={() => onAddFromQuote(item)}
                        >
                          {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 object-cover rounded" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{item.nom}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="secondary" className="text-[9px] px-1 h-4">x{item.quantity}</Badge>
                              <Badge variant="outline" className="text-[9px] px-1 h-4">{item.prix_unitaire?.toFixed(2)}€</Badge>
                            </div>
                          </div>
                          <Badge className="bg-green-500 text-[9px] px-1 h-4">Devis</Badge>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-500 py-8">Aucun article dans le devis</div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>

        {/* Spacer pour pousser le bouton fullscreen à droite */}
        <div className="flex-1" />

        {/* Plein écran */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onToggleFullscreen} 
              className="h-8"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isFullscreen ? "Quitter plein écran" : "Plein écran"}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default PlumbingToolbar;
