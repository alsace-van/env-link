// Service de génération des documents DREAL
// RTI, demande d'homologation, etc.

import { supabase } from "@/integrations/supabase/client";
import { callAI, AIProvider } from "./aiService";

// ============================================
// TYPES
// ============================================

export interface ProjectData {
  id: string;
  name: string;
  client_name?: string;
  client_address?: string;
  client_phone?: string;
  client_email?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_vin?: string;
  vehicle_immatriculation?: string;
  vehicle_date_premiere_immat?: string;
  vehicle_ptac?: number;
  vehicle_poids_vide?: number;
  vehicle_genre?: string;
  vehicle_carrosserie?: string;
}

export interface RTIData {
  project: ProjectData;
  amenagements: string[];
  equipements: {
    nom: string;
    marque?: string;
    numero_agrement?: string;
    type?: string;
  }[];
  poids_apres_transformation?: number;
  places_assises?: number;
  places_couchage?: number;
  observations?: string;
}

export interface DocumentGenerationResult {
  success: boolean;
  data?: RTIData;
  missingFields: string[];
  warnings: string[];
  pdfUrl?: string;
}

// ============================================
// RÉCUPÉRATION DES DONNÉES PROJET
// ============================================

export async function getProjectDataForRTI(projectId: string): Promise<{
  data: RTIData | null;
  missingFields: string[];
  warnings: string[];
}> {
  try {
    // Récupérer le projet
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    
    if (projectError || !project) {
      return {
        data: null,
        missingFields: ["Projet non trouvé"],
        warnings: [],
      };
    }
    
    // Récupérer les accessoires du projet (équipements)
    const { data: projectAccessories } = await (supabase as any)
      .from("project_accessories")
      .select(`
        quantity,
        accessory:accessories_catalog(
          nom, marque, description, 
          puissance_watts, type_electrique
        )
      `)
      .eq("project_id", projectId);
    
    // Récupérer les tâches (aménagements)
    const { data: workTasks } = await (supabase as any)
      .from("work_tasks")
      .select("name, description, category")
      .eq("project_id", projectId);
    
    // Construire les données RTI
    const rtiData: RTIData = {
      project: {
        id: project.id,
        name: project.name,
        client_name: project.client_name,
        client_address: project.client_address,
        client_phone: project.client_phone,
        client_email: project.client_email,
        vehicle_brand: project.vehicle_brand,
        vehicle_model: project.vehicle_model,
        vehicle_vin: project.vehicle_vin,
        vehicle_immatriculation: project.vehicle_immatriculation,
        vehicle_date_premiere_immat: project.vehicle_date_premiere_immat,
        vehicle_ptac: project.vehicle_ptac,
        vehicle_poids_vide: project.vehicle_poids_vide,
        vehicle_genre: project.vehicle_genre,
        vehicle_carrosserie: project.vehicle_carrosserie,
      },
      amenagements: (workTasks || []).map((t: any) => t.name),
      equipements: (projectAccessories || []).map((pa: any) => ({
        nom: pa.accessory?.nom || "Inconnu",
        marque: pa.accessory?.marque,
        type: pa.accessory?.type_electrique,
      })),
      places_assises: project.places_assises,
      places_couchage: project.places_couchage,
    };
    
    // Vérifier les champs manquants
    const missingFields: string[] = [];
    const warnings: string[] = [];
    
    if (!project.vehicle_vin) missingFields.push("Numéro VIN du véhicule");
    if (!project.vehicle_immatriculation) missingFields.push("Immatriculation");
    if (!project.vehicle_ptac) missingFields.push("PTAC");
    if (!project.vehicle_poids_vide) warnings.push("Poids à vide non renseigné");
    if (!project.client_name) missingFields.push("Nom du client");
    if (!project.client_address) warnings.push("Adresse client non renseignée");
    
    // Vérifier les numéros d'agrément des équipements
    const equipementsSansAgrement = rtiData.equipements.filter(
      (e) => !e.numero_agrement && (e.nom.toLowerCase().includes("chauffage") || e.nom.toLowerCase().includes("gaz"))
    );
    if (equipementsSansAgrement.length > 0) {
      warnings.push(`Numéro d'agrément manquant pour: ${equipementsSansAgrement.map((e) => e.nom).join(", ")}`);
    }
    
    return {
      data: rtiData,
      missingFields,
      warnings,
    };
  } catch (error) {
    console.error("Erreur getProjectDataForRTI:", error);
    return {
      data: null,
      missingFields: ["Erreur lors de la récupération des données"],
      warnings: [],
    };
  }
}

