// ============================================
// SERVICE API EVOLIZ
// Utilise l'Edge Function comme proxy pour éviter CORS
// ============================================

import { supabase } from "@/integrations/supabase/client";
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

const DEBUG = true;

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[EVOLIZ]", ...args);
  }
}

interface EvolizAuthConfig {
  companyId: string;
  publicKey: string;
  secretKey: string;
}

class EvolizApiService {
  private config: EvolizAuthConfig | null = null;

  // --- CONFIGURATION ---

  setConfig(config: EvolizAuthConfig) {
    debugLog("Configuration définie:", {
      companyId: config.companyId,
      publicKey: config.publicKey.substring(0, 10) + "...",
    });
    this.config = config;
  }

  clearConfig() {
    debugLog("Configuration effacée");
    this.config = null;
  }

  hasConfig(): boolean {
    return this.config !== null;
  }

  // --- PROXY CALL ---

  private async callProxy<T>(params: { endpoint?: string; method?: string; body?: any; action?: string }): Promise<T> {
    if (!this.config) {
      throw new Error("Evoliz API non configurée");
    }

    debugLog("Appel proxy:", params);

    const { data, error } = await supabase.functions.invoke("evoliz-proxy", {
      body: {
        company_id: this.config.companyId,
        public_key: this.config.publicKey,
        secret_key: this.config.secretKey,
        endpoint: params.endpoint,
        method: params.method || "GET",
        body: params.body,
        action: params.action,
      },
    });

    debugLog("Réponse proxy:", { data, error });

    if (error) {
      throw new EvolizError(error.message || "Erreur proxy", 500, error);
    }

    return data as T;
  }

  // --- TEST CONNECTION ---

