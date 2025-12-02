// Composant pour détecter si un produit existe déjà (même référence fabricant)
// et proposer de le regrouper

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package,
  Link2,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

// ============================================
// TYPES
// ============================================

interface ExistingProduct {
  id: string;
  nom: string;
  marque: string | null;
  fournisseur: string | null;
  prix_reference: number | null;
  product_group_id: string | null;
  reference_fabricant: string | null;
}

interface ProductGroupInfo {
  id: string;
  nom: string;
  marque: string | null;
  reference_fabricant: string;
  description: string | null;
  image_url: string | null;
  specs_communes: Record<string, any>;
}

interface ProductGroupDetectorProps {
  referenceFabricant: string;
  onGroupSelect: (group: ProductGroupInfo | null) => void;
  onExistingProductSelect: (product: ExistingProduct | null) => void;
  excludeAccessoryId?: string; // Pour exclure le produit en cours d'édition
}

// ============================================
// HOOK DE DEBOUNCE (si pas déjà existant)
// ============================================

function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export const ProductGroupDetector = ({
  referenceFabricant,
  onGroupSelect,
  onExistingProductSelect,
  excludeAccessoryId,
}: ProductGroupDetectorProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>([]);
  const [productGroup, setProductGroup] = useState<ProductGroupInfo | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const debouncedRef = useDebounceValue(referenceFabricant, 500);

  // Rechercher les produits existants avec la même référence
  useEffect(() => {
    const searchExisting = async () => {
      if (!debouncedRef || debouncedRef.length < 2) {
        setExistingProducts([]);
        setProductGroup(null);
        setIsLinked(false);
        return;
      }

      setIsSearching(true);
      setDismissed(false);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Chercher les accessoires avec la même référence fabricant
        let query = (supabase as any)
          .from("accessories_catalog")
          .select("id, nom, marque, fournisseur, prix_reference, product_group_id, reference_fabricant")
          .eq("user_id", user.id)
          .ilike("reference_fabricant", debouncedRef);

        if (excludeAccessoryId) {
          query = query.neq("id", excludeAccessoryId);
        }

        const { data: products, error } = await query;

        if (error) {
          console.error("Erreur recherche produits:", error);
          return;
        }

        setExistingProducts(products || []);

        // Si un produit a un group_id, récupérer les infos du groupe
        const withGroup = products?.find((p: ExistingProduct) => p.product_group_id);
        if (withGroup?.product_group_id) {
          const { data: group } = await (supabase as any)
            .from("product_groups")
            .select("*")
            .eq("id", withGroup.product_group_id)
            .single();

          setProductGroup(group || null);
        } else if (products && products.length > 0) {
          // Créer un groupe virtuel basé sur le premier produit trouvé
          const firstProduct = products[0];
          setProductGroup({
            id: "", // Pas encore de groupe
            nom: firstProduct.nom,
            marque: firstProduct.marque,
            reference_fabricant: firstProduct.reference_fabricant || debouncedRef,
            description: null,
            image_url: null,
            specs_communes: {},
          });
        } else {
          setProductGroup(null);
        }
      } catch (error) {
        console.error("Erreur searchExisting:", error);
      } finally {
        setIsSearching(false);
      }
    };

    searchExisting();
  }, [debouncedRef, excludeAccessoryId]);

  const handleLink = () => {
    setIsLinked(true);
    onGroupSelect(productGroup);
    if (existingProducts.length > 0) {
      onExistingProductSelect(existingProducts[0]);
    }
  };

  const handleDismiss = () => {
    setIsLinked(false);
    setDismissed(true);
    onGroupSelect(null);
    onExistingProductSelect(null);
  };

  // Ne rien afficher si pas de référence ou pas de produits existants
  if (!debouncedRef || debouncedRef.length < 2 || dismissed) {
    return null;
  }

  if (isSearching) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Recherche de produits similaires...
      </div>
    );
  }

  if (existingProducts.length === 0) {
    return null;
  }

  // Produits trouvés
  return (
    <Alert className={isLinked ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-amber-500 bg-amber-50 dark:bg-amber-950"}>
      <div className="flex items-start gap-3">
        {isLinked ? (
          <Check className="h-5 w-5 text-green-500 mt-0.5" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
        )}
        
        <div className="flex-1 space-y-2">
          <AlertDescription className="text-sm font-medium">
            {isLinked
              ? "Produit lié - Les infos techniques seront récupérées"
              : `Ce produit existe déjà chez ${existingProducts.length} fournisseur(s)`}
          </AlertDescription>

          {/* Liste des fournisseurs existants */}
          <div className="flex flex-wrap gap-2">
            {existingProducts.map((product) => (
              <Badge
                key={product.id}
                variant="secondary"
                className="text-xs"
              >
                <Package className="h-3 w-3 mr-1" />
                {product.fournisseur || "Sans fournisseur"} - {product.prix_reference || 0}€
              </Badge>
            ))}
          </div>

          {/* Actions */}
          {!isLinked && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleLink}
                className="h-7 text-xs"
              >
                <Link2 className="h-3 w-3 mr-1" />
                Regrouper avec ce produit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Non, c'est différent
              </Button>
            </div>
          )}

          {isLinked && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-7 text-xs mt-2"
            >
              Annuler le regroupement
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
};

// ============================================
// COMPOSANT INFOS PRÉ-REMPLIES
// ============================================

interface PrefilledInfosProps {
  product: ExistingProduct;
}

export const PrefilledProductInfos = ({ product }: PrefilledInfosProps) => {
  return (
    <Card className="bg-muted/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Check className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Infos récupérées automatiquement</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Nom :</span>
            <span className="ml-1 font-medium">{product.nom}</span>
          </div>
          {product.marque && (
            <div>
              <span className="text-muted-foreground">Marque :</span>
              <span className="ml-1 font-medium">{product.marque}</span>
            </div>
          )}
          {product.reference_fabricant && (
            <div>
              <span className="text-muted-foreground">Réf. fabricant :</span>
              <span className="ml-1 font-medium">{product.reference_fabricant}</span>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-2">
          Vous n'avez plus qu'à saisir le fournisseur et le prix d'achat.
        </p>
      </CardContent>
    </Card>
  );
};

export default ProductGroupDetector;
