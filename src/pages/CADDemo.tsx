// ============================================
// PAGE TEST: CAD Gabarit Canvas
// Route: /cad-demo
// VERSION: 1.0
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Test CAD Gabarit Canvas</h1>
          <p className="text-sm text-muted-foreground">
            Module CAO professionnel - Page de test à supprimer
          </p>
        </div>

        <div className="text-xs text-muted-foreground bg-yellow-100 px-2 py-1 rounded">
          🧪 MODE TEST
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
        <div className="max-w-4xl mx-auto text-sm text-blue-800">
          <strong>Instructions :</strong>{" "}
          <span className="text-blue-600">
            V=Sélection | H=Pan | L=Ligne | C=Cercle | R=Rectangle | D=Cotation | 
            Molette=Zoom | Clic milieu=Pan | Échap=Annuler
          </span>
        </div>
      </div>

      {/* Canvas CAD */}
      <div className="p-4">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
          <CADGabaritCanvas
            scaleFactor={2.5}
            templateId="test-demo"
            onSave={handleSave}
          />
        </div>
      </div>

      {/* Info panel */}
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Snap */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-medium mb-2">🧲 Types de Snap</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>□ Extrémité (carré)</li>
                <li>△ Milieu (triangle)</li>
                <li>⊕ Centre (cercle+croix)</li>
                <li>✕ Intersection (X)</li>
                <li>◇ Quadrant (losange)</li>
                <li>○ Plus proche (cercle)</li>
              </ul>
            </div>

            {/* Contraintes */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-medium mb-2">🔗 Contraintes</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>─ Horizontal</li>
                <li>│ Vertical</li>
                <li>⊥ Perpendiculaire</li>
                <li>∥ Parallèle</li>
                <li>= Égal</li>
                <li>● Coïncident</li>
                <li>⚓ Fixe</li>
              </ul>
            </div>

            {/* Export */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-medium mb-2">📤 Export</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✅ DXF (Fusion 360, AutoCAD)</li>
                <li>✅ SVG (Web, Illustrator)</li>
                <li>✅ JSON (sauvegarde interne)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Le DXF est au format AutoCAD 2000, compatible avec la plupart des logiciels CAO.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-muted-foreground">
        <p>
          Module CAD Gabarit v1.0 - Solveur simplifié intégré
          <br />
          Pour le solveur complet : <code>npm install @salusoft89/planegcs</code>
        </p>
      </div>
    </div>
  );
}
