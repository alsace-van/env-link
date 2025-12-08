import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Trash2,
  AlertTriangle,
  ShoppingCart,
  Package,
  PackageCheck,
  ChevronRight,
  X,
  Edit2,
  Check,
  FolderPlus,
  ExternalLink,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

type ItemStatus = "pending" | "ordered" | "received";

interface WishlistCategory {
  id: string;
  name: string;
  display_order: number | null;
  user_id?: string;
  created_at?: string;
}

interface WishlistItem {
  id: string;
  category_id: string | null;
  project_id: string | null;
  text: string;
  status: string;
  priority: number | null;
  product_url: string | null;
  supplier: string | null;
  estimated_price: number | null;
  created_at: string;
  ordered_at: string | null;
  received_at: string | null;
  user_id?: string;
  updated_at?: string;
}

interface Project {
  id: string;
  nom: string;
  nom_proprietaire: string;
}

interface WishlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string | null;
}

const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
};

const WishlistDialog = ({ open, onOpenChange, initialProjectId = null }: WishlistDialogProps) => {
  // Récupérer le projectId depuis l'URL si on est sur une page projet
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const effectiveProjectId = initialProjectId || urlProjectId || null;

  const [categories, setCategories] = useState<WishlistCategory[]>([]);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<string>("__all__");
  const [projectFilter, setProjectFilter] = useState<string | null>(effectiveProjectId);
  const [newItemText, setNewItemText] = useState("");
  const [newItemUrl, setNewItemUrl] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemProjectId, setNewItemProjectId] = useState<string | null>(effectiveProjectId);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadData();
      loadProjects();
      // Mettre à jour le filtre et le projet par défaut quand on ouvre
      setProjectFilter(effectiveProjectId);
      setNewItemProjectId(effectiveProjectId);
    }
  }, [open, effectiveProjectId]);

  useEffect(() => {
    if (initialProjectId) {
      setProjectFilter(initialProjectId);
      setNewItemProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  const loadProjects = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("❌ Wishlist: Pas d'utilisateur connecté");
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select("id, nom, nom_proprietaire")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    console.log("📁 Wishlist projets:", { data, error, count: data?.length });

    if (error) {
      console.error("❌ Erreur chargement projets:", error);
      return;
    }

    if (data) setProjects(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.log("❌ Wishlist: Pas d'utilisateur connecté");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // Charger les catégories
      const { data: categoriesData, error: catError } = await supabase
        .from("wishlist_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (catError) {
        console.error("Erreur chargement catégories:", catError);
      } else {
        setCategories(categoriesData || []);
      }

      // Charger les items
      const { data: itemsData, error: itemsError } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (itemsError) {
        console.error("Erreur chargement items:", itemsError);
      } else {
        setItems(itemsData || []);
      }
    } catch (error) {
      console.error("Erreur chargement wishlist:", error);
    }
    setLoading(false);
  };

  const addCategory = async () => {
    if (!newCategoryName.trim() || !userId) return;

    const newCategory = {
      name: newCategoryName.trim(),
      display_order: categories.length,
      user_id: userId,
    };

    const { data, error } = await supabase.from("wishlist_categories").insert(newCategory).select().single();

    if (error) {
      console.error("Erreur création catégorie:", error);
      toast.error("Erreur lors de la création");
      return;
    }

    setCategories([...categories, data]);
    setNewCategoryName("");
    setIsAddingCategory(false);
    setActiveTab(data.id);
    toast.success("Onglet créé");
  };

  const updateCategory = async (id: string, name: string) => {
    if (!name.trim()) return;

    const { error } = await supabase.from("wishlist_categories").update({ name: name.trim() }).eq("id", id);

    if (error) {
      console.error("Erreur mise à jour catégorie:", error);
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    setCategories(categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)));
    setEditingCategoryId(null);
  };

  const deleteCategory = async (id: string) => {
    // D'abord, mettre à null les items de cette catégorie
    await supabase.from("wishlist_items").update({ category_id: null }).eq("category_id", id);

    const { error } = await supabase.from("wishlist_categories").delete().eq("id", id);

    if (error) {
      console.error("Erreur suppression catégorie:", error);
      toast.error("Erreur lors de la suppression");
      return;
    }

    setCategories(categories.filter((c) => c.id !== id));
    setItems(items.map((i) => (i.category_id === id ? { ...i, category_id: null } : i)));
    if (activeTab === id) setActiveTab("__all__");
    toast.success("Onglet supprimé");
  };

  const addItem = async () => {
    if (!newItemText.trim() || !userId) return;

    const categoryId = activeTab === "__all__" ? null : activeTab;
    const newItem = {
      text: newItemText.trim(),
      category_id: categoryId,
      project_id: newItemProjectId,
      product_url: newItemUrl.trim() || null,
      supplier: newItemSupplier.trim() || null,
      estimated_price: newItemPrice ? parseFloat(newItemPrice) : null,
      status: "pending",
      priority: 0,
      user_id: userId,
    };

    const { data, error } = await supabase.from("wishlist_items").insert(newItem).select().single();

    if (error) {
      console.error("Erreur création item:", error);
      toast.error("Erreur lors de l'ajout");
      return;
    }

    setItems([data, ...items]);
    setNewItemText("");
    setNewItemUrl("");
    setNewItemSupplier("");
    setNewItemPrice("");
    setShowAdvancedAdd(false);
  };

  const updateStatus = async (item: WishlistItem, newStatus: ItemStatus) => {
    const updates: Partial<WishlistItem> = { status: newStatus };
    if (newStatus === "ordered" && !item.ordered_at) updates.ordered_at = new Date().toISOString();
    else if (newStatus === "received" && !item.received_at) updates.received_at = new Date().toISOString();

    const { error } = await supabase.from("wishlist_items").update(updates).eq("id", item.id);

    if (error) {
      console.error("Erreur mise à jour status:", error);
      return;
    }

    setItems(items.map((i) => (i.id === item.id ? { ...i, ...updates } : i)));
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", id);

    if (error) {
      console.error("Erreur suppression item:", error);
      return;
    }

    setItems(items.filter((i) => i.id !== id));
  };

  const clearReceived = async () => {
    const receivedIds = items.filter((i) => i.status === "received").map((i) => i.id);
    if (receivedIds.length === 0) return;

    const { error } = await supabase.from("wishlist_items").delete().in("id", receivedIds);

    if (error) {
      console.error("Erreur suppression items reçus:", error);
      return;
    }

    setItems(items.filter((i) => i.status !== "received"));
    toast.success("Articles reçus supprimés");
  };

  const togglePriority = async (item: WishlistItem) => {
    const newPriority = (item.priority || 0) === 1 ? 0 : 1;

    const { error } = await supabase.from("wishlist_items").update({ priority: newPriority }).eq("id", item.id);

    if (error) {
      console.error("Erreur mise à jour priorité:", error);
      return;
    }

    setItems(items.map((i) => (i.id === item.id ? { ...i, priority: newPriority } : i)));
  };

  const getFilteredItems = () => {
    let filtered = items;
    if (projectFilter === "__none__") {
      // Filtre "Sans projet" - seulement les items sans projet
      filtered = filtered.filter((i) => i.project_id === null);
    } else if (projectFilter) {
      // Filtre par projet spécifique
      filtered = filtered.filter((i) => i.project_id === projectFilter);
    }
    if (activeTab !== "__all__") filtered = filtered.filter((i) => i.category_id === activeTab);
    return filtered;
  };

  const getPendingCountForCategory = (categoryId: string | null) => {
    let filtered = items;
    if (projectFilter === "__none__") {
      filtered = filtered.filter((i) => i.project_id === null);
    } else if (projectFilter) {
      filtered = filtered.filter((i) => i.project_id === projectFilter);
    }
    if (categoryId === null) return filtered.filter((i) => i.status === "pending").length;
    return filtered.filter((i) => i.category_id === categoryId && i.status === "pending").length;
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    const project = projects.find((p) => p.id === projectId);
    return project ? project.nom || project.nom_proprietaire : null;
  };

  const filteredItems = getFilteredItems();
  const pendingItems = filteredItems.filter((i) => i.status === "pending");
  const orderedItems = filteredItems.filter((i) => i.status === "ordered");
  const receivedItems = filteredItems.filter((i) => i.status === "received");

  const ItemRow = ({ item }: { item: WishlistItem }) => {
    const nextStatus: ItemStatus | null =
      item.status === "pending" ? "ordered" : item.status === "ordered" ? "received" : null;

    return (
      <div
        className={`p-3 rounded-lg border group transition-colors ${
          item.status === "received"
            ? "bg-green-50 dark:bg-green-950/30 border-green-200"
            : item.status === "ordered"
              ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200"
              : item.priority === 1
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300"
                : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium ${item.status === "received" ? "line-through text-muted-foreground" : ""}`}>
                {item.text}
              </span>
              {item.priority === 1 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Urgent
                </Badge>
              )}
              {item.project_id && !projectFilter && (
                <Badge variant="outline" className="text-xs">
                  📁 {getProjectName(item.project_id)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {item.supplier && <span>🏪 {item.supplier}</span>}
              {item.estimated_price && <span>💰 {item.estimated_price.toFixed(2)} €</span>}
              {item.product_url && (
                <a
                  href={item.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Lien
                </a>
              )}
              <span>Ajouté le {formatShortDate(item.created_at)}</span>
              {item.ordered_at && <span>• Commandé le {formatShortDate(item.ordered_at)}</span>}
              {item.received_at && <span>• Reçu le {formatShortDate(item.received_at)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.status === "pending" && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${item.priority === 1 ? "text-amber-600" : ""}`}
                onClick={() => togglePriority(item)}
                title={item.priority === 1 ? "Retirer urgent" : "Marquer urgent"}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            )}
            {nextStatus && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateStatus(item, nextStatus)}
                title={nextStatus === "ordered" ? "Marquer commandé" : "Marquer reçu"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => deleteItem(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Liste de souhaits
              {projectFilter && projectFilter !== "__none__" && (
                <Badge variant="secondary" className="ml-2">
                  📁 {getProjectName(projectFilter)}
                </Badge>
              )}
              {projectFilter === "__none__" && (
                <Badge variant="outline" className="ml-2">
                  Sans projet
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={projectFilter || "__all__"}
                onValueChange={(value) => {
                  const newProjectId = value === "__all__" ? null : value === "__none__" ? null : value;
                  setProjectFilter(value === "__all__" ? null : value);
                  // Synchroniser le projet pour les nouveaux articles (sauf "Sans projet")
                  if (value !== "__none__") {
                    setNewItemProjectId(newProjectId);
                  }
                }}
              >
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Tous les projets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les projets</SelectItem>
                  <SelectItem value="__none__">Sans projet</SelectItem>
                  {projects.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1">Projets</div>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          📁 {project.nom || project.nom_proprietaire}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-shrink-0 border-b bg-muted/30">
          <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <button
              onClick={() => setActiveTab("__all__")}
              className={`px-4 py-2.5 text-sm font-medium border-r whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === "__all__" ? "bg-white dark:bg-gray-900 text-primary border-b-2 border-b-primary" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground"}`}
            >
              Tout
              {getPendingCountForCategory(null) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {getPendingCountForCategory(null)}
                </Badge>
              )}
            </button>

            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`flex items-center border-r group ${activeTab === cat.id ? "bg-white dark:bg-gray-900 border-b-2 border-b-primary" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              >
                {editingCategoryId === cat.id ? (
                  <div className="flex items-center px-2 py-1.5 gap-1">
                    <Input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="h-7 w-24 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateCategory(cat.id, editingCategoryName);
                        if (e.key === "Escape") setEditingCategoryId(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => updateCategory(cat.id, editingCategoryName)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingCategoryId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setActiveTab(cat.id)}
                      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === cat.id ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {cat.name}
                      {getPendingCountForCategory(cat.id) > 0 && (
                        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                          {getPendingCountForCategory(cat.id)}
                        </Badge>
                      )}
                    </button>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 pr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setEditingCategoryName(cat.name);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => deleteCategory(cat.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {isAddingCategory ? (
              <div className="flex items-center px-2 py-1.5 gap-1">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nom..."
                  className="h-7 w-24 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCategory();
                    if (e.key === "Escape") setIsAddingCategory(false);
                  }}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addCategory}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsAddingCategory(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingCategory(true)}
                className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Ajouter un article..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) addItem();
                    }}
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button onClick={addItem} disabled={!newItemText.trim()}>
                  Ajouter
                </Button>
              </div>

              {showAdvancedAdd && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg">
                  <Input
                    placeholder="URL du produit"
                    value={newItemUrl}
                    onChange={(e) => setNewItemUrl(e.target.value)}
                  />
                  <Input
                    placeholder="Fournisseur"
                    value={newItemSupplier}
                    onChange={(e) => setNewItemSupplier(e.target.value)}
                  />
                  <Input
                    placeholder="Prix estimé (€)"
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                  />
                  <Select
                    value={newItemProjectId || "__none__"}
                    onValueChange={(v) => setNewItemProjectId(v === "__none__" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Projet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sans projet</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom || p.nom_proprietaire}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {pendingItems.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <ShoppingCart className="h-4 w-4" />À commander ({pendingItems.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingItems
                      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                      .map((item) => (
                        <ItemRow key={item.id} item={item} />
                      ))}
                  </div>
                </div>
              )}

              {orderedItems.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-blue-600">
                    <Package className="h-4 w-4" />
                    En attente de livraison ({orderedItems.length})
                  </h3>
                  <div className="space-y-2">
                    {orderedItems.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {receivedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2 text-green-600">
                      <PackageCheck className="h-4 w-4" />
                      Reçu ({receivedItems.length})
                    </h3>
                    <Button variant="ghost" size="sm" onClick={clearReceived} className="text-xs text-muted-foreground">
                      <Trash2 className="h-3 w-3 mr-1" />
                      Vider
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {receivedItems.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {filteredItems.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Aucun article dans cette liste</p>
                  <p className="text-sm mt-1">Ajoutez des articles à commander</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WishlistDialog;
