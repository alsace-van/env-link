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