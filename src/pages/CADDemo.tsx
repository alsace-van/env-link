// ============================================
// PAGE TEST: CAD Gabarit Canvas
// Route: /cad-demo
// VERSION: 1.1 - v7.54n: Optimisation espace écran
// À SUPPRIMER après validation
// ============================================

import { CADGabaritCanvas } from "@/components/cad-gabarit";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function CADDemo() {
  const navigate = useNavigate();

  const handleSave = (data: any) => {
    console.log("Données sauvegardées:", data);
    toast.success("Données sauvegardées dans la console !");
    
    // Afficher un résumé
    const summary = {
      points: Object.keys(data.points || {}).length,
      geometries: Object.keys(data.geometries || {}).length,
      constraints: Object.keys(data.constraints || {}).length,
      dimensions: Object.keys(data.dimensions || {}).length,
    };
    console.table(summary);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header compact */}
      <div className="bg-white border-b px-3 py-1.5 flex items-center gap-3 flex-shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        
        <div className="flex-1">
          <h1 className="text-sm font-semibold">Test CAD Gabarit Canvas</h1>
        </div>

        <div className="text-xs text-muted-foreground bg-yellow-100 px-2 py-0.5 rounded">
          🧪 MODE TEST
        </div>
      </div>

      {/* Canvas CAD - prend tout l'espace restant */}
      <div className="flex-1 min-h-0">
        <CADGabaritCanvas
          scaleFactor={2.5}
          templateId="test-demo"
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
