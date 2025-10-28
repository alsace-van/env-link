import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const PhotosDiagnostic = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isSimpleModalOpen, setIsSimpleModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  const testImageUrl = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800";

  const addResult = (message: string, isSuccess: boolean) => {
    const emoji = isSuccess ? "✅" : "❌";
    setTestResults(prev => [...prev, `${emoji} ${message}`]);
    console.log(`[Diagnostic] ${emoji} ${message}`);
  };

  const runTest1 = () => {
    addResult("Test 1: Bouton cliqué", true);
    try {
      setIsSimpleModalOpen(true);
      addResult("Test 1: État du modal changé à true", true);
    } catch (error) {
      addResult(`Test 1: Erreur - ${error}`, false);
    }
  };

  const runTest2 = () => {
    addResult("Test 2: Tentative d'ouverture modal avec image", true);
    try {
      setIsImageModalOpen(true);
      addResult("Test 2: État du modal image changé à true", true);
    } catch (error) {
      addResult(`Test 2: Erreur - ${error}`, false);
    }
  };

  const runTest3 = () => {
    addResult("Test 3: Vérification Paper.js", true);
    try {
      import('paper').then((paper) => {
        if (paper) {
          addResult("Test 3: Paper.js est disponible", true);
        } else {
          addResult("Test 3: Paper.js n'est pas disponible", false);
        }
      }).catch((error) => {
        addResult(`Test 3: Paper.js manquant - ${error}`, false);
      });
    } catch (error) {
      addResult(`Test 3: Erreur - ${error}`, false);
    }
  };

  const runTest4 = () => {
    addResult("Test 4: Test de chargement d'image", true);
    const img = new Image();
    img.onload = () => {
      addResult(`Test 4: Image chargée avec succès (${img.width}x${img.height})`, true);
    };
    img.onerror = () => {
      addResult("Test 4: Erreur de chargement d'image", false);
    };
    img.src = testImageUrl;
  };

  return (
    <div className="fixed bottom-4 left-4 z-[999] max-w-md">
      <div className="bg-white border-2 border-red-500 rounded-lg shadow-2xl p-4">
        <h2 className="text-lg font-bold mb-3 text-red-600">🔧 Diagnostic Photos</h2>
        
        <div className="space-y-2 mb-4">
          <Button onClick={runTest1} variant="outline" size="sm" className="w-full">
            Test 1: Dialog Simple
          </Button>
          <Button onClick={runTest2} variant="outline" size="sm" className="w-full">
            Test 2: Dialog avec Image
          </Button>
          <Button onClick={runTest3} variant="outline" size="sm" className="w-full">
            Test 3: Paper.js Disponible?
          </Button>
          <Button onClick={runTest4} variant="outline" size="sm" className="w-full">
            Test 4: Chargement Image
          </Button>
          <Button onClick={() => setTestResults([])} variant="destructive" size="sm" className="w-full">
            Effacer Résultats
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="bg-gray-100 rounded p-3 max-h-60 overflow-y-auto">
            <p className="text-xs font-semibold mb-2">Résultats:</p>
            {testResults.map((result, idx) => (
              <p key={idx} className="text-xs mb-1 font-mono">{result}</p>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-gray-600 border-t pt-2">
          <p>Status modals:</p>
          <p>Simple: {isSimpleModalOpen ? "🟢 Ouvert" : "⚪ Fermé"}</p>
          <p>Image: {isImageModalOpen ? "🟢 Ouvert" : "⚪ Fermé"}</p>
        </div>
      </div>

      <Dialog open={isSimpleModalOpen} onOpenChange={setIsSimpleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Test 1 Réussi !</DialogTitle>
            <DialogDescription>Le système de Dialog fonctionne correctement</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Si vous voyez ceci, le système de Dialog fonctionne correctement.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Test 2: Affichage Image</DialogTitle>
            <DialogDescription>Test d'affichage d'une image simple</DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
            <img 
              src={testImageUrl}
              alt="Test"
              className="max-w-full max-h-full object-contain"
              onLoad={() => addResult("Test 2: Image affichée dans le modal", true)}
              onError={() => addResult("Test 2: Erreur d'affichage de l'image", false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotosDiagnostic;
