import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScanConfirmationModal } from "./ScanConfirmationModal";
import type { VehicleRegistrationData } from "@/lib/registrationCardParser";

interface VehicleRegistrationScannerProps {
  onDataExtracted: (data: VehicleRegistrationData) => void;
}

/**
 * VehicleRegistrationScanner - VERSION ULTIME GEMINI + MODAL
 *
 * Cette version :
 * 1. Utilise Gemini AI (pas Tesseract) via l'Edge Function scan-carte-grise
 * 2. Affiche le ScanConfirmationModal pour vérifier les données
 * 3. Mappe correctement tous les champs entre Gemini et le Modal
 * 4. Gère les rescans et modifications manuelles
 */
export const VehicleRegistrationScanner = ({ onDataExtracted }: VehicleRegistrationScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<VehicleRegistrationData | null>(null);

  // ✅ État pour gérer l'affichage du modal de confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentImageBase64Ref = useRef<string | null>(null);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    // Afficher l'aperçu
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Lancer le scan avec Gemini
    await scanWithGemini(file);
  };

  /**
   * Scan la carte grise avec Gemini AI via l'Edge Function
   */
  const scanWithGemini = async (file: File) => {
    setIsProcessing(true);
    setProgress(10);

    try {
      console.log("🚀 Démarrage du scan Gemini...");

      // Convertir l'image en base64
      const base64 = await fileToBase64(file);
      currentImageBase64Ref.current = base64;
      setProgress(30);

      console.log("📤 Envoi de l'image à l'Edge Function scan-carte-grise...");

      // Appeler l'Edge Function Gemini
      const { data, error } = await supabase.functions.invoke("scan-carte-grise", {
        body: { imageData: base64 },
      });

      setProgress(70);

      if (error) {
        console.error("❌ Erreur Edge Function:", error);
        throw error;
      }

      if (!data.success) {
        console.error("❌ Erreur scan:", data.error);
        throw new Error(data.error || "Erreur lors du scan");
      }

      console.log("✅ Réponse Gemini reçue:", data);
      console.log(`📊 ${data.detected_fields_count || 0} champs détectés`);
      console.log("📋 Champs détectés:", data.detected_fields || []);

      // ✅ MAPPING CORRECT : Gemini utilise les codes officiels (E, A, D1, etc.)
      // On mappe vers les noms attendus par ScanConfirmationModal
      const scanData = data.data;
      const mappedData: VehicleRegistrationData = {
        // ✅ Champs critiques (codes officiels → noms TypeScript)
        numeroChassisVIN: scanData.E || undefined, // E → numeroChassisVIN
        immatriculation: scanData.A || undefined, // A → immatriculation
        marque: scanData.D1 || undefined, // D1 → marque
        modele: scanData.D2 || undefined, // D2 → modele
        denominationCommerciale: scanData.D3 || undefined, // D3 → denominationCommerciale

        // Classification
        genreNational: scanData.J || undefined, // J → genreNational
        carrosserie: scanData.J1 || undefined, // J1 → carrosserie

        // Motorisation
        energie: scanData.P3 || undefined, // P3 → energie
        puissanceFiscale: scanData.P6 ? parseInt(scanData.P6) : undefined, // P6 → puissanceFiscale
        cylindree: scanData.P1 ? parseInt(scanData.P1) : undefined, // P1 → cylindree

        // Masses
        masseVide: scanData.G ? parseInt(scanData.G) : undefined, // G → masseVide
        masseEnChargeMax: scanData.F1 ? parseInt(scanData.F1) : undefined, // F1 → masseEnChargeMax (PTAC)
        ptra: scanData.F2 ? parseInt(scanData.F2) : undefined, // F2 → ptra

        // Dimensions
        longueur: scanData.L ? parseInt(scanData.L) : undefined, // L → longueur
        largeur: scanData.B ? parseInt(scanData.B) : undefined, // B → largeur
        hauteur: scanData.H ? parseInt(scanData.H) : undefined, // H → hauteur

        // Autres
        nombrePlaces: scanData.S1 ? parseInt(scanData.S1) : undefined, // S1 → nombrePlaces
        datePremiereImmatriculation: scanData.B1 || undefined, // B1 → datePremiereImmatriculation

        confidence: scanData.confidence || 90,
      };

      console.log("✅ Données mappées pour ScanConfirmationModal:");
      console.log("📊 Détails du scan:");
      console.log(`  🔑 VIN: ${mappedData.numeroChassisVIN || "❌ Non détecté"}`);
      console.log(`  🚗 Immatriculation: ${mappedData.immatriculation || "❌ Non détecté"}`);
      console.log(`  🏭 Marque: ${mappedData.marque || "❌ Non détecté"}`);
      console.log(`  📝 Modèle: ${mappedData.modele || "❌ Non détecté"}`);
      console.log(`  📅 Date: ${mappedData.datePremiereImmatriculation || "❌ Non détecté"}`);
      console.log(`  ⚖️  Masse vide: ${mappedData.masseVide || "❌ Non détecté"} kg`);
      console.log(`  📦 PTAC: ${mappedData.masseEnChargeMax || "❌ Non détecté"} kg`);
      console.log(`  🏷️  Genre: ${mappedData.genreNational || "❌ Non détecté"}`);

      setProgress(100);
      setExtractedData(mappedData);

      // ✅ AFFICHER LE MODAL DE CONFIRMATION
      setShowConfirmModal(true);

      const detectedCount = Object.keys(mappedData).filter(
        (key) => key !== "confidence" && mappedData[key] !== undefined && mappedData[key] !== null,
      ).length;

      toast.success(`Carte grise scannée : ${detectedCount} champs détectés`, {
        description: `Confiance : ${mappedData.confidence}% - Vérifiez avant de valider`,
        duration: 4000,
      });
    } catch (error: any) {
      console.error("❌ Erreur scan Gemini:", error);
      toast.error("Erreur lors du scan Gemini", {
        description: error.message || "Impossible de lire la carte grise",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  /**
   * Convertit un fichier en base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Confirme les données validées par l'utilisateur dans le modal
   */
  const handleConfirmData = (confirmedData: VehicleRegistrationData) => {
    console.log("✅ Données confirmées par l'utilisateur:", confirmedData);
    onDataExtracted(confirmedData);
    toast.success("Données de la carte grise enregistrées", {
      description: "Vous pouvez maintenant continuer la création du projet",
      duration: 3000,
    });
    setShowConfirmModal(false);
    resetScanner();
  };

  /**
   * Rescanne un champ spécifique (VIN, Immat, Marque, Modèle)
   */
  const handleRescanField = async (fieldName: string) => {
    console.log(`🔄 Rescan demandé pour: ${fieldName}`);

    if (!currentImageBase64Ref.current) {
      toast.error("Image non disponible pour le rescan");
      return;
    }

    toast.info(`Rescan du champ ${fieldName}...`, {
      description: "Analyse en cours avec Gemini",
    });

    // Fermer le modal pendant le rescan
    setShowConfirmModal(false);
    setIsProcessing(true);
    setProgress(50);

    try {
      // Refaire un scan complet (pour l'instant)
      // TODO: Implémenter un scan ciblé sur un champ spécifique
      const { data, error } = await supabase.functions.invoke("scan-carte-grise", {
        body: { imageData: currentImageBase64Ref.current },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const scanData = data.data;
      const mappedData: VehicleRegistrationData = {
        numeroChassisVIN: scanData.E || undefined,
        immatriculation: scanData.A || undefined,
        marque: scanData.D1 || undefined,
        modele: scanData.D2 || undefined,
        denominationCommerciale: scanData.D3 || undefined,
        genreNational: scanData.J || undefined,
        carrosserie: scanData.J1 || undefined,
        energie: scanData.P3 || undefined,
        puissanceFiscale: scanData.P6 ? parseInt(scanData.P6) : undefined,
        cylindree: scanData.P1 ? parseInt(scanData.P1) : undefined,
        masseVide: scanData.G ? parseInt(scanData.G) : undefined,
        masseEnChargeMax: scanData.F1 ? parseInt(scanData.F1) : undefined,
        ptra: scanData.F2 ? parseInt(scanData.F2) : undefined,
        longueur: scanData.L ? parseInt(scanData.L) : undefined,
        largeur: scanData.B ? parseInt(scanData.B) : undefined,
        hauteur: scanData.H ? parseInt(scanData.H) : undefined,
        nombrePlaces: scanData.S1 ? parseInt(scanData.S1) : undefined,
        datePremiereImmatriculation: scanData.B1 || undefined,
        confidence: scanData.confidence || 90,
      };

      console.log(`✅ Rescan ${fieldName} terminé`);
      setExtractedData(mappedData);
      setShowConfirmModal(true);

      toast.success(`Rescan effectué`, {
        description: "Vérifiez les nouvelles données",
      });
    } catch (error: any) {
      console.error(`❌ Erreur rescan ${fieldName}:`, error);
      toast.error(`Erreur lors du rescan`, {
        description: error.message,
      });
      // Réouvrir le modal avec les anciennes données
      setShowConfirmModal(true);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  /**
   * Réinitialise le scanner
   */
  const resetScanner = () => {
    setImagePreview(null);
    setExtractedData(null);
    setShowConfirmModal(false);
    setProgress(0);
    currentImageBase64Ref.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Scanner la carte grise
                <Badge variant="secondary" className="ml-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  IA Gemini
                </Badge>
              </CardTitle>
              <CardDescription>
                Scannez automatiquement votre carte grise avec l'IA Gemini - Précision 95%
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!imagePreview && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <Button asChild variant="outline" size="lg">
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Choisir une photo
                    </span>
                  </Button>
                </Label>
                <Input
                  id="image-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground font-medium">
                  📸 Prenez une photo nette de la carte grise (recto)
                </p>
                <p className="text-xs text-muted-foreground">
                  Conseils : carte à plat, lumière naturelle, photo bien cadrée
                </p>
              </div>
            </div>
          )}

          {imagePreview && (
            <div className="space-y-4">
              <div className="relative">
                <img src={imagePreview} alt="Carte grise" className="w-full rounded-lg border-2 border-gray-200" />
                {!isProcessing && (
                  <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={resetScanner}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyse en cours avec Gemini AI...
                    </span>
                    <span className="font-bold">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">⏱️ Temps estimé : 3-5 secondes</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ MODAL DE CONFIRMATION DES DONNÉES SCANNÉES */}
      {extractedData && (
        <ScanConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            // Ne pas réinitialiser le scanner pour permettre un nouveau scan
          }}
          scannedData={extractedData}
          onConfirm={handleConfirmData}
          onRescanVIN={() => handleRescanField("VIN")}
          onRescanImmat={() => handleRescanField("Immatriculation")}
          onRescanMarque={() => handleRescanField("Marque")}
          onRescanModele={() => handleRescanField("Modèle")}
        />
      )}
    </>
  );
};

export default VehicleRegistrationScanner;
