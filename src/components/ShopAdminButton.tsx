import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

/**
 * Composant à ajouter dans votre Dashboard ou page Admin
 * pour accéder rapidement à l'administration de la boutique
 */
export const ShopAdminButton = () => {
  const navigate = useNavigate();

  return (
    <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/admin/shop")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Boutique
        </CardTitle>
        <CardDescription>
          Gérer les produits, commandes et clients
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={(e) => {
            e.stopPropagation();
            navigate("/admin/shop");
          }}>
            Produits
          </Button>
          <Button variant="outline" size="sm" onClick={(e) => {
            e.stopPropagation();
            navigate("/admin/orders");
          }}>
            Commandes
          </Button>
          <Button variant="outline" size="sm" onClick={(e) => {
            e.stopPropagation();
            navigate("/admin/customers");
          }}>
            Clients
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Alternative : Bouton simple à ajouter dans une toolbar
 */
export const ShopAdminSimpleButton = () => {
  const navigate = useNavigate();

  return (
    <Button onClick={() => navigate("/admin/shop")} variant="outline">
      <ShoppingBag className="h-4 w-4 mr-2" />
      Administration Boutique
    </Button>
  );
};

/**
 * INSTRUCTIONS D'UTILISATION :
 * 
 * 1. Créer ce fichier : src/components/ShopAdminButton.tsx
 * 
 * 2. Dans votre Dashboard.tsx ou Admin.tsx, importer et utiliser :
 * 
 * import { ShopAdminButton } from "@/components/ShopAdminButton";
 * 
 * // Puis dans le JSX, ajouter parmi vos autres cards :
 * <ShopAdminButton />
 * 
 * // Ou utiliser le bouton simple dans une toolbar :
 * import { ShopAdminSimpleButton } from "@/components/ShopAdminButton";
 * <ShopAdminSimpleButton />
 */
