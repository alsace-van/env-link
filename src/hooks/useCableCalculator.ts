// ============================================
// useCableCalculator.ts
// Hook pour calculer la section de câble recommandée
// VERSION: 1.1 - quickCalculate accepte tension en paramètre
// ============================================

import { useMemo, useCallback } from "react";

// Conductivité du cuivre en m/(Ω.mm²)
const COPPER_CONDUCTIVITY = 56;

// Sections de câble standard disponibles (mm²)
export const STANDARD_SECTIONS = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

// Intensité max par section (cuivre, installation ouverte) en Ampères
export const MAX_CURRENT_BY_SECTION: Record<number, number> = {
  0.5: 3,
  0.75: 6,
  1: 10,
  1.5: 16,
  2.5: 25,
  4: 32,
  6: 40,
  10: 60,
  16: 80,
  25: 100,
  35: 125,
  50: 160,
};

// Couleurs de câble par usage
export const CABLE_COLORS = {
  positive: { color: "#ef4444", label: "+", description: "Positif (rouge)" },
  negative: { color: "#1f2937", label: "-", description: "Négatif/Masse (noir)" },
  ground: { color: "#22c55e", label: "⏚", description: "Terre (vert)" },
  neutral: { color: "#3b82f6", label: "N", description: "Neutre (bleu)" },
  phase: { color: "#a855f7", label: "L", description: "Phase (violet/marron)" },
  data: { color: "#f97316", label: "D", description: "Data/Signal (orange)" },
};

export interface CableCalculation {
  // Données d'entrée
  power_watts: number;
  voltage: number;
  length_m: number;

  // Résultats calculés
  current_amps: number;
  min_section_mm2: number;
  recommended_section_mm2: number;
  voltage_drop_percent: number;
  voltage_drop_volts: number;

  // Validation
  is_valid: boolean;
  warnings: string[];
  errors: string[];
}

interface UseCableCalculatorOptions {
  defaultVoltage?: number;
  maxVoltageDrop?: number; // en pourcentage (ex: 3 pour 3%)
}

