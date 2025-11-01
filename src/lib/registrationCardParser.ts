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
 * Extrait l'immatriculation (champ A)
 * Format: XX-XXX-XX ou ancien format
 */
export const extractImmatriculation = (text: string): string | undefined => {
  const patterns = [
    // Format SIV (depuis 2009): AA-123-AA
    /\b([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{2})\b/i,
    // Ancien format: 123 ABC 45
    /\b(\d{1,4}\s?[A-Z]{2,3}\s?\d{2})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return cleanText(match[1].replace(/\s/g, "-").toUpperCase());
    }
  }

  return undefined;
};

/**
 * Extrait la date de première immatriculation (champ B)
 * Format: JJ/MM/AAAA ou JJ.MM.AAAA
 */
export const extractDatePremiereImmatriculation = (text: string): string | undefined => {
  const patterns = [
    /\b(\d{2})[\/\.](\d{2})[\/\.](\d{4})\b/,
    /\b(\d{2})\/(\d{2})\/(\d{2})\b/, // Format court YY
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const day = match[1];
      const month = match[2];
      let year = match[3];

      // Convertir année courte en année complète
      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum > 50 ? `19${year}` : `20${year}`;
      }

      // Valider la date
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  return undefined;
};

/**
 * Extrait le numéro de châssis / VIN (champ E)
 * Format: 17 caractères alphanumériques
 */
export const extractNumeroChassisVIN = (text: string): string | undefined => {
  // VIN: 17 caractères (lettres et chiffres, pas de I, O, Q)
  const pattern = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
  const match = text.match(pattern);

  if (match) {
    return cleanText(match[1].toUpperCase());
  }

  return undefined;
};

/**
 * Extrait la marque (champ D.1)
 */
export const extractMarque = (text: string): string | undefined => {
  const marques = [
    "CITROEN",
    "CITROËN",
    "PEUGEOT",
    "RENAULT",
    "FIAT",
    "FORD",
    "VOLKSWAGEN",
    "VW",
    "MERCEDES",
    "MERCEDES-BENZ",
    "OPEL",
    "IVECO",
    "NISSAN",
    "TOYOTA",
    "HYUNDAI",
    "KIA",
    "DACIA",
    "SUZUKI",
    "MITSUBISHI",
    "ISUZU",
    "VOLKSWAGEN UTILITAIRES",
    "DUCATO",
    "TRANSIT",
    "SPRINTER",
    "MASTER",
    "MOVANO",
    "BOXER",
    "JUMPER",
    "TRAFIC",
    "VIVARO",
    "EXPERT",
    "PROACE",
    "TALENTO",
  ];

  // Recherche insensible à la casse
  const textUpper = text.toUpperCase();

  for (const marque of marques) {
    if (textUpper.includes(marque)) {
      return marque;
    }
  }

  return undefined;
};

/**
 * Extrait la dénomination commerciale / modèle (champ D.3)
 */
export const extractDenominationCommerciale = (text: string): string | undefined => {
  const modeles = [
    "JUMPER",
    "BOXER",
    "DUCATO",
    "MASTER",
    "MOVANO",
    "TRANSIT",
    "SPRINTER",
    "TRAFIC",
    "VIVARO",
    "EXPERT",
    "PROACE",
    "TALENTO",
    "CRAFTER",
    "DAILY",
    "PRIMASTAR",
    "DOBLO",
    "COMBO",
    "BERLINGO",
    "KANGOO",
    "PARTNER",
    "CADDY",
    "CONNECT",
    "DISPATCH",
    "SCUDO",
    "TRAVELLER",
    "SPACETOURER",
    "ZAFIRA LIFE",
    "CALIFORNIA",
  ];

  const textUpper = text.toUpperCase();

  for (const modele of modeles) {
    if (textUpper.includes(modele)) {
      return modele;
    }
  }

  // Recherche pattern générique après marque
  const marqueMatch = extractMarque(text);
  if (marqueMatch) {
    const afterMarquePattern = new RegExp(`${marqueMatch}\\s+([A-Z][A-Z0-9\\s-]+?)(?=\\s+[A-Z]\\.|\\d|$)`, "i");
    const match = text.match(afterMarquePattern);
    if (match && match[1]) {
      return cleanText(match[1]);
    }
  }

  return undefined;
};

