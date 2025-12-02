// Service de recherche IA
// Recherche hybride : embeddings (documents) + SQL (données structurées)

import { supabase } from "@/integrations/supabase/client";
import { generateEmbedding } from "./documentIndexingService";
import { callAI, AIProvider } from "./aiService";

// ============================================
// TYPES
// ============================================

export interface SearchResult {
  type: "document" | "accessory" | "project" | "scenario" | "expense";
  id: string;
  title: string;
  content: string;
  source?: string;
  pageNumber?: number;
  similarity?: number;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SearchResult[];
  actions?: ChatAction[];
  timestamp: Date;
}

export interface ChatAction {
  type: "generate_rti" | "change_supplier" | "view_document" | "view_accessory";
  label: string;
  data: Record<string, any>;
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

// ============================================
// RECHERCHE VECTORIELLE (Documents)
// ============================================

export async function searchDocuments(
  query: string,
  userId: string,
  options: {
    sourceType?: "notice" | "official_document";
    limit?: number;
  } = {},
): Promise<SearchResult[]> {
  try {
    const { sourceType, limit = 5 } = options;

    // Générer l'embedding de la question
    const queryEmbedding = await generateEmbedding(query);

    // Recherche par similarité via la fonction SQL
    const { data, error } = await (supabase as any).rpc("search_documents", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: limit,
      filter_source_type: sourceType || null,
      filter_user_id: userId,
    });

    if (error) {
      console.error("Erreur recherche vectorielle:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      type: "document" as const,
      id: row.source_id,
      title: row.source_name,
      content: row.content,
      source: row.source_type === "notice" ? "Notice" : "Document officiel",
      pageNumber: row.page_number,
      similarity: row.similarity,
    }));
  } catch (error) {
    console.error("Erreur searchDocuments:", error);
    return [];
  }
}

// ============================================
// RECHERCHE SQL (Données structurées)
// ============================================

export async function searchAccessories(
  query: string,
  userId: string,
  options: {
    category?: string;
    supplier?: string;
    limit?: number;
  } = {},
): Promise<SearchResult[]> {
  try {
    const { category, supplier, limit = 10 } = options;

    let queryBuilder = (supabase as any)
      .from("accessories_catalog")
      .select(
        `
        id, nom, marque, fournisseur, prix_reference, prix_vente_ttc,
        description, reference_fabricant, reference_interne, stock_status,
        product_group_id
      `,
      )
      .eq("user_id", userId)
      .or(
        `nom.ilike.%${query}%,marque.ilike.%${query}%,description.ilike.%${query}%,reference_fabricant.ilike.%${query}%`,
      )
      .limit(limit);

    if (category) {
      queryBuilder = queryBuilder.eq("category_id", category);
    }
    if (supplier) {
      queryBuilder = queryBuilder.eq("fournisseur", supplier);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error("Erreur recherche accessoires:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      type: "accessory" as const,
      id: row.id,
      title: row.nom,
      content: `${row.marque || ""} - ${row.fournisseur || ""} - ${row.prix_reference || 0}€`,
      metadata: {
        marque: row.marque,
        fournisseur: row.fournisseur,
        prix_reference: row.prix_reference,
        prix_vente_ttc: row.prix_vente_ttc,
        stock_status: row.stock_status,
        reference_fabricant: row.reference_fabricant,
        product_group_id: row.product_group_id,
      },
    }));
  } catch (error) {
    console.error("Erreur searchAccessories:", error);
    return [];
  }
}

export async function searchProjects(query: string, userId: string, limit: number = 5): Promise<SearchResult[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("projects")
      .select("id, name, vehicle_brand, vehicle_model, client_name, status")
      .eq("user_id", userId)
      .or(`name.ilike.%${query}%,vehicle_brand.ilike.%${query}%,client_name.ilike.%${query}%`)
      .limit(limit);

    if (error) return [];

    return (data || []).map((row: any) => ({
      type: "project" as const,
      id: row.id,
      title: row.name,
      content: `${row.vehicle_brand || ""} ${row.vehicle_model || ""} - ${row.client_name || ""}`,
      metadata: row,
    }));
  } catch (error) {
    return [];
  }
}