// ============================================
// GÉNÉRATION DU CONTENU RTI VIA IA
// ============================================

export async function generateRTIContent(
  rtiData: RTIData,
  aiConfig: { provider: AIProvider; apiKey: string }
): Promise<{ content: string; suggestions: string[] }> {
  const prompt = `Tu es un expert en homologation VASP pour les véhicules aménagés en France.

Génère le contenu pour un formulaire RTI (Réception à Titre Isolé) avec les données suivantes:

VÉHICULE:
- Marque: ${rtiData.project.vehicle_brand || "Non renseigné"}
- Modèle: ${rtiData.project.vehicle_model || "Non renseigné"}
- VIN: ${rtiData.project.vehicle_vin || "Non renseigné"}
- Immatriculation: ${rtiData.project.vehicle_immatriculation || "Non renseigné"}
- Date 1ère immat: ${rtiData.project.vehicle_date_premiere_immat || "Non renseigné"}
- PTAC: ${rtiData.project.vehicle_ptac || "Non renseigné"} kg
- Poids à vide: ${rtiData.project.vehicle_poids_vide || "Non renseigné"} kg
- Genre: ${rtiData.project.vehicle_genre || "Non renseigné"}

CLIENT:
- Nom: ${rtiData.project.client_name || "Non renseigné"}
- Adresse: ${rtiData.project.client_address || "Non renseigné"}
- Téléphone: ${rtiData.project.client_phone || "Non renseigné"}

AMÉNAGEMENTS RÉALISÉS:
${rtiData.amenagements.length > 0 ? rtiData.amenagements.map((a) => `- ${a}`).join("\n") : "Aucun aménagement listé"}

ÉQUIPEMENTS INSTALLÉS:
${rtiData.equipements.length > 0 ? rtiData.equipements.map((e) => `- ${e.nom} (${e.marque || "marque inconnue"})${e.numero_agrement ? ` - Agrément: ${e.numero_agrement}` : ""}`).join("\n") : "Aucun équipement listé"}

PLACES:
- Places assises: ${rtiData.places_assises || "Non renseigné"}
- Places couchage: ${rtiData.places_couchage || "Non renseigné"}

Génère:
1. Une description des transformations pour le formulaire RTI (max 500 caractères)
2. La liste des pièces justificatives à fournir
3. Des suggestions pour compléter le dossier

Réponds en JSON:
{
  "description_transformation": "texte...",
  "pieces_justificatives": ["pièce 1", "pièce 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "observations": "observations éventuelles..."
}`;

  try {
    const response = await callAI({
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey,
      prompt,
      maxTokens: 1500,
    });
    
    if (response.success && response.text) {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: parsed.description_transformation || "",
          suggestions: parsed.suggestions || [],
        };
      }
    }
    
    return {
      content: "Transformation du véhicule en VASP - Véhicule de loisir aménagé.",
      suggestions: ["Vérifier les données du véhicule", "Compléter les informations manquantes"],
    };
  } catch (error) {
    console.error("Erreur generateRTIContent:", error);
    return {
      content: "Transformation du véhicule en VASP.",
      suggestions: [],
    };
  }
}

// ============================================
// RECHERCHE D'INFOS DANS LES NOTICES
// ============================================

