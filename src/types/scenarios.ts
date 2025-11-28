// types/scenarios.ts
// Types pour le système de scénarios

export interface Scenario {
  id: string;
  project_id: string;
  nom: string;
  couleur: string;
  icone: string;
  est_principal: boolean;
  ordre: number;
  created_at: string;
  updated_at: string;
}

export interface DevisSnapshot {
  id: string;
  project_id: string;
  scenario_id: string | null;
  version_numero: number;
  nom_snapshot: string;
  date_snapshot: string;
  contenu_complet: SnapshotContent;
  notes?: string;
  created_at: string;
}

export interface SnapshotContent {
  version: number;
  date: string;
  nom: string;
  projet: {
    nom_proprietaire: string;
    vehicule: string;
    [key: string]: any;
  };
  depenses: ExpenseSnapshot[];
  totaux: {
    total_achat_ht: number;
    total_vente_ttc: number;
    marge_totale: number;
    marge_pourcentage: number;
  };
  bilan_energie?: {
    production_w: number;
    stockage_ah: number;
    stockage_wh: number;
    autonomie_jours: number;
  };
  metadata: {
    nombre_articles: number;
    categories_utilisees: string[];
    date_validation: string;
    montant_acompte?: number;
  };
}

export interface ExpenseSnapshot {
  id: string;
  nom_accessoire: string;
  marque?: string;
  prix: number;
  prix_vente_ttc?: number;
  marge_pourcent?: number;
  quantite: number;
  date_achat?: string;
  categorie: string;
  statut_paiement?: string;
  statut_livraison?: string;
  fournisseur?: string;
  notes?: string;
  [key: string]: any;
}

export interface ExpensesHistory {
  id: string;
  project_id: string;
  scenario_id: string | null;
  expense_id: string | null;
  ancienne_depense_json: any;
  action: 'modification' | 'suppression' | 'remplacement' | 'ajout';
  raison_changement?: string;
  remplace_par_id?: string | null;
  date_modification: string;
  modifie_par_user_id?: string | null;
}

export interface ProjectWithStatus {
  id: string;
  statut_financier: 'brouillon' | 'devis_envoye' | 'devis_accepte' | 'en_cours' | 'termine';
  date_validation_devis?: string | null;
  date_encaissement_acompte?: string | null;
  montant_acompte?: number | null;
  [key: string]: any;
}

export interface ScenarioComparison {
  ajouts: ExpenseSnapshot[];
  suppressions: ExpenseSnapshot[];
  modifications: Array<{
    avant: ExpenseSnapshot;
    apres: ExpenseSnapshot;
  }>;
}

export interface BilanEnergie {
  production_totale_w: number;
  stockage_total_ah: number;
  stockage_total_wh: number;
  consommation_estimee_w?: number;
  autonomie_jours: number;
}

export interface ScenarioTotaux {
  total_achat_ht: number;
  total_vente_ttc: number;
  marge_euros: number;
  marge_pourcent: number;
  nombre_articles: number;
}