export async function getSupplierComparison(productGroupId: string, userId: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("accessories_catalog")
      .select("id, nom, fournisseur, prix_reference, stock_status, url_produit")
      .eq("product_group_id", productGroupId)
      .eq("user_id", userId)
      .order("prix_reference", { ascending: true });

    if (error) return [];

    return (data || []).map((row: any) => ({
      type: "accessory" as const,
      id: row.id,
      title: row.nom,
      content: `${row.fournisseur}: ${row.prix_reference}€`,
      metadata: row,
    }));
  } catch (error) {
    return [];
  }
}

// ============================================
// ANALYSE D'INTENTION
// ============================================

type IntentType =
  | "search_document"
  | "search_accessory"
  | "compare_prices"
  | "compare_suppliers"
  | "generate_rti"
  | "generate_document"
  | "project_info"
  | "scenario_info"
  | "general_question";

interface AnalyzedIntent {
  type: IntentType;
  entities: {
    productName?: string;
    supplierName?: string;
    projectName?: string;
    documentType?: string;
    category?: string;
  };
  originalQuery: string;
}

export async function analyzeIntent(query: string, aiConfig: AIConfig): Promise<AnalyzedIntent> {
  const prompt = `Analyse cette question et identifie l'intention de l'utilisateur.

Question: "${query}"

Réponds UNIQUEMENT en JSON avec ce format:
{
  "type": "search_document" | "search_accessory" | "compare_prices" | "compare_suppliers" | "generate_rti" | "generate_document" | "project_info" | "scenario_info" | "general_question",
  "entities": {
    "productName": "nom du produit si mentionné",
    "supplierName": "nom du fournisseur si mentionné",
    "projectName": "nom du projet si mentionné",
    "documentType": "type de document si demandé (RTI, homologation, etc.)",
    "category": "catégorie de produit si mentionnée"
  }
}

Règles:
- "search_document" = question sur contenu de notices/documents
- "search_accessory" = recherche de produits dans le catalogue
- "compare_prices" = comparaison de prix
- "compare_suppliers" = comparaison entre fournisseurs
- "generate_rti" = demande de génération de RTI
- "generate_document" = demande de génération d'autre document DREAL
- "project_info" = question sur un projet spécifique
- "scenario_info" = question sur des scénarios
- "general_question" = autre question`;

  try {
    const response = await callAI({
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey,
      prompt,
      maxTokens: 500,
    });

    if (response.success && response.text) {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || "general_question",
          entities: parsed.entities || {},
          originalQuery: query,
        };
      }
    }
  } catch (error) {
    console.error("Erreur analyse intention:", error);
  }

  return {
    type: "general_question",
    entities: {},
    originalQuery: query,
  };
}

// ============================================
// RECHERCHE HYBRIDE
// ============================================

export async function hybridSearch(query: string, userId: string, intent: AnalyzedIntent): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  switch (intent.type) {
    case "search_document":
      const docResults = await searchDocuments(query, userId, { limit: 5 });
      results.push(...docResults);
      break;

    case "search_accessory":
    case "compare_prices":
      const accessoryResults = await searchAccessories(intent.entities.productName || query, userId, {
        supplier: intent.entities.supplierName,
      });
      results.push(...accessoryResults);
      break;

    case "compare_suppliers":
      // D'abord trouver le produit
      const products = await searchAccessories(intent.entities.productName || query, userId, { limit: 1 });
      if (products[0]?.metadata?.product_group_id) {
        const supplierResults = await getSupplierComparison(products[0].metadata.product_group_id, userId);
        results.push(...supplierResults);
      } else {
        results.push(...products);
      }
      break;

    case "project_info":
    case "generate_rti":
    case "generate_document":
      const projectResults = await searchProjects(intent.entities.projectName || query, userId);
      results.push(...projectResults);
      break;

    case "scenario_info":
      const scenarioProjects = await searchProjects(intent.entities.projectName || query, userId);
      results.push(...scenarioProjects);
      break;

    default:
      // Recherche large
      const [docs, accessories, projects] = await Promise.all([
        searchDocuments(query, userId, { limit: 3 }),
        searchAccessories(query, userId, { limit: 3 }),
        searchProjects(query, userId, 2),
      ]);
      results.push(...docs, ...accessories, ...projects);
  }

  return results;
}

