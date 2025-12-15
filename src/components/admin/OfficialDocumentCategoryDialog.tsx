import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Edit, GripVertical } from "lucide-react";

interface OfficialDocumentCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  display_order: number;
}

interface OfficialDocumentCategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: OfficialDocumentCategory[];
}

const emojiOptions = [
  "📄", "📋", "📑", "📝", "📜", "📃", "📁", "📂",
  "🏛️", "⚖️", "🔐", "🛡️", "✅", "📊", "📈", "📉",
  "🚗", "🚐", "🚛", "🔧", "⚙️", "🔩", "🛠️", "⚡",
  "🏢", "🏭", "🏗️", "📮", "✉️", "📧", "💼", "📌",
];

const colorOptions = [
  { value: "blue", label: "Bleu", class: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "green", label: "Vert", class: "bg-green-100 text-green-800 border-green-200" },
  { value: "purple", label: "Violet", class: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "orange", label: "Orange", class: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "red", label: "Rouge", class: "bg-red-100 text-red-800 border-red-200" },
  { value: "yellow", label: "Jaune", class: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "pink", label: "Rose", class: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "gray", label: "Gris", class: "bg-gray-100 text-gray-800 border-gray-200" },
];

const OfficialDocumentCategoryDialog = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
}: OfficialDocumentCategoryDialogProps) => {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📄");
  const [newCategoryColor, setNewCategoryColor] = useState("blue");
  const [editingCategory, setEditingCategory] = useState<OfficialDocumentCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryIcon, setEditCategoryIcon] = useState("📄");
  const [editCategoryColor, setEditCategoryColor] = useState("blue");

  const handleAddCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      toast.error("Veuillez entrer un nom de catégorie");
      return;
    }

    const maxOrder = Math.max(...categories.map((c) => c.display_order), 0);

    const { error } = await supabase.from("official_document_categories").insert({
      name: trimmedName,
      icon: newCategoryIcon,
      color: newCategoryColor,
      display_order: maxOrder + 1,
    });

    if (error) {
      toast.error("Erreur lors de la création de la catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie créée");
      setNewCategoryName("");
      setNewCategoryIcon("📄");
      setNewCategoryColor("blue");
      onSuccess();
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const { error } = await supabase.from("official_document_categories").delete().eq("id", categoryId);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Catégorie supprimée");
      onSuccess();
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) {
      toast.error("Veuillez entrer un nom de catégorie");
      return;
    }

    const { error } = await supabase
      .from("official_document_categories")
      .update({
        name: editCategoryName.trim(),
        icon: editCategoryIcon,
        color: editCategoryColor,
      })
      .eq("id", editingCategory.id);

    if (error) {
      toast.error("Erreur lors de la modification");
      console.error(error);
    } else {
      toast.success("Catégorie modifiée");
      setEditingCategory(null);
      setEditCategoryName("");
      setEditCategoryIcon("📄");
      setEditCategoryColor("blue");
      onSuccess();
    }
  };

  const sortedCategories = [...categories].sort((a, b) => a.display_order - b.display_order);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gérer les catégories de documents</DialogTitle>
          <DialogDescription>Créez et organisez les catégories pour les documents officiels</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {editingCategory ? (
            <div className="space-y-4 p-4 border rounded-lg bg-accent/50">
              <h4 className="font-semibold">Modifier la catégorie</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-category-name">Nom de la catégorie</Label>
                  <Input
                    id="edit-category-name"
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleEditCategory();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingCategory(null);
                      }
                    }}
                    placeholder="Ex: Formulaires DREAL"
                    autoFocus
                  />
                </div>

                <div>
                  <Label>Icône</Label>
                  <div className="flex gap-2 flex-wrap">
                    {emojiOptions.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEditCategoryIcon(emoji)}
                        className={`text-2xl p-2 rounded border-2 transition-all ${
                          editCategoryIcon === emoji
                            ? "border-primary bg-primary/10 scale-110"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Couleur</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setEditCategoryColor(color.value)}
                        className={`px-3 py-1 rounded-full text-sm font-medium border-2 transition-all ${color.class} ${
                          editCategoryColor === color.value ? "ring-2 ring-primary ring-offset-2" : ""
                        }`}
                      >
                        {color.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" onClick={handleEditCategory} className="flex-1">
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingCategory(null);
                      setEditCategoryName("");
                      setEditCategoryIcon("📄");
                      setEditCategoryColor("blue");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-semibold">Nouvelle catégorie</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="category-name">Nom de la catégorie</Label>
                  <Input
                    id="category-name"
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    placeholder="Ex: Formulaires DREAL, CERFA..."
                  />
                </div>

                <div>
                  <Label>Icône</Label>
                  <div className="flex gap-2 flex-wrap">
                    {emojiOptions.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewCategoryIcon(emoji)}
                        className={`text-2xl p-2 rounded border-2 transition-all ${
                          newCategoryIcon === emoji
                            ? "border-primary bg-primary/10 scale-110"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Couleur</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setNewCategoryColor(color.value)}
                        className={`px-3 py-1 rounded-full text-sm font-medium border-2 transition-all ${color.class} ${
                          newCategoryColor === color.value ? "ring-2 ring-primary ring-offset-2" : ""
                        }`}
                      >
                        {color.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAddCategory} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la catégorie
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-semibold">Catégories existantes</h4>
            {sortedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune catégorie pour le moment</p>
            ) : (
              <div className="border rounded-lg p-2 space-y-1">
                {sortedCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between py-2 px-3 hover:bg-accent rounded"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{category.icon}</span>
                      <span className="font-medium">{category.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          colorOptions.find((c) => c.value === category.color)?.class || "bg-gray-100"
                        }`}
                      >
                        {colorOptions.find((c) => c.value === category.color)?.label || category.color}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCategory(category);
                          setEditCategoryName(category.name);
                          setEditCategoryIcon(category.icon);
                          setEditCategoryColor(category.color);
                        }}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OfficialDocumentCategoryDialog;
