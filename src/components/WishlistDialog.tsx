import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface WishlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string | null;
}

const STORAGE_KEYS = {
  categories: "wishlist_categories",
  items: "wishlist_items",
};

const generateId = () => crypto.randomUUID();

const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
};

const WishlistDialog = ({ open, onOpenChange }: WishlistDialogProps) => {
  const [categories, setCategories] = useState<WishlistCategory[]>([]);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("__all__");
  const [newItemText, setNewItemText] = useState("");
  const [newItemUrl, setNewItemUrl] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (categories.length > 0 || items.length > 0) {
      localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
      localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
    }
  }, [categories, items]);

  const loadData = () => {
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
      console.error("Erreur chargement wishlist:", error);
    }
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory: WishlistCategory = {
      id: generateId(),
      name: newCategoryName.trim(),
      display_order: categories.length,
    };
    
    setCategories([...categories, newCategory]);
    setNewCategoryName("");
    setIsAddingCategory(false);
    setActiveTab(newCategory.id);
    toast.success("Onglet créé");
  };

  const updateCategory = (id: string, name: string) => {
    if (!name.trim()) return;
    setCategories(categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)));
    setEditingCategoryId(null);
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
    setItems(items.map((i) => (i.category_id === id ? { ...i, category_id: null } : i)));
    if (activeTab === id) setActiveTab("__all__");
    toast.success("Onglet supprimé");
  };

  const addItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: WishlistItem = {
      id: generateId(),
      text: newItemText.trim(),
      category_id: activeTab === "__all__" ? null : activeTab,
      product_url: newItemUrl.trim() || null,
      supplier: newItemSupplier.trim() || null,
      estimated_price: newItemPrice ? parseFloat(newItemPrice) : null,
      status: "pending",
      priority: 0,
      created_at: new Date().toISOString(),
      ordered_at: null,
      received_at: null,
    };
    
    setItems([newItem, ...items]);
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
    
    setItems(items.map((i) => (i.id === item.id ? { ...i, ...updates } : i)));
  };

  const togglePriority = (item: WishlistItem) => {
    const newPriority = item.priority === 1 ? 0 : 1;
    setItems(items.map((i) => (i.id === item.id ? { ...i, priority: newPriority } : i)));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const clearReceived = () => {
    const receivedIds = getFilteredItems().filter((i) => i.status === "received").map((i) => i.id);
    if (receivedIds.length === 0) return;
    setItems(items.filter((i) => !receivedIds.includes(i.id)));
    toast.success(`${receivedIds.length} élément(s) supprimé(s)`);
  };

  const getFilteredItems = () => {
    if (activeTab === "__all__") return items;
    return items.filter((i) => i.category_id === activeTab);
  };

  const getPendingCountForCategory = (categoryId: string | null) => {
    if (categoryId === null) return items.filter((i) => i.status === "pending").length;
    return items.filter((i) => i.category_id === categoryId && i.status === "pending").length;
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
          : "bg-card hover:bg-muted/50"
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium ${item.status === "received" ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
              {item.priority === 1 && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Urgent</Badge>}
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
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />Liste de souhaits
          </DialogTitle>
        </DialogHeader>

        <div className="flex-shrink-0 border-b bg-muted/30">
          <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <button onClick={() => setActiveTab("__all__")} className={`px-4 py-2.5 text-sm font-medium border-r whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === "__all__" ? "bg-background text-primary border-b-2 border-b-primary" : "hover:bg-muted text-muted-foreground"}`}>
              📋 Tous<Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </button>

            {categories.map((cat) => (
              <div key={cat.id} className={`flex items-center border-r ${activeTab === cat.id ? "bg-background border-b-2 border-b-primary" : "hover:bg-muted"}`}>
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
              <button onClick={() => setIsAddingCategory(true)} className="px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Ajouter un onglet"><FolderPlus className="h-4 w-4" /></button>
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
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Input value={newItemUrl} onChange={(e) => setNewItemUrl(e.target.value)} placeholder="URL du produit..." className="text-sm" />
              <Input value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)} placeholder="Fournisseur..." className="text-sm" />
              <Input type="number" step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Prix estimé..." className="text-sm" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredItems.length === 0 ? (
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