/**
 * Extrait la masse en charge maximale (champ F.2) en kg
 */
export const extractMasseEnChargeMax = (text: string): number | undefined => {
  // Recherche "F.2" ou "F2" suivi d'un nombre
  const patterns = [/F\.?2[:\s]*(\d{3,5})/i, /masse.*charge.*max.*[:\s]*(\d{3,5})/i, /PTAC[:\s]*(\d{3,5})/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1]);
      // Validation: PTAC typique entre 2000 et 7500 kg pour un fourgon
      if (value >= 1500 && value <= 8000) {
        return value;
      }
    }
  }

  return undefined;
};

/**
 * Extrait la masse à vide (champ G.1) en kg
 */
export const extractMasseVide = (text: string): number | undefined => {
  // Recherche "G.1" ou "G1" suivi d'un nombre
  const patterns = [/G\.?1[:\s]*(\d{3,5})/i, /masse.*vide[:\s]*(\d{3,5})/i, /poids.*vide[:\s]*(\d{3,5})/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1]);
      // Validation: masse à vide typique entre 1200 et 3500 kg
      if (value >= 1000 && value <= 5000) {
        return value;
      }
    }
  }

  return undefined;
};

/**
 * Extrait la catégorie du véhicule (champ J)
 */
export const extractCategorie = (text: string): string | undefined => {
  const categories = ["M1", "M2", "M3", "N1", "N2", "N3", "O1", "O2", "O3", "O4"];

  for (const cat of categories) {
    const pattern = new RegExp(`\\bJ[:\\.\\s]*${cat}\\b`, "i");
    if (pattern.test(text)) {
      return cat;
    }
  }

  return undefined;
};

/**
 * Extrait le genre national (champ J.1)
 */
export const extractGenreNational = (text: string): string | undefined => {
  const genres = [
    "CTTE",
    "DERIV-VP",
    "CAMIONNETTE",
    "CAMION",
    "TCP",
    "VASP",
    "VP",
    "CAMPING-CAR",
    "AUTOBUS",
    "AUTOCAR",
  ];

  const textUpper = text.toUpperCase();

  for (const genre of genres) {
    if (textUpper.includes(`J.1${genre}`) || textUpper.includes(`J1${genre}`)) {
      return genre;
    }
  }

  // Recherche sans préfixe J.1
  for (const genre of genres) {
    if (textUpper.includes(genre)) {
      return genre;
    }
  }

  return undefined;
};

/**
 * Parse le texte complet de l'OCR et extrait toutes les données
 */
export const parseRegistrationCardText = (ocrText: string): VehicleRegistrationData => {
  return {
    immatriculation: extractImmatriculation(ocrText),
    datePremiereImmatriculation: extractDatePremiereImmatriculation(ocrText),
    numeroChassisVIN: extractNumeroChassisVIN(ocrText),
    marque: extractMarque(ocrText),
    denominationCommerciale: extractDenominationCommerciale(ocrText),
    masseEnChargeMax: extractMasseEnChargeMax(ocrText),
    masseVide: extractMasseVide(ocrText),
    categorie: extractCategorie(ocrText),
    genreNational: extractGenreNational(ocrText),
  };
};

/**
 * Prétraite une image pour améliorer la reconnaissance OCR
 */
export const preprocessImageForOCR = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Augmenter le contraste et convertir en niveaux de gris
  for (let i = 0; i < data.length; i += 4) {
    // Conversion en niveaux de gris
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    // Augmentation du contraste (seuillage)
    const threshold = 128;
    const value = gray > threshold ? 255 : 0;

    data[i] = value; // Rouge
    data[i + 1] = value; // Vert
    data[i + 2] = value; // Bleu
  }

  ctx.putImageData(imageData, 0, 0);
};
