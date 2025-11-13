import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AccessoiresShopList } from "@/components/AccessoiresShopList";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface Project {
  id: string;
  nom: string;
}

const Shop = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
    } else {
      setUser(session.user);
      await loadProjects(session.user.id);
    }
    setLoading(false);
  };

  const loadProjects = async (userId: string) => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, nom")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des projets:", error);
      toast.error("Erreur lors du chargement des projets");
      return;
    }

    setProjects(data || []);
    if (data && data.length > 0) {
      setSelectedProjectId(data[0].id);
    }
  };

  const handleAddToProject = async (items: any[]) => {
    if (!selectedProjectId) {
      toast.error("Veuillez sélectionner un projet");
      return;
    }

    try {
      const expenses = items.map((item) => ({
        project_id: selectedProjectId,
        user_id: user.id,
        accessory_id: item.accessory_id,
        nom_accessoire: item.nom,
        marque: item.marque,
        quantite: item.quantity,
        prix_unitaire: item.prix_unitaire,
        prix_vente_ttc: item.prix_vente_ttc,
        total_amount: item.total,
        fournisseur: item.fournisseur,
        categorie: "Accessoires",
        expense_date: new Date().toISOString().split('T')[0],
        statut_livraison: "commande",
        statut_paiement: "pending",
      }));

      const { error } = await supabase
        .from("project_expenses")
        .insert(expenses);

      if (error) throw error;

      toast.success(`${items.length} article(s) ajouté(s) au projet`);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout au projet");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <img 
              src={logo} 
              alt="Alsace Van Création" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Boutique</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Vous devez créer un projet avant de pouvoir faire des achats dans la boutique.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Créer un projet
            </Button>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">
                Sélectionnez le projet pour vos achats
              </label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choisir un projet" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProjectId && (
              <AccessoiresShopList
                projectId={selectedProjectId}
                onAddToProject={handleAddToProject}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Shop;
