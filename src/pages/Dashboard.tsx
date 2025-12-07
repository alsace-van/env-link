# ============================================================================
# FICHIER 1 : src/components/WishlistDialog.tsx
# ACTION : Remplacer TOUT le contenu du fichier existant
# ============================================================================

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
      migrateFromLocalStorage();
    }
  }, [open]);

  useEffect(() => {
    if (initialProjectId) {
      setProjectFilter(initialProjectId);
      setNewItemProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  const migrateFromLocalStorage = async () => {
    const MIGRATION_KEY = "wishlist_migrated_to_supabase";
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const storedCategories = localStorage.getItem("wishlist_categories");
      const storedItems = localStorage.getItem("wishlist_items");

      if (storedCategories || storedItems) {
        if (storedCategories) {
          const oldCategories = JSON.parse(storedCategories);
          for (const cat of oldCategories) {
            await supabase.from("wishlist_categories").insert({
              id: cat.id,
              user_id: user.id,
              name: cat.name,
              display_order: cat.display_order || 0,
            });
          }
        }

        if (storedItems) {
          const oldItems = JSON.parse(storedItems);
          for (const item of oldItems) {
            await supabase.from("wishlist_items").insert({
              id: item.id,
              user_id: user.id,
              category_id: item.category_id,
              text: item.text,
              status: item.status || "pending",
              priority: item.priority || 0,
              ordered_at: item.ordered_at,
              received_at: item.received_at,
              created_at: item.created_at || new Date().toISOString(),
            });
          }
        }

        toast.success("Wishlist migrée vers le cloud ☁️");
        localStorage.removeItem("wishlist_categories");
        localStorage.removeItem("wishlist_items");
      }

      localStorage.setItem(MIGRATION_KEY, "true");
      loadData();
    } catch (error) {
      console.error("Erreur migration wishlist:", error);
    }
  };

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

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    try {
      const { data: categoriesData, error: catError } = await supabase
        .from("wishlist_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order");

      if (catError) throw catError;
      setCategories(categoriesData || []);

      const { data: itemsData, error: itemsError } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error) {
      console.error("Erreur chargement wishlist:", error);
      toast.error("Erreur lors du chargement de la liste");
    }
    setLoading(false);
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("wishlist_categories")
      .insert({ user_id: user.id, name: newCategoryName.trim(), display_order: categories.length })
      .select()
      .single();

    if (error) { toast.error("Erreur lors de la création"); return; }

    setCategories([...categories, data]);
    setNewCategoryName("");
    setIsAddingCategory(false);
    setActiveTab(data.id);
    toast.success("Onglet créé");
  };

  const updateCategory = async (id: string, name: string) => {
    if (!name.trim()) return;
    const { error } = await supabase.from("wishlist_categories").update({ name: name.trim() }).eq("id", id);
    if (error) { toast.error("Erreur lors de la modification"); return; }
    setCategories(categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)));
    setEditingCategoryId(null);
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("wishlist_categories").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setCategories(categories.filter((c) => c.id !== id));
    setItems(items.map((i) => (i.category_id === id ? { ...i, category_id: null } : i)));
    if (activeTab === id) setActiveTab("__all__");
    toast.success("Onglet supprimé");
  };

  const addItem = async () => {
    if (!newItemText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const categoryId = activeTab === "__all__" ? null : activeTab;
    const { data, error } = await supabase
      .from("wishlist_items")
      .insert({
        user_id: user.id,
        text: newItemText.trim(),
        category_id: categoryId,
        project_id: newItemProjectId,
        product_url: newItemUrl.trim() || null,
        supplier: newItemSupplier.trim() || null,
        estimated_price: newItemPrice ? parseFloat(newItemPrice) : null,
        status: "pending",
        priority: 0,
      })
      .select()
      .single();

    if (error) { toast.error("Erreur lors de l'ajout"); return; }

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
    if (error) { toast.error("Erreur lors de la mise à jour"); return; }
    setItems(items.map((i) => (i.id === item.id ? { ...i, ...updates } : i)));
  };

  const togglePriority = async (item: WishlistItem) => {
    const newPriority = item.priority === 1 ? 0 : 1;
    const { error } = await supabase.from("wishlist_items").update({ priority: newPriority }).eq("id", item.id);
    if (error) { toast.error("Erreur lors de la mise à jour"); return; }
    setItems(items.map((i) => (i.id === item.id ? { ...i, priority: newPriority } : i)));
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setItems(items.filter((i) => i.id !== id));
  };

  const clearReceived = async () => {
    const receivedIds = getFilteredItems().filter((i) => i.status === "received").map((i) => i.id);
    if (receivedIds.length === 0) return;
    const { error } = await supabase.from("wishlist_items").delete().in("id", receivedIds);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setItems(items.filter((i) => !receivedIds.includes(i.id)));
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
    return project ? (project.nom || project.nom_proprietaire) : null;
  };

  const filteredItems = getFilteredItems();
  const pendingItems = filteredItems.filter((i) => i.status === "pending");
  const orderedItems = filteredItems.filter((i) => i.status === "ordered");
  const receivedItems = filteredItems.filter((i) => i.status === "received");

  const ItemRow = ({ item }: { item: WishlistItem }) => {
    const nextStatus: ItemStatus | null = item.status === "pending" ? "ordered" : item.status === "ordered" ? "received" : null;

    return (
      <div className={`p-3 rounded-lg border group transition-colors ${
        item.status === "received" ? "bg-green-50 dark:bg-green-950/30 border-green-200"
          : item.status === "ordered" ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200"
          : item.priority === 1 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300"
          : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium ${item.status === "received" ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
              {item.priority === 1 && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Urgent</Badge>}
              {item.project_id && !projectFilter && <Badge variant="outline" className="text-xs">📁 {getProjectName(item.project_id)}</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {item.supplier && <span>🏪 {item.supplier}</span>}
              {item.estimated_price && <span>💰 {item.estimated_price.toFixed(2)} €</span>}
              {item.product_url && <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" />Lien</a>}
              <span>Ajouté le {formatShortDate(item.created_at)}</span>
              {item.ordered_at && <span>• Commandé le {formatShortDate(item.ordered_at)}</span>}
              {item.received_at && <span>• Reçu le {formatShortDate(item.received_at)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.status === "pending" && <Button variant="ghost" size="icon" className={`h-8 w-8 ${item.priority === 1 ? "text-amber-600" : ""}`} onClick={() => togglePriority(item)} title={item.priority === 1 ? "Retirer urgent" : "Marquer urgent"}><AlertTriangle className="h-4 w-4" /></Button>}
            {nextStatus && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateStatus(item, nextStatus)} title={nextStatus === "ordered" ? "Marquer commandé" : "Marquer reçu"}><ChevronRight className="h-4 w-4" /></Button>}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
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
              <ShoppingCart className="h-5 w-5" />Liste de souhaits
              {projectFilter && <Badge variant="secondary" className="ml-2">📁 {getProjectName(projectFilter)}</Badge>}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={projectFilter || "__all__"} onValueChange={(value) => setProjectFilter(value === "__all__" ? null : value)}>
                <SelectTrigger className="w-[200px] h-8"><SelectValue placeholder="Tous les projets" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les projets</SelectItem>
                  <SelectItem value="__none__">Sans projet</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.nom || project.nom_proprietaire}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-shrink-0 border-b bg-muted/30">
          <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <button onClick={() => setActiveTab("__all__")} className={`px-4 py-2.5 text-sm font-medium border-r whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === "__all__" ? "bg-white dark:bg-gray-900 text-primary border-b-2 border-b-primary" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground"}`}>
              📋 Tous<Badge variant="secondary" className="text-xs">{projectFilter ? items.filter(i => i.project_id === projectFilter).length : items.length}</Badge>
            </button>

            {categories.map((cat) => (
              <div key={cat.id} className={`flex items-center border-r ${activeTab === cat.id ? "bg-white dark:bg-gray-900 border-b-2 border-b-primary" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                {editingCategoryId === cat.id ? (
                  <div className="flex items-center px-2 py-1">
                    <Input value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} className="h-7 w-24 text-sm" autoFocus onKeyDown={(e) => { if (e.key === "Enter") updateCategory(cat.id, editingCategoryName); else if (e.key === "Escape") setEditingCategoryId(null); }} />
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => updateCategory(cat.id, editingCategoryName)}><Check className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setActiveTab(cat.id)} className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === cat.id ? "text-primary" : "text-muted-foreground"}`}>
                      {cat.name}{getPendingCountForCategory(cat.id) > 0 && <Badge variant="secondary" className="text-xs">{getPendingCountForCategory(cat.id)}</Badge>}
                    </button>
                    {activeTab === cat.id && (
                      <div className="flex items-center pr-2 gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteCategory(cat.id)}><X className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {isAddingCategory ? (
              <div className="flex items-center px-2 py-1">
                <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nom..." className="h-7 w-24 text-sm" autoFocus onKeyDown={(e) => { if (e.key === "Enter") addCategory(); else if (e.key === "Escape") { setIsAddingCategory(false); setNewCategoryName(""); } }} />
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={addCategory}><Check className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setIsAddingCategory(false); setNewCategoryName(""); }}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <button onClick={() => setIsAddingCategory(true)} className="px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Ajouter un onglet"><FolderPlus className="h-4 w-4" /></button>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 px-6 py-3 border-b bg-muted/20">
          <div className="flex gap-2">
            <Input value={newItemText} onChange={(e) => setNewItemText(e.target.value)} placeholder="Ajouter un élément..." className="flex-1" onKeyDown={(e) => { if (e.key === "Enter" && !showAdvancedAdd) addItem(); }} />
            <Button variant="outline" size="icon" onClick={() => setShowAdvancedAdd(!showAdvancedAdd)} title="Options avancées"><Plus className={`h-4 w-4 transition-transform ${showAdvancedAdd ? "rotate-45" : ""}`} /></Button>
            <Button onClick={addItem} disabled={!newItemText.trim()}>Ajouter</Button>
          </div>
          {showAdvancedAdd && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input value={newItemUrl} onChange={(e) => setNewItemUrl(e.target.value)} placeholder="URL du produit..." className="text-sm" />
              <Input value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)} placeholder="Fournisseur..." className="text-sm" />
              <Input type="number" step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Prix estimé..." className="text-sm" />
              <Select value={newItemProjectId || "__none__"} onValueChange={(value) => setNewItemProjectId(value === "__none__" ? null : value)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Projet..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun projet</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.nom || project.nom_proprietaire}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucun élément dans cette liste</p>
              <p className="text-sm mt-1">Ajoutez des articles à commander ci-dessus</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2"><Package className="h-4 w-4" />À commander ({pendingItems.length})</h3>
                  <div className="space-y-2">{pendingItems.sort((a, b) => b.priority - a.priority).map((item) => <ItemRow key={item.id} item={item} />)}</div>
                </div>
              )}
              {orderedItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-blue-600 mb-2 flex items-center gap-2"><Package className="h-4 w-4" />Commandé ({orderedItems.length})</h3>
                  <div className="space-y-2">{orderedItems.map((item) => <ItemRow key={item.id} item={item} />)}</div>
                </div>
              )}
              {receivedItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-green-600 flex items-center gap-2"><PackageCheck className="h-4 w-4" />Reçu ({receivedItems.length})</h3>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={clearReceived}><Trash2 className="h-3 w-3 mr-1" />Vider</Button>
                  </div>
                  <div className="space-y-2">{receivedItems.map((item) => <ItemRow key={item.id} item={item} />)}</div>
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