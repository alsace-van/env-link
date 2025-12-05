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
  created_at: string;
  ordered_at: string | null;
  received_at: string | null;
}

interface WishlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY_ITEMS = "wishlist_items";
const STORAGE_KEY_CATEGORIES = "wishlist_categories";

const generateId = () => crypto.randomUUID();

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
};

const WishlistDialog = ({ open, onOpenChange }: WishlistDialogProps) => {
  const [categories, setCategories] = useState<WishlistCategory[]>([]);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("__all__");
  const [newItemText, setNewItemText] = useState("");
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    }
  }, [items, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    }
  }, [categories, loading]);

  const loadData = () => {
    setLoading(true);

    try {
      const storedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }

      const storedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (storedItems) {
        setItems(JSON.parse(storedItems));
      }
    } catch (error) {
      console.error("Erreur chargement wishlist:", error);
      toast.error("Erreur lors du chargement de la liste");
    }

    setLoading(false);
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
    // Move items to "no category"
    setItems(items.map((i) => (i.category_id === id ? { ...i, category_id: null } : i)));
    setCategories(categories.filter((c) => c.id !== id));
    
    if (activeTab === id) {
      setActiveTab("__all__");
    }
    toast.success("Onglet supprimé");
  };

  const addItem = () => {
    if (!newItemText.trim()) return;

    const categoryId = activeTab === "__all__" ? null : activeTab;

    const newItem: WishlistItem = {
      id: generateId(),
      text: newItemText.trim(),
      category_id: categoryId,
      status: "pending",
      priority: 0,
      created_at: new Date().toISOString(),
      ordered_at: null,
      received_at: null,
    };

    setItems([newItem, ...items]);
    setNewItemText("");
  };

  const updateStatus = (item: WishlistItem, newStatus: ItemStatus) => {
    const updates: Partial<WishlistItem> = { status: newStatus };

    if (newStatus === "ordered" && !item.ordered_at) {
      updates.ordered_at = new Date().toISOString();
    } else if (newStatus === "received" && !item.received_at) {
      updates.received_at = new Date().toISOString();
    }

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
    const filteredItems = getFilteredItems();
    const receivedIds = filteredItems.filter((i) => i.status === "received").map((i) => i.id);
    if (receivedIds.length === 0) return;

    setItems(items.filter((i) => !receivedIds.includes(i.id)));
    toast.success(`${receivedIds.length} élément(s) supprimé(s)`);
  };

  const getFilteredItems = () => {
    if (activeTab === "__all__") {
      return items;
    }
    return items.filter((i) => i.category_id === activeTab);
  };

  const getPendingCountForCategory = (categoryId: string | null) => {
    if (categoryId === null) {
      return items.filter((i) => i.status === "pending").length;
    }
    return items.filter((i) => i.category_id === categoryId && i.status === "pending").length;
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
            ? "bg-green-50/50 border-green-200 opacity-70"
            : item.status === "ordered"
              ? "bg-blue-50/50 border-blue-200"
              : item.priority === 1
                ? "bg-orange-50 border-orange-200"
                : "bg-white border-gray-200 hover:border-gray-300"
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {item.priority === 1 && item.status === "pending" && (
                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              )}
              <span className={`font-medium ${item.status === "received" ? "line-through text-muted-foreground" : ""}`}>
                {item.text}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span title={formatDate(item.created_at)}>📝 {formatShortDate(item.created_at)}</span>
              {item.ordered_at && (
                <span title={formatDate(item.ordered_at)}>📦 {formatShortDate(item.ordered_at)}</span>
              )}
              {item.received_at && (
                <span title={formatDate(item.received_at)}>✅ {formatShortDate(item.received_at)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {item.status === "pending" && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${
                  item.priority === 1 ? "text-orange-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                }`}
                onClick={() => togglePriority(item)}
                title={item.priority === 1 ? "Retirer urgent" : "Marquer urgent"}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            )}

            {nextStatus && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateStatus(item, nextStatus)}>
                {nextStatus === "ordered" ? (
                  <>
                    <Package className="h-3 w-3 mr-1" />
                    Commandé
                  </>
                ) : (
                  <>
                    <PackageCheck className="h-3 w-3 mr-1" />
                    Reçu
                  </>
                )}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
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
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Liste de souhaits
          </DialogTitle>
        </DialogHeader>

        {/* Onglets */}
        <div className="flex-shrink-0 border-b bg-muted/30">
          <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {/* Onglet "Tous" */}
            <button
              onClick={() => setActiveTab("__all__")}
              className={`px-4 py-2.5 text-sm font-medium border-r whitespace-nowrap flex items-center gap-2 transition-colors ${
                activeTab === "__all__"
                  ? "bg-white dark:bg-gray-900 text-primary border-b-2 border-b-primary"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground"
              }`}
            >
              📋 Tous
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </button>

            {/* Onglets des catégories */}
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`flex items-center border-r ${
                  activeTab === cat.id
                    ? "bg-white dark:bg-gray-900 border-b-2 border-b-primary"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {editingCategoryId === cat.id ? (
                  <div className="flex items-center px-2 py-1">
                    <Input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="h-7 w-24 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateCategory(cat.id, editingCategoryName);
                        } else if (e.key === "Escape") {
                          setEditingCategoryId(null);
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-1"
                      onClick={() => updateCategory(cat.id, editingCategoryName)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setActiveTab(cat.id)}
                      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${
                        activeTab === cat.id ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {cat.name}
                      {getPendingCountForCategory(cat.id) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {getPendingCountForCategory(cat.id)}
                        </Badge>
                      )}
                    </button>
                    {activeTab === cat.id && (
                      <div className="flex items-center pr-2 gap-1">
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
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Bouton ajouter onglet */}
            {isAddingCategory ? (
              <div className="flex items-center px-2 py-1">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nom..."
                  className="h-7 w-24 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addCategory();
                    } else if (e.key === "Escape") {
                      setIsAddingCategory(false);
                      setNewCategoryName("");
                    }
                  }}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={addCategory}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingCategory(true)}
                className="px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Ajouter un onglet"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Zone d'ajout */}
        <div className="flex-shrink-0 px-6 py-3 border-b bg-muted/20">
          <div className="flex gap-2">
            <Input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Ajouter un élément..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem();
              }}
            />
            <Button onClick={addItem} disabled={!newItemText.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Liste des items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucun élément dans cette liste</div>
          ) : (
            <div className="space-y-6">
              {/* Items en attente */}
              {pendingItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />À commander ({pendingItems.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingItems
                      .sort((a, b) => b.priority - a.priority)
                      .map((item) => (
                        <ItemRow key={item.id} item={item} />
                      ))}
                  </div>
                </div>
              )}

              {/* Items commandés */}
              {orderedItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-blue-600 mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Commandé ({orderedItems.length})
                  </h3>
                  <div className="space-y-2">
                    {orderedItems.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Items reçus */}
              {receivedItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-green-600 flex items-center gap-2">
                      <PackageCheck className="h-4 w-4" />
                      Reçu ({receivedItems.length})
                    </h3>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={clearReceived}>
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WishlistDialog;
