import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Trash2, AlertTriangle, ShoppingCart, 
  Clock, Package, PackageCheck, ChevronRight 
} from "lucide-react";
import { toast } from "sonner";

type ItemStatus = "pending" | "ordered" | "received";

interface WishlistItem {
  id: string;
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

const STORAGE_KEY = "wishlist_items";

const getStoredItems = (): WishlistItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveItems = (items: WishlistItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

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
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open]);

  const loadItems = () => {
    setLoading(true);
    const storedItems = getStoredItems();
    // Sort: by status, then priority, then created_at
    storedItems.sort((a, b) => {
      const statusOrder = { pending: 0, ordered: 1, received: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setItems(storedItems);
    setLoading(false);
  };

  const addItem = () => {
    if (!newItemText.trim()) return;

    const newItem: WishlistItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      status: "pending",
      priority: 0,
      created_at: new Date().toISOString(),
      ordered_at: null,
      received_at: null,
    };

    const updatedItems = [newItem, ...items];
    setItems(updatedItems);
    saveItems(updatedItems);
    setNewItemText("");
  };

  const updateStatus = (item: WishlistItem, newStatus: ItemStatus) => {
    const updates: Partial<WishlistItem> = { status: newStatus };
    
    if (newStatus === "ordered" && !item.ordered_at) {
      updates.ordered_at = new Date().toISOString();
    } else if (newStatus === "received" && !item.received_at) {
      updates.received_at = new Date().toISOString();
    }

    const updatedItems = items.map((i) =>
      i.id === item.id ? { ...i, ...updates } : i
    );
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  const togglePriority = (item: WishlistItem) => {
    const newPriority = item.priority === 1 ? 0 : 1;
    const updatedItems = items.map((i) =>
      i.id === item.id ? { ...i, priority: newPriority } : i
    );
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  const deleteItem = (id: string) => {
    const updatedItems = items.filter((i) => i.id !== id);
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  const clearReceived = () => {
    const receivedCount = items.filter((i) => i.status === "received").length;
    if (receivedCount === 0) return;

    const updatedItems = items.filter((i) => i.status !== "received");
    setItems(updatedItems);
    saveItems(updatedItems);
    toast.success(`${receivedCount} élément(s) supprimé(s)`);
  };

  const pendingItems = items.filter((i) => i.status === "pending");
  const orderedItems = items.filter((i) => i.status === "ordered");
  const receivedItems = items.filter((i) => i.status === "received");

  const StatusBadge = ({ status }: { status: ItemStatus }) => {
    if (status === "pending") {
      return (
        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" />
          À commander
        </Badge>
      );
    }
    if (status === "ordered") {
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
          <Package className="h-3 w-3 mr-1" />
          Commandé
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
        <PackageCheck className="h-3 w-3 mr-1" />
        Reçu
      </Badge>
    );
  };

  const ItemRow = ({ item }: { item: WishlistItem }) => {
    const nextStatus: ItemStatus | null = 
      item.status === "pending" ? "ordered" : 
      item.status === "ordered" ? "received" : 
      null;

    return (
      <div
        className={`p-3 rounded-lg border group ${
          item.status === "received" 
            ? "bg-green-50/50 border-green-200 opacity-70" 
            : item.status === "ordered"
            ? "bg-blue-50/50 border-blue-200"
            : item.priority === 1 
            ? "bg-orange-50 border-orange-200" 
            : "bg-white border-gray-200"
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
              <span title={formatDate(item.created_at)}>
                📝 Ajouté le {formatShortDate(item.created_at)}
              </span>
              {item.ordered_at && (
                <span title={formatDate(item.ordered_at)}>
                  📦 Commandé le {formatShortDate(item.ordered_at)}
                </span>
              )}
              {item.received_at && (
                <span title={formatDate(item.received_at)}>
                  ✅ Reçu le {formatShortDate(item.received_at)}
                </span>
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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => updateStatus(item, nextStatus)}
              >
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
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Liste de souhaits
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            {pendingItems.length} à commander
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
            <Package className="h-3 w-3 mr-1" />
            {orderedItems.length} en attente
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <PackageCheck className="h-3 w-3 mr-1" />
            {receivedItems.length} reçu(s)
          </Badge>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Ajouter un article à commander..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <Button onClick={addItem} disabled={!newItemText.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Aucun article dans la liste</p>
              <p className="text-sm">Ajoutez des consommables ou matériels à commander</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-yellow-700">
                    <Clock className="h-4 w-4" />
                    À commander ({pendingItems.length})
                  </h4>
                  <div className="space-y-2">
                    {pendingItems.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {orderedItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-blue-700">
                    <Package className="h-4 w-4" />
                    En attente de livraison ({orderedItems.length})
                  </h4>
                  <div className="space-y-2">
                    {orderedItems.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {receivedItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-green-700">
                    <PackageCheck className="h-4 w-4" />
                    Reçus ({receivedItems.length})
                  </h4>
                  <div className="space-y-2">
                    {receivedItems.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {receivedItems.length > 0 && (
          <div className="flex justify-end pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={clearReceived}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer les reçus ({receivedItems.length})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WishlistDialog;