// ============================================
// RÉCUPÉRATION DU CONTEXTE PROJET
// ============================================

async function getProjectContext(projectId: string): Promise<string | null> {
  try {
    // Récupérer le projet avec toutes ses données
    const { data: project, error } = await (supabase as any).from("projects").select("*").eq("id", projectId).single();

    if (error || !project) return null;

    // Récupérer les données client si client_id existe
    let client = null;
    if (project.client_id) {
      const { data: clientData } = await (supabase as any)
        .from("clients")
        .select("*")
        .eq("id", project.client_id)
        .single();
      client = clientData;
    }

    // Récupérer les données de carte grise depuis vehicle_registration
    const { data: vehicleReg } = await (supabase as any)
      .from("vehicle_registration")
      .select("*")
      .eq("project_id", projectId)
      .single();

    // Récupérer les accessoires du projet avec leur poids
    const { data: accessories } = await (supabase as any)
      .from("project_accessories")
      .select(
        `
        quantity,
        accessory:accessories_catalog(nom, marque, prix_reference, fournisseur, poids_kg)
      `,
      )
      .eq("project_id", projectId);

    // Récupérer les tâches
    const { data: tasks } = await (supabase as any)
      .from("work_tasks")
      .select("name, description, status, category")
      .eq("project_id", projectId);

    // Construire le contexte textuel
    let context = `=== DONNÉES DU PROJET ACTUEL ===\n`;
    context += `Nom du projet: ${project.name || "Non défini"}\n`;

    context += `\n--- CLIENT ---\n`;
    if (client) {
      context += `Nom: ${client.first_name || ""} ${client.last_name || ""}\n`;
      context += `Adresse: ${client.address || "Non renseignée"}\n`;
      context += `Code postal: ${client.postal_code || ""} ${client.city || ""}\n`;
      context += `Pays: ${client.country || "France"}\n`;
      context += `Téléphone: ${client.phone || "Non renseigné"}\n`;
      context += `Email: ${client.email || "Non renseigné"}\n`;
    } else {
      context += `Nom: ${project.client_name || "Non renseigné"}\n`;
      context += `Aucune fiche client détaillée associée.\n`;
    }

    context += `\n--- VÉHICULE (depuis carte grise scannée) ---\n`;
    if (vehicleReg) {
      context += `Marque: ${vehicleReg.marque || "Non renseigné"}\n`;
      context += `Modèle: ${vehicleReg.modele || "Non renseigné"}\n`;
      context += `Immatriculation: ${vehicleReg.immatriculation || "Non renseignée"}\n`;
      context += `VIN (N° série): ${vehicleReg.vin || "Non renseigné"}\n`;
      context += `Date 1ère immat: ${vehicleReg.date_premiere_immatriculation || "Non renseignée"}\n`;
      context += `PTAC: ${vehicleReg.ptac ? vehicleReg.ptac + " kg" : "Non renseigné"}\n`;
      context += `Poids à vide: ${vehicleReg.poids_vide ? vehicleReg.poids_vide + " kg" : "Non renseigné"}\n`;
      context += `Genre: ${vehicleReg.genre || "Non renseigné"}\n`;
      context += `Carrosserie: ${vehicleReg.carrosserie || "Non renseignée"}\n`;
      context += `Type: ${vehicleReg.type || "Non renseigné"}\n`;
      context += `Puissance fiscale: ${vehicleReg.puissance_fiscale || "Non renseignée"} CV\n`;
      context += `Énergie: ${vehicleReg.energie || "Non renseignée"}\n`;
      context += `Places assises: ${vehicleReg.places_assises || "Non renseigné"}\n`;
      context += `Cylindrée: ${vehicleReg.cylindree || "Non renseignée"} cm³\n`;
      context += `CO2: ${vehicleReg.co2 || "Non renseigné"} g/km\n`;
    } else {
      context += `Aucune carte grise scannée pour ce projet.\n`;
    }

    let totalPoidsAccessoires = 0;
    if (accessories && accessories.length > 0) {
      context += `\n--- ÉQUIPEMENTS PRÉVUS (${accessories.length}) ---\n`;
      accessories.forEach((acc: any) => {
        if (acc.accessory) {
          const poidsUnitaire = acc.accessory.poids_kg || 0;
          const poidsTotal = poidsUnitaire * (acc.quantity || 1);
          totalPoidsAccessoires += poidsTotal;
          context += `- ${acc.accessory.nom} (${acc.accessory.marque || "N/A"}) x${acc.quantity}`;
          if (poidsUnitaire) context += ` - ${poidsUnitaire} kg/u (total: ${poidsTotal} kg)`;
          context += ` - ${acc.accessory.prix_reference || 0}€ (${acc.accessory.fournisseur || "N/A"})\n`;
        }
      });
      context += `Poids total équipements: ${totalPoidsAccessoires} kg\n`;
    }

    if (tasks && tasks.length > 0) {
      context += `\n--- TRAVAUX PRÉVUS (${tasks.length}) ---\n`;
      tasks.forEach((task: any) => {
        context += `- [${task.status || "à faire"}] ${task.name}: ${task.description || ""}\n`;
      });
    }

    // Données de poids et charge
    context += `\n--- JAUGE DE POIDS / CHARGE ---\n`;
    const poidsVide = project.poids_vide_kg || vehicleReg?.poids_vide || project.masse_vide || 0;
    const ptac = project.ptac_kg || vehicleReg?.ptac || 0;
    const chargeUtile = project.charge_utile_kg || (ptac && poidsVide ? ptac - poidsVide : 0);
    const masseOrdreMarche = project.masse_ordre_marche_kg || 0;

    context += `Poids à vide (véhicule): ${poidsVide ? poidsVide + " kg" : "Non renseigné"}\n`;
    context += `PTAC: ${ptac ? ptac + " kg" : "Non renseigné"}\n`;
    context += `Charge utile disponible: ${chargeUtile ? chargeUtile + " kg" : "Non calculable"}\n`;
    context += `Masse en ordre de marche: ${masseOrdreMarche ? masseOrdreMarche + " kg" : "Non renseignée"}\n`;

    // Plan d'aménagement et meubles (furniture_data)
    if (project.furniture_data) {
      context += `\n--- PLAN D'AMÉNAGEMENT / MEUBLES ---\n`;
      try {
        const furnitureData =
          typeof project.furniture_data === "string" ? JSON.parse(project.furniture_data) : project.furniture_data;

        if (Array.isArray(furnitureData) && furnitureData.length > 0) {
          let totalPoidsMeubles = 0;
          context += `Nombre d'éléments: ${furnitureData.length}\n`;
          context += `\nDétail des éléments:\n`;

          furnitureData.forEach((item: any, index: number) => {
            const poids = item.poids_kg || item.weight || item.poids || 0;
            totalPoidsMeubles += poids;
            context += `${index + 1}. ${item.name || item.nom || "Élément sans nom"}`;
            if (poids) context += ` - ${poids} kg`;
            if (item.position_x !== undefined && item.position_y !== undefined) {
              context += ` (Position: X=${Math.round(item.position_x)}, Y=${Math.round(item.position_y)})`;
            }
            if (item.dimensions || item.width || item.length) {
              const w = item.width || item.dimensions?.width || 0;
              const l = item.length || item.dimensions?.length || 0;
              const h = item.height || item.dimensions?.height || 0;
              if (w || l || h) context += ` [${w}x${l}x${h} mm]`;
            }
            context += `\n`;
          });

          context += `\nPoids total des aménagements: ${totalPoidsMeubles} kg\n`;

          // Calcul charge restante (meubles + accessoires)
          const poidsTotal = totalPoidsMeubles + totalPoidsAccessoires;
          context += `Poids total (aménagements + équipements): ${poidsTotal} kg\n`;

          if (chargeUtile) {
            const chargeRestante = chargeUtile - poidsTotal;
            context += `Charge restante disponible: ${chargeRestante} kg`;
            if (chargeRestante < 0) {
              context += ` ⚠️ DÉPASSEMENT DE CHARGE DE ${Math.abs(chargeRestante)} kg !`;
            } else if (chargeRestante < 100) {
              context += ` ⚠️ Marge faible`;
            }
            context += `\n`;

            // Pourcentage d'utilisation
            const pourcentageUtilise = Math.round((poidsTotal / chargeUtile) * 100);
            context += `Utilisation de la charge utile: ${pourcentageUtilise}%\n`;
          }
        } else {
          context += `Aucun meuble/élément défini dans le plan.\n`;
        }
      } catch (e) {
        context += `Données d'aménagement présentes mais format non lisible.\n`;
      }
    } else {
      context += `\n--- PLAN D'AMÉNAGEMENT ---\n`;
      context += `Aucun plan d'aménagement défini.\n`;

      // Même sans meubles, afficher le résumé si on a des accessoires
      if (totalPoidsAccessoires > 0 && chargeUtile) {
        context += `\nPoids total équipements: ${totalPoidsAccessoires} kg\n`;
        const chargeRestante = chargeUtile - totalPoidsAccessoires;
        context += `Charge restante disponible: ${chargeRestante} kg\n`;
        const pourcentageUtilise = Math.round((totalPoidsAccessoires / chargeUtile) * 100);
        context += `Utilisation de la charge utile: ${pourcentageUtilise}%\n`;
      }
    }

    context += `\n=== FIN DONNÉES PROJET ===\n`;

    return context;
  } catch (error) {
    console.error("Erreur récupération contexte projet:", error);
    return null;
  }
}

