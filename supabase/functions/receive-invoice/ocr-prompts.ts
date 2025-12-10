// Prompt Gemini pour extraction OCR avec bounding boxes
// À utiliser dans receive-invoice Edge Function

export const OCR_PROMPT_WITH_ZONES = `Tu es un expert en extraction de données de factures fournisseurs françaises.

Analyse cette facture et extrais les informations suivantes avec leurs coordonnées sur le document.

IMPORTANT: Pour chaque champ, indique la ZONE où tu as trouvé l'information.
Les coordonnées sont normalisées entre 0 et 1 (0,0 = coin supérieur gauche, 1,1 = coin inférieur droit).

Retourne un JSON avec cette structure EXACTE :

{
  "success": true,
  "confidence": 0.95,
  "data": {
    "supplier_name": "Nom du fournisseur",
    "supplier_siret": "12345678901234",
    "invoice_number": "FA-2024-001",
    "invoice_date": "2024-01-15",
    "due_date": "2024-02-15",
    "total_ht": 136.51,
    "tva_rate": 20,
    "tva_amount": 27.30,
    "total_ttc": 163.81,
    "description": "Description des articles/services"
  },
  "zones": {
    "supplier_name": {
      "x": 0.05,
      "y": 0.05,
      "width": 0.4,
      "height": 0.08,
      "page": 1,
      "raw_text": "VISSERIE SERVICE SARL",
      "confidence": 0.98,
      "label_found": "En-tête fournisseur"
    },
    "supplier_siret": {
      "x": 0.05,
      "y": 0.15,
      "width": 0.3,
      "height": 0.03,
      "page": 1,
      "raw_text": "SIRET: 123 456 789 01234",
      "confidence": 0.95,
      "label_found": "SIRET"
    },
    "invoice_number": {
      "x": 0.6,
      "y": 0.1,
      "width": 0.35,
      "height": 0.04,
      "page": 1,
      "raw_text": "Facture N° FA-2024-001",
      "confidence": 0.99,
      "label_found": "Facture N°"
    },
    "invoice_date": {
      "x": 0.6,
      "y": 0.15,
      "width": 0.25,
      "height": 0.03,
      "page": 1,
      "raw_text": "Date: 15/01/2024",
      "confidence": 0.97,
      "label_found": "Date"
    },
    "due_date": {
      "x": 0.6,
      "y": 0.18,
      "width": 0.25,
      "height": 0.03,
      "page": 1,
      "raw_text": "Échéance: 15/02/2024",
      "confidence": 0.90,
      "label_found": "Échéance"
    },
    "total_ht": {
      "x": 0.55,
      "y": 0.75,
      "width": 0.2,
      "height": 0.03,
      "page": 1,
      "raw_text": "Total HT: 136,51 €",
      "confidence": 0.96,
      "label_found": "Total HT"
    },
    "tva_amount": {
      "x": 0.55,
      "y": 0.78,
      "width": 0.2,
      "height": 0.03,
      "page": 1,
      "raw_text": "TVA 20%: 27,30 €",
      "confidence": 0.94,
      "label_found": "TVA"
    },
    "total_ttc": {
      "x": 0.55,
      "y": 0.82,
      "width": 0.25,
      "height": 0.04,
      "page": 1,
      "raw_text": "Total TTC: 163,81 €",
      "confidence": 0.98,
      "label_found": "Total TTC"
    },
    "description": {
      "x": 0.05,
      "y": 0.35,
      "width": 0.9,
      "height": 0.35,
      "page": 1,
      "raw_text": "Vis inox M6x30 x100, Écrous M6 x200...",
      "confidence": 0.85,
      "label_found": "Désignation"
    }
  },
  "identification_patterns": [
    "VISSERIE SERVICE",
    "SIRET 123456789"
  ]
}

RÈGLES IMPORTANTES:
1. Les coordonnées x, y, width, height sont entre 0 et 1
2. x=0 est le bord gauche, x=1 est le bord droit
3. y=0 est le haut, y=1 est le bas
4. raw_text = le texte EXACT trouvé dans cette zone (avec le label)
5. label_found = le libellé qui t'a permis d'identifier ce champ
6. confidence = ta confiance pour CE champ spécifique (0 à 1)
7. Les dates doivent être au format ISO (YYYY-MM-DD)
8. Les montants sont des nombres décimaux (pas de symbole €)
9. Le SIRET doit contenir 14 chiffres (sans espaces)
10. identification_patterns = textes uniques pour identifier ce fournisseur

Si un champ n'est pas trouvé, mets null pour la valeur et n'inclus pas la zone.

Si la facture est illisible ou n'est pas une facture:
{
  "success": false,
  "confidence": 0,
  "error": "Description du problème"
}`;

// Prompt pour extraction AVEC un template existant
export const OCR_PROMPT_WITH_TEMPLATE = (template: any) => `Tu es un expert en extraction de données de factures fournisseurs françaises.

Cette facture provient du fournisseur "${template.supplier_name}".
J'ai déjà un template avec les zones habituelles pour ce fournisseur.

ZONES CONNUES POUR CE FOURNISSEUR:
${JSON.stringify(template.field_zones, null, 2)}

Utilise ces zones comme GUIDE pour trouver les informations.
Les factures de ce fournisseur ont généralement le même format.

Retourne un JSON avec la même structure que d'habitude, mais en te concentrant sur les zones indiquées.
Si une zone ne correspond plus (le fournisseur a changé son format), indique les nouvelles coordonnées.

${OCR_PROMPT_WITH_ZONES}`;

// Types TypeScript
export interface BoundingBox {
  x: number;      // 0-1, position horizontale du coin supérieur gauche
  y: number;      // 0-1, position verticale du coin supérieur gauche
  width: number;  // 0-1, largeur de la zone
  height: number; // 0-1, hauteur de la zone
  page: number;   // numéro de page (1-indexed)
  raw_text: string;    // texte brut trouvé
  confidence: number;  // confiance 0-1
  label_found: string; // libellé identifié
}

export interface OCRResultWithZones {
  success: boolean;
  confidence: number;
  error?: string;
  data?: {
    supplier_name: string | null;
    supplier_siret: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    due_date: string | null;
    total_ht: number | null;
    tva_rate: number | null;
    tva_amount: number | null;
    total_ttc: number | null;
    description: string | null;
  };
  zones?: {
    [field: string]: BoundingBox;
  };
  identification_patterns?: string[];
}

export interface SupplierTemplate {
  id: string;
  supplier_name: string;
  supplier_siret: string | null;
  field_zones: {
    [field: string]: {
      zone: Omit<BoundingBox, 'raw_text' | 'label_found'>;
      label_patterns: string[];
      value_format: 'text' | 'alphanumeric' | 'date' | 'currency' | 'siret';
      confidence: number;
    };
  };
  identification_patterns: string[];
  times_used: number;
  success_rate: number;
}
