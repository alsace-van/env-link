import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * Composant de vérification visuelle du VIN
 * Force l'utilisateur à vérifier caractère par caractère
 */

interface VINVerificationProps {
  detectedVIN: string;
  onVerified: (correctedVIN: string) => void;
  onEdit: () => void;
}

export const VINVerificationAlert = ({ detectedVIN, onVerified, onEdit }: VINVerificationProps) => {
  const [isVerified, setIsVerified] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="space-y-3">
      {/* Alerte principale - TRÈS visible */}
      <Alert className="border-2 border-orange-500 bg-orange-50">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-900 font-bold text-lg">
          ⚠️ VÉRIFICATION OBLIGATOIRE
        </AlertTitle>
        <AlertDescription className="text-orange-800">
          <p className="font-semibold mb-2">
            L'OCR peut faire des erreurs sur certains caractères !
          </p>
          <p className="text-sm mb-2">
            Vérifiez ATTENTIVEMENT le VIN détecté caractère par caractère avec votre carte grise.
          </p>
          <p className="text-sm font-bold">
            Une seule erreur rend le VIN invalide ! 🔴
          </p>
        </AlertDescription>
      </Alert>

      {/* Affichage du VIN avec caractères séparés */}
      <div className="p-4 bg-white border-2 border-orange-300 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-orange-900">VIN détecté :</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? (
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
        </div>

        {/* Caractères du VIN séparés */}
        <div className="flex flex-wrap gap-1 mb-3 font-mono text-2xl justify-center">
          {detectedVIN.split("").map((char, index) => (
            <div
              key={index}
              className="w-10 h-12 flex items-center justify-center bg-orange-100 border-2 border-orange-400 rounded font-bold text-orange-900"
              title={`Position ${index + 1}`}
            >
              {char}
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-gray-600 mb-2">
          {detectedVIN.length}/17 caractères
        </p>

        {/* Aide visuelle - Confusions courantes */}
        {showComparison && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
            <p className="text-sm font-semibold text-yellow-900 mb-2">
              ⚠️ Confusions courantes à vérifier :
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  0
                </Badge>
                <span className="text-xs">vs</span>
                <Badge variant="outline" className="font-mono">
                  O
                </Badge>
                <span className="text-xs text-gray-600">(chiffre vs lettre)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  1
                </Badge>
                <span className="text-xs">vs</span>
                <Badge variant="outline" className="font-mono">
                  I
                </Badge>
                <span className="text-xs text-gray-600">(chiffre vs lettre)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  5
                </Badge>
                <span className="text-xs">vs</span>
                <Badge variant="outline" className="font-mono">
                  S
                </Badge>
                <span className="text-xs text-gray-600">(chiffre vs lettre)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  8
                </Badge>
                <span className="text-xs">vs</span>
                <Badge variant="outline" className="font-mono">
                  B
                </Badge>
                <span className="text-xs text-gray-600">(chiffre vs lettre)</span>
              </div>
            </div>
            <p className="text-xs text-yellow-800 mt-2 font-semibold">
              💡 Astuce : Le VIN ne contient JAMAIS les lettres I, O, Q
            </p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant={isVerified ? "default" : "outline"}
            onClick={() => {
              setIsVerified(true);
              onVerified(detectedVIN);
            }}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isVerified ? "✅ Vérifié" : "J'ai vérifié, c'est correct"}
          </Button>
          <Button type="button" variant="outline" onClick={onEdit} className="flex-1">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Corriger une erreur
          </Button>
        </div>
      </div>

      {/* Message de rappel */}
      {!isVerified && (
        <Alert className="bg-red-50 border-red-300">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 text-sm">
            <strong>Important :</strong> Vous devez confirmer avoir vérifié le VIN avant de continuer.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

/**
 * Composant d'avertissement pour l'immatriculation
 */
interface ImmatriculationVerificationProps {
  detectedImmat: string;
  onVerified: () => void;
}

export const ImmatriculationVerificationAlert = ({
  detectedImmat,
  onVerified,
}: ImmatriculationVerificationProps) => {
  return (
    <Alert className="border-orange-400 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Immatriculation détectée : {detectedImmat}</p>
            <p className="text-xs mt-1">Vérifiez qu'elle correspond bien à votre carte grise</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onVerified}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Vérifié
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

/**
 * Composant d'avertissement général après scan
 */
export const ScanResultWarning = () => {
  return (
    <Alert className="border-2 border-red-500 bg-red-50 mb-4">
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <AlertTitle className="text-red-900 font-bold">
        🚨 ATTENTION : Vérification manuelle requise
      </AlertTitle>
      <AlertDescription className="text-red-800">
        <p className="mb-2 font-semibold">
          L'OCR n'est pas parfait et peut faire des erreurs, notamment sur :
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm mb-2">
          <li>Les chiffres et lettres similaires (0/O, 1/I, 5/S, 8/B)</li>
          <li>Les caractères peu contrastés ou flous</li>
          <li>Les zones avec reflets ou ombres</li>
        </ul>
        <p className="font-bold text-base mt-3">
          ⚠️ Vérifiez TOUS les champs détectés avant de valider !
        </p>
      </AlertDescription>
    </Alert>
  );
};

/**
 * Badge d'état de vérification
 */
interface VerificationBadgeProps {
  isVerified: boolean;
  fieldName: string;
}

export const VerificationBadge = ({ isVerified, fieldName }: VerificationBadgeProps) => {
  if (isVerified) {
    return (
      <Badge className="bg-green-500 text-white">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {fieldName} vérifié
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-orange-500 text-orange-700">
      <AlertTriangle className="h-3 w-3 mr-1" />
      {fieldName} à vérifier
    </Badge>
  );
};
