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
    /A[:\.\s]*([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const immat = match[1] || match[0].replace(/^A[:\.\s]*/, "");
      return cleanText(immat.replace(/\s+/g, "-").toUpperCase());
    }
  }

  // Stratégie de secours: chercher pattern proche
  // Format AA-NNN-AA où certains caractères peuvent être mal reconnus
  const flexiblePattern = /\b([A-Z0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[A-Z0-9]{2})\b/i;
  const flexMatch = text.match(flexiblePattern);

  if (flexMatch) {
    const candidate = flexMatch[1].replace(/\s+/g, "-").toUpperCase();
    // Vérifier que le pattern ressemble à une immatriculation
    if (/^[A-Z]{2}[\-][0-9]{3}[\-][A-Z]{2}$/.test(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

/**
 * Extrait la date de première immatriculation (champ B)
 * Format: JJ/MM/AAAA ou JJ.MM.AAAA
 * AMÉLIORÉ v2: Priorité champ B + correction confusion chiffres OCR
 */
export const extractDatePremiereImmatriculation = (text: string): string | undefined => {
  // PRIORITÉ 1: Pattern précis avec "B:" ou "B." (champ officiel)
  const precisPatterns = [
    /B[:\.\s]+(\d{2})[\/\.](\d{2})[\/\.](\d{4})/i, // B: 13/02/2018
    /B[:\.\s]+(\d{2})[\/\.](\d{2})[\/\.](\d{2})/i, // B: 13/02/18
  ];

  for (const pattern of precisPatterns) {
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

      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      // Validation stricte
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1990 && yearNum <= 2025) {
        const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
        if (!isNaN(date.getTime())) {
          console.log(`🔍 Date détectée (champ B précis): ${day}/${month}/${year}`);
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
      }
    }
  }

  // PRIORITÉ 2: Recherche ligne par ligne avec contexte "B"
  const lines = text.split(/[\n\r]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Si la ligne contient "B" isolé (champ B)
    if (/\bB[:\.\s]/i.test(line)) {
      // Chercher toutes les dates dans cette ligne et les 2 suivantes
      const contextLines = [line];
      if (i + 1 < lines.length) contextLines.push(lines[i + 1]);
      if (i + 2 < lines.length) contextLines.push(lines[i + 2]);

      const contextText = contextLines.join(" ");

      // Chercher pattern date dans le contexte
      const datePatterns = [/(\d{2})[\/\.](\d{2})[\/\.](\d{4})/g, /(\d{2})[\/\.](\d{2})[\/\.](\d{2})/g];

      for (const datePattern of datePatterns) {
        const matches = [...contextText.matchAll(datePattern)];

        for (const match of matches) {
          const day = match[1];
          const month = match[2];
          let year = match[3];

          if (year.length === 2) {
            const yearNum = parseInt(year);
            year = yearNum > 50 ? `19${year}` : `20${year}`;
          }

          const dayNum = parseInt(day);
          const monthNum = parseInt(month);
          const yearNum = parseInt(year);

          if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1990 && yearNum <= 2025) {
            const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
            if (!isNaN(date.getTime())) {
              console.log(`🔍 Date détectée (contexte B): ${day}/${month}/${year}`);
              return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            }
          }
        }
      }
    }
  }

  // PRIORITÉ 3: Patterns standards sans contexte (fallback)
  const fallbackPatterns = [/\b(\d{2})[\/\.](\d{2})[\/\.](\d{4})\b/, /\b(\d{2})[\/\.](\d{2})[\/\.](\d{2})\b/];

  for (const pattern of fallbackPatterns) {
    const match = text.match(pattern);
    if (match) {
      const day = match[1];
      const month = match[2];
      let year = match[3];

      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum > 50 ? `19${year}` : `20${year}`;
      }

      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      // Validation avec plage de dates plus restrictive pour éviter fausses détections
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 2000 && yearNum <= 2025) {
        const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
        if (!isNaN(date.getTime())) {
          console.log(`🔍 Date détectée (fallback): ${day}/${month}/${year}`);
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
      }
    }
  }

  return undefined;
};

/**
 * Extrait le numéro de châssis / VIN (champ E)
 * Format: 17 caractères alphanumériques
 * AMÉLIORÉ: Tolère les espaces, tirets et erreurs OCR communes
 */
export const extractNumeroChassisVIN = (text: string): string | undefined => {
  // Stratégie 1: VIN parfait de 17 caractères sans séparateurs
  const perfectPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
  const perfectMatch = text.match(perfectPattern);

  if (perfectMatch) {
    return cleanText(perfectMatch[1].toUpperCase());
  }

  // Stratégie 2: VIN avec espaces ou tirets (tolérance OCR)
  // Exemple: "VF3 VFAHK HJZ012953" ou "VF3-VFAHK-HJZ012953"
  const flexiblePattern = /\b([A-HJ-NPR-Z0-9][\s\-]?){17}\b/i;
  const flexibleMatch = text.match(flexiblePattern);

  if (flexibleMatch) {
    // Nettoyer: enlever espaces et tirets
    const cleaned = flexibleMatch[0].replace(/[\s\-]/g, "").toUpperCase();

    // Vérifier que c'est bien 17 caractères après nettoyage
    if (cleaned.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
      return cleaned;
    }
  }

  // Stratégie 3: Recherche pattern "E:" suivi du VIN
  // Sur les cartes grises, le VIN est précédé de "E" ou "E:"
  const fieldEPattern = /E[:\.\s]*([A-HJ-NPR-Z0-9][\s\-]?){16,18}/i;
  const fieldEMatch = text.match(fieldEPattern);

  if (fieldEMatch) {
    const cleaned = fieldEMatch[0]
      .replace(/^E[:\.\s]*/, "")
      .replace(/[\s\-]/g, "")
      .toUpperCase();

    // Accepter 16-18 caractères (on corrigera après)
    if (cleaned.length >= 16 && cleaned.length <= 18 && /^[A-HJ-NPR-Z0-9]+$/.test(cleaned)) {
      return cleaned;
    }
  }

  // Stratégie 4: Recherche de séquence longue de caractères alphanumériques
  // (dernier recours pour OCR de mauvaise qualité)
  const longSequencePattern = /\b([A-HJ-NPR-Z0-9]{15,19})\b/i;
  const longMatch = text.match(longSequencePattern);

  if (longMatch) {
    const candidate = longMatch[1].toUpperCase();
    // Vérifier que c'est proche de 17 caractères
    if (candidate.length >= 16 && candidate.length <= 18) {
      return candidate;
    }
  }

  return undefined;
};

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * (nombre minimal d'opérations pour transformer s1 en s2)
 */
const levenshteinDistance = (s1: string, s2: string): number => {
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
};

/**
 * Extrait la marque (champ D.1)
 * AMÉLIORÉ: Utilise fuzzy matching pour tolérer les erreurs OCR
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
  ];

  const textUpper = text.toUpperCase().replace(/[ËÉÈ]/g, "E");

  // Stratégie 1: Match exact
  for (const marque of marques) {
    const normalized = marque.replace(/[ËÉÈ]/g, "E");
    if (textUpper.includes(normalized)) {
      return marque;
    }
  }

  // Stratégie 2: Fuzzy matching pour erreurs OCR
  // Découper le texte en mots de 4+ caractères
  const words = textUpper.split(/\s+/).filter((w) => w.length >= 4);

  for (const word of words) {
    for (const marque of marques) {
      const normalized = marque.replace(/[ËÉÈ]/g, "E");
      const distance = levenshteinDistance(word, normalized);
      const threshold = Math.ceil(normalized.length * 0.2); // Tolérance 20%

      if (distance <= threshold) {
        console.log(`🔍 Fuzzy match marque: "${word}" → "${marque}" (distance: ${distance})`);
        return marque;
      }
    }
  }

  // Stratégie 3: Pattern D.1 ou D1 suivi de la marque
  const fieldDPattern = /D\.?1[:\s]*([A-Z][A-Z\s]{3,})/i;
  const fieldDMatch = text.match(fieldDPattern);

  if (fieldDMatch) {
    const candidate = fieldDMatch[1].trim().toUpperCase().replace(/[ËÉÈ]/g, "E");

    // Vérifier si correspond à une marque connue (même avec fuzzy)
    for (const marque of marques) {
      const normalized = marque.replace(/[ËÉÈ]/g, "E");
      if (candidate.includes(normalized) || levenshteinDistance(candidate, normalized) <= 2) {
        return marque;
      }
    }
  }

  return undefined;
};

/**
 * Extrait la dénomination commerciale / modèle (champ D.3)
 * AMÉLIORÉ: Utilise fuzzy matching pour tolérer les erreurs OCR
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

  // Stratégie 1: Match exact
  for (const modele of modeles) {
    if (textUpper.includes(modele)) {
      return modele;
    }
  }

  // Stratégie 2: Fuzzy matching
  const words = textUpper.split(/\s+/).filter((w) => w.length >= 4);

  for (const word of words) {
    for (const modele of modeles) {
      const distance = levenshteinDistance(word, modele);
      const threshold = Math.ceil(modele.length * 0.25); // Tolérance 25%

      if (distance <= threshold) {
        console.log(`🔍 Fuzzy match modèle: "${word}" → "${modele}" (distance: ${distance})`);
        return modele;
      }
    }
  }

  // Stratégie 3: Pattern D.3 ou D3 suivi du modèle
  const fieldD3Pattern = /D\.?3[:\s]*([A-Z][A-Z0-9\s\-]{3,})/i;
  const fieldD3Match = text.match(fieldD3Pattern);

  if (fieldD3Match) {
    const candidate = fieldD3Match[1].trim().toUpperCase();

    // Vérifier si correspond à un modèle connu
    for (const modele of modeles) {
      if (candidate.includes(modele) || levenshteinDistance(candidate, modele) <= 2) {
        return modele;
      }
    }

    // Si pas de match exact, retourner le candidat nettoyé
    return cleanText(candidate);
  }

  // Stratégie 4: Recherche pattern générique après marque
  const marqueMatch = extractMarque(text);
  if (marqueMatch) {
    const afterMarquePattern = new RegExp(`${marqueMatch}\\s+([A-Z][A-Z0-9\\s-]{3,}?)(?=\\s+[A-Z]\\.|\\d|$)`, "i");
    const match = text.match(afterMarquePattern);
    if (match && match[1]) {
      const candidate = cleanText(match[1]).toUpperCase();

      // Vérifier fuzzy avec modèles connus
      for (const modele of modeles) {
        if (candidate.includes(modele) || levenshteinDistance(candidate, modele) <= 2) {
          return modele;
        }
      }

      return cleanText(match[1]);
    }
  }

  return undefined;
};

/**
 * Extrait la masse en charge maximale (champ F.2) en kg
 * AMÉLIORÉ v2: Priorité patterns précis + correction OCR chiffres
 */
export const extractMasseEnChargeMax = (text: string): number | undefined => {
  // PRIORITÉ 1: Patterns très précis avec F.2 (champ officiel)
  const precisPatterns = [
    /F\.2[:\s]+(\d{4})/i, // F.2: 3100
    /F\.2[:\s]*:?\s*(\d{4})/i, // F.2 3100 ou F.2: 3100
    /F2[:\s]+(\d{4})/i, // F2 3100
  ];

  for (const pattern of precisPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/\s/g, ""));
      // Validation stricte: PTAC typique entre 2500 et 5000 kg pour utilitaires légers
      if (value >= 2500 && value <= 5000) {
        console.log(`🔍 PTAC détecté (F.2 précis): ${value} kg`);
        return value;
      }
    }
  }

  // PRIORITÉ 2: Recherche ligne par ligne avec contexte F.2
  const lines = text.split(/[\n\r]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Si la ligne contient F.2 ou F2
    if (/F\.?2\b/i.test(line)) {
      // Extraire TOUS les nombres de 4 chiffres dans cette ligne et les 2 lignes suivantes
      const contextLines = [line];
      if (i + 1 < lines.length) contextLines.push(lines[i + 1]);
      if (i + 2 < lines.length) contextLines.push(lines[i + 2]);

      const contextText = contextLines.join(" ");
      const numbers = contextText.match(/\b(\d{4})\b/g);

      if (numbers) {
        console.log(`🔍 Nombres trouvés près de F.2: ${numbers.join(", ")}`);

        // Chercher le premier nombre dans la plage valide
        for (const num of numbers) {
          const value = parseInt(num);
          if (value >= 2500 && value <= 5000) {
            console.log(`🔍 PTAC détecté (contexte F.2): ${value} kg`);
            return value;
          }
        }
      }
    }
  }

  // PRIORITÉ 3: Patterns moins précis avec PTAC ou "masse en charge"
  const fallbackPatterns = [/PTAC[:\s]*(\d{4})/i, /masse.*charge.*max[^\d]*(\d{4})/i, /poids.*total[^\d]*(\d{4})/i];

  for (const pattern of fallbackPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/\s/g, ""));
      if (value >= 2500 && value <= 5000) {
        console.log(`🔍 PTAC détecté (fallback): ${value} kg`);
        return value;
      }
    }
  }

  // PRIORITÉ 4: Dernier recours - chercher le plus petit nombre de 4 chiffres dans la plage
  // (le PTAC est souvent le plus petit des poids)
  const allNumbers = text.match(/\b(\d{4})\b/g);
  if (allNumbers) {
    const validNumbers = allNumbers
      .map((n) => parseInt(n))
      .filter((v) => v >= 2500 && v <= 5000)
      .sort((a, b) => a - b); // Trier du plus petit au plus grand

    if (validNumbers.length > 0) {
      console.log(`🔍 PTAC détecté (dernier recours, plus petit poids): ${validNumbers[0]} kg`);
      return validNumbers[0];
    }
  }

  return undefined;
};

