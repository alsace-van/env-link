// ============================================
// TYPES: Données VASP M1 pour répartition des charges
// VERSION: 1.0
// DATE: 2026-01-05
// ============================================

/**
 * Rangée de sièges pour calcul répartition des occupants
 */
export interface VASPRangeeSiege {
  id: string;
  nom: string; // "Rangée 1", "Rangée 2", etc.
  distance_av_mm: number; // Distance par rapport à l'essieu avant en mm
  nb_occupants: number; // Nombre d'occupants sur cette rangée
}

/**
 * Coffre/rangement pour calcul répartition des charges
 */
export interface VASPCoffre {
  id: string;
  nom: string; // "Coffre cuisine", "Coffre arrière", etc.
  distance_av_mm: number; // Distance du milieu du coffre à l'essieu avant en mm
  masse_kg: number; // Masse du contenu en kg
  longueur_mm?: number; // Longueur du coffre (optionnel pour affichage)
  largeur_mm?: number; // Largeur du coffre (optionnel pour affichage)
}

/**
 * Réservoir d'eau pour calcul répartition des charges
 */
export interface VASPReservoirEau {
  id: string;
  nom: string; // "Eau propre", "Eaux grises", etc.
  distance_av_mm: number; // Distance à l'essieu avant en mm
  masse_kg: number; // Masse plein en kg
  capacite_litres?: number; // Capacité en litres (optionnel)
}

/**
 * Réservoir de gaz pour calcul répartition des charges
 */
export interface VASPReservoirGaz {
  distance_av_mm: number; // Distance à l'essieu avant en mm
  masse_kg: number; // Masse plein en kg
  type?: string; // "Propane", "Butane", etc.
}

/**
 * Données COC (Certificate of Conformity) du véhicule
 */
export interface VASPDonneesCOC {
  // Masses (COC)
  mmta_kg?: number; // Masse Maximale Techniquement Autorisée (COC 16.1)
  ptac_kg?: number; // Poids Total Autorisé en Charge
  mmta_essieu_av_kg?: number; // MMTA Essieu Avant (COC 16.2)
  mmta_essieu_ar_kg?: number; // MMTA Essieu Arrière (COC 16.2)
  charge_attelage_s_kg?: number; // Charge max point d'attelage S (COC 19)
  
  // Dimensions
  longueur_mm?: number; // Longueur totale
  largeur_mm?: number; // Largeur totale
  empattement_mm?: number; // Empattement (COC 4.1)
  porte_a_faux_avant_mm?: number; // Porte-à-faux avant
  porte_a_faux_arriere_mm?: number; // Porte-à-faux arrière
  
  // Nombre de places
  nombre_places?: number;
}

/**
 * Données de pesée du véhicule
 */
export interface VASPDonneesPesee {
  pesee_essieu_av_kg?: number;
  pesee_essieu_ar_kg?: number;
}

/**
 * Données réservoirs de liquides
 */
export interface VASPDonneesReservoirs {
  // Carburant
  reservoir_carburant_litres?: number;
  reservoir_carburant_distance_av_mm?: number;
  reservoir_carburant_taux_remplissage?: number; // %
  
  // GPL/GNV
  reservoir_gpl_litres?: number;
  reservoir_gpl_distance_av_mm?: number;
  reservoir_gpl_taux_remplissage?: number; // %
  
  // AdBlue
  reservoir_adblue_litres?: number;
  reservoir_adblue_distance_av_mm?: number;
  reservoir_adblue_taux_remplissage?: number; // %
}

/**
 * Données VASP complètes pour un projet
 */
export interface VASPData {
  // Identification
  demandeur?: string;
  
  // COC
  coc: VASPDonneesCOC;
  
  // Pesée
  pesee: VASPDonneesPesee;
  
  // Réservoirs
  reservoirs: VASPDonneesReservoirs;
  
  // Rangées de sièges
  rangees_sieges: VASPRangeeSiege[];
  
  // Coffres
  coffres: VASPCoffre[];
  
  // Réservoirs eau
  reservoirs_eau: VASPReservoirEau[];
  
  // Réservoir gaz
  reservoir_gaz?: VASPReservoirGaz;
}

/**
 * Densités des liquides (kg/L)
 */
export const DENSITES_LIQUIDES = {
  essence: 0.75,
  diesel: 0.84,
  gpl: 0.51,
  gnv: 0.51,
  adblue: 1.09,
  eau: 1.0,
} as const;

/**
 * Masse standard d'un occupant (kg) selon réglementation EU
 */
export const MASSE_OCCUPANT_KG = 75;

/**
 * Calcul de la masse manquante de carburant
 */
export function calculerMasseCarburantManquante(
  volumeLitres: number,
  tauxRemplissage: number,
  densite: number = DENSITES_LIQUIDES.diesel
): number {
  const volumeManquant = volumeLitres * (1 - tauxRemplissage / 100);
  return volumeManquant * densite;
}

/**
 * Calcul de la masse en ordre de marche
 */
export function calculerMasseOrdreMarche(
  peseeAv: number,
  peseeAr: number,
  masseCarburantManquante: number = 0,
  masseGplManquante: number = 0,
  masseAdblueManquante: number = 0
): number {
  return peseeAv + peseeAr + masseCarburantManquante + masseGplManquante + masseAdblueManquante;
}

/**
 * Calcul de la charge utile disponible
 */
export function calculerChargeUtile(
  ptac: number,
  masseOrdreMarche: number,
  nombrePlaces: number,
  chargeAttelage: number = 0
): number {
  const massePassagers = nombrePlaces * MASSE_OCCUPANT_KG;
  return ptac - masseOrdreMarche - massePassagers - chargeAttelage;
}

/**
 * Calcul de la répartition de charge sur l'avant (%)
 */
export function calculerRepartitionAvant(masseAv: number, masseAr: number): number {
  const total = masseAv + masseAr;
  if (total === 0) return 0;
  return (masseAv / total) * 100;
}

/**
 * Élément positionnable sur le plan 2D VASP
 */
export interface VASPElementPosition {
  id: string;
  type: 'essieu_av' | 'essieu_ar' | 'rangee_siege' | 'coffre' | 'reservoir_eau' | 'reservoir_gaz' | 'contour';
  x: number; // Position X sur le canvas (pixels)
  y: number; // Position Y sur le canvas (pixels)
  distance_av_mm: number; // Distance calculée par rapport à l'essieu AV
  data?: any; // Données associées
}

/**
 * Mode de cotation
 */
export type VASPCotationMode = 'bord_bord' | 'centre_centre' | 'bord_centre';

/**
 * Direction de cotation
 */
export type VASPCotationDirection = 'horizontal' | 'vertical' | 'libre';

/**
 * État d'une cotation en cours
 */
export interface VASPCotationState {
  active: boolean;
  referenceElement?: VASPElementPosition;
  targetElement?: VASPElementPosition;
  mode: VASPCotationMode;
  direction: VASPCotationDirection;
  distanceActuelle?: number;
  distanceSaisie?: number;
}
