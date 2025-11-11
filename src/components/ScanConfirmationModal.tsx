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
          <div className="grid grid-cols-3 gap-4">
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

            {/* DIMENSION */}
            <div className="space-y-2 p-4 border rounded-lg bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Dimension</Label>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    Manuel
                  </Badge>
                </div>
              </div>

              <Select
                value={editedData.dimension || ""}
                onValueChange={(value) => handleFieldChange("dimension", value)}
              >
                <SelectTrigger className="font-semibold text-lg">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1H1">L1H1</SelectItem>
                  <SelectItem value="L1H2">L1H2</SelectItem>
                  <SelectItem value="L2H1">L2H1</SelectItem>
                  <SelectItem value="L2H2">L2H2</SelectItem>
                  <SelectItem value="L3H1">L3H1</SelectItem>
                  <SelectItem value="L3H2">L3H2</SelectItem>
                  <SelectItem value="L3H3">L3H3</SelectItem>
                  <SelectItem value="L4H2">L4H2</SelectItem>
                  <SelectItem value="L4H3">L4H3</SelectItem>
                </SelectContent>
              </Select>
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