/**
 * Extrait la masse à vide (champ G.1) en kg
 * AMÉLIORÉ v2: Priorité patterns précis + correction OCR chiffres
 */
export const extractMasseVide = (text: string): number | undefined => {
  // PRIORITÉ 1: Patterns très précis avec G.1 (champ officiel)
  const precisPatterns = [
    /G\.1[:\s]+(\d{4})/i, // G.1: 1613
    /G\.1[:\s]*:?\s*(\d{4})/i, // G.1 1613 ou G.1: 1613
    /G1[:\s]+(\d{4})/i, // G1 1613
  ];

  for (const pattern of precisPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/\s/g, ""));
      // Validation stricte: Masse vide typique entre 1200 et 2500 kg pour utilitaires légers
      if (value >= 1200 && value <= 2500) {
        console.log(`🔍 Masse à vide détectée (G.1 précis): ${value} kg`);
        return value;
      }
    }
  }

  // PRIORITÉ 2: Recherche ligne par ligne avec contexte G.1
  const lines = text.split(/[\n\r]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Si la ligne contient G.1 ou G1
    if (/G\.?1\b/i.test(line)) {
      // Extraire TOUS les nombres de 4 chiffres dans cette ligne et les 2 lignes suivantes
      const contextLines = [line];
      if (i + 1 < lines.length) contextLines.push(lines[i + 1]);
      if (i + 2 < lines.length) contextLines.push(lines[i + 2]);

      const contextText = contextLines.join(" ");
      const numbers = contextText.match(/\b(\d{4})\b/g);

      if (numbers) {
        console.log(`🔍 Nombres trouvés près de G.1: ${numbers.join(", ")}`);

        // Chercher le premier nombre dans la plage valide
        for (const num of numbers) {
          const value = parseInt(num);
          if (value >= 1200 && value <= 2500) {
            console.log(`🔍 Masse à vide détectée (contexte G.1): ${value} kg`);
            return value;
          }
        }
      }
    }
  }

  // PRIORITÉ 3: Patterns moins précis avec "masse vide" ou "poids vide"
  const fallbackPatterns = [/masse.*vide[^\d]*(\d{4})/i, /poids.*vide[^\d]*(\d{4})/i, /masse.*service[^\d]*(\d{4})/i];

  for (const pattern of fallbackPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/\s/g, ""));
      if (value >= 1200 && value <= 2500) {
        console.log(`🔍 Masse à vide détectée (fallback): ${value} kg`);
        return value;
      }
    }
  }

  // PRIORITÉ 4: Dernier recours - chercher un nombre de 4 chiffres commençant par 1
  // (la masse vide commence souvent par 1 : 1200-1999 kg)
  const allNumbers = text.match(/\b(\d{4})\b/g);
  if (allNumbers) {
    const validNumbers = allNumbers
      .map((n) => parseInt(n))
      .filter((v) => v >= 1200 && v <= 2500 && v.toString().startsWith("1"))
      .sort((a, b) => a - b);

    if (validNumbers.length > 0) {
      console.log(`🔍 Masse à vide détectée (dernier recours): ${validNumbers[0]} kg`);
      return validNumbers[0];
    }
  }

  return undefined;
};

