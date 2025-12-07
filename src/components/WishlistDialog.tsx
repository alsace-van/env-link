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

const STORAGE_KEYS = {
  categories: "wishlist_categories",
  items: "wishlist_items",
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

  // Persist categories to localStorage
  useEffect(() => {
    if (categories.length > 0 || !loading) {
      localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
    }
  }, [categories, loading]);

  // Persist items to localStorage
  useEffect(() => {
    if (items.length > 0 || !loading) {
      localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
    }
  }, [items, loading]);

  const loadData = () => {
    setLoading(true);
    try {
      const storedCategories = localStorage.getItem(STORAGE_KEYS.categories);
      const storedItems = localStorage.getItem(STORAGE_KEYS.items);
      
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }
      if (storedItems) {
        setItems(JSON.parse(storedItems));
      }
    } catch (error) {
      console.error("Error loading wishlist data:", error);
    }
    setLoading(false);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, nom, nom_proprietaire")
      .order("created_at", { ascending: false });
    if (data) setProjects(data);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory: WishlistCategory = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      display_order: categories.length,
    };
    
    setCategories([...categories, newCategory]);
    setNewCategoryName("");
    setIsAddingCategory(false);
    toast.success("Catégorie ajoutée");
  };

  const updateCategory = (id: string) => {
    if (!editingCategoryName.trim()) return;
    
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, name: editingCategoryName.trim() } : cat
    ));
    setEditingCategoryId(null);
    setEditingCategoryName("");
    toast.success("Catégorie modifiée");
  };

  const deleteCategory = (id: string) => {
    // Move items to uncategorized
    setItems(items.map(item => 
      item.category_id === id ? { ...item, category_id: null } : item
    ));
    setCategories(categories.filter(cat => cat.id !== id));
    if (activeTab === id) setActiveTab("__all__");
    toast.success("Catégorie supprimée");
  };

  const addItem = () => {
    if (!newItemText.trim()) return;

    const newItem: WishlistItem = {
      id: crypto.randomUUID(),
      category_id: activeTab === "__all__" || activeTab === "__uncategorized__" ? null : activeTab,
      project_id: newItemProjectId,
      text: newItemText.trim(),
      status: "pending",
      priority: 0,
      product_url: newItemUrl.trim() || null,
      supplier: newItemSupplier.trim() || null,
      estimated_price: newItemPrice ? parseFloat(newItemPrice) : null,
      created_at: new Date().toISOString(),
      ordered_at: null,
      received_at: null,
    };

    setItems([...items, newItem]);
    setNewItemText("");
    setNewItemUrl("");
    setNewItemSupplier("");
    setNewItemPrice("");
    setShowAdvancedAdd(false);
    toast.success("Article ajouté");
  };

  const updateItemStatus = (id: string, status: ItemStatus) => {
    const now = new Date().toISOString();
    setItems(items.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        status,
        ordered_at: status === "ordered" || status === "received" ? (item.ordered_at || now) : item.ordered_at,
        received_at: status === "received" ? now : null,
      };
    }));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    toast.success("Article supprimé");
  };

  const getFilteredItems = () => {
    let filtered = items;
    
    // Filter by project if set
    if (projectFilter) {
      filtered = filtered.filter(item => item.project_id === projectFilter);
    }
    
    // Filter by category tab
    if (activeTab === "__uncategorized__") {
      filtered = filtered.filter(item => !item.category_id);
    } else if (activeTab !== "__all__") {
      filtered = filtered.filter(item => item.category_id === activeTab);
    }
    
    return filtered;
  };

  const getStatusIcon = (status: ItemStatus) => {
    switch (status) {
      case "pending": return <ShoppingCart className="h-4 w-4" />;
      case "ordered": return <Package className="h-4 w-4" />;
      case "received": return <PackageCheck className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ItemStatus) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "ordered": return "bg-blue-500/20 text-blue-400";
      case "received": return "bg-green-500/20 text-green-400";
    }
  };

  const filteredItems = getFilteredItems();
  const uncategorizedCount = items.filter(i => !i.category_id).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Liste d'achats
          </DialogTitle>
        </DialogHeader>

        {/* Project Filter */}
        <div className="flex items-center gap-2 px-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={projectFilter || "__all__"} onValueChange={(v) => setProjectFilter(v === "__all__" ? null : v)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Tous les projets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les projets</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom} - {p.nom_proprietaire}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Categories Sidebar */}
          <div className="w-48 flex-shrink-0 border-r pr-4 overflow-y-auto">
            <div className="space-y-1">
              <Button
                variant={activeTab === "__all__" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("__all__")}
              >
                Tout ({items.length})
              </Button>
              
              <Button
                variant={activeTab === "__uncategorized__" ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("__uncategorized__")}
              >
                Non classé ({uncategorizedCount})
              </Button>

              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center group">
                  {editingCategoryId === cat.id ? (
                    <div className="flex items-center gap-1 w-full">
                      <Input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && updateCategory(cat.id)}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateCategory(cat.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingCategoryId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant={activeTab === cat.id ? "secondary" : "ghost"}
                        className="flex-1 justify-start"
                        onClick={() => setActiveTab(cat.id)}
                      >
                        {cat.name} ({items.filter(i => i.category_id === cat.id).length})
                      </Button>
                      <div className="opacity-0 group-hover:opacity-100 flex">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingCategoryId(cat.id);
                            setEditingCategoryName(cat.name);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteCategory(cat.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {isAddingCategory ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nom..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && addCategory()}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={addCategory}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsAddingCategory(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setIsAddingCategory(true)}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Ajouter catégorie
                </Button>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Add Item Form */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex gap-2">
                <Input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Ajouter un article..."
                  onKeyDown={(e) => e.key === "Enter" && !showAdvancedAdd && addItem()}
                />
                <Button onClick={addItem} disabled={!newItemText.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${showAdvancedAdd ? "rotate-90" : ""}`} />
                </Button>
              </div>
              
              {showAdvancedAdd && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Input
                    value={newItemUrl}
                    onChange={(e) => setNewItemUrl(e.target.value)}
                    placeholder="URL du produit"
                  />
                  <Input
                    value={newItemSupplier}
                    onChange={(e) => setNewItemSupplier(e.target.value)}
                    placeholder="Fournisseur"
                  />
                  <Input
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Prix estimé (€)"
                    type="number"
                  />
                  <Select value={newItemProjectId || "__none__"} onValueChange={(v) => setNewItemProjectId(v === "__none__" ? null : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Projet associé" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun projet</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Items */}
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Chargement...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Aucun article dans cette liste
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={item.status === "received" ? "line-through text-muted-foreground" : ""}>
                          {item.text}
                        </span>
                        {item.product_url && (
                          <a
                            href={item.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {item.supplier && <span>{item.supplier}</span>}
                        {item.estimated_price && <span>{item.estimated_price}€</span>}
                        {item.ordered_at && <span>Cmd: {formatShortDate(item.ordered_at)}</span>}
                        {item.received_at && <span>Reçu: {formatShortDate(item.received_at)}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge
                        className={`${getStatusColor(item.status)} cursor-pointer`}
                        onClick={() => {
                          const nextStatus: ItemStatus = 
                            item.status === "pending" ? "ordered" : 
                            item.status === "ordered" ? "received" : "pending";
                          updateItemStatus(item.id, nextStatus);
                        }}
                      >
                        {getStatusIcon(item.status)}
                        <span className="ml-1">
                          {item.status === "pending" ? "À acheter" : item.status === "ordered" ? "Commandé" : "Reçu"}
                        </span>
                      </Badge>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteItem(item.id)}
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

export default WishlistDialog;