// ============================================
// GÉNÉRATION DE RÉPONSE
// ============================================

export async function generateResponse(
  query: string,
  context: SearchResult[],
  intent: AnalyzedIntent,
  aiConfig: AIConfig,
  conversationHistory: ChatMessage[] = [],
  projectContext: string = "",
  projectId?: string,
): Promise<{ text: string; actions: ChatAction[] }> {
  // Construire le contexte
  let contextText = "";

  // Ajouter le contexte projet s'il existe
  if (projectContext) {
    contextText += projectContext + "\n\n";
  }

  if (context.length > 0) {
    contextText += "Informations trouvées dans la recherche:\n\n";
    context.forEach((result, i) => {
      if (result.type === "document") {
        contextText += `[Document ${i + 1}: ${result.title}${result.pageNumber ? ` - Page ${result.pageNumber}` : ""}]\n${result.content}\n\n`;
      } else if (result.type === "accessory") {
        const meta = result.metadata || {};
        contextText += `[Accessoire ${i + 1}: ${result.title}]\nMarque: ${meta.marque || "N/A"}, Fournisseur: ${meta.fournisseur || "N/A"}, Prix: ${meta.prix_reference || 0}€, Stock: ${meta.stock_status || "N/A"}\n\n`;
      } else if (result.type === "project") {
        contextText += `[Projet: ${result.title}]\n${result.content}\n\n`;
      }
    });
  }

  // Historique de conversation (limité aux 5 derniers messages)
  const recentHistory = conversationHistory.slice(-5);
  let historyText = "";
  if (recentHistory.length > 0) {
    historyText = "Historique récent:\n";
    recentHistory.forEach((msg) => {
      historyText += `${msg.role === "user" ? "Utilisateur" : "Assistant"}: ${msg.content.substring(0, 200)}...\n`;
    });
    historyText += "\n";
  }

  // Prompt selon l'intention
  let systemPrompt = `Tu es un assistant pour une application de gestion d'aménagement de fourgons.
Tu aides à:
- Rechercher des informations dans les notices techniques et documents DREAL
- Comparer les prix et fournisseurs du catalogue
- Préparer les documents d'homologation (RTI, etc.)

Réponds de manière concise et utile en français.
Si tu cites une source, mentionne-la.
Si tu proposes une action (générer un document, changer de fournisseur), indique-le clairement.`;

  if (intent.type === "generate_rti" || intent.type === "generate_document") {
    systemPrompt += `\n\nL'utilisateur veut générer un document officiel. Liste les informations nécessaires et celles qui manquent.`;
  }

  if (intent.type === "compare_prices" || intent.type === "compare_suppliers") {
    systemPrompt += `\n\nL'utilisateur veut comparer des prix/fournisseurs. Présente les résultats sous forme de tableau si possible et indique le moins cher.`;
  }

  const prompt = `${systemPrompt}

${historyText}${contextText}
Question de l'utilisateur: ${query}

Réponds de manière concise et utile:`;

  const response = await callAI({
    provider: aiConfig.provider,
    apiKey: aiConfig.apiKey,
    prompt,
    maxTokens: 1500,
  });

  // Déterminer les actions possibles
  const actions: ChatAction[] = [];

  // Action RTI si projectId fourni ou projet trouvé dans la recherche
  if (intent.type === "generate_rti" || intent.type === "generate_document") {
    if (projectId) {
      // On a directement le projectId depuis le contexte
      actions.push({
        type: "generate_rti",
        label: "Générer le RTI",
        data: { projectId: projectId },
      });
    } else if (context.some((c) => c.type === "project")) {
      const project = context.find((c) => c.type === "project");
      if (project) {
        actions.push({
          type: "generate_rti",
          label: "Générer le RTI",
          data: { projectId: project.id, projectName: project.title },
        });
      }
    }
  }

  if (intent.type === "compare_suppliers" && context.length > 1) {
    const cheapest = context
      .filter((c) => c.type === "accessory" && c.metadata?.prix_reference)
      .sort((a, b) => (a.metadata?.prix_reference || 0) - (b.metadata?.prix_reference || 0))[0];

    if (cheapest) {
      actions.push({
        type: "change_supplier",
        label: `Utiliser ${cheapest.metadata?.fournisseur} (${cheapest.metadata?.prix_reference}€)`,
        data: { accessoryId: cheapest.id },
      });
    }
  }

  return {
    text: response.text || "Désolé, je n'ai pas pu générer de réponse.",
    actions,
  };
}