/**
 * Extrait la catégorie du véhicule (champ J)
 * AMÉLIORÉ v2: Recherche contextuelle + patterns enrichis
 */
export const extractCategorie = (text: string): string | undefined => {
  const categories = [
    "M1",
    "M2",
    "M3",
    "N1",
    "N2",
    "N3",
    "O1",
    "O2",
    "O3",
    "O4",
    "L1",
    "L2",
    "L3",
    "L4",
    "L5",
    "L6",
    "L7",
  ];

  // PRIORITÉ 1: Pattern précis avec J:
  const precisPatterns = [
    /\bJ[:\.\s]+([MNOL]\d)/i, // J: N1
    /\bJ[:\.\s]*:?\s*([MNOL]\d)/i, // J : N1 ou J N1
  ];

  for (const pattern of precisPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].toUpperCase();

      if (categories.includes(candidate)) {
        console.log(`🔍 Catégorie détectée (J précis): ${candidate}`);
        return candidate;
      }
    }
  }

  // PRIORITÉ 2: Recherche ligne par ligne avec contexte J
  const lines = text.split(/[\n\r]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Si la ligne contient "J" isolé ou "J:"
    if (/\bJ[:\.\s]/i.test(line)) {
      // Chercher dans cette ligne et les 2 suivantes
      const contextLines = [line];
      if (i + 1 < lines.length) contextLines.push(lines[i + 1]);
      if (i + 2 < lines.length) contextLines.push(lines[i + 2]);

      const contextText = contextLines.join(" ").toUpperCase();

      // Chercher toutes les catégories
      for (const cat of categories) {
        const pattern = new RegExp(`\\b${cat}\\b`);
        if (pattern.test(contextText)) {
          console.log(`🔍 Catégorie détectée (contexte J): ${cat}`);
          return cat;
        }
      }
    }
  }

  // PRIORITÉ 3: Patterns existants (fallback)
  for (const cat of categories) {
    const pattern = new RegExp(`\\bJ[:\\.\\s]*${cat}\\b`, "i");
    if (pattern.test(text)) {
      console.log(`🔍 Catégorie détectée (fallback): ${cat}`);
      return cat;
    }
  }

  // PRIORITÉ 4: Recherche globale
  for (const cat of categories) {
    const pattern = new RegExp(`\\b${cat}\\b`, "i");
    if (pattern.test(text)) {
      console.log(`🔍 Catégorie détectée (global): ${cat}`);
      return cat;
    }
  }

  return undefined;
};

