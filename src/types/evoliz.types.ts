// ============================================
// TYPES EVOLIZ API
// Types pour l'intégration avec l'API Evoliz
// ============================================

// --- CREDENTIALS ---

export interface EvolizCredentials {
  id: string;
  user_id: string;
  company_id: string;
  public_key: string;
  secret_key: string;
  is_active: boolean;
  last_test_at?: string;
  last_test_success?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvolizCredentialsInput {
  company_id: string;
  public_key: string;
  secret_key: string;
}

// --- API RESPONSES ---

export interface EvolizApiResponse<T> {
  data: T;
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface EvolizApiError {
  error: string;
  message: string;
  status_code: number;
}

// --- CLIENTS ---

export interface EvolizClient {
  clientid: number;
  civility: string | null;
  name: string;
  address: {
    postcode: string;
    town: string;
    country: string;
    iso2: string;
    addr: string;
  };
  email: string | null;
  phone: string | null;
  mobile: string | null;
  type: 'Professionnel' | 'Particulier';
  siret: string | null;
  vat_number: string | null;
  comment: string | null;
  payment_term: number;
  created_at: string;
  updated_at: string;
}

export interface EvolizClientInput {
  civility?: string;
  name: string;
  type: 'Professionnel' | 'Particulier';
  addr?: string;
  postcode?: string;
  town?: string;
  country?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  siret?: string;
  vat_number?: string;
  comment?: string;
  payment_term?: number;
}

// --- CONTACTS ---

export interface EvolizContact {
  contactclientid: number;
  clientid: number;
  civility: string | null;
  lastname: string;
  firstname: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  function: string | null;
  comment: string | null;
}

// --- QUOTES (DEVIS) ---

export interface EvolizQuote {
  quoteid: number;
  documentid: string; // Ex: "DE-2024-0001"
  clientid: number;
  client: EvolizClient;
  label: string | null;
  object: string | null;
  status: EvolizQuoteStatus;
  execdate: string | null; // Date d'exécution prévue
  duedate: string | null; // Date de validité
  documentdate: string; // Date du devis
  currency: string;
  total: {
    totalht: number;
    totaltax: number;
    totalttc: number;
  };
  items: EvolizQuoteItem[];
  comment: string | null;
  comment_internal: string | null;
  term: {
    paytermid: number;
    label: string;
    days: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export type EvolizQuoteStatus = 
  | 'draft'      // Brouillon
  | 'sent'       // Envoyé
  | 'accepted'   // Accepté
  | 'refused'    // Refusé
  | 'invoiced';  // Facturé

export interface EvolizQuoteItem {
  itemid: number;
  quoteid: number;
  articleid: number | null;
  designation: string;
  quantity: number;
  unit: string | null;
  unit_price_vat_exclude: number;
  discount_percent: number;
  vat_rate: number;
  total_vat_exclude: number;
  classification: {
    saleclassificationid: number;
    code: string;
    label: string;
  } | null;
  sort_order: number;
}

export interface EvolizQuoteInput {
  clientid: number;
  label?: string;
  object?: string;
  documentdate?: string; // Format YYYY-MM-DD
  duedate?: string;
  execdate?: string;
  currency?: string;
  comment?: string;
  comment_internal?: string;
  paytermid?: number;
  items: EvolizQuoteItemInput[];
}

export interface EvolizQuoteItemInput {
  articleid?: number;
  designation: string;
  quantity: number;
  unit?: string;
  unit_price_vat_exclude: number;
  discount_percent?: number;
  vat_rate?: number;
  saleclassificationid?: number;
}

// --- ARTICLES ---

export interface EvolizArticle {
  articleid: number;
  reference: string;
  designation: string;
  unit_price_vat_exclude: number;
  vat_rate: number;
  unit: string | null;
  classification: {
    saleclassificationid: number;
    code: string;
    label: string;
  } | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

// --- SUPPLIERS (FOURNISSEURS) ---

export interface EvolizSupplier {
  supplierid: number;
  name: string;
  address: {
    postcode: string;
    town: string;
    country: string;
    addr: string;
  };
  email: string | null;
  phone: string | null;
  siret: string | null;
  vat_number: string | null;
  comment: string | null;
}

// --- BUYS (ACHATS/DÉPENSES) ---

export interface EvolizBuy {
  buyid: number;
  supplierid: number;
  supplier: EvolizSupplier;
  external_document_number: string | null;
  documentdate: string;
  duedate: string | null;
  label: string | null;
  total: {
    totalht: number;
    totaltax: number;
    totalttc: number;
  };
  currency: string;
  status: 'draft' | 'validated' | 'paid';
  items: EvolizBuyItem[];
  created_at: string;
  updated_at: string;
}

export interface EvolizBuyItem {
  designation: string;
  quantity: number;
  unit_price_vat_exclude: number;
  vat_rate: number;
  classification: {
    purchaseclassificationid: number;
    code: string;
    label: string;
  } | null;
}

export interface EvolizBuyInput {
  supplierid: number;
  external_document_number?: string;
  documentdate: string;
  duedate?: string;
  label?: string;
  currency?: string;
  items: EvolizBuyItemInput[];
}

export interface EvolizBuyItemInput {
  designation: string;
  quantity: number;
  unit_price_vat_exclude: number;
  vat_rate?: number;
  purchaseclassificationid?: number;
}

// --- CLASSIFICATIONS ---

export interface EvolizSaleClassification {
  saleclassificationid: number;
  code: string;
  label: string;
  enabled: boolean;
}

export interface EvolizPurchaseClassification {
  purchaseclassificationid: number;
  code: string;
  label: string;
  enabled: boolean;
}

// --- PAYMENT TERMS ---

export interface EvolizPaymentTerm {
  paytermid: number;
  code: string;
  label: string;
  days: number;
  end_month: boolean;
}

// --- CACHE TYPES (pour Supabase) ---

export interface EvolizQuoteCache {
  id: string;
  user_id: string;
  evoliz_quote_id: number;
  project_id?: string;
  client_id?: string;
  evoliz_client_id?: number;
  quote_number?: string;
  title?: string;
  status?: string;
  total_ht?: number;
  total_ttc?: number;
  currency?: string;
  issue_date?: string;
  validity_date?: string;
  raw_data?: EvolizQuote;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface EvolizClientMapping {
  id: string;
  user_id: string;
  vpb_client_id?: string;
  evoliz_client_id: number;
  evoliz_client_name?: string;
  evoliz_client_email?: string;
  sync_direction: 'to_evoliz' | 'from_evoliz' | 'both';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// --- HELPERS ---

export const EVOLIZ_QUOTE_STATUS_LABELS: Record<EvolizQuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  invoiced: 'Facturé',
};

export const EVOLIZ_QUOTE_STATUS_COLORS: Record<EvolizQuoteStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'green',
  refused: 'red',
  invoiced: 'purple',
};