export async function findEquipmentApprovalNumbers(
  equipmentNames: string[],
  userId: string,
  aiConfig: { provider: AIProvider; apiKey: string }
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  
  // Importer dynamiquement pour éviter les dépendances circulaires
  const { searchDocuments } = await import("./aiSearchService");
  
  for (const name of equipmentNames) {
    // Rechercher dans les notices indexées
    const docResults = await searchDocuments(
      `numéro agrément ${name}`,
      userId,
      { limit: 3 }
    );
    
    if (docResults.length > 0) {
      // Extraire le numéro d'agrément via l'IA
      const context = docResults.map((r) => r.content).join("\n\n");
      
      const prompt = `Dans ce texte extrait d'une notice technique, trouve le numéro d'agrément ou d'homologation pour l'équipement "${name}".

Texte:
${context}

Réponds UNIQUEMENT avec le numéro d'agrément trouvé (format type "E1 122R-000xxx" ou similaire), ou "NON_TROUVÉ" si pas trouvé.`;

      const response = await callAI({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        prompt,
        maxTokens: 100,
      });
      
      if (response.success && response.text && !response.text.includes("NON_TROUVÉ")) {
        results.set(name, response.text.trim());
      } else {
        results.set(name, null);
      }
    } else {
      results.set(name, null);
    }
  }
  
  return results;
}

// ============================================
// FONCTION PRINCIPALE DE GÉNÉRATION RTI
// ============================================

export async function generateRTI(
  projectId: string,
  userId: string,
  aiConfig: { provider: AIProvider; apiKey: string }
): Promise<DocumentGenerationResult> {
  // 1. Récupérer les données du projet
  const { data: rtiData, missingFields, warnings } = await getProjectDataForRTI(projectId);
  
  if (!rtiData) {
    return {
      success: false,
      missingFields,
      warnings,
    };
  }
  
  // 2. Rechercher les numéros d'agrément manquants
  const equipementsNecessitantAgrement = rtiData.equipements
    .filter((e) => 
      e.nom.toLowerCase().includes("chauffage") || 
      e.nom.toLowerCase().includes("webasto") ||
      e.nom.toLowerCase().includes("gaz") ||
      e.nom.toLowerCase().includes("truma")
    )
    .map((e) => e.nom);
  
  if (equipementsNecessitantAgrement.length > 0) {
    const agrements = await findEquipmentApprovalNumbers(
      equipementsNecessitantAgrement,
      userId,
      aiConfig
    );
    
    // Mettre à jour les équipements avec les agréments trouvés
    rtiData.equipements = rtiData.equipements.map((e) => ({
      ...e,
      numero_agrement: agrements.get(e.nom) || e.numero_agrement,
    }));
    
    // Ajouter des warnings pour les agréments non trouvés
    agrements.forEach((value, key) => {
      if (!value) {
        warnings.push(`Numéro d'agrément non trouvé pour "${key}" - Vérifiez la notice`);
      }
    });
  }
  
  // 3. Générer le contenu via IA
  const { content, suggestions } = await generateRTIContent(rtiData, aiConfig);
  
  // Ajouter les suggestions aux warnings
  warnings.push(...suggestions);
  
  // 4. Retourner les données (la génération PDF sera faite côté composant)
  return {
    success: missingFields.length === 0,
    data: rtiData,
    missingFields,
    warnings,
  };
}

// ============================================
// LISTE DES DOCUMENTS DREAL SUPPORTÉS
// ============================================

export const DREAL_DOCUMENTS = [
  {
    id: "rti",
    name: "RTI - Réception à Titre Isolé",
    description: "Demande de réception à titre isolé pour transformation VASP",
    requiredFields: ["vehicle_vin", "vehicle_immatriculation", "vehicle_ptac", "client_name"],
  },
  {
    id: "demande_homologation",
    name: "Demande d'homologation VASP",
    description: "Formulaire de demande d'homologation véhicule aménagé",
    requiredFields: ["vehicle_vin", "vehicle_ptac", "amenagements"],
  },
  {
    id: "attestation_conformite",
    name: "Attestation de conformité",
    description: "Attestation de conformité des équipements installés",
    requiredFields: ["equipements", "numeros_agrement"],
  },
  {
    id: "fiche_pesee",
    name: "Fiche de pesée",
    description: "Fiche de répartition des masses par essieu",
    requiredFields: ["poids_avant", "poids_arriere", "ptac"],
  },
];
