import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ShopAdmin() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Administration Boutique</h1>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Produits</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Gérer les produits simples, bundles et kits
            </p>
            <Button>Gérer les produits</Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Catégories</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Organiser l'arborescence de la boutique
            </p>
            <Button>Gérer les catégories</Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Commandes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Suivre et gérer les commandes
            </p>
            <Button>Voir les commandes</Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