export function useCableCalculator(options: UseCableCalculatorOptions = {}) {
  const { defaultVoltage = 12, maxVoltageDrop = 3 } = options;

  /**
   * Calcule la section minimale théorique
   * Formule: S = (2 × L × I) / (σ × ΔU)
   *
   * Où:
   * - L = longueur aller (m)
   * - I = intensité (A)
   * - σ = conductivité cuivre (56 m/Ω.mm²)
   * - ΔU = chute de tension max (V)
   */
  const calculateMinSection = useCallback(
    (current: number, length: number, voltage: number): number => {
      const maxDrop = (maxVoltageDrop / 100) * voltage; // en Volts
      // × 2 pour aller-retour
      const section = (2 * length * current) / (COPPER_CONDUCTIVITY * maxDrop);
      return section;
    },
    [maxVoltageDrop],
  );

  /**
   * Trouve la section standard supérieure la plus proche
   */
  const findRecommendedSection = useCallback((minSection: number, current: number): number => {
    // Trouver la plus petite section qui satisfait les deux critères:
    // 1. >= section minimale calculée
    // 2. Supporte l'intensité
    for (const section of STANDARD_SECTIONS) {
      const maxCurrent = MAX_CURRENT_BY_SECTION[section] || 0;
      if (section >= minSection && maxCurrent >= current) {
        return section;
      }
    }
    // Si aucune section ne convient, retourner la plus grande
    return STANDARD_SECTIONS[STANDARD_SECTIONS.length - 1];
  }, []);

  /**
   * Calcule la chute de tension réelle avec une section donnée
   * Formule: ΔU = (2 × L × I) / (σ × S)
   */
  const calculateVoltageDrop = useCallback((current: number, length: number, section: number): number => {
    return (2 * length * current) / (COPPER_CONDUCTIVITY * section);
  }, []);

  /**
   * Calcul complet pour un câble
   */
  const calculateCable = useCallback(
    (power_watts: number, length_m: number, voltage: number = defaultVoltage): CableCalculation => {
      const warnings: string[] = [];
      const errors: string[] = [];

      // Calcul de l'intensité
      const current_amps = power_watts / voltage;

      // Calcul section minimale
      const min_section_mm2 = calculateMinSection(current_amps, length_m, voltage);

      // Section recommandée (arrondie au standard supérieur)
      const recommended_section_mm2 = findRecommendedSection(min_section_mm2, current_amps);

      // Chute de tension avec la section recommandée
      const voltage_drop_volts = calculateVoltageDrop(current_amps, length_m, recommended_section_mm2);
      const voltage_drop_percent = (voltage_drop_volts / voltage) * 100;

      // Validations
      let is_valid = true;

      if (current_amps > 160) {
        errors.push(`Intensité trop élevée (${current_amps.toFixed(1)}A > 160A max)`);
        is_valid = false;
      }

      if (voltage_drop_percent > maxVoltageDrop) {
        warnings.push(`Chute de tension élevée (${voltage_drop_percent.toFixed(1)}% > ${maxVoltageDrop}%)`);
      }

      if (length_m > 20 && recommended_section_mm2 < 2.5) {
        warnings.push("Longueur importante, vérifier la section");
      }

      if (min_section_mm2 > STANDARD_SECTIONS[STANDARD_SECTIONS.length - 1]) {
        errors.push("Section nécessaire supérieure aux standards disponibles");
        is_valid = false;
      }

      return {
        power_watts,
        voltage,
        length_m,
        current_amps,
        min_section_mm2,
        recommended_section_mm2,
        voltage_drop_percent,
        voltage_drop_volts,
        is_valid,
        warnings,
        errors,
      };
    },
    [defaultVoltage, maxVoltageDrop, calculateMinSection, findRecommendedSection, calculateVoltageDrop],
  );

  /**
   * Formater l'affichage de la section
   */
  const formatSection = useCallback((section: number): string => {
    return `${section} mm²`;
  }, []);

  /**
   * Formater l'intensité
   */
  const formatCurrent = useCallback((current: number): string => {
    return `${current.toFixed(1)} A`;
  }, []);

  /**
   * Obtenir la couleur d'alerte selon la chute de tension
   */
  const getVoltageDropColor = useCallback(
    (dropPercent: number): string => {
      if (dropPercent <= maxVoltageDrop * 0.5) return "#22c55e"; // Vert
      if (dropPercent <= maxVoltageDrop) return "#f59e0b"; // Orange
      return "#ef4444"; // Rouge
    },
    [maxVoltageDrop],
  );

  /**
   * Calcul rapide de section pour un équipement
   */
  const quickCalculate = useCallback(
    (power_watts: number, length_m: number, voltage?: number): number => {
      const result = calculateCable(power_watts, length_m, voltage ?? defaultVoltage);
      return result.recommended_section_mm2;
    },
    [calculateCable, defaultVoltage],
  );

  return {
    calculateCable,
    calculateMinSection,
    calculateVoltageDrop,
    findRecommendedSection,
    formatSection,
    formatCurrent,
    getVoltageDropColor,
    quickCalculate,
    STANDARD_SECTIONS,
    MAX_CURRENT_BY_SECTION,
    CABLE_COLORS,
  };
}

/**
 * Fonction utilitaire standalone pour calcul rapide
 */
export function quickCableSection(power_watts: number, length_m: number, voltage: number = 12): number {
  const current = power_watts / voltage;
  const maxDrop = 0.03 * voltage; // 3%
  const minSection = (2 * length_m * current) / (COPPER_CONDUCTIVITY * maxDrop);

  for (const section of STANDARD_SECTIONS) {
    const maxCurrent = MAX_CURRENT_BY_SECTION[section] || 0;
    if (section >= minSection && maxCurrent >= current) {
      return section;
    }
  }
  return STANDARD_SECTIONS[STANDARD_SECTIONS.length - 1];
}