/**
 * Extrait le genre national (champ J.1)
 * AMÉLIORÉ v2: Recherche contextuelle + patterns enrichis + fuzzy matching
 */
export const extractGenreNational = (text: string): string | undefined => {
  const genres = [
    "CTTE",
    "DERIV-VP",
    "DERIVVP",
    "CAMIONNETTE",
    "CAMION",
    "TCP",
    "VASP",
    "VP",
    "CAMPING-CAR",
    "CAMPINGCAR",
    "AUTOBUS",
    "AUTOCAR",
    "REMORQUE",
    "TRACTEUR",
  ];

  const textUpper = text.toUpperCase();

  // PRIORITÉ 1: Patterns précis avec J.1 ou J1
  const precisPatterns = [
    /J\.1[:\s]*([A-Z\-]+)/i, // J.1: CTTE
    /J\.1[:\s]+([A-Z\-]+)/i, // J.1 CTTE
    /J1[:\s]*([A-Z\-]+)/i, // J1: CTTE
    /J\.1[:\s]*:?\s*([A-Z\-]+)/i, // J.1 : CTTE
  ];

  for (const pattern of precisPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].toUpperCase().trim();

      // Vérifier si c'est un genre connu
      for (const genre of genres) {
        if (candidate === genre || candidate.replace(/[\s\-]/g, "") === genre.replace(/[\s\-]/g, "")) {
          console.log(`🔍 Genre national détecté (J.1 précis): ${genre}`);
          return genre;
        }
      }

      // Fuzzy matching pour variantes
      for (const genre of genres) {
        if (levenshteinDistance(candidate, genre) <= 2) {
          console.log(`🔍 Genre national détecté (fuzzy J.1): "${candidate}" → "${genre}"`);
          return genre;
        }
      }
    }
  }

  // PRIORITÉ 2: Recherche ligne par ligne avec contexte J.1
  const lines = text.split(/[\n\r]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Si la ligne contient "J.1" ou "J1" ou "J :" (variations OCR)
    if (/J\.?1\b|J\s*:/i.test(line)) {
      // Chercher dans cette ligne et les 2 suivantes
      const contextLines = [line];
      if (i + 1 < lines.length) contextLines.push(lines[i + 1]);
      if (i + 2 < lines.length) contextLines.push(lines[i + 2]);

      const contextText = contextLines.join(" ").toUpperCase();

      // Chercher tous les genres dans le contexte
      for (const genre of genres) {
        // Match exact
        if (contextText.includes(genre)) {
          console.log(`🔍 Genre national détecté (contexte J.1): ${genre}`);
          return genre;
        }

        // Match sans tirets/espaces (DERIV-VP = DERIVVP)
        const genreNormalized = genre.replace(/[\s\-]/g, "");
        const contextNormalized = contextText.replace(/[\s\-]/g, "");
        if (contextNormalized.includes(genreNormalized)) {
          console.log(`🔍 Genre national détecté (contexte normalisé): ${genre}`);
          return genre;
        }
      }

      // Fuzzy search dans le contexte
      const words = contextText.split(/\s+/).filter((w) => w.length >= 2);
      for (const word of words) {
        for (const genre of genres) {
          const distance = levenshteinDistance(word, genre);
          const threshold = Math.ceil(genre.length * 0.25); // Tolérance 25%

          if (distance <= threshold && distance <= 2) {
            console.log(`🔍 Genre national détecté (fuzzy contexte): "${word}" → "${genre}" (distance: ${distance})`);
            return genre;
          }
        }
      }
    }
  }

  // PRIORITÉ 3: Recherche sans préfixe J.1 (fallback)
  for (const genre of genres) {
    // Match exact dans le texte
    if (textUpper.includes(genre)) {
      console.log(`🔍 Genre national détecté (fallback): ${genre}`);
      return genre;
    }

    // Match sans tirets/espaces
    const genreNormalized = genre.replace(/[\s\-]/g, "");
    const textNormalized = textUpper.replace(/[\s\-]/g, "");
    if (textNormalized.includes(genreNormalized)) {
      console.log(`🔍 Genre national détecté (fallback normalisé): ${genre}`);
      return genre;
    }
  }

  // PRIORITÉ 4: Fuzzy matching global (dernier recours)
  const words = textUpper.split(/\s+/).filter((w) => w.length >= 3);
  for (const word of words) {
    for (const genre of genres) {
      const distance = levenshteinDistance(word, genre);

      // Seuil très strict pour éviter faux positifs
      if (distance <= 1 && genre.length >= 4) {
        console.log(`🔍 Genre national détecté (fuzzy global): "${word}" → "${genre}" (distance: ${distance})`);
        return genre;
      }
    }
  }

  console.log("⚠️ Genre national non détecté");
  return undefined;
};

/**
 * Parse le texte complet de l'OCR et extrait toutes les données
 * AMÉLIORÉ v2: Correction OCR chiffres avant extraction
 */
export const parseRegistrationCardText = (ocrText: string): VehicleRegistrationData => {
  // Pré-traitement: Corriger les erreurs OCR communes sur les chiffres
  const correctedText = correctOCRDigits(ocrText);

  console.log("📝 Texte OCR corrigé (erreurs chiffres)");

  return {
    immatriculation: extractImmatriculation(correctedText),
    datePremiereImmatriculation: extractDatePremiereImmatriculation(correctedText),
    numeroChassisVIN: extractNumeroChassisVIN(correctedText),
    marque: extractMarque(correctedText),
    denominationCommerciale: extractDenominationCommerciale(correctedText),
    masseEnChargeMax: extractMasseEnChargeMax(correctedText),
    masseVide: extractMasseVide(correctedText),
    categorie: extractCategorie(correctedText),
    genreNational: extractGenreNational(correctedText),
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
