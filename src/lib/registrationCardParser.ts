/**
 * Valide et corrige un VIN (Vehicle Identification Number)
 * Le VIN doit faire exactement 17 caractères
 * Ne contient jamais les lettres I, O, Q (confusion avec 1, 0)
 */
export const validateAndCorrectVIN = (vin: string): string => {
  if (!vin) return vin;

  const cleaned = vin.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();

  // Si le VIN fait exactement 17 caractères, c'est bon
  if (cleaned.length === 17) {
    return cleaned;
  }

  // Si le VIN fait 16 ou 18 caractères, tenter une correction
  if (cleaned.length === 16) {
    console.warn(`⚠️ VIN trop court (${cleaned.length} caractères): ${cleaned}`);
    // Souvent, un caractère est manquant au milieu ou à la fin
    // On retourne quand même le VIN pour que l'utilisateur puisse le corriger
    return cleaned + "?"; // Ajouter un ? pour indiquer qu'il manque un caractère
  }

  if (cleaned.length === 18) {
    console.warn(`⚠️ VIN trop long (${cleaned.length} caractères): ${cleaned}`);
    // Souvent, un caractère en trop est détecté
    // On retourne quand même pour correction manuelle
    return cleaned;
  }

  // Si trop différent de 17, retourner tel quel
  return cleaned;
};

/**
 * Validation stricte du format VIN
 * - Exactement 17 caractères
 * - Commence par une lettre
 * - Au moins 3 chiffres
 * - Code constructeur connu (VF, WV, JA, etc.)
 * - Pas de mots français courants
 */
export const isValidVINFormat = (vin: string): boolean => {
  if (!vin || vin.length !== 17) return false;

  // Doit commencer par une lettre (code constructeur)
  if (!/^[A-Z]/.test(vin)) return false;

  // Doit contenir au moins 3 chiffres
  const digitCount = (vin.match(/\d/g) || []).length;
  if (digitCount < 3) return false;

  // Liste des codes constructeurs connus (2 premières lettres)
  const validManufacturerCodes = [
    "VF",
    "WV",
    "WP",
    "JA",
    "JM",
    "JN",
    "KL",
    "KM",
    "KN",
    "LV",
    "SA",
    "SB",
    "SU",
    "TM",
    "TR",
    "VN",
    "VS",
    "WA",
    "WB",
    "WD",
    "WM",
    "YS",
    "YV",
    "ZA",
    "ZF",
    "1F",
    "1G",
    "1H",
    "1J",
    "2F",
    "2G",
    "2H",
    "3F",
    "3G",
    "4F",
    "5F",
  ];
  const manufacturerCode = vin.substring(0, 2);
  if (!validManufacturerCodes.includes(manufacturerCode)) {
    console.warn(`⚠️ Code constructeur inconnu: ${manufacturerCode} dans ${vin}`);
    return false;
  }

  // Rejeter les mots français courants qui pourraient être mal détectés comme VIN
  const commonFrenchWords = ["RUE", "AVENUE", "BOULEVARD", "FRANCE", "PARIS"];
  if (commonFrenchWords.some((word) => vin.includes(word))) {
    console.warn(`⚠️ Mot français détecté dans le VIN: ${vin}`);
    return false;
  }

  return true;
};

/**
 * Validation de l'immatriculation française
 * Format SIV: AA-123-AA (ou variations sans tirets)
 * Ancien format: 1234 AB 56
 */
export const isValidImmatriculation = (immat: string): boolean => {
  if (!immat) return false;

  const cleaned = immat.replace(/[\s\-]/g, "").toUpperCase();

  // Format SIV (nouveau): AA-123-AA (7 caractères)
  const sivPattern = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
  if (sivPattern.test(cleaned)) {
    return true;
  }

  // Ancien format: 123 ABC 45 ou 1234 AB 45
  const oldPattern1 = /^\d{3}[A-Z]{2,3}\d{2}$/; // 123ABC45
  const oldPattern2 = /^\d{4}[A-Z]{2}\d{2}$/; // 1234AB45
  if (oldPattern1.test(cleaned) || oldPattern2.test(cleaned)) {
    return true;
  }

  console.warn(`⚠️ Format d'immatriculation invalide: ${immat}`);
  return false;
};

/**
 * Utilitaires pour parser les données d'une carte grise française
 */

export interface VehicleRegistrationData {
  immatriculation?: string;
  datePremiereImmatriculation?: string;
  numeroChassisVIN?: string;
  marque?: string;
  denominationCommerciale?: string;
  masseEnChargeMax?: number;
  masseVide?: number;
  categorie?: string;
  genreNational?: string;
  carrosserieCE?: string;
  carrosserieNationale?: string;
}

/**
 * Nettoie et formate une chaîne de texte
 */
const cleanText = (text: string): string => {
  return text.trim().replace(/\s+/g, " ");
};

/**
 * Corrige les erreurs OCR communes sur les chiffres
 * Utilisé pour améliorer la précision des valeurs numériques
 */
const correctOCRDigits = (text: string): string => {
  let corrected = text;

  // Dans un contexte numérique, corriger les confusions communes:
  // - Remplacer O par 0 si entouré de chiffres
  // - Remplacer I, l, | par 1 si entouré de chiffres
  // - Remplacer S par 5 si entouré de chiffres

  // Pattern: chiffre + lettre confuse + chiffre
  corrected = corrected.replace(/(\d)[Oo](\d)/g, "$10$2"); // O → 0
  corrected = corrected.replace(/(\d)[IlL|](\d)/g, "$11$2"); // I,l,L,| → 1
  corrected = corrected.replace(/(\d)[Ss](\d)/g, "$15$2"); // S → 5
  corrected = corrected.replace(/(\d)[Bb](\d)/g, "$18$2"); // B → 8

  // Au début d'un nombre de 4 chiffres
  corrected = corrected.replace(/\b[Oo](\d{3})\b/g, "0$1"); // O → 0
  corrected = corrected.replace(/\b[IlL|](\d{3})\b/g, "1$1"); // I,l,L,| → 1

  // À la fin d'un nombre de 4 chiffres
  corrected = corrected.replace(/\b(\d{3})[Oo]\b/g, "$10"); // O → 0
  corrected = corrected.replace(/\b(\d{3})[IlL|]\b/g, "$11"); // I,l,L,| → 1

  return corrected;
};

/**
 * Extrait l'immatriculation (champ A)
 * Format: XX-XXX-XX ou ancien format
 * AMÉLIORÉ: Plus tolérant aux variations et erreurs OCR
 */
export const extractImmatriculation = (text: string): string | undefined => {
  const patterns = [
    // Format SIV (depuis 2009): AA-123-AA avec variations
    /\b([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})\b/i,
    // Ancien format: 123 ABC 45 avec variations
    /\b(\d{1,4}\s?[A-Z]{2,3}\s?\d{2})\b/i,
    // Pattern "A:" suivi de l'immatriculation
    /A[\s.:]*([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})/i,
    // Recherche après "IMMATRICULATION" ou "N°"
    /(?:IMMATRICULATION|N°|NUM)[\s.:]*([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/[\s\-]/g, "").toUpperCase();

      // Valider avant de retourner
      if (isValidImmatriculation(cleaned)) {
        // Reformater au format AA-123-AA si format SIV
        if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(cleaned)) {
          return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}`;
        }
        return cleaned;
      }
    }
  }

  return undefined;
};

/**
 * Extrait la date de première immatriculation (champ B)
 * Format: JJ/MM/AAAA ou JJ.MM.AAAA
 */
export const extractDatePremiereImmatriculation = (text: string): string | undefined => {
  // Pattern pour date complète
  const datePattern = /\b(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})\b/;
  const match = text.match(datePattern);

  if (match) {
    const [, jour, mois, annee] = match;
    return `${jour}/${mois}/${annee}`;
  }

  // Chercher après "B" ou "B." ou "B:"
  const bPattern = /B[\s.:]+([\d\/\.\-]{8,10})/i;
  const bMatch = text.match(bPattern);
  if (bMatch) {
    const dateStr = bMatch[1];
    const dateMatch = dateStr.match(/(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/);
    if (dateMatch) {
      const [, jour, mois, annee] = dateMatch;
      return `${jour}/${mois}/${annee}`;
    }
  }

  return undefined;
};

/**
 * Extrait le numéro de châssis VIN (champ E)
 * Format: 17 caractères alphanumériques
 * AMÉLIORÉ v3.4: Validation stricte + rejette les VIN invalides
 */
export const extractNumeroChassisVIN = (text: string): string | undefined => {
  console.log("🔍 Recherche du VIN dans le texte OCR...");

  // Nettoyage initial
  const lines = text.split("\n");

  // Chercher le VIN dans différents patterns
  const vinCandidates: string[] = [];

  // Pattern 1: Ligne commençant par "E" ou "E." suivi du VIN
  for (const line of lines) {
    const ePattern = /E[\s.:]+(VF[A-HJ-NPR-Z0-9]{15})/i;
    const match = line.match(ePattern);
    if (match) {
      vinCandidates.push(match[1]);
    }
  }

  // Pattern 2: Séquence de 17 caractères commençant par VF
  const vfPattern = /\b(VF[A-HJ-NPR-Z0-9]{15})\b/gi;
  let match;
  while ((match = vfPattern.exec(text)) !== null) {
    vinCandidates.push(match[1]);
  }

  // Pattern 3: Autres codes constructeurs
  const allManufacturerPattern = /\b([A-Z]{2}[A-HJ-NPR-Z0-9]{15})\b/gi;
  while ((match = allManufacturerPattern.exec(text)) !== null) {
    vinCandidates.push(match[1]);
  }

  console.log(`📋 Candidats VIN trouvés: ${vinCandidates.length}`);

  // Valider tous les candidats
  const validVINs = vinCandidates
    .map((vin) => vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ""))
    .filter((vin) => {
      const isValid = isValidVINFormat(vin);
      if (isValid) {
        console.log(`✅ VIN valide: ${vin}`);
      } else {
        console.log(`❌ VIN invalide rejeté: ${vin}`);
      }
      return isValid;
    });

  if (validVINs.length > 0) {
    // Prendre le premier VIN valide
    const selectedVIN = validVINs[0];
    console.log(`🎯 VIN sélectionné: ${selectedVIN}`);
    return selectedVIN;
  }

  console.warn("⚠️ Aucun VIN valide détecté");
  return undefined;
};

/**
 * Extrait la marque (champ D.1)
 * Exemples: RENAULT, PEUGEOT, CITROEN, etc.
 */
export const extractMarque = (text: string): string | undefined => {
  const marques = [
    "RENAULT",
    "PEUGEOT",
    "CITROEN",
    "VOLKSWAGEN",
    "BMW",
    "MERCEDES",
    "AUDI",
    "FORD",
    "OPEL",
    "FIAT",
    "TOYOTA",
    "NISSAN",
    "HYUNDAI",
    "KIA",
    "DACIA",
    "SEAT",
    "SKODA",
    "VOLVO",
    "MAZDA",
    "HONDA",
    "MITSUBISHI",
    "SUZUKI",
    "JEEP",
    "LAND ROVER",
    "PORSCHE",
    "TESLA",
  ];

  // Chercher D.1 ou D1 suivi de la marque
  for (const marque of marques) {
    const pattern = new RegExp(`D[\\.\\s]?1[\\s.:]*${marque}`, "i");
    if (pattern.test(text)) {
      return marque;
    }
  }

  // Chercher directement la marque dans le texte
  for (const marque of marques) {
    const pattern = new RegExp(`\\b${marque}\\b`, "i");
    if (pattern.test(text)) {
      return marque;
    }
  }

  return undefined;
};

/**
 * Extrait la dénomination commerciale / modèle (champ D.3)
 * Exemples: CLIO, 308, C3, GOLF, etc.
 */
export const extractDenominationCommerciale = (text: string): string | undefined => {
  // Chercher D.3 ou D3 suivi du modèle
  const d3Pattern = /D[\.\s]?3[\s.:]+([A-Z0-9\s\-]{2,30})/i;
  const match = text.match(d3Pattern);

  if (match) {
    return cleanText(match[1]).toUpperCase();
  }

  return undefined;
};

/**
 * Extrait la masse à vide (champ G.1)
 * Format: Nombre en kg
 */
export const extractMasseVide = (text: string): number | undefined => {
  // Chercher G.1 ou G1 suivi d'un nombre
  const patterns = [/G[\.\s]?1[\s.:]+(\d+)/i, /MASSE[\s]+(?:A\s+)?VIDE[\s.:]+(\d+)/i, /TARE[\s.:]+(\d+)/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(correctOCRDigits(match[1]));
      // Valider que la valeur est réaliste (entre 500kg et 5000kg)
      if (value >= 500 && value <= 5000) {
        return value;
      }
    }
  }

  return undefined;
};

/**
 * Extrait la masse en charge maximale / PTAC (champ F.1)
 * Format: Nombre en kg
 */
export const extractMasseEnChargeMax = (text: string): number | undefined => {
  const patterns = [
    /F[\.\s]?1[\s.:]+(\d+)/i,
    /PTAC[\s.:]+(\d+)/i,
    /(?:MASSE|POIDS)[\s]+(?:TOTALE|MAX|EN\s+CHARGE)[\s.:]+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(correctOCRDigits(match[1]));
      // Valider que la valeur est réaliste (entre 800kg et 7500kg)
      if (value >= 800 && value <= 7500) {
        return value;
      }
    }
  }

  return undefined;
};

/**
 * Extrait le genre national (champ J.1)
 * Exemples: VP (Voiture Particulière), CTTE (Camionnette), etc.
 */
export const extractGenreNational = (text: string): string | undefined => {
  const genres = ["VP", "CTTE", "CAM", "TCP", "TRR", "RESP", "SRAT", "MAGA", "VASP"];

  // Chercher J.1 ou J1 suivi du genre
  for (const genre of genres) {
    const pattern = new RegExp(`J[\\.\\s]?1[\\s.:]*${genre}`, "i");
    if (pattern.test(text)) {
      return genre;
    }
  }

  // Chercher "GENRE" suivi du genre
  for (const genre of genres) {
    const pattern = new RegExp(`GENRE[\\s.:]+${genre}`, "i");
    if (pattern.test(text)) {
      return genre;
    }
  }

  // Chercher directement dans le texte
  for (const genre of genres) {
    const pattern = new RegExp(`\\b${genre}\\b`, "i");
    if (pattern.test(text)) {
      return genre;
    }
  }

  return undefined;
};

/**
 * Parse le texte OCR pour extraire toutes les données de la carte grise
 */
export const parseRegistrationCardText = (text: string): VehicleRegistrationData => {
  console.log("📄 Parsing du texte OCR...");
  console.log("Texte brut (premiers 500 caractères):", text.substring(0, 500));

  const data: VehicleRegistrationData = {
    immatriculation: extractImmatriculation(text),
    datePremiereImmatriculation: extractDatePremiereImmatriculation(text),
    numeroChassisVIN: extractNumeroChassisVIN(text),
    marque: extractMarque(text),
    denominationCommerciale: extractDenominationCommerciale(text),
    masseVide: extractMasseVide(text),
    masseEnChargeMax: extractMasseEnChargeMax(text),
    genreNational: extractGenreNational(text),
  };

  console.log("✅ Données extraites:", data);
  return data;
};
