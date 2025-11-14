import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id?: string;
  nom: string;
  description?: string;
  icon: string;
  display_order: number;
  is_active: boolean;
}

export const CategoriesManager = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<Category>({
    nom: "",
    description: "",
    icon: "📦",
    display_order: 0,
    is_active: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("shop_categories" as any)
      .select("*")
      .eq("user_id", user.id)
      .is("parent_id", null)
      .order("display_order");

    if (data) {
      setCategories(data as any);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from("shop_categories" as any)
        .insert({
          ...newCategory,
          user_id: user.id,
        });

      if (error) throw error;

      toast.success("Catégorie créée");
      setNewCategory({
        nom: "",
        description: "",
        icon: "📦",
        display_order: 0,
        is_active: true,
      });
      loadCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Erreur lors de la création");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;

    try {
      const { error } = await supabase
        .from("shop_categories" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Catégorie supprimée");
      loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle catégorie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={newCategory.nom}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, nom: e.target.value })
                }
                placeholder="Ex: Électricité"
              />
            </div>
            <div className="space-y-2">
              <Label>Icône</Label>
              <Input
                value={newCategory.icon}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, icon: e.target.value })
                }
                placeholder="📦"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={newCategory.description}
              onChange={(e) =>
                setNewCategory({ ...newCategory, description: e.target.value })
              }
              placeholder="Description de la catégorie..."
            />
          </div>

          <Button onClick={handleSave} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {category.icon} {category.nom}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => category.id && handleDelete(category.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardTitle>
            </CardHeader>
            {category.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
