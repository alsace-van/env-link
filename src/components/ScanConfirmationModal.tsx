import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Edit2, AlertCircle, Info, XCircle, ScanLine } from "lucide-react";
import { type VehicleRegistrationData } from "@/lib/registrationCardParser";

interface ScanConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedData: VehicleRegistrationData;
  onConfirm: (confirmedData: VehicleRegistrationData) => void;
  onRescanVIN?: () => void;
  onRescanImmat?: () => void;
  onRescanMarque?: () => void;
  onRescanModele?: () => void;
}

/**
 * Modal de confirmation des données scannées - VERSION COMPLÈTE
 *
 * Affiche les 8 champs avec :
 * - Statut de détection (Détecté / Non détecté)
 * - Boutons Rescan pour VIN, Immat, Marque, Modèle
 * - Vérification obligatoire du VIN
 * - Mode édition pour tous les champs
 */
export const ScanConfirmationModal = ({
  isOpen,
  onClose,
  scannedData,
  onConfirm,
  onRescanVIN,
  onRescanImmat,
  onRescanMarque,
  onRescanModele,
}: ScanConfirmationModalProps) => {
  // État local pour l'édition
  const [editedData, setEditedData] = useState<VehicleRegistrationData>(scannedData);

  // États de vérification
  const [vinVerified, setVinVerified] = useState(false);
  const [showVinHelp, setShowVinHelp] = useState(false);

  // Mode édition pour chaque champ
  const [editingVin, setEditingVin] = useState(false);
  const [editingImmat, setEditingImmat] = useState(false);
  const [editingMarque, setEditingMarque] = useState(false);
  const [editingModele, setEditingModele] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingMasseVide, setEditingMasseVide] = useState(false);
  const [editingPTAC, setEditingPTAC] = useState(false);
  const [editingGenre, setEditingGenre] = useState(false);
  const [editingCarrosserie, setEditingCarrosserie] = useState(false);
  const [editingEnergie, setEditingEnergie] = useState(false);
  const [editingPuissanceFiscale, setEditingPuissanceFiscale] = useState(false);
  const [editingCylindree, setEditingCylindree] = useState(false);
  const [editingCategorieInter, setEditingCategorieInter] = useState(false);
  const [editingTypeVariante, setEditingTypeVariante] = useState(false);
  const [editingPlacesAssises, setEditingPlacesAssises] = useState(false);
  const [editingNumeroReception, setEditingNumeroReception] = useState(false);
  const [editingPuissanceKw, setEditingPuissanceKw] = useState(false);
  const [editingPtra, setEditingPtra] = useState(false);
  const [editingNormeEuro, setEditingNormeEuro] = useState(false);

  // ✅ CORRECTION: Mettre à jour editedData quand scannedData change (après rescan)
  useEffect(() => {
    console.log("📥 ScanConfirmationModal: Mise à jour avec nouvelles données scannées");
    setEditedData(scannedData);
    setVinVerified(false);
  }, [scannedData]);

  const handleFieldChange = (field: keyof VehicleRegistrationData, value: any) => {
    setEditedData((prev) => ({ ...prev, [field]: value }));
    // Réinitialiser la vérification si le VIN est modifié
    if (field === "numeroChassisVIN") setVinVerified(false);
  };

  const handleConfirm = () => {
    if (!vinVerified && editedData.numeroChassisVIN) {
      return; // Bloqué si VIN non vérifié
    }
    onConfirm(editedData);
    onClose();
  };

  // Helper pour afficher le statut de détection
  const getDetectionStatus = (value: any) => {
    const isDetected = value !== undefined && value !== null && value !== "";

    if (isDetected) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Détecté
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-red-300 text-red-700">
          <XCircle className="h-3 w-3 mr-1" />
          Non détecté
        </Badge>
      );
    }
  };

  const vinLength = editedData.numeroChassisVIN?.length || 0;
  const isVinValid = vinLength === 17;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Vérification des données scannées
          </DialogTitle>
          <DialogDescription>Vérifiez attentivement les informations détectées avant de les utiliser</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* ============================================ */}
          {/* SECTION 1 : IMMATRICULATION */}
          {/* ============================================ */}
          <div className="space-y-2 p-4 border rounded-lg bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Immatriculation</Label>
                {getDetectionStatus(editedData.immatriculation)}
              </div>
              <div className="flex gap-2">
                {onRescanImmat && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onRescanImmat();
                    }}
                  >
                    <ScanLine className="h-4 w-4 mr-2" />
                    Rescan
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingImmat(!editingImmat)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  {editingImmat ? "Annuler" : "Modifier"}
                </Button>
              </div>
            </div>

            {!editingImmat && editedData.immatriculation ? (
              <div className="text-2xl font-bold font-mono tracking-wider p-3 bg-white border-2 border-blue-300 rounded text-center">
                {editedData.immatriculation}
              </div>
            ) : editingImmat ? (
              <Input
                value={editedData.immatriculation || ""}
                onChange={(e) => handleFieldChange("immatriculation", e.target.value.toUpperCase())}
                className="text-xl font-mono tracking-wider"
                placeholder="AA-123-BB"
              />
            ) : (
              <div className="text-center p-3 text-gray-500 italic">
                Non détecté - Cliquez sur "Modifier" pour saisir manuellement
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* SECTION 2 : VIN (CRITIQUE) */}
          {/* ============================================ */}
          <div className="space-y-3">
            {/* Alerte de vérification obligatoire - affichée seulement si VIN détecté */}
            {editedData.numeroChassisVIN && !vinVerified && (
              <Alert className="border-2 border-orange-500 bg-orange-50">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <AlertTitle className="text-orange-900 font-bold">🚨 VÉRIFICATION OBLIGATOIRE DU VIN</AlertTitle>
                <AlertDescription className="text-orange-800">
                  <p className="font-semibold mb-2">
                    L'OCR peut confondre certains caractères (Z→1, O→0, I→1, S→5, B→8)
                  </p>
                  <p className="text-sm">Vous devez vérifier le VIN caractère par caractère avant de continuer.</p>
                </AlertDescription>
              </Alert>
            )}

            <div className="p-4 border-2 border-orange-300 rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold text-orange-900">Numéro de châssis (VIN)</Label>
                  {getDetectionStatus(editedData.numeroChassisVIN)}
                </div>
                <div className="flex gap-2">
                  {onRescanVIN && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onRescanVIN();
                      }}
                    >
                      <ScanLine className="h-4 w-4 mr-2" />
                      Rescan
                    </Button>
                  )}
                  {editedData.numeroChassisVIN && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowVinHelp(!showVinHelp)}>
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
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingVin(!editingVin)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    {editingVin ? "Annuler" : editedData.numeroChassisVIN ? "Corriger" : "Saisir"}
                  </Button>
                </div>
              </div>

              {/* Affichage du VIN si détecté */}
              {editedData.numeroChassisVIN && !editingVin ? (
                <>
                  {/* Caractères séparés visuellement */}
                  <div className="flex flex-wrap gap-1 mb-3 justify-center">
                    {editedData.numeroChassisVIN.split("").map((char, index) => (
                      <div
                        key={index}
                        className={`
                          w-10 h-14 flex items-center justify-center 
                          border-2 rounded font-mono text-2xl font-bold
                          ${
                            vinVerified
                              ? "bg-green-100 border-green-500 text-green-900"
                              : "bg-orange-100 border-orange-400 text-orange-900"
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
                    <Badge variant={isVinValid ? "default" : "destructive"} className="text-sm">
                      {vinLength}/17 caractères
                    </Badge>
                    {!isVinValid && (
                      <span className="text-sm text-red-600 font-semibold">
                        ⚠️ Le VIN doit faire exactement 17 caractères
                      </span>
                    )}
                  </div>
                </>
              ) : editingVin ? (
                /* Mode édition du VIN */
                <div className="mb-3">
                  <Input
                    value={editedData.numeroChassisVIN || ""}
                    onChange={(e) => handleFieldChange("numeroChassisVIN", e.target.value.toUpperCase())}
                    className="text-center font-mono text-xl tracking-wider"
                    maxLength={17}
                    placeholder="17 caractères"
                  />
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    {editedData.numeroChassisVIN
                      ? "Modifiez directement les caractères incorrects"
                      : "Saisissez le VIN manuellement"}
                  </p>
                </div>
              ) : (
                /* VIN non détecté */
                <div className="text-center p-3 text-gray-500 italic">
                  Non détecté - Cliquez sur "Rescan" ou "Saisir" pour ajouter le VIN
                </div>
              )}

              {/* Aide visuelle - Confusions courantes - affichée uniquement si VIN détecté */}
              {editedData.numeroChassisVIN && showVinHelp && (
                <Alert className="bg-yellow-50 border-yellow-300 mb-3">
                  <Info className="h-4 w-4 text-yellow-700" />
                  <AlertDescription>
                    <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Confusions courantes de l'OCR :</p>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          0
                        </Badge>
                        <span className="text-xs">≠</span>
                        <Badge variant="outline" className="font-mono">
                          O
                        </Badge>
                        <span className="text-xs text-gray-600">(zéro vs lettre O)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          1
                        </Badge>
                        <span className="text-xs">≠</span>
                        <Badge variant="outline" className="font-mono">
                          I
                        </Badge>
                        <span className="text-xs text-gray-600">(un vs lettre I)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          5
                        </Badge>
                        <span className="text-xs">≠</span>
                        <Badge variant="outline" className="font-mono">
                          S
                        </Badge>
                        <span className="text-xs text-gray-600">(cinq vs lettre S)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          8
                        </Badge>
                        <span className="text-xs">≠</span>
                        <Badge variant="outline" className="font-mono">
                          B
                        </Badge>
                        <span className="text-xs text-gray-600">(huit vs lettre B)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          Z
                        </Badge>
                        <span className="text-xs">≠</span>
                        <Badge variant="outline" className="font-mono">
                          2
                        </Badge>
                        <span className="text-xs text-gray-600">(Z vs deux)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          Z
                        </Badge>
                        <span className="text-xs">≠</span>
                        <Badge variant="outline" className="font-mono">
                          1
                        </Badge>
                        <span className="text-xs text-gray-600 font-bold">(Z vs un) 🔴</span>
                      </div>
                    </div>
                    <p className="text-xs text-yellow-800 font-semibold">
                      💡 Info : Le VIN ne contient JAMAIS les lettres I, O, Q
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Boutons de vérification - affichés uniquement si VIN détecté */}
              {editedData.numeroChassisVIN &&
                (!vinVerified ? (
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
                ))}
            </div>
          </div>

          <Separator />

          {/* ============================================ */}
          {/* SECTION 3 : MARQUE & MODÈLE */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 gap-4">
            {/* MARQUE */}
            <div className="space-y-2 p-4 border rounded-lg bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Marque</Label>
                  {getDetectionStatus(editedData.marque)}
                </div>
                <div className="flex gap-2">
                  {onRescanMarque && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onRescanMarque();
                      }}
                    >
                      <ScanLine className="h-3 w-3 mr-1" />
                      Rescan
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingMarque(!editingMarque)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {!editingMarque && editedData.marque ? (
                <div className="font-semibold text-lg p-2 bg-white border rounded">{editedData.marque}</div>
              ) : editingMarque ? (
                <Input
                  value={editedData.marque || ""}
                  onChange={(e) => handleFieldChange("marque", e.target.value)}
                  className="font-semibold"
                />
              ) : (
                <div className="text-center p-2 text-gray-500 text-sm italic">Non détecté</div>
              )}
            </div>

            {/* MODÈLE */}
            <div className="space-y-2 p-4 border rounded-lg bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Modèle</Label>
                  {getDetectionStatus(editedData.denominationCommerciale)}
                </div>
                <div className="flex gap-2">
                  {onRescanModele && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onRescanModele();
                      }}
                    >
                      <ScanLine className="h-3 w-3 mr-1" />
                      Rescan
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingModele(!editingModele)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {!editingModele && editedData.denominationCommerciale ? (
                <div className="font-semibold text-lg p-2 bg-white border rounded">
                  {editedData.denominationCommerciale}
                </div>
              ) : editingModele ? (
                <Input
                  value={editedData.denominationCommerciale || ""}
                  onChange={(e) => handleFieldChange("denominationCommerciale", e.target.value)}
                />
              ) : (
                <div className="text-center p-2 text-gray-500 text-sm italic">Non détecté</div>
              )}
            </div>
          </div>

          <Separator />

          {/* ============================================ */}
          {/* SECTION 4 : AUTRES CHAMPS */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 gap-4">
            {/* DATE 1ÈRE IMMAT */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Date 1ère immatriculation</Label>
                {getDetectionStatus(editedData.datePremiereImmatriculation)}
              </div>
              {!editingDate && editedData.datePremiereImmatriculation ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded">{editedData.datePremiereImmatriculation}</div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingDate(!editingDate)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingDate ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedData.datePremiereImmatriculation || ""}
                    onChange={(e) => handleFieldChange("datePremiereImmatriculation", e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingDate(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingDate(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>

            {/* MASSE À VIDE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Masse à vide (kg)</Label>
                {getDetectionStatus(editedData.masseVide)}
              </div>
              {!editingMasseVide && editedData.masseVide ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded font-semibold">{editedData.masseVide} kg</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingMasseVide(!editingMasseVide)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingMasseVide ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editedData.masseVide || ""}
                    onChange={(e) => handleFieldChange("masseVide", parseInt(e.target.value) || undefined)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingMasseVide(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingMasseVide(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>

            {/* PTAC */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">PTAC (kg)</Label>
                {getDetectionStatus(editedData.masseEnChargeMax)}
              </div>
              {!editingPTAC && editedData.masseEnChargeMax ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded font-semibold">
                    {editedData.masseEnChargeMax} kg
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPTAC(!editingPTAC)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingPTAC ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editedData.masseEnChargeMax || ""}
                    onChange={(e) => handleFieldChange("masseEnChargeMax", parseInt(e.target.value) || undefined)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPTAC(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingPTAC(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>

            {/* GENRE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Genre</Label>
                {getDetectionStatus(editedData.genreNational)}
              </div>
              {!editingGenre && editedData.genreNational ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded">{editedData.genreNational}</div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingGenre(!editingGenre)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingGenre ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedData.genreNational || ""}
                    onChange={(e) => handleFieldChange("genreNational", e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingGenre(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingGenre(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5 : NOUVEAUX CHAMPS TECHNIQUES */}
          <div className="grid grid-cols-2 gap-4">
            {/* CARROSSERIE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Carrosserie</Label>
                {getDetectionStatus(editedData.carrosserieCE)}
              </div>
              {!editingCarrosserie && editedData.carrosserieCE ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded">{editedData.carrosserieCE}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCarrosserie(!editingCarrosserie)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingCarrosserie ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedData.carrosserieCE || ""}
                    onChange={(e) => handleFieldChange("carrosserieCE", e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCarrosserie(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingCarrosserie(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>

            {/* ÉNERGIE / CARBURANT */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Énergie</Label>
                {getDetectionStatus(editedData.energie)}
              </div>
              {!editingEnergie && editedData.energie ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded">{editedData.energie}</div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingEnergie(!editingEnergie)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingEnergie ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedData.energie || ""}
                    onChange={(e) => handleFieldChange("energie", e.target.value.toUpperCase())}
                    className="flex-1"
                    placeholder="GO, ES, EL, GPL..."
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingEnergie(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingEnergie(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>

            {/* PUISSANCE FISCALE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Puissance fiscale (CV)</Label>
                {getDetectionStatus(editedData.puissanceFiscale)}
              </div>
              {!editingPuissanceFiscale && editedData.puissanceFiscale ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded font-semibold">
                    {editedData.puissanceFiscale} CV
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingPuissanceFiscale(!editingPuissanceFiscale)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingPuissanceFiscale ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editedData.puissanceFiscale || ""}
                    onChange={(e) => handleFieldChange("puissanceFiscale", parseInt(e.target.value) || undefined)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPuissanceFiscale(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingPuissanceFiscale(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>

            {/* CYLINDRÉE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Cylindrée (cm³)</Label>
                {getDetectionStatus(editedData.cylindree)}
              </div>
              {!editingCylindree && editedData.cylindree ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border rounded font-semibold">{editedData.cylindree} cm³</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCylindree(!editingCylindree)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : editingCylindree ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editedData.cylindree || ""}
                    onChange={(e) => handleFieldChange("cylindree", parseInt(e.target.value) || undefined)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCylindree(false)}>
                    OK
                  </Button>
                </div>
              ) : (
                <div className="p-2 text-gray-500 text-sm italic">
                  Non détecté -{" "}
                  <button onClick={() => setEditingCylindree(true)} className="underline">
                    Saisir
                  </button>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* SECTION 6 : CHAMPS CRITIQUES RTI */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-blue-700">Informations techniques RTI</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* CATÉGORIE INTERNATIONALE */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Catégorie (J)</Label>
                  {getDetectionStatus(editedData.categorieInternational)}
                </div>
                {!editingCategorieInter && editedData.categorieInternational ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-blue-50 border-2 border-blue-200 rounded font-bold text-blue-800">
                      {editedData.categorieInternational}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCategorieInter(!editingCategorieInter)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : editingCategorieInter ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={editedData.categorieInternational || ""}
                      onValueChange={(value) => {
                        handleFieldChange("categorieInternational", value);
                        setEditingCategorieInter(false);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M1">M1 - Voiture particulière</SelectItem>
                        <SelectItem value="N1">N1 - Utilitaire léger ≤3.5t</SelectItem>
                        <SelectItem value="N2">N2 - Utilitaire 3.5t-12t</SelectItem>
                        <SelectItem value="N3">N3 - Utilitaire &gt;12t</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCategorieInter(false)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded">
                    ⚠️ Non détecté -{" "}
                    <button onClick={() => setEditingCategorieInter(true)} className="underline font-bold">
                      Saisir (obligatoire RTI)
                    </button>
                  </div>
                )}
              </div>

              {/* TYPE VARIANTE (D.2) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Type mine (D.2)</Label>
                  {getDetectionStatus(editedData.typeVariante)}
                </div>
                {!editingTypeVariante && editedData.typeVariante ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-slate-50 border rounded font-mono text-sm">
                      {editedData.typeVariante}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTypeVariante(!editingTypeVariante)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : editingTypeVariante ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedData.typeVariante || ""}
                      onChange={(e) => handleFieldChange("typeVariante", e.target.value.toUpperCase())}
                      className="flex-1 font-mono"
                      placeholder="VFAHKH-B2B01D"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTypeVariante(false)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-gray-500 text-sm italic">
                    Non détecté -{" "}
                    <button onClick={() => setEditingTypeVariante(true)} className="underline">
                      Saisir
                    </button>
                  </div>
                )}
              </div>

              {/* PLACES ASSISES (S.1) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Places assises (S.1)</Label>
                  {getDetectionStatus(editedData.placesAssises)}
                </div>
                {!editingPlacesAssises && editedData.placesAssises ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-slate-50 border rounded font-semibold">
                      {editedData.placesAssises} places
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPlacesAssises(!editingPlacesAssises)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : editingPlacesAssises ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={editedData.placesAssises || ""}
                      onChange={(e) => handleFieldChange("placesAssises", parseInt(e.target.value) || undefined)}
                      className="flex-1"
                      min={1}
                      max={9}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPlacesAssises(false)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-orange-600 text-sm bg-orange-50 border border-orange-200 rounded">
                    Non détecté -{" "}
                    <button onClick={() => setEditingPlacesAssises(true)} className="underline">
                      Saisir (important)
                    </button>
                  </div>
                )}
              </div>

              {/* PUISSANCE KW (P.2) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Puissance (P.2)</Label>
                  {getDetectionStatus(editedData.puissanceKw)}
                </div>
                {!editingPuissanceKw && editedData.puissanceKw ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-slate-50 border rounded font-semibold">
                      {editedData.puissanceKw} kW
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPuissanceKw(!editingPuissanceKw)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : editingPuissanceKw ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={editedData.puissanceKw || ""}
                      onChange={(e) => handleFieldChange("puissanceKw", parseInt(e.target.value) || undefined)}
                      className="flex-1"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPuissanceKw(false)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-gray-500 text-sm italic">
                    Non détecté -{" "}
                    <button onClick={() => setEditingPuissanceKw(true)} className="underline">
                      Saisir
                    </button>
                  </div>
                )}
              </div>

              {/* NUMÉRO RÉCEPTION CE (K) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">N° Réception CE (K)</Label>
                  {getDetectionStatus(editedData.numeroReceptionCE)}
                </div>
                {!editingNumeroReception && editedData.numeroReceptionCE ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-slate-50 border rounded font-mono text-xs">
                      {editedData.numeroReceptionCE}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNumeroReception(!editingNumeroReception)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : editingNumeroReception ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedData.numeroReceptionCE || ""}
                      onChange={(e) => handleFieldChange("numeroReceptionCE", e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="e2*2007/46*0533*04"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingNumeroReception(false)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-gray-500 text-sm italic">
                    Non détecté -{" "}
                    <button onClick={() => setEditingNumeroReception(true)} className="underline">
                      Saisir
                    </button>
                  </div>
                )}
              </div>

              {/* PTRA (F.2) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">PTRA (F.2)</Label>
                  {getDetectionStatus(editedData.ptra)}
                </div>
                {!editingPtra && editedData.ptra ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-slate-50 border rounded font-semibold">{editedData.ptra} kg</div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPtra(!editingPtra)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : editingPtra ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={editedData.ptra || ""}
                      onChange={(e) => handleFieldChange("ptra", parseInt(e.target.value) || undefined)}
                      className="flex-1"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPtra(false)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-gray-500 text-sm italic">
                    Non détecté -{" "}
                    <button onClick={() => setEditingPtra(true)} className="underline">
                      Saisir
                    </button>
                  </div>
                )}
              </div>

              {/* NORME EURO (V.9) */}
              <div className="space-y-2 col-span-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Norme Euro (V.9)</Label>
                  {getDetectionStatus(editedData.normeEuro)}
                </div>
                {!editingNormeEuro && editedData.normeEuro ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-green-50 border border-green-200 rounded font-semibold text-green-800">
                      {editedData.normeEuro}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNormeEuro(!editingNormeEuro)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : editingNormeEuro ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={editedData.normeEuro || ""}
                      onValueChange={(value) => {
                        handleFieldChange("normeEuro", value);
                        setEditingNormeEuro(false);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EURO6">Euro 6</SelectItem>
                        <SelectItem value="EURO5">Euro 5</SelectItem>
                        <SelectItem value="EURO4">Euro 4</SelectItem>
                        <SelectItem value="EURO3">Euro 3</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingNormeEuro(false)}>
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-gray-500 text-sm italic">
                    Non détecté -{" "}
                    <button onClick={() => setEditingNormeEuro(true)} className="underline">
                      Saisir
                    </button>
                  </div>
                )}
              </div>
            </div>
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
          <Button type="button" variant="outline" onClick={onClose}>
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