// ============================================
// FONCTION PRINCIPALE DU CHAT
// ============================================

export async function processUserMessage(
  message: string,
  userId: string,
  aiConfig: AIConfig,
  conversationHistory: ChatMessage[] = [],
  projectId?: string, // Ajout du projectId optionnel
): Promise<ChatMessage> {
  try {
    // 1. Analyser l'intention
    const intent = await analyzeIntent(message, aiConfig);

    // 2. Si on a un projectId et que l'intention concerne le projet, récupérer les données
    let projectContext = "";
    if (projectId && ["generate_rti", "generate_document", "project_info", "scenario_info"].includes(intent.type)) {
      const projectData = await getProjectContext(projectId);
      if (projectData) {
        projectContext = projectData;
      }
    }

    // 3. Recherche hybride
    const searchResults = await hybridSearch(message, userId, intent);

    // 4. Générer la réponse avec le contexte projet
    const { text, actions } = await generateResponse(
      message,
      searchResults,
      intent,
      aiConfig,
      conversationHistory,
      projectContext,
      projectId,
    );

    return {
      role: "assistant",
      content: text,
      sources: searchResults.slice(0, 5), // Limiter les sources affichées
      actions,
      timestamp: new Date(),
    };
  } catch (error: any) {
    console.error("Erreur processUserMessage:", error);
    return {
      role: "assistant",
      content: `Désolé, une erreur s'est produite: ${error.message}`,
      timestamp: new Date(),
    };
  }
}
