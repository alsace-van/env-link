// ============================================
// COMPOSANT: TemplateLibrary
// Panneau latéral de bibliothèque de templates CAD
// VERSION: 1.0
// ============================================

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Library,
  Search,
  Star,
  StarOff,
  Globe,
  Lock,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  FolderPlus,
  X,
  Save,
  Download,
  Replace,
  PlusCircle,
  Filter,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  useTemplates,
  CADTemplate,
  TemplateCategory,
  deserializeSketchData,
  mergeTemplateIntoSketch,
} from "@/hooks/useTemplates";
import type { Sketch } from "@/components/cad-gabarit/types";

interface TemplateLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  currentSketch: Sketch;
  onLoadTemplate: (sketch: Sketch, mode: "replace" | "merge") => void;
  onGenerateThumbnail: () => string | null; // Génère un thumbnail du canvas actuel
}

export function TemplateLibrary({
  isOpen,
  onClose,
  currentSketch,
  onLoadTemplate,
  onGenerateThumbnail,
}: TemplateLibraryProps) {
  const {
    templates,
    categories,
    loading,
    filters,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    toggleFavorite,
    togglePublic,
    createCategory,
    deleteCategory,
    setFilters,
    resetFilters,
    refresh,
  } = useTemplates();

  // États locaux
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<CADTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Formulaire nouveau template
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<string | null>(null);
  const [newTemplateTags, setNewTemplateTags] = useState("");
  const [newTemplatePublic, setNewTemplatePublic] = useState(false);

  // Formulaire édition
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");

  // Formulaire nouvelle catégorie
  const [newCategoryName, setNewCategoryName] = useState("");

  // Sauvegarder le sketch actuel comme template
  const handleSaveTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      toast.error("Veuillez entrer un nom pour le template");
      return;
    }

    setSavingTemplate(true);
    try {
      // Générer la miniature
      const thumbnail = onGenerateThumbnail();

      const tags = newTemplateTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await saveTemplate(newTemplateName.trim(), currentSketch, {
        description: newTemplateDescription.trim() || undefined,
        categoryId: newTemplateCategory || undefined,
        tags,
        isPublic: newTemplatePublic,
        thumbnail: thumbnail || undefined,
      });

      // Reset formulaire
      setNewTemplateName("");
      setNewTemplateDescription("");
      setNewTemplateCategory(null);
      setNewTemplateTags("");
      setNewTemplatePublic(false);
      setSaveDialogOpen(false);
    } finally {
      setSavingTemplate(false);
    }
  }, [
    newTemplateName,
    newTemplateDescription,
    newTemplateCategory,
    newTemplateTags,
    newTemplatePublic,
    currentSketch,
    saveTemplate,
    onGenerateThumbnail,
  ]);

  // Ouvrir le dialog d'édition
  const handleOpenEdit = useCallback((template: CADTemplate) => {
    setSelectedTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || "");
    setEditCategory(template.category_id);
    setEditTags(template.tags.join(", "));
    setEditDialogOpen(true);
  }, []);

  // Sauvegarder les modifications
  const handleSaveEdit = useCallback(async () => {
    if (!selectedTemplate || !editName.trim()) return;

    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await updateTemplate(selectedTemplate.id, {
      name: editName.trim(),
      description: editDescription.trim() || null,
      category_id: editCategory,
      tags,
    });

    setEditDialogOpen(false);
    setSelectedTemplate(null);
  }, [selectedTemplate, editName, editDescription, editCategory, editTags, updateTemplate]);

  // Confirmer suppression
  const handleConfirmDelete = useCallback(async () => {
    if (!selectedTemplate) return;
    await deleteTemplate(selectedTemplate.id);
    setDeleteDialogOpen(false);
    setSelectedTemplate(null);
  }, [selectedTemplate, deleteTemplate]);

  // Charger un template
  const handleLoadTemplate = useCallback(
    (mode: "replace" | "merge") => {
      if (!selectedTemplate) return;

      const templateSketch = deserializeSketchData(selectedTemplate.sketch_data);

      if (mode === "replace") {
        onLoadTemplate(templateSketch, "replace");
        toast.success(`Template "${selectedTemplate.name}" chargé`);
      } else {
        const mergedSketch = mergeTemplateIntoSketch(currentSketch, selectedTemplate.sketch_data, {
          x: 100,
          y: 100,
        });
        onLoadTemplate(mergedSketch, "merge");
        toast.success(`Template "${selectedTemplate.name}" ajouté au sketch`);
      }

      setLoadDialogOpen(false);
      setSelectedTemplate(null);
      onClose();
    },
    [selectedTemplate, currentSketch, onLoadTemplate, onClose]
  );

  // Créer une catégorie
  const handleCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    await createCategory(newCategoryName.trim());
    setNewCategoryName("");
    setCategoryDialogOpen(false);
  }, [newCategoryName, createCategory]);

  if (!isOpen) return null;

  return (
    <>
      {/* Panneau latéral */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white border-l shadow-lg z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Bibliothèque</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Barre d'actions */}
        <div className="p-3 border-b space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setSaveDialogOpen(true)}
              disabled={currentSketch.geometries.size === 0}
            >
              <Save className="h-4 w-4 mr-1" />
              Sauvegarder
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              className="pl-8 h-8"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>

          {/* Filtres */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 flex-1">
              <Select
                value={filters.categoryId || "all"}
                onValueChange={(v) => setFilters({ categoryId: v === "all" ? null : v })}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-1.5"
                onClick={() => setCategoryDialogOpen(true)}
                title="Nouvelle catégorie"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <Button
              size="sm"
              variant={filters.showFavorites ? "default" : "outline"}
              className="h-7 px-2"
              onClick={() => setFilters({ showFavorites: !filters.showFavorites })}
            >
              <Star className="h-3 w-3" />
            </Button>

            <Button
              size="sm"
              variant={filters.showPublic ? "default" : "outline"}
              className="h-7 px-2"
              onClick={() => setFilters({ showPublic: !filters.showPublic })}
            >
              <Globe className="h-3 w-3" />
            </Button>

            {(filters.search || filters.categoryId || filters.showFavorites || filters.showPublic) && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={resetFilters}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Liste des templates */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Library className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun template trouvé</p>
                <p className="text-xs mt-1">Sauvegardez votre premier template !</p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="border rounded-lg p-2 hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setLoadDialogOpen(true);
                  }}
                >
                  <div className="flex gap-2">
                    {/* Miniature */}
                    <div className="w-16 h-16 bg-muted rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {template.thumbnail ? (
                        <img
                          src={template.thumbnail}
                          alt={template.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-medium text-sm truncate">{template.name}</h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(template.id);
                            }}
                          >
                            {template.is_favorite ? (
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <StarOff className="h-3 w-3" />
                            )}
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(template);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePublic(template.id);
                                }}
                              >
                                {template.is_public ? (
                                  <>
                                    <Lock className="h-4 w-4 mr-2" />
                                    Rendre privé
                                  </>
                                ) : (
                                  <>
                                    <Globe className="h-4 w-4 mr-2" />
                                    Rendre public
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTemplate(template);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {template.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {template.description}
                        </p>
                      )}

                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {template.category && (
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {template.category.name}
                          </Badge>
                        )}
                        {template.is_public && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            <Globe className="h-2 w-2 mr-0.5" />
                            Public
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {template.geometry_count} formes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Dialog: Sauvegarder template */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder comme template</DialogTitle>
            <DialogDescription>
              Sauvegardez le sketch actuel pour le réutiliser plus tard
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nom *</Label>
              <Input
                id="template-name"
                placeholder="Mon template"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                placeholder="Description optionnelle..."
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-category">Catégorie</Label>
              <div className="flex gap-2">
                <Select
                  value={newTemplateCategory || "none"}
                  onValueChange={(v) => setNewTemplateCategory(v === "none" ? null : v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune catégorie</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCategoryDialogOpen(true)}
                  title="Nouvelle catégorie"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-tags">Tags (séparés par des virgules)</Label>
              <Input
                id="template-tags"
                placeholder="meuble, cuisine, base..."
                value={newTemplateTags}
                onChange={(e) => setNewTemplateTags(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="template-public">Rendre public</Label>
                <p className="text-xs text-muted-foreground">
                  Les autres utilisateurs pourront voir ce template
                </p>
              </div>
              <Switch
                id="template-public"
                checked={newTemplatePublic}
                onCheckedChange={setNewTemplatePublic}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Éditer template */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le template</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Catégorie</Label>
              <Select
                value={editCategory || "none"}
                onValueChange={(v) => setEditCategory(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune catégorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmer suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le template ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le template "{selectedTemplate?.name}" sera
              définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Charger template */}
      <AlertDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Charger "{selectedTemplate?.name}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Comment souhaitez-vous charger ce template ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Preview */}
          {selectedTemplate?.thumbnail && (
            <div className="flex justify-center my-2">
              <img
                src={selectedTemplate.thumbnail}
                alt={selectedTemplate.name}
                className="max-h-32 border rounded"
              />
            </div>
          )}

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:mr-auto">Annuler</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleLoadTemplate("merge")}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Ajouter au sketch
            </Button>
            <Button onClick={() => handleLoadTemplate("replace")} className="gap-2">
              <Replace className="h-4 w-4" />
              Remplacer le sketch
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Nouvelle catégorie */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nom</Label>
              <Input
                id="category-name"
                placeholder="Ma catégorie"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCategory();
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TemplateLibrary;
