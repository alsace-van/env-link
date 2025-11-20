import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Plus, Search } from "lucide-react";
import { PhotoTemplateCard } from "@/components/photo-templates/PhotoTemplateCard";
import { PhotoTemplateCreationWizard } from "@/components/photo-templates/PhotoTemplateCreationWizard";
import type { PhotoTemplate } from "@/types/photo-templates";

export default function PhotoTemplates() {
  const { id: projectId } = useParams();
  const [showCreationWizard, setShowCreationWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: templates, isLoading } = useQuery<PhotoTemplate[]>({
    queryKey: ["photo-templates", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("photo_templates")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PhotoTemplate[];
    },
    enabled: !!projectId,
  });

  const filteredTemplates = templates?.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Camera className="h-8 w-8 text-primary" />
            Gabarits & Traçage CNC
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez des gabarits précis à partir de photos avec correction automatique
          </p>
        </div>
        <Button onClick={() => setShowCreationWizard(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau gabarit
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un gabarit..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Chargement des gabarits...
        </div>
      ) : filteredTemplates && filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <PhotoTemplateCard key={template.id} template={template} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 space-y-4">
          <Camera className="h-16 w-16 mx-auto text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-semibold">Aucun gabarit</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Aucun gabarit ne correspond à votre recherche"
                : "Créez votre premier gabarit pour commencer"}
            </p>
          </div>
          {!searchQuery && (
            <Button onClick={() => setShowCreationWizard(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer un gabarit
            </Button>
          )}
        </div>
      )}

      {/* Creation Wizard */}
      <PhotoTemplateCreationWizard
        open={showCreationWizard}
        onOpenChange={setShowCreationWizard}
        projectId={projectId!}
      />
    </div>
  );
}
