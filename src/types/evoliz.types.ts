// ============================================
// TYPES EVOLIZ API - CORRIGÉS
// Basés sur la vraie structure de l'API Evoliz
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
  code?: string;
  civility: string | null;
  name: string;
  contact?: string | null;
  address?: {
    postcode: string;
    town: string;
    country: string;
    iso2?: string;
    addr: string;
  };
  delivery_address?: any | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  type?: "Professionnel" | "Particulier";
  siret?: string | null;
  business_number?: string | null; // SIRET
  business_identification_number?: string | null; // SIREN
  legalform?: string | null; // Forme juridique (SAS, SARL, etc.)
  activity_number?: string | null; // APE/NAF
  vat_number?: string | null;
  comment?: string | null;
  payment_term?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EvolizClientInput {
  civility?: string;
  name: string;
  type?: "Professionnel" | "Particulier";
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

// --- CURRENCY ---

export interface EvolizCurrency {
  code: string;
  conversion: number;
  symbol: string;
}

// --- TOTAL STRUCTURE (vraie structure Evoliz) ---

export interface EvolizTotal {
  rebate?: {
    amount_vat_exclude: number;
  };
  vat_exclude: number; // Total HT
  vat: number; // Montant TVA
  vat_include: number; // Total TTC
  // Anciens champs pour compatibilité
  totalht?: number;
  totaltax?: number;
  totalttc?: number;
  net_to_pay?: number;
  margin?: {
    purchase_price_vat_exclude?: number;
    percent?: number;
    margin_percent?: number;
    markup_percent?: number;
    amount?: number;
  };
}

// --- QUOTES (DEVIS) - Structure réelle ---

export interface EvolizQuote {
  quoteid: number;
  document_number: string; // Ex: "D-20250000066"
  documentid?: string; // Ancien format pour compatibilité
  userid?: number;
  prospect?: any | null;
  organization?: string;
  clientid?: number;
  client: {
    clientid: number;
    code?: string;
    name: string;
    civility?: string;
    contact?: string | null;
    delivery_address?: any | null;
  };
  default_currency?: EvolizCurrency;
  document_currency?: any | null;
  total: EvolizTotal;
  currency_total?: any | null;
  status_code?: number;
  status: string; // "draft", "sent", "accept", "reject", "invoice", etc.
  status_dates?: {
    create?: string;
    sent?: string;
    accept?: string;
    wait?: string;
    reject?: string;
    order?: string;
    pack?: string;
    invoice?: string;
    close?: string;
  };
  label?: string | null;
  object?: string | null;
  documentdate: string;
  duedate?: string | null;
  execdate?: string | null;
  delivery_date?: string | null;
  validity?: number;
  term?: {
    penalty?: number;
    nopenalty?: boolean;
    recovery_indemnity?: boolean;
    discount_term?: number;
    no_discount_term?: boolean;
    paytype?: {
      paytypeid: number;
      label: string;
    };
    payterm?: {
      paytermid: number;
      label: string;
    };
  };
  comment?: string | null;
  comment_clean?: string | null;
  external_document_number?: string | null;
  enabled?: boolean;
  file?: string;
  links?: string;
  webdoc?: string;
  items: EvolizQuoteItem[];
  prices_include_vat?: boolean;
  template?: {
    templateid: number;
    label: string;
  };
  created_at?: string;
  updated_at?: string;
}

export type EvolizQuoteStatus =
  | "draft" // Brouillon
  | "sent" // Envoyé
  | "wait" // En attente
  | "accept" // Accepté
  | "accepted" // Accepté (alias)
  | "reject" // Refusé
  | "refused" // Refusé (alias)
  | "order" // Commandé
  | "invoice" // Facturé
  | "invoiced" // Facturé (alias)
  | "close"; // Clôturé

export interface EvolizQuoteItem {
  itemid: number;
  articleid?: number | null;
  reference?: string;
  reference_clean?: string;
  designation: string;
  designation_clean?: string;
  quantity: number;
  type?: string;
  unit?: string;
  unit_price_vat_exclude: number;
  unit_price_vat_exclude_currency?: number | null;
  vat?: number;
  total: EvolizTotal;
  currency_total?: any | null;
  sale_classification?: {
    id: number;
    code: string;
    label: string;
  };
  // Anciens champs pour compatibilité
  discount_percent?: number;
  vat_rate?: number;
  total_vat_exclude?: number;
  sort_order?: number;
}

export interface EvolizQuoteInput {
  clientid: number;
  label?: string;
  object?: string;
  documentdate?: string;
  duedate?: string;
  execdate?: string;
  validity?: number;
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
  vat?: number;
  vat_rate?: number;
  saleclassificationid?: number;
}

// --- ARTICLES ---

export interface EvolizArticle {
  articleid: number;
  reference: string;
  designation: string;
  unit_price_vat_exclude: number;
  purchase_unit_price_vat_exclude?: number | null;
  vat_rate?: number;
  vat?: number;
  unit: string | null;
  classification?: {
    saleclassificationid?: number;
    id?: number;
    code: string;
    label: string;
  } | null;
  comment: string | null;
  created_at?: string;
  updated_at?: string;
  // Fournisseur lié (si défini dans Evoliz)
  supplier?: {
    supplierid: number;
    name: string;
  } | null;
  supplier_reference?: string | null;
  weight?: number | null;
  // Marge (contient aussi le prix d'achat)
  margin?: {
    purchase_unit_price_vat_exclude?: number | null;
    margin_percent?: number | null;
    markup_percent?: number | null;
    amount?: number | null;
    coefficient?: number | null;
  } | null;
}

export interface EvolizArticleInput {
  reference: string;
  designation: string;
  unit_price_vat_exclude: number;
  purchase_unit_price_vat_exclude?: number | null;
  vat_rate?: number;
  unit?: string;
  comment?: string | null;
  saleclassificationid?: number;
}

// --- SUPPLIERS (FOURNISSEURS) ---

export interface EvolizSupplier {
  supplierid: number;
  name: string;
  code?: string;
  address?: {
    postcode: string;
    town: string;
    country: string;
    addr: string;
    addr2?: string;
  };
  email?: string | null;
  phone?: string | null;
  business_number?: string | null; // SIRET
  vat_number?: string | null;
  comment?: string | null;
}

export interface EvolizSupplierInput {
  name: string;
  code?: string;
  legalform?: string;
  business_number?: string; // SIRET
  vat_number?: string;
  activity_number?: string;
  address?: {
    addr?: string;
    addr2?: string;
    postcode?: string;
    town?: string;
    iso2?: string; // FR, DE, etc.
  };
  phone?: string;
  mobile?: string;
  website?: string;
  comment?: string;
}

// --- BUYS (ACHATS/DÉPENSES) ---

export interface EvolizBuy {
  buyid: number;
  supplierid: number;
  supplier?: EvolizSupplier;
  external_document_number?: string | null;
  documentdate: string;
  duedate?: string | null;
  label?: string | null;
  total: EvolizTotal;
  currency?: string;
  status?: "draft" | "validated" | "paid";
  items?: EvolizBuyItem[];
  created_at?: string;
  updated_at?: string;
}

export interface EvolizBuyItem {
  designation: string;
  quantity: number;
  unit_price_vat_exclude: number;
  vat_rate?: number;
  vat?: number;
  classification?: {
    purchaseclassificationid?: number;
    id?: number;
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
  vat?: number;
  purchaseclassificationid?: number;
}

// --- CLASSIFICATIONS ---

export interface EvolizSaleClassification {
  saleclassificationid?: number;
  id?: number;
  code: string;
  label: string;
  enabled?: boolean;
}

export interface EvolizPurchaseClassification {
  purchaseclassificationid?: number;
  id?: number;
  code: string;
  label: string;
  enabled?: boolean;
}

// --- PAYMENT TERMS ---

export interface EvolizPaymentTerm {
  paytermid: number;
  code?: string;
  label: string;
  days?: number;
  end_month?: boolean;
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
  sync_direction: "to_evoliz" | "from_evoliz" | "both";
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// --- HELPERS ---

export const EVOLIZ_QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  wait: "En attente",
  accept: "Accepté",
  accepted: "Accepté",
  reject: "Refusé",
  refused: "Refusé",
  order: "Commandé",
  invoice: "Facturé",
  invoiced: "Facturé",
  close: "Clôturé",
};

export const EVOLIZ_QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: "gray",
  sent: "blue",
  wait: "orange",
  accept: "green",
  accepted: "green",
  reject: "red",
  refused: "red",
  order: "purple",
  invoice: "indigo",
  invoiced: "indigo",
  close: "gray",
};

// --- INVOICES (FACTURES) ---

export interface EvolizInvoice {
  invoiceid: number;
  userid?: number;
  external_document_number?: string | null;
  document_number?: string;
  documentdate?: string;
  execalidate?: string | null;
  duedate?: string;
  object?: string | null;
  comment?: string | null;
  currency?: string;
  retention?: any;
  total?: EvolizTotal;
  term?: {
    paytermid: number;
    label: string;
    recovery: boolean;
  };
  status?: {
    label: string;
    sub_status?: string | null;
  };
  enabled?: boolean;
  locked?: boolean;
  client?: {
    clientid: number;
    code?: string;
    name: string;
    civility?: string;
  };
  items?: EvolizInvoiceItem[];
  document_link?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EvolizInvoiceItem {
  itemid?: number;
  type: "article" | "text" | "sub_total";
  articleid?: number;
  reference?: string;
  designation?: string;
  quantity?: number;
  unit?: string;
  unit_price_vat_exclude?: number;
  unit_price_vat_include?: number;
  vat_rate?: number;
  rebate?: string | number;
  total_vat_exclude?: number;
  total_vat_include?: number;
}

export const EVOLIZ_INVOICE_STATUS_LABELS: Record<string, string> = {
  filled: "Brouillon",
  create: "Créée",
  sent: "Envoyée",
  inpayment: "En cours",
  paid: "Payée",
  match: "Lettrée",
  unpaid: "Impayée",
  nopaid: "Non payée",
};

export const EVOLIZ_INVOICE_STATUS_COLORS: Record<string, string> = {
  filled: "gray",
  create: "blue",
  sent: "cyan",
  inpayment: "orange",
  paid: "green",
  match: "green",
  unpaid: "red",
  nopaid: "yellow",
};

// --- CONTACT CLIENT ---

export interface EvolizContactClient {
  contactid: number;
  userid?: number;
  client?: {
    clientid: number;
    code?: string;
    name: string;
  };
  civility?: string;
  lastname?: string;
  firstname?: string;
  email?: string;
  profil?: string;
  label_tel_primary?: string;
  tel_primary?: string;
  label_tel_secondary?: string;
  tel_secondary?: string;
  label_tel_tertiary?: string;
  tel_tertiary?: string;
  enabled?: boolean;
  consent?: "without" | "authorized" | "unauthorized";
  favorite?: boolean;
}
