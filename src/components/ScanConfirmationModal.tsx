import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Edit2,
  AlertCircle,
  Info
} from "lucide-react";
import { type VehicleRegistrationData } from "@/lib/registrationCardParser";

interface ScanConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedData: VehicleRegistrationData;
  onConfirm: (confirmedData: VehicleRegistrationData) => void;
}

/**
 * Modal de confirmation des données scannées
 * 
 * OBJECTIF : Empêcher les erreurs silencieuses de l'OCR
 * 
 * FONCTIONNEMENT :
 * 1. S'ouvre automatiquement après chaque scan
 * 2. Affiche le VIN caractère par caractère
 * 3. Bloque la validation tant que le VIN n'est pas confirmé
 * 4. Permet de corriger facilement les erreurs détectées
 * 
 * SÉCURITÉ :
 * - Le bouton "Valider" est désactivé tant que le VIN n'est pas vérifié
 * - Alerte visuelle très présente sur le VIN
 * - Aide à la vérification (confusions courantes 0/O, 1/I, etc.)
 */
export const ScanConfirmationModal = ({
  isOpen,
  onClose,
  scannedData,
  onConfirm,
}: ScanConfirmationModalProps) => {
  // État local pour l'édition
  const [editedData, setEditedData] = useState<VehicleRegistrationData>(scannedData);
  
  // États de vérification
  const [vinVerified, setVinVerified] = useState(false);
  const [immatVerified, setImmatVerified] = useState(false);
  const [showVinHelp, setShowVinHelp] = useState(false);
  
  // Mode édition pour chaque champ
  const [editingVin, setEditingVin] = useState(false);
  const [editingImmat, setEditingImmat] = useState(false);

  // Réinitialiser quand les données changent
  useState(() => {
    setEditedData(scannedData);
    setVinVerified(false);
    setImmatVerified(false);
  });

  const handleFieldChange = (field: keyof VehicleRegistrationData, value: any) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
    // Réinitialiser la vérification si le champ modifié est le VIN ou l'immat
    if (field === 'numeroChassisVIN') setVinVerified(false);
    if (field === 'immatriculation') setImmatVerified(false);
  };

  const handleConfirm = () => {
    if (!vinVerified && editedData.numeroChassisVIN) {
      return; // Bloqué si VIN non vérifié
    }
    onConfirm(editedData);
    onClose();
  };

  const vinLength = editedData.numeroChassisVIN?.length || 0;
  const isVinValid = vinLength === 17;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Vérification des données scannées
          </DialogTitle>
          <DialogDescription>
            Vérifiez attentivement les informations détectées avant de les utiliser
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* SECTION VIN - LA PLUS IMPORTANTE */}
          {editedData.numeroChassisVIN && (
            <div className="space-y-3">
              {/* Alerte de vérification obligatoire */}
              {!vinVerified && (
                <Alert className="border-2 border-orange-500 bg-orange-50">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <AlertTitle className="text-orange-900 font-bold">
                    🚨 VÉRIFICATION OBLIGATOIRE DU VIN
                  </AlertTitle>
                  <AlertDescription className="text-orange-800">
                    <p className="font-semibold mb-2">
                      L'OCR peut confondre certains caractères (Z→1, O→0, I→1, S→5, B→8)
                    </p>
                    <p className="text-sm">
                      Vous devez vérifier le VIN caractère par caractère avant de continuer.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="p-4 border-2 border-orange-300 rounded-lg bg-white">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold text-orange-900">
                    Numéro de châssis (VIN)
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVinHelp(!showVinHelp)}
                    >
                      {showVinHelp ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Masquer l'aide
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Afficher l'aide
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingVin(!editingVin)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      {editingVin ? "Annuler" : "Corriger"}
                    </Button>
                  </div>
                </div>

                {/* Affichage du VIN en mode lecture */}
                {!editingVin ? (
                  <>
                    {/* Caractères séparés visuellement */}
                    <div className="flex flex-wrap gap-1 mb-3 justify-center">
                      {editedData.numeroChassisVIN.split("").map((char, index) => (
                        <div
                          key={index}
                          className={`
                            w-10 h-14 flex items-center justify-center 
                            border-2 rounded font-mono text-2xl font-bold
                            ${vinVerified 
                              ? 'bg-green-100 border-green-500 text-green-900' 
                              : 'bg-orange-100 border-orange-400 text-orange-900'
                            }
                          `}
                          title={`Position ${index + 1}`}
                        >
                          {char}
                        </div>
                      ))}
                    </div>

                    {/* Compteur de caractères */}
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Badge 
                        variant={isVinValid ? "default" : "destructive"}
                        className="text-sm"
                      >
                        {vinLength}/17 caractères
                      </Badge>
                      {!isVinValid && (
                        <span className="text-sm text-red-600 font-semibold">
                          ⚠️ Le VIN doit faire exactement 17 caractères
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  /* Mode édition du VIN */
                  <div className="mb-3">
                    <Input
                      value={editedData.numeroChassisVIN}
                      onChange={(e) => handleFieldChange('numeroChassisVIN', e.target.value.toUpperCase())}
                      className="text-center font-mono text-xl tracking-wider"
                      maxLength={17}
                      placeholder="17 caractères"
                    />
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      Modifiez directement les caractères incorrects
                    </p>
                  </div>
                )}

                {/* Aide visuelle - Confusions courantes */}
                {showVinHelp && (
                  <Alert className="bg-yellow-50 border-yellow-300 mb-3">
                    <Info className="h-4 w-4 text-yellow-700" />
                    <AlertDescription>
                      <p className="text-sm font-semibold text-yellow-900 mb-2">
                        ⚠️ Confusions courantes de l'OCR :
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">0</Badge>
                          <span className="text-xs">≠</span>
                          <Badge variant="outline" className="font-mono">O</Badge>
                          <span className="text-xs text-gray-600">(zéro vs lettre O)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">1</Badge>
                          <span className="text-xs">≠</span>
                          <Badge variant="outline" className="font-mono">I</Badge>
                          <span className="text-xs text-gray-600">(un vs lettre I)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">5</Badge>
                          <span className="text-xs">≠</span>
                          <Badge variant="outline" className="font-mono">S</Badge>
                          <span className="text-xs text-gray-600">(cinq vs lettre S)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">8</Badge>
                          <span className="text-xs">≠</span>
                          <Badge variant="outline" className="font-mono">B</Badge>
                          <span className="text-xs text-gray-600">(huit vs lettre B)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">Z</Badge>
                          <span className="text-xs">≠</span>
                          <Badge variant="outline" className="font-mono">2</Badge>
                          <span className="text-xs text-gray-600">(Z vs deux)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">Z</Badge>
                          <span className="text-xs">≠</span>
                          <Badge variant="outline" className="font-mono">1</Badge>
                          <span className="text-xs text-gray-600 font-bold">(Z vs un) 🔴</span>
                        </div>
                      </div>
                      <p className="text-xs text-yellow-800 font-semibold">
                        💡 Info : Le VIN ne contient JAMAIS les lettres I, O, Q
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Boutons de vérification */}
                {!vinVerified ? (
                  <Button
                    type="button"
                    onClick={() => setVinVerified(true)}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={!isVinValid}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    J'ai vérifié caractère par caractère, c'est correct
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-2 p-2 bg-green-50 border border-green-300 rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-900">VIN vérifié ✓</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVinVerified(false)}
                      className="ml-2"
                    >
                      Révérifier
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* SECTION IMMATRICULATION */}
          {editedData.immatriculation && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Immatriculation</Label>
                {!editingImmat ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingImmat(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingImmat(false)}
                  >
                    Annuler
                  </Button>
                )}
              </div>

              {!editingImmat ? (
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold font-mono tracking-wider p-3 bg-blue-50 border-2 border-blue-300 rounded">
                    {editedData.immatriculation}
                  </div>
                  {!immatVerified && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setImmatVerified(true)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Vérifier
                    </Button>
                  )}
                  {immatVerified && (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Vérifié
                    </Badge>
                  )}
                </div>
              ) : (
                <Input
                  value={editedData.immatriculation}
                  onChange={(e) => handleFieldChange('immatriculation', e.target.value.toUpperCase())}
                  className="text-xl font-mono tracking-wider"
                  placeholder="AA-123-BB"
                />
              )}
            </div>
          )}

          {/* AUTRES CHAMPS */}
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            {editedData.marque && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Marque</Label>
                <Input
                  value={editedData.marque}
                  onChange={(e) => handleFieldChange('marque', e.target.value)}
                  className="font-semibold"
                />
              </div>
            )}

            {editedData.denominationCommerciale && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Modèle</Label>
                <Input
                  value={editedData.denominationCommerciale}
                  onChange={(e) => handleFieldChange('denominationCommerciale', e.target.value)}
                />
              </div>
            )}

            {editedData.datePremiereImmatriculation && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Date 1ère immatriculation</Label>
                <Input
                  value={editedData.datePremiereImmatriculation}
                  onChange={(e) => handleFieldChange('datePremiereImmatriculation', e.target.value)}
                />
              </div>
            )}

            {editedData.masseVide && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Masse à vide (kg)</Label>
                <Input
                  type="number"
                  value={editedData.masseVide}
                  onChange={(e) => handleFieldChange('masseVide', parseInt(e.target.value) || undefined)}
                />
              </div>
            )}

            {editedData.masseEnChargeMax && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">PTAC (kg)</Label>
                <Input
                  type="number"
                  value={editedData.masseEnChargeMax}
                  onChange={(e) => handleFieldChange('masseEnChargeMax', parseInt(e.target.value) || undefined)}
                />
              </div>
            )}

            {editedData.genreNational && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Genre</Label>
                <Input
                  value={editedData.genreNational}
                  onChange={(e) => handleFieldChange('genreNational', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Message d'avertissement si VIN non vérifié */}
          {editedData.numeroChassisVIN && !vinVerified && (
            <Alert className="bg-red-50 border-red-300">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                <strong>Attention :</strong> Vous devez vérifier le VIN avant de pouvoir valider les données.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={editedData.numeroChassisVIN ? !vinVerified : false}
            className={!vinVerified && editedData.numeroChassisVIN ? "opacity-50 cursor-not-allowed" : ""}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Valider et utiliser ces données
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
