import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WishlistDialog from "@/components/WishlistDialog";

interface WishlistWidgetProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showCount?: boolean;
}

const WishlistWidget = ({ variant = "outline", size = "sm", showCount = true }: WishlistWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [orderedCount, setOrderedCount] = useState(0);

  useEffect(() => {
    loadCounts();
    const channel = supabase
      .channel("wishlist_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist_items" }, () => loadCounts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadCounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("wishlist_items").select("status").eq("user_id", user.id);
    if (data) {
      setPendingCount(data.filter(i => i.status === "pending").length);
      setOrderedCount(data.filter(i => i.status === "ordered").length);
    }
  };

  const totalCount = pendingCount + orderedCount;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} className="relative">
        <ShoppingCart className="h-4 w-4 mr-2" />
        Wishlist
        {showCount && totalCount > 0 && (
          <Badge variant={pendingCount > 0 ? "destructive" : "secondary"} className="ml-2 h-5 min-w-5 px-1.5 text-xs">{totalCount}</Badge>
        )}
      </Button>
      <WishlistDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default WishlistWidget;
