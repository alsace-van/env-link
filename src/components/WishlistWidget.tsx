import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import WishlistDialog from "@/components/WishlistDialog";

interface WishlistWidgetProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showCount?: boolean;
}

interface WishlistItem {
  id: string;
  status: "pending" | "ordered" | "received";
}

const ITEMS_KEY = "wishlist_items";

const WishlistWidget = ({ variant = "outline", size = "sm", showCount = true }: WishlistWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [orderedCount, setOrderedCount] = useState(0);

  useEffect(() => {
    loadCounts();
    
    // Listen for storage changes
    const handleStorageChange = () => loadCounts();
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Reload when dialog closes
  useEffect(() => {
    if (!open) {
      loadCounts();
    }
  }, [open]);

  const loadCounts = () => {
    try {
      const storedItems = localStorage.getItem(ITEMS_KEY);
      if (storedItems) {
        const items: WishlistItem[] = JSON.parse(storedItems);
        setPendingCount(items.filter((i) => i.status === "pending").length);
        setOrderedCount(items.filter((i) => i.status === "ordered").length);
      } else {
        setPendingCount(0);
        setOrderedCount(0);
      }
    } catch (error) {
      console.error("Error loading wishlist counts:", error);
      setPendingCount(0);
      setOrderedCount(0);
    }
  };

  const totalCount = pendingCount + orderedCount;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} className="relative">
        <ShoppingCart className="h-4 w-4 mr-2" />
        Wishlist
        {showCount && totalCount > 0 && (
          <Badge variant={pendingCount > 0 ? "destructive" : "secondary"} className="ml-2 h-5 min-w-5 px-1.5 text-xs">
            {totalCount}
          </Badge>
        )}
      </Button>
      <WishlistDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default WishlistWidget;