  async testConnection(): Promise<{ success: boolean; message: string; details?: string }> {
    debugLog("=== TEST DE CONNEXION ===");

    try {
      const result = await this.callProxy<{ success: boolean; message: string }>({
        action: "test",
      });

      debugLog("Résultat test:", result);
      return result;
    } catch (error) {
      debugLog("Erreur test:", error);

      if (error instanceof EvolizError) {
        return {
          success: false,
          message: error.message,
          details: JSON.stringify(error.data),
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : "Erreur inconnue",
      };
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
    return this.callProxy<EvolizApiResponse<EvolizClient[]>>({
      endpoint: `/clients${query ? `?${query}` : ""}`,
    });
  }

  async getClient(clientId: number): Promise<EvolizClient> {
    return this.callProxy<EvolizClient>({
      endpoint: `/clients/${clientId}`,
    });
  }

  async createClient(data: EvolizClientInput): Promise<EvolizClient> {
    return this.callProxy<EvolizClient>({
      endpoint: "/clients",
      method: "POST",
      body: data,
    });
  }

  async updateClient(clientId: number, data: Partial<EvolizClientInput>): Promise<EvolizClient> {
    return this.callProxy<EvolizClient>({
      endpoint: `/clients/${clientId}`,
      method: "PATCH",
      body: data,
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
    return this.callProxy<EvolizApiResponse<EvolizQuote[]>>({
      endpoint: `/quotes${query ? `?${query}` : ""}`,
    });
  }

  async getQuote(quoteId: number): Promise<EvolizQuote> {
    return this.callProxy<EvolizQuote>({
      endpoint: `/quotes/${quoteId}`,
    });
  }

  async createQuote(data: EvolizQuoteInput): Promise<EvolizQuote> {
    return this.callProxy<EvolizQuote>({
      endpoint: "/quotes",
      method: "POST",
      body: data,
    });
  }

  async sendQuote(quoteId: number, email?: string): Promise<{ success: boolean }> {
    return this.callProxy<{ success: boolean }>({
      endpoint: `/quotes/${quoteId}/send`,
      method: "POST",
      body: email ? { email } : {},
    });
  }

  async acceptQuote(quoteId: number): Promise<EvolizQuote> {
    return this.callProxy<EvolizQuote>({
      endpoint: `/quotes/${quoteId}/accept`,
      method: "POST",
    });
  }

  async refuseQuote(quoteId: number): Promise<EvolizQuote> {
    return this.callProxy<EvolizQuote>({
      endpoint: `/quotes/${quoteId}/refuse`,
      method: "POST",
    });
  }

  async convertQuoteToInvoice(quoteId: number): Promise<{ invoiceid: number }> {
    return this.callProxy<{ invoiceid: number }>({
      endpoint: `/quotes/${quoteId}/invoice`,
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
    return this.callProxy<EvolizApiResponse<EvolizArticle[]>>({
      endpoint: `/articles${query ? `?${query}` : ""}`,
    });
  }

  async getArticle(articleId: number): Promise<EvolizArticle> {
    return this.callProxy<EvolizArticle>({
      endpoint: `/articles/${articleId}`,
    });
  }

  async createArticle(article: {
    reference: string;
    designation: string;
    unit_price_vat_exclude: number;
    vat_rate?: number;
    unit?: string;
    comment?: string | null;
  }): Promise<EvolizArticle> {
    debugLog("Création article Evoliz:", article);
    return this.callProxy<EvolizArticle>({
      endpoint: "/articles",
      method: "POST",
      body: {
        reference: article.reference,
        designation: article.designation,
        unit_price_vat_exclude: article.unit_price_vat_exclude,
        vat_rate: article.vat_rate || 20,
        unit: article.unit || "u",
        comment: article.comment || null,
      },
    });
  }

  async updateArticle(
    articleId: number,
    article: {
      reference?: string;
      designation?: string;
      unit_price_vat_exclude?: number;
      vat_rate?: number;
      unit?: string;
      comment?: string | null;
    },
  ): Promise<EvolizArticle> {
    debugLog("Mise à jour article Evoliz:", articleId, article);
    return this.callProxy<EvolizArticle>({
      endpoint: `/articles/${articleId}`,
      method: "PUT",
      body: article,
    });
  }

  async deleteArticle(articleId: number): Promise<void> {
    debugLog("Suppression article Evoliz:", articleId);
    await this.callProxy<void>({
      endpoint: `/articles/${articleId}`,
      method: "DELETE",
    });
  }

  // --- SUPPLIERS ---

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
    return this.callProxy<EvolizApiResponse<EvolizSupplier[]>>({
      endpoint: `/suppliers${query ? `?${query}` : ""}`,
    });
  }

  // --- BUYS ---

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
    return this.callProxy<EvolizApiResponse<EvolizBuy[]>>({
      endpoint: `/buys${query ? `?${query}` : ""}`,
    });
  }

  async createBuy(data: EvolizBuyInput): Promise<EvolizBuy> {
    return this.callProxy<EvolizBuy>({
      endpoint: "/buys",
      method: "POST",
      body: data,
    });
  }

  // Note: uploadBuyAttachment nécessiterait une gestion spéciale des fichiers
  // Pour l'instant, on ne le supporte pas via le proxy

  // --- CLASSIFICATIONS ---

  async getSaleClassifications(): Promise<EvolizApiResponse<EvolizSaleClassification[]>> {
    return this.callProxy<EvolizApiResponse<EvolizSaleClassification[]>>({
      endpoint: "/sale-classifications",
    });
  }

  async getPurchaseClassifications(): Promise<EvolizApiResponse<EvolizPurchaseClassification[]>> {
    return this.callProxy<EvolizApiResponse<EvolizPurchaseClassification[]>>({
      endpoint: "/purchase-classifications",
    });
  }

  // --- PAYMENT TERMS ---

  async getPaymentTerms(): Promise<EvolizApiResponse<EvolizPaymentTerm[]>> {
    return this.callProxy<EvolizApiResponse<EvolizPaymentTerm[]>>({
      endpoint: "/payterms",
    });
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
