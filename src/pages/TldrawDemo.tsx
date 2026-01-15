// ============================================
// PAGE: TldrawDemo
// Page de test pour le nouveau canvas tldraw
// VERSION: 1.1 - Fix import TldrawGabaritCanvas (import default)
// ============================================

import { useState } from "react";
import TldrawGabaritCanvas from "@/components/photo-templates/TldrawGabaritCanvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TldrawDemo() {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [scaleFactor, setScaleFactor] = useState<number>(2.5); // pixels par mm
  const [showCanvas, setShowCanvas] = useState(false);
  const [savedData, setSavedData] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (data: any) => {
    setSavedData(data);
    console.log("Données sauvegardées:", data);
  };

  // Image de test par défaut (placeholder)
  const defaultTestImage = "https://placehold.co/800x600/f3f4f6/6b7280?text=Image+de+test";

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Test Canvas tldraw</h1>
            <p className="text-muted-foreground">Prototype du nouveau canvas pour gabarits CNC</p>
          </div>
        </div>

        {!showCanvas ? (
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Configurez l'image et l'échelle avant de commencer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload image */}
              <div className="space-y-2">
                <Label>Image de fond (optionnel)</Label>
                <Input type="file" accept="image/*" onChange={handleFileUpload} />
                {imageUrl && <img src={imageUrl} alt="Preview" className="max-w-md rounded border" />}
              </div>

              {/* Échelle */}
              <div className="space-y-2">
                <Label>Facteur d'échelle (pixels par mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={scaleFactor}
                  onChange={(e) => setScaleFactor(parseFloat(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">Exemple: 2.5 = 1 pixel représente 0.4mm</p>
              </div>

              {/* Boutons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!imageUrl) setImageUrl(defaultTestImage);
                    setShowCanvas(true);
                  }}
                >
                  Lancer le canvas
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImageUrl(defaultTestImage);
                    setShowCanvas(true);
                  }}
                >
                  Utiliser image de test
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowCanvas(false)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à la config
              </Button>
              {savedData && (
                <span className="text-sm text-green-600">
                  ✓ Dernière sauvegarde: {new Date(savedData.savedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Canvas tldraw */}
            <Card className="overflow-hidden">
              <TldrawGabaritCanvas
                imageUrl={imageUrl}
                scaleFactor={scaleFactor}
                templateId="demo-test"
                initialData={savedData}
                onSave={handleSave}
              />
            </Card>

            {/* Fonctionnalités */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fonctionnalités disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium">🖊️ Dessin</p>
                    <ul className="text-muted-foreground text-xs">
                      <li>• Ligne droite</li>
                      <li>• Rectangle</li>
                      <li>• Ellipse</li>
                      <li>• Crayon libre</li>
                      <li>• Flèche</li>
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">✏️ Édition</p>
                    <ul className="text-muted-foreground text-xs">
                      <li>• Sélection multiple</li>
                      <li>• Redimensionnement</li>
                      <li>• Rotation</li>
                      <li>• Undo/Redo</li>
                      <li>• Supprimer</li>
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">🔍 Navigation</p>
                    <ul className="text-muted-foreground text-xs">
                      <li>• Zoom molette</li>
                      <li>• Pan (clic droit)</li>
                      <li>• Reset vue</li>
                      <li>• Plein écran</li>
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">📤 Export</p>
                    <ul className="text-muted-foreground text-xs">
                      <li>• SVG vectoriel</li>
                      <li>• DXF (Fusion 360)</li>
                      <li>• Sauvegarde locale</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
