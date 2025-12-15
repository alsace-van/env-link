import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Clock, TrendingUp, Settings, Trash2, AlertTriangle, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import CategoryManagementDialog from "../CategoryManagementDialog";
import { useToast } from "@/hooks/use-toast";
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

interface TaskTemplatesLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUseTemplate: (templateId: string) => void;
}

export const TaskTemplatesLibrary = ({ open, onOpenChange, projectId, onUseTemplate }: TaskTemplatesLibraryProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicatesToDelete, setDuplicatesToDelete] = useState<string[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["work-categories", "templates"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("work_categories")
        .select("*")
        .eq("is_template", true)
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .order("display_order");

      if (error) throw error;
      return data;
    },
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("task_templates")
        .select(
          `
          *,
          work_categories!inner(name, icon, color)
        `,
        )
        .or(`is_global.eq.true,user_id.eq.${user?.id}`)
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  const filteredTemplates = templates?.filter((t: any) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || t.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const userTemplates = filteredTemplates?.filter((t: any) => !t.is_global);
  const globalTemplates = filteredTemplates?.filter((t: any) => t.is_global);

  // Fonction pour détecter les doublons
  const findDuplicates = () => {
    if (!templates) return [];

    const duplicateGroups: any[] = [];
    const seen = new Map();

    templates.forEach((template: any) => {
      const key = `${template.title.toLowerCase().trim()}-${template.category_id}`;
      if (seen.has(key)) {
        seen.get(key).push(template);
      } else {
        seen.set(key, [template]);
      }
    });

    seen.forEach((group) => {
      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    });

    return duplicateGroups;
  };

  const duplicates = findDuplicates();

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      categoryId: string;
      estimatedHours?: number;
      isGlobal: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("task_templates").insert({
        title: data.title,
        description: data.description,
        category_id: data.categoryId,
        estimated_hours: data.estimatedHours,
        user_id: user?.id,
        is_global: data.isGlobal,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "✓ Template créé avec succès" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le template",
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer les doublons
  const deleteDuplicatesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("task_templates").delete().in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "✓ Doublons supprimés avec succès" });
      setShowDuplicates(false);
      setDuplicatesToDelete([]);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les doublons",
        variant: "destructive",
      });
    },
  });

  // Mutation pour modifier un template
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      title: string;
      description?: string;
      categoryId: string;
      estimatedHours?: number;
    }) => {
      const { error } = await supabase
        .from("task_templates")
        .update({
          title: data.title,
          description: data.description,
          category_id: data.categoryId,
          estimated_hours: data.estimatedHours,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "✓ Template modifié avec succès" });
      setEditingTemplate(null);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le template",
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer un template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_templates").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "✓ Template supprimé avec succès" });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le template",
        variant: "destructive",
      });
    },
  });

  const renderTemplateCard = (template: any) => {
    const canEdit = !template.is_global; // Seuls les templates utilisateur peuvent être modifiés

    return (
      <Card key={template.id} className="hover:border-primary transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-base">
                {template.work_categories?.icon} {template.title}
              </CardTitle>
              {template.description && <CardDescription className="text-xs">{template.description}</CardDescription>}
            </div>
            <div className="flex items-center gap-1">
              {canEdit && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingTemplate(template)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirm(template.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                onClick={() => {
                  onUseTemplate(template.id);
                  onOpenChange(false);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Utiliser
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {template.estimated_hours && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {template.estimated_hours}h
              </Badge>
            )}
            {template.usage_count > 0 && (
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {template.usage_count}x
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">📚 Bibliothèque de tâches</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une tâche..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {duplicates.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowDuplicates(true)}
                className="border-orange-500 text-orange-500 hover:bg-orange-50"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {duplicates.length} doublon{duplicates.length > 1 ? "s" : ""}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowManageCategories(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Gérer les catégories
            </Button>
          </div>

          {/* Category filters */}
          {!loadingCategories && categories && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Toutes
              </Button>
              {categories.map((cat: any) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={selectedCategory === cat.id ? { backgroundColor: cat.color } : undefined}
                >
                  {cat.icon} {cat.name}
                </Button>
              ))}
            </div>
          )}

          <Tabs defaultValue="global" className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="global">🌍 Tâches communes</TabsTrigger>
              <TabsTrigger value="user">📖 Mes tâches</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4 pr-4">
              <TabsContent value="global" className="mt-0 space-y-3">
                {loadingTemplates ? (
                  Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                ) : globalTemplates && globalTemplates.length > 0 ? (
                  globalTemplates.map(renderTemplateCard)
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucune tâche commune trouvée</p>
                )}
              </TabsContent>

              <TabsContent value="user" className="mt-0 space-y-3">
                {loadingTemplates ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                ) : userTemplates && userTemplates.length > 0 ? (
                  <>
                    <div className="flex justify-end mb-4">
                      <Button onClick={() => setShowCreateTemplate(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Nouveau template
                      </Button>
                    </div>
                    {userTemplates.map(renderTemplateCard)}
                  </>
                ) : (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-muted-foreground">Vous n'avez pas encore créé de templates</p>
                    <Button onClick={() => setShowCreateTemplate(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Créer mon premier template
                    </Button>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>

      <CreateTemplateDialog
        open={showCreateTemplate || editingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateTemplate(false);
            setEditingTemplate(null);
          }
        }}
        categories={categories || []}
        onSubmit={(data) => {
          if (editingTemplate) {
            updateTemplateMutation.mutate({ ...data, id: editingTemplate.id });
          } else {
            createTemplateMutation.mutate(data);
          }
        }}
        initialData={
          editingTemplate
            ? {
                title: editingTemplate.title,
                description: editingTemplate.description,
                categoryId: editingTemplate.category_id,
                estimatedHours: editingTemplate.estimated_hours,
                isGlobal: editingTemplate.is_global,
              }
            : undefined
        }
      />

      <CategoryManagementDialog open={showManageCategories} onOpenChange={setShowManageCategories} />

      {/* Confirmation de suppression */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce template ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteTemplateMutation.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog pour gérer les doublons */}
      <AlertDialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Doublons détectés
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les tâches suivantes ont le même nom et la même catégorie. Sélectionnez celles que vous souhaitez
              supprimer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {duplicates.map((group, groupIndex) => (
                <div key={groupIndex} className="border rounded-lg p-4 space-y-2">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {group[0].work_categories?.icon} {group[0].title}
                  </div>
                  <div className="space-y-2">
                    {group.map((template: any) => (
                      <div key={template.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={duplicatesToDelete.includes(template.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDuplicatesToDelete([...duplicatesToDelete, template.id]);
                              } else {
                                setDuplicatesToDelete(duplicatesToDelete.filter((id) => id !== template.id));
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <span className="text-muted-foreground">
                            {template.is_global ? "Globale" : "Utilisateur"}
                          </span>
                          {template.description && (
                            <span className="text-xs text-muted-foreground">- {template.description}</span>
                          )}
                          {template.usage_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {template.usage_count}x utilisé
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicatesToDelete([])}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDuplicatesMutation.mutate(duplicatesToDelete)}
              disabled={duplicatesToDelete.length === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer ({duplicatesToDelete.length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
