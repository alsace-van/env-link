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
import { Search, Plus, Clock, TrendingUp, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import { CategoryManagementDialog } from "./CategoryManagementDialog";
import { useToast } from "@/hooks/use-toast";

interface TaskTemplatesLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUseTemplate: (templateId: string) => void;
}

export const TaskTemplatesLibrary = ({
  open,
  onOpenChange,
  projectId,
  onUseTemplate,
}: TaskTemplatesLibraryProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["work-categories", "templates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
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
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("task_templates")
        .select(`
          *,
          work_categories!inner(name, icon, color)
        `)
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

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      categoryId: string;
      estimatedHours?: number;
      isGlobal: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
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
        variant: "destructive" 
      });
    },
  });

  const renderTemplateCard = (template: any) => (
    <Card key={template.id} className="hover:border-primary transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {template.work_categories?.icon} {template.title}
            </CardTitle>
            {template.description && (
              <CardDescription className="text-xs">
                {template.description}
              </CardDescription>
            )}
          </div>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📚 Bibliothèque de tâches
          </DialogTitle>
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
            <Button
              variant="outline"
              onClick={() => setShowManageCategories(true)}
            >
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
                  Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))
                ) : globalTemplates && globalTemplates.length > 0 ? (
                  globalTemplates.map(renderTemplateCard)
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune tâche commune trouvée
                  </p>
                )}
              </TabsContent>

              <TabsContent value="user" className="mt-0 space-y-3">
                {loadingTemplates ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))
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
                    <p className="text-muted-foreground">
                      Vous n'avez pas encore créé de templates
                    </p>
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
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        categories={categories || []}
        onSubmit={(data) => createTemplateMutation.mutate(data)}
      />

      <CategoryManagementDialog
        open={showManageCategories}
        onOpenChange={setShowManageCategories}
      />
    </Dialog>
  );
};