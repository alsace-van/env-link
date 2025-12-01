/**
 * VERSION AMÉLIORÉE - registrationCardParser.ts
 * 
 * Améliorations principales :
 * 1. Corrections OCR spécifiques au VIN plus agressives
 * 2. Validation VIN plus tolérante (mode relaxed pour debug)
 * 3. Plus de patterns d'extraction pour l'immatriculation
 * 4. Logs détaillés pour diagnostic
 * 5. Correction des erreurs OCR communes sur les chiffres
 */

/**
 * NOUVEAU : Corrections OCR spécifiques au VIN
 * Plus agressif que correctOCRDigits car le VIN a des règles strictes
 */
export const correctOCRVIN = (text: string): string => {
  let corrected = text.toUpperCase();

  // Le VIN ne contient JAMAIS I, O, Q
  corrected = corrected.replace(/[Oo]/g, '0');  // O → 0
  corrected = corrected.replace(/[Ii]/g, '1');  // I → 1
  corrected = corrected.replace(/[Qq]/g, '0');  // Q → 0
  
  // Corrections contextuelles courantes
  corrected = corrected.replace(/[lL|]/g, '1'); // l, L, | → 1
  corrected = corrected.replace(/[Ss]/g, '5');  // S → 5 (dans contexte VIN)
  corrected = corrected.replace(/[Zz]/g, '2');  // Z → 2 (moins fréquent)
  corrected = corrected.replace(/[Bb]/g, '8');  // B → 8 (dans contexte numérique)
  
  // Nettoyer les espaces et caractères spéciaux
  corrected = corrected.replace(/[^A-HJ-NPR-Z0-9]/g, '');

  return corrected;
};

/**
 * Valide et corrige un VIN (Vehicle Identification Number)
 * VERSION AMÉLIORÉE avec correction OCR intégrée
 */
export const validateAndCorrectVIN = (vin: string): string => {
  if (!vin) return vin;

  // Appliquer les corrections OCR
  const cleaned = correctOCRVIN(vin);

  console.log(`🔍 VIN brut: "${vin}" → nettoyé: "${cleaned}" (${cleaned.length} car.)`);

  // Si le VIN fait exactement 17 caractères, c'est bon
  if (cleaned.length === 17) {
    console.log("✅ VIN valide (17 caractères)");
    return cleaned;
  }

  // Si le VIN fait 16 caractères, essayer de trouver le caractère manquant
  if (cleaned.length === 16) {
    console.warn(`⚠️ VIN trop court (${cleaned.length} caractères): ${cleaned}`);
    // On peut essayer de deviner où ajouter un caractère basé sur le pattern
    // Pour l'instant, on retourne avec un ? à la fin
    return cleaned + "?";
  }

  // Si le VIN fait 18 caractères, essayer de trouver le caractère en trop
  if (cleaned.length === 18) {
    console.warn(`⚠️ VIN trop long (${cleaned.length} caractères): ${cleaned}`);
    // Retourner pour correction manuelle
    return cleaned;
  }

  // Si entre 15-19 caractères, c'est probablement un VIN mal détecté
  if (cleaned.length >= 15 && cleaned.length <= 19) {
    console.warn(`⚠️ VIN longueur atypique (${cleaned.length} caractères): ${cleaned}`);
    return cleaned;
  }

  console.warn(`❌ VIN trop éloigné de 17 caractères: ${cleaned.length}`);
  return cleaned;
};

/**
 * NOUVEAU : Validation stricte du format VIN
 */
export const isValidVINFormat = (vin: string): boolean => {
  if (!vin || vin.length !== 17) {
    console.log(`❌ VIN longueur invalide: ${vin?.length || 0}/17`);
    return false;
  }

  // Doit commencer par une lettre (code constructeur)
  if (!/^[A-Z]/.test(vin)) {
    console.log(`❌ VIN ne commence pas par une lettre: ${vin[0]}`);
    return false;
  }

  // Doit contenir au moins 3 chiffres
  const digitCount = (vin.match(/\d/g) || []).length;
  if (digitCount < 3) {
    console.log(`❌ VIN pas assez de chiffres: ${digitCount}/3`);
    return false;
  }

  // Liste étendue des codes constructeurs connus (2 premières lettres)
  const validManufacturerCodes = [
    "VF", "WV", "WP", "JA", "JM", "JN", "KL", "KM", "KN", "LV",
    "SA", "SB", "SU", "TM", "TR", "VN", "VS", "WA", "WB", "WD",
    "WM", "YS", "YV", "ZA", "ZF", "1F", "1G", "1H", "1J", "2F",
    "2G", "2H", "3F", "3G", "4F", "5F", "5T", "5X", "6F", "6G",
    "8A", "9B", "93", "9F"
  ];
  
  const manufacturerCode = vin.substring(0, 2);
  if (!validManufacturerCodes.includes(manufacturerCode)) {
    console.warn(`⚠️ Code constructeur inconnu (mais autorisé): ${manufacturerCode} dans ${vin}`);
    // Ne pas rejeter, juste warning
  }

  // Rejeter les mots français courants qui pourraient être mal détectés comme VIN
  const commonFrenchWords = ["RUE", "AVENUE", "BOULEVARD", "FRANCE", "PARIS", "CARTE", "GRISE"];
  if (commonFrenchWords.some((word) => vin.includes(word))) {
    console.warn(`❌ Mot français détecté dans le VIN: ${vin}`);
    return false;
  }

  // Ne doit pas contenir I, O, Q
  if (/[IOQ]/.test(vin)) {
    console.warn(`❌ VIN contient I, O ou Q (invalide): ${vin}`);
    return false;
  }

  console.log("✅ VIN passe toutes les validations");
  return true;
};

/**
 * NOUVEAU : Validation relaxed pour debugging (plus tolérante)
 */
export const isValidVINFormatRelaxed = (vin: string): boolean => {
  if (!vin || vin.length < 15 || vin.length > 19) {
    return false;
  }

  // Commence par une lettre
  if (!/^[A-Z]/.test(vin)) return false;

  // Au moins 3 chiffres
  const digitCount = (vin.match(/\d/g) || []).length;
  if (digitCount < 3) return false;

  // Pas de mots français évidents
  const commonFrenchWords = ["RUE", "AVENUE", "BOULEVARD"];
  if (commonFrenchWords.some((word) => vin.includes(word))) {
    return false;
  }

  return true;
};

/**
 * Validation de l'immatriculation française
 * VERSION AMÉLIORÉE avec corrections OCR
 */
export const isValidImmatriculation = (immat: string): boolean => {
  if (!immat) return false;

  // Nettoyer et corriger les erreurs OCR courantes
  let cleaned = immat.replace(/[\s\-]/g, "").toUpperCase();
  
  // Corrections OCR spécifiques aux immatriculations
  cleaned = cleaned.replace(/[Oo]/g, '0');  // O → 0
  cleaned = cleaned.replace(/[Ii]/g, '1');  // I → 1
  cleaned = cleaned.replace(/[Qq]/g, '0');  // Q → 0

  console.log(`🔍 Immatriculation brute: "${immat}" → nettoyée: "${cleaned}"`);

  // Format SIV (nouveau): AA-123-AA (7 caractères)
  const sivPattern = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
  if (sivPattern.test(cleaned)) {
    console.log("✅ Immatriculation SIV valide");
    return true;
  }

  // Ancien format: 123 ABC 45 ou 1234 AB 45
  const oldPattern1 = /^\d{3}[A-Z]{2,3}\d{2}$/; // 123ABC45
  const oldPattern2 = /^\d{4}[A-Z]{2}\d{2}$/; // 1234AB45
  if (oldPattern1.test(cleaned) || oldPattern2.test(cleaned)) {
    console.log("✅ Immatriculation ancien format valide");
    return true;
  }

  console.warn(`⚠️ Format d'immatriculation invalide: ${immat} → ${cleaned}`);
  return false;
};

/**
 * Utilitaires pour parser les données d'une carte grise française
 */

export interface VehicleRegistrationData {
  // Données principales déjà utilisées dans le parsing avancé
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
  energie?: string;
  puissanceFiscale?: number;
  cylindree?: number;
  ptra?: number;
  longueur?: number;
  largeur?: number;
  hauteur?: number;

  // Champs complémentaires utilisés par le scanner IA et la saisie manuelle
  vin?: string;
  modele?: string;
  typeVariante?: string;
  dateImmatriculation?: string;
  genre?: string;
  carrosserie?: string;
  couleur?: string;
  placesAssises?: number | null;
  placesDebout?: number | null;
  ptac?: number | null;
  poidsVide?: number | null;
  puissanceKw?: number | null;
  co2?: number | null;
  nomProprietaire?: string;
  prenomProprietaire?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
}

/**
 * Nettoie et formate une chaîne de texte
 */
const cleanText = (text: string): string => {
  return text.trim().replace(/\s+/g, " ");
};

/**
 * Corrige les erreurs OCR communes sur les chiffres
 * VERSION AMÉLIORÉE
 */
const correctOCRDigits = (text: string): string => {
  let corrected = text;

  // Dans un contexte numérique, corriger les confusions communes:
  // - Remplacer O par 0 si entouré de chiffres
  // - Remplacer I, l, | par 1 si entouré de chiffres
  // - Remplacer S par 5 si entouré de chiffres

  // Pattern: chiffre + lettre confuse + chiffre
  corrected = corrected.replace(/(\d)[Oo](\d)/g, "$10$2"); // O → 0
  corrected = corrected.replace(/(\d)[IilL|](\d)/g, "$11$2"); // I,i,l,L,| → 1
  corrected = corrected.replace(/(\d)[Ss](\d)/g, "$15$2"); // S → 5
  corrected = corrected.replace(/(\d)[Bb](\d)/g, "$18$2"); // B → 8
  corrected = corrected.replace(/(\d)[Zz](\d)/g, "$12$2"); // Z → 2

  // Au début d'un nombre de 4 chiffres
  corrected = corrected.replace(/\b[Oo](\d{3})\b/g, "0$1"); // O → 0
  corrected = corrected.replace(/\b[IilL|](\d{3})\b/g, "1$1"); // I,i,l,L,| → 1

  // À la fin d'un nombre de 4 chiffres
  corrected = corrected.replace(/\b(\d{3})[Oo]\b/g, "$10"); // O → 0
  corrected = corrected.replace(/\b(\d{3})[IilL|]\b/g, "$11"); // I,i,l,L,| → 1

  return corrected;
};

/**
 * Extrait l'immatriculation (champ A)
 * VERSION AMÉLIORÉE avec plus de patterns et corrections OCR
 */
export const extractImmatriculation = (text: string): string | undefined => {
  console.log("🔍 Recherche de l'immatriculation...");
  
  const patterns = [
    // Format SIV (depuis 2009): AA-123-AA avec variations
    /\b([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})\b/i,
    // Ancien format: 123 ABC 45 avec variations
    /\b(\d{1,4}\s?[A-Z]{2,3}\s?\d{2})\b/i,
    // Pattern "A:" ou "A." suivi de l'immatriculation
    /A[\s.:]*([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})/i,
    /A[\s.:]*(\d{1,4}\s?[A-Z]{2,3}\s?\d{2})/i,
    // Recherche après "IMMATRICULATION" ou "N°"
    /(?:IMMATRICULATION|N°|NUM|NUMERO)[\s.:]*([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})/i,
    /(?:IMMATRICULATION|N°|NUM|NUMERO)[\s.:]*(\d{1,4}\s?[A-Z]{2,3}\s?\d{2})/i,
    // Pattern plus large pour capturer tout ce qui ressemble à une immat
    /\b([A-Z]{2}\d{3}[A-Z]{2})\b/i,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = text.match(pattern);
    if (match) {
      console.log(`  Pattern ${i + 1} match: "${match[1]}"`);
      
      let cleaned = match[1].replace(/[\s\-]/g, "").toUpperCase();
      
      // Appliquer corrections OCR
      cleaned = cleaned.replace(/[Oo]/g, '0');
      cleaned = cleaned.replace(/[Ii]/g, '1');
      cleaned = cleaned.replace(/[Qq]/g, '0');

      console.log(`  Après correction OCR: "${cleaned}"`);

      // Valider avant de retourner
      if (isValidImmatriculation(cleaned)) {
        // Reformater au format AA-123-AA si format SIV
        if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(cleaned)) {
          const formatted = `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}`;
          console.log(`✅ Immatriculation trouvée: ${formatted}`);
          return formatted;
        }
        console.log(`✅ Immatriculation trouvée: ${cleaned}`);
        return cleaned;
      } else {
        console.log(`  ❌ Validation échouée pour: ${cleaned}`);
      }
    }
  }

  console.log("❌ Aucune immatriculation détectée");
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
 * VERSION AMÉLIORÉE avec plus de patterns et meilleure validation
 */
export const extractNumeroChassisVIN = (text: string): string | undefined => {
  console.log("🔍 Recherche du VIN dans le texte OCR...");
  console.log("📄 Texte brut (300 premiers car.):", text.substring(0, 300));

  // Nettoyage initial
  const lines = text.split("\n");
  console.log(`📋 ${lines.length} lignes détectées`);

  // Chercher le VIN dans différents patterns
  const vinCandidates: string[] = [];

  // Pattern 1: Ligne commençant par "E" ou "E." suivi du VIN
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Patterns variés pour le champ E
    const ePatterns = [
      /E[\s.:]+(VF[A-HJ-NPR-Z0-9]{15})/i,
      /E[\s.:]+([A-Z]{2}[A-HJ-NPR-Z0-9]{15})/i,
      /E[\s.:]+([\dA-HJ-NPR-Z]{17})/i,
    ];

    for (const ePattern of ePatterns) {
      const match = line.match(ePattern);
      if (match) {
        console.log(`  ✓ Pattern E ligne ${i}: "${match[1]}"`);
        vinCandidates.push(match[1]);
      }
    }
  }

  // Pattern 2: Séquence de 17 caractères commençant par VF (France)
  const vfPattern = /\b(VF[A-HJ-NPR-Z0-9]{15})\b/gi;
  let match;
  while ((match = vfPattern.exec(text)) !== null) {
    console.log(`  ✓ Pattern VF: "${match[1]}"`);
    vinCandidates.push(match[1]);
  }

  // Pattern 3: Autres codes constructeurs européens courants
  const euPattern = /\b((VF|WV|WP|SA|SB|VS|ZA|ZF)[A-HJ-NPR-Z0-9]{15})\b/gi;
  while ((match = euPattern.exec(text)) !== null) {
    console.log(`  ✓ Pattern EU: "${match[1]}"`);
    vinCandidates.push(match[1]);
  }

  // Pattern 4: Tous codes constructeurs (plus permissif)
  const allPattern = /\b([A-Z\d]{2}[A-HJ-NPR-Z0-9]{15})\b/gi;
  while ((match = allPattern.exec(text)) !== null) {
    console.log(`  ✓ Pattern ALL: "${match[1]}"`);
    vinCandidates.push(match[1]);
  }

  console.log(`📋 ${vinCandidates.length} candidats VIN trouvés`);

  // Appliquer corrections OCR et valider tous les candidats
  const validVINs = vinCandidates
    .map((vin) => correctOCRVIN(vin))
    .filter((vin) => {
      const isValid = isValidVINFormat(vin);
      if (isValid) {
        console.log(`✅ VIN valide: ${vin}`);
      } else {
        console.log(`❌ VIN invalide rejeté: ${vin}`);
        
        // En mode debug, essayer la version relaxed
        const isRelaxedValid = isValidVINFormatRelaxed(vin);
        if (isRelaxedValid) {
          console.log(`⚠️ VIN passe en mode relaxed (debug): ${vin}`);
          // En production, commenter la ligne suivante
          // return true; // Activer pour mode debug ultra-permissif
        }
      }
      return isValid;
    });

  if (validVINs.length > 0) {
    // Prendre le premier VIN valide (le plus probable)
    const selectedVIN = validVINs[0];
    console.log(`🎯 VIN sélectionné: ${selectedVIN}`);
    return selectedVIN;
  }

  console.warn("⚠️ Aucun VIN valide détecté");
  
  // En dernier recours, retourner le meilleur candidat même s'il est invalide
  if (vinCandidates.length > 0) {
    const bestCandidate = vinCandidates
      .map((vin) => correctOCRVIN(vin))
      .sort((a, b) => Math.abs(b.length - 17) - Math.abs(a.length - 17))[0];
    
    console.warn(`⚠️ Retour du meilleur candidat (invalide): ${bestCandidate}`);
    return bestCandidate;
  }

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
    "IVECO",
    "MAN",
    "SCANIA",
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
  const patterns = [
    /G[\.\s]?1[\s.:]+(\d+)/i,
    /MASSE[\s]+(?:A\s+)?VIDE[\s.:]+(\d+)/i,
    /TARE[\s.:]+(\d+)/i,
  ];

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
 * VERSION AMÉLIORÉE avec logs détaillés
 */
export const parseRegistrationCardText = (text: string): VehicleRegistrationData => {
  console.log("📄 Parsing du texte OCR...");
  console.log("=" .repeat(80));
  console.log("Texte brut (premiers 500 caractères):");
  console.log(text.substring(0, 500));
  console.log("=" .repeat(80));

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

  console.log("=" .repeat(80));
  console.log("✅ Résultat du parsing:");
  console.log(`  Immatriculation: ${data.immatriculation || "NON DÉTECTÉ"}`);
  console.log(`  VIN: ${data.numeroChassisVIN || "NON DÉTECTÉ"} (${data.numeroChassisVIN?.length || 0} car.)`);
  console.log(`  Marque: ${data.marque || "NON DÉTECTÉ"}`);
  console.log(`  Modèle: ${data.denominationCommerciale || "NON DÉTECTÉ"}`);
  console.log(`  Date: ${data.datePremiereImmatriculation || "NON DÉTECTÉ"}`);
  console.log(`  Masse vide: ${data.masseVide || "NON DÉTECTÉ"} kg`);
  console.log(`  PTAC: ${data.masseEnChargeMax || "NON DÉTECTÉ"} kg`);
  console.log(`  Genre: ${data.genreNational || "NON DÉTECTÉ"}`);
  console.log("=" .repeat(80));

  return data;
};
