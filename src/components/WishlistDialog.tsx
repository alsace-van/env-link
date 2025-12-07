import { useState, useEffect } from "react";
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
  display_order: number;
}

interface WishlistItem {
  id: string;
  category_id: string | null;
  project_id: string | null;
  text: string;
  status: ItemStatus;
  priority: number;
  product_url: string | null;
  supplier: string | null;
  estimated_price: number | null;
  created_at: string;
  ordered_at: string | null;
  received_at: string | null;
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

const CATEGORIES_KEY = "wishlist_categories";
const ITEMS_KEY = "wishlist_items";

const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
};

const WishlistDialog = ({ open, onOpenChange, initialProjectId = null }: WishlistDialogProps) => {
  const [categories, setCategories] = useState<WishlistCategory[]>([]);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<string>("__all__");
  const [projectFilter, setProjectFilter] = useState<string | null>(initialProjectId);
  const [newItemText, setNewItemText] = useState("");
  const [newItemUrl, setNewItemUrl] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemProjectId, setNewItemProjectId] = useState<string | null>(initialProjectId);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
      loadProjects();
    }
  }, [open]);

  useEffect(() => {
    if (initialProjectId) {
      setProjectFilter(initialProjectId);
      setNewItemProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("projects")
      .select("id, nom, nom_proprietaire")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (data) setProjects(data);
  };

  const loadData = () => {
    setLoading(true);
    try {
      const storedCategories = localStorage.getItem(CATEGORIES_KEY);
      const storedItems = localStorage.getItem(ITEMS_KEY);
      setCategories(storedCategories ? JSON.parse(storedCategories) : []);
      setItems(storedItems ? JSON.parse(storedItems) : []);
    } catch (error) {
      console.error("Erreur chargement wishlist:", error);
    }
    setLoading(false);
  };

  const saveCategories = (newCategories: WishlistCategory[]) => {
    setCategories(newCategories);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(newCategories));
  };

  const saveItems = (newItems: WishlistItem[]) => {
    setItems(newItems);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(newItems));
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: WishlistCategory = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      display_order: categories.length,
    };
    saveCategories([...categories, newCategory]);
    setNewCategoryName("");
    setIsAddingCategory(false);
    setActiveTab(newCategory.id);
    toast.success("Onglet créé");
  };

  const updateCategory = (id: string, name: string) => {
    if (!name.trim()) return;
    saveCategories(categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)));
    setEditingCategoryId(null);
  };

  const deleteCategory = (id: string) => {
    saveCategories(categories.filter((c) => c.id !== id));
    saveItems(items.map((i) => (i.category_id === id ? { ...i, category_id: null } : i)));
    if (activeTab === id) setActiveTab("__all__");
    toast.success("Onglet supprimé");
  };

  const addItem = () => {
    if (!newItemText.trim()) return;
    const categoryId = activeTab === "__all__" ? null : activeTab;
    const newItem: WishlistItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      category_id: categoryId,
      project_id: newItemProjectId,
      product_url: newItemUrl.trim() || null,
      supplier: newItemSupplier.trim() || null,
      estimated_price: newItemPrice ? parseFloat(newItemPrice) : null,
      status: "pending",
      priority: 0,
      created_at: new Date().toISOString(),
      ordered_at: null,
      received_at: null,
    };
    saveItems([newItem, ...items]);
    setNewItemText("");
    setNewItemUrl("");
    setNewItemSupplier("");
    setNewItemPrice("");
    setShowAdvancedAdd(false);
  };

  const updateStatus = (item: WishlistItem, newStatus: ItemStatus) => {
    const updates: Partial<WishlistItem> = { status: newStatus };
    if (newStatus === "ordered" && !item.ordered_at) updates.ordered_at = new Date().toISOString();
    else if (newStatus === "received" && !item.received_at) updates.received_at = new Date().toISOString();
    saveItems(items.map((i) => (i.id === item.id ? { ...i, ...updates } : i)));
  };

  const togglePriority = (item: WishlistItem) => {
    const newPriority = item.priority === 1 ? 0 : 1;
    saveItems(items.map((i) => (i.id === item.id ? { ...i, priority: newPriority } : i)));
  };

  const deleteItem = (id: string) => {
    saveItems(items.filter((i) => i.id !== id));
  };

  const clearReceived = () => {
    const receivedIds = getFilteredItems()
      .filter((i) => i.status === "received")
      .map((i) => i.id);
    if (receivedIds.length === 0) return;
    saveItems(items.filter((i) => !receivedIds.includes(i.id)));
    toast.success(`${receivedIds.length} élément(s) supprimé(s)`);
  };

  const getFilteredItems = () => {
    let filtered = items;
    if (projectFilter) filtered = filtered.filter((i) => i.project_id === projectFilter);
    if (activeTab !== "__all__") filtered = filtered.filter((i) => i.category_id === activeTab);
    return filtered;
  };

  const getPendingCountForCategory = (categoryId: string | null) => {
    let filtered = items;
    if (projectFilter) filtered = filtered.filter((i) => i.project_id === projectFilter);
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
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Liste de souhaits
              {projectFilter && (
                <Badge variant="secondary" className="ml-2">
                  📁 {getProjectName(projectFilter)}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={projectFilter || "__all__"}
                onValueChange={(value) => setProjectFilter(value === "__all__" ? null : value)}
              >
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder="Tous les projets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les projets</SelectItem>
                  <SelectItem value="__none__">Sans projet</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.nom || project.nom_proprietaire}
                    </SelectItem>
                  ))}
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

            {categories.map((category) => (
              <div
                key={category.id}
                className={`relative flex items-center border-r ${activeTab === category.id ? "bg-white dark:bg-gray-900 border-b-2 border-b-primary" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              >
                {editingCategoryId === category.id ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <Input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="h-7 w-24 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateCategory(category.id, editingCategoryName);
                        if (e.key === "Escape") setEditingCategoryId(null);
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateCategory(category.id, editingCategoryName)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingCategoryId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveTab(category.id)}
                    onDoubleClick={() => {
                      setEditingCategoryId(category.id);
                      setEditingCategoryName(category.name);
                    }}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === category.id ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {category.name}
                    {getPendingCountForCategory(category.id) > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                        {getPendingCountForCategory(category.id)}
                      </Badge>
                    )}
                  </button>
                )}
                {activeTab === category.id && editingCategoryId !== category.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 mr-1 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCategory(category.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}

            {isAddingCategory ? (
              <div className="flex items-center gap-1 px-2 py-1.5">
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
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addCategory}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAddingCategory(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingCategory(true)}
                className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
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
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ajouter un article..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !showAdvancedAdd && addItem()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}>
                    <Plus className={`h-4 w-4 transition-transform ${showAdvancedAdd ? "rotate-45" : ""}`} />
                  </Button>
                  <Button onClick={addItem} disabled={!newItemText.trim()}>
                    Ajouter
                  </Button>
                </div>

                {showAdvancedAdd && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
                    <Input
                      placeholder="URL produit"
                      value={newItemUrl}
                      onChange={(e) => setNewItemUrl(e.target.value)}
                    />
                    <Input
                      placeholder="Fournisseur"
                      value={newItemSupplier}
                      onChange={(e) => setNewItemSupplier(e.target.value)}
                    />
                    <Input
                      placeholder="Prix estimé"
                      type="number"
                      step="0.01"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                    />
                    <Select
                      value={newItemProjectId || "__none__"}
                      onValueChange={(value) => setNewItemProjectId(value === "__none__" ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Projet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sans projet</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.nom || project.nom_proprietaire}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {pendingItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Package className="h-4 w-4" />À acheter ({pendingItems.length})
                  </div>
                  <div className="space-y-2">
                    {pendingItems
                      .sort((a, b) => b.priority - a.priority)
                      .map((item) => (
                        <ItemRow key={item.id} item={item} />
                      ))}
                  </div>
                </div>
              )}

              {orderedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                    <ShoppingCart className="h-4 w-4" />
                    Commandés ({orderedItems.length})
                  </div>
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
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <PackageCheck className="h-4 w-4" />
                      Reçus ({receivedItems.length})
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearReceived} className="text-xs text-muted-foreground">
                      <Trash2 className="h-3 w-3 mr-1" />
                      Effacer les reçus
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
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Aucun article dans cette liste</p>
                  <p className="text-sm">Ajoutez des articles à acheter ci-dessus</p>
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
