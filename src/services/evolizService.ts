// ============================================
// SERVICE API EVOLIZ
// Gestion des appels à l'API Evoliz
// ============================================

import type {
  EvolizCredentials,
  EvolizClient,
  EvolizClientInput,
  EvolizQuote,
  EvolizQuoteInput,
  EvolizArticle,
  EvolizSupplier,
  EvolizBuy,
  EvolizBuyInput,
  EvolizSaleClassification,
  EvolizPurchaseClassification,
  EvolizPaymentTerm,
  EvolizApiResponse,
} from "@/types/evoliz.types";

const EVOLIZ_API_BASE = "https://www.evoliz.io/api/v1";

interface EvolizAuthConfig {
  companyId: string;
  publicKey: string;
  secretKey: string;
}

class EvolizApiService {
  private config: EvolizAuthConfig | null = null;

  // --- CONFIGURATION ---

  setConfig(config: EvolizAuthConfig) {
    this.config = config;
  }

  clearConfig() {
    this.config = null;
  }

  hasConfig(): boolean {
    return this.config !== null;
  }

  // --- PRIVATE METHODS ---

  private getAuthHeader(): string {
    if (!this.config) {
      throw new Error("Evoliz API non configurée. Veuillez saisir vos clés API.");
    }
    const credentials = btoa(`${this.config.publicKey}:${this.config.secretKey}`);
    return `Basic ${credentials}`;
  }

  private getBaseUrl(): string {
    if (!this.config) {
      throw new Error("Evoliz API non configurée.");
    }
    return `${EVOLIZ_API_BASE}/companies/${this.config.companyId}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new EvolizError(errorData.message || `Erreur API Evoliz: ${response.status}`, response.status, errorData);
    }

    return response.json();
  }

  // --- TEST CONNECTION ---

  async testConnection(): Promise<{ success: boolean; message: string; companyName?: string }> {
    try {
      // On utilise l'endpoint /clients avec limit=1 pour tester
      const response = await this.request<EvolizApiResponse<EvolizClient[]>>("/clients?per_page=1");
      return {
        success: true,
        message: "Connexion réussie à Evoliz",
      };
    } catch (error) {
      if (error instanceof EvolizError) {
        if (error.status === 401) {
          return { success: false, message: "Clés API invalides" };
        }
        if (error.status === 404) {
          return { success: false, message: "Company ID invalide" };
        }
        return { success: false, message: error.message };
      }
      return { success: false, message: "Erreur de connexion" };
    }
  }

  // --- CLIENTS ---

  async getClients(params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<EvolizApiResponse<EvolizClient[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
    if (params?.search) searchParams.set("search", params.search);

    const query = searchParams.toString();
    return this.request<EvolizApiResponse<EvolizClient[]>>(`/clients${query ? `?${query}` : ""}`);
  }

  async getClient(clientId: number): Promise<EvolizClient> {
    return this.request<EvolizClient>(`/clients/${clientId}`);
  }

  async createClient(data: EvolizClientInput): Promise<EvolizClient> {
    return this.request<EvolizClient>("/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateClient(clientId: number, data: Partial<EvolizClientInput>): Promise<EvolizClient> {
    return this.request<EvolizClient>(`/clients/${clientId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // --- QUOTES (DEVIS) ---

  async getQuotes(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    clientid?: number;
  }): Promise<EvolizApiResponse<EvolizQuote[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.clientid) searchParams.set("clientid", params.clientid.toString());

    const query = searchParams.toString();
    return this.request<EvolizApiResponse<EvolizQuote[]>>(`/quotes${query ? `?${query}` : ""}`);
  }

  async getQuote(quoteId: number): Promise<EvolizQuote> {
    return this.request<EvolizQuote>(`/quotes/${quoteId}`);
  }

  async createQuote(data: EvolizQuoteInput): Promise<EvolizQuote> {
    return this.request<EvolizQuote>("/quotes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async sendQuote(quoteId: number, email?: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/quotes/${quoteId}/send`, {
      method: "POST",
      body: JSON.stringify(email ? { email } : {}),
    });
  }

  async acceptQuote(quoteId: number): Promise<EvolizQuote> {
    return this.request<EvolizQuote>(`/quotes/${quoteId}/accept`, {
      method: "POST",
    });
  }

  async refuseQuote(quoteId: number): Promise<EvolizQuote> {
    return this.request<EvolizQuote>(`/quotes/${quoteId}/refuse`, {
      method: "POST",
    });
  }

  async convertQuoteToInvoice(quoteId: number): Promise<{ invoiceid: number }> {
    return this.request<{ invoiceid: number }>(`/quotes/${quoteId}/invoice`, {
      method: "POST",
    });
  }

  // --- ARTICLES ---

  async getArticles(params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<EvolizApiResponse<EvolizArticle[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
    if (params?.search) searchParams.set("search", params.search);

    const query = searchParams.toString();
    return this.request<EvolizApiResponse<EvolizArticle[]>>(`/articles${query ? `?${query}` : ""}`);
  }

  async getArticle(articleId: number): Promise<EvolizArticle> {
    return this.request<EvolizArticle>(`/articles/${articleId}`);
  }

  // --- SUPPLIERS (FOURNISSEURS) ---

  async getSuppliers(params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<EvolizApiResponse<EvolizSupplier[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
    if (params?.search) searchParams.set("search", params.search);

    const query = searchParams.toString();
    return this.request<EvolizApiResponse<EvolizSupplier[]>>(`/suppliers${query ? `?${query}` : ""}`);
  }

  // --- BUYS (ACHATS/DÉPENSES) ---

  async getBuys(params?: {
    page?: number;
    per_page?: number;
    supplierid?: number;
  }): Promise<EvolizApiResponse<EvolizBuy[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
    if (params?.supplierid) searchParams.set("supplierid", params.supplierid.toString());

    const query = searchParams.toString();
    return this.request<EvolizApiResponse<EvolizBuy[]>>(`/buys${query ? `?${query}` : ""}`);
  }

  async createBuy(data: EvolizBuyInput): Promise<EvolizBuy> {
    return this.request<EvolizBuy>("/buys", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async uploadBuyAttachment(buyId: number, file: File): Promise<{ success: boolean }> {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${this.getBaseUrl()}/buys/${buyId}/attachments`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new EvolizError("Erreur upload fichier", response.status);
    }

    return { success: true };
  }

  // --- CLASSIFICATIONS ---

  async getSaleClassifications(): Promise<EvolizApiResponse<EvolizSaleClassification[]>> {
    return this.request<EvolizApiResponse<EvolizSaleClassification[]>>("/sale-classifications");
  }

  async getPurchaseClassifications(): Promise<EvolizApiResponse<EvolizPurchaseClassification[]>> {
    return this.request<EvolizApiResponse<EvolizPurchaseClassification[]>>("/purchase-classifications");
  }

  // --- PAYMENT TERMS ---

  async getPaymentTerms(): Promise<EvolizApiResponse<EvolizPaymentTerm[]>> {
    return this.request<EvolizApiResponse<EvolizPaymentTerm[]>>("/payterms");
  }
}

// --- CUSTOM ERROR ---

export class EvolizError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "EvolizError";
    this.status = status;
    this.data = data;
  }
}

// --- SINGLETON INSTANCE ---

export const evolizApi = new EvolizApiService();

// --- HELPER FUNCTIONS ---

export function initializeEvolizApi(credentials: EvolizCredentials) {
  evolizApi.setConfig({
    companyId: credentials.company_id,
    publicKey: credentials.public_key,
    secretKey: credentials.secret_key,
  });
}

export function formatEvolizAmount(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatEvolizDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
