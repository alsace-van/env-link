// ============================================
// workDescriptionGenerator.ts
// Génère automatiquement la description des travaux
// depuis les tâches, accessoires et meubles
// ============================================

import { supabase } from "@/integrations/supabase/client";

interface WorkTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  category?: string;
}

interface ProjectAccessory {
  id: string;
  quantity: number;
  accessory: {
    nom: string;
    marque?: string;
    description?: string;
    poids_kg?: number;
  };
}

interface FurnitureItem {
  id: string;
  name: string;
  type?: string;
  weight?: number;
  dimensions?: string;
}

interface SeatInfo {
  seats_added?: number;
  seats_type?: string;
  sleeping_places?: number;
}

// ============================================
// GÉNÉRATION DE LA DESCRIPTION
// ============================================

export async function generateWorkDescription(projectId: string): Promise<string> {
  // Récupérer toutes les données du projet
  const [tasks, accessories, projectData] = await Promise.all([
    fetchCompletedTasks(projectId),
    fetchProjectAccessories(projectId),
    fetchProjectData(projectId),
  ]);

  const sections: string[] = [];

  // 1. Introduction
  sections.push(`Aménagement en véhicule autocaravane (VASP Caravane) comprenant:`);

  // 2. Travaux réalisés (depuis les tâches terminées)
  if (tasks.length > 0) {
    const tasksByCategory = groupTasksByCategory(tasks);
    
    for (const [category, categoryTasks] of Object.entries(tasksByCategory)) {
      const taskNames = categoryTasks.map(t => t.title).join(", ");
      sections.push(`- ${category}: ${taskNames}`);
    }
  }

  // 3. Équipements installés (depuis les accessoires)
  const equipments = accessories.filter(a => 
    a.accessory?.nom && 
    !a.accessory.nom.toLowerCase().includes("siège") &&
    !a.accessory.nom.toLowerCase().includes("banquette")
  );
  
  if (equipments.length > 0) {
    const equipList = equipments.map(a => {
      const name = a.accessory.nom;
      const brand = a.accessory.marque ? ` ${a.accessory.marque}` : "";
      const qty = a.quantity > 1 ? ` (x${a.quantity})` : "";
      return `${name}${brand}${qty}`;
    });
    sections.push(`- Équipements: ${equipList.join(", ")}`);
  }

  // 4. Mobilier (depuis furniture_data)
  if (projectData?.furniture_data) {
    const furniture = parseFurnitureData(projectData.furniture_data);
    if (furniture.length > 0) {
      const furnitureList = furniture.map(f => f.name).join(", ");
      sections.push(`- Mobilier fixe: ${furnitureList}`);
    }
  }

  // 5. Places et couchages
  const seatInfo = getSeatInfo(accessories, projectData);
  if (seatInfo.seats_added && seatInfo.seats_added > 0) {
    sections.push(`- Places assises ajoutées: ${seatInfo.seats_added} (${seatInfo.seats_type || "banquette"})`);
  }
  if (seatInfo.sleeping_places && seatInfo.sleeping_places > 0) {
    sections.push(`- Couchages: ${seatInfo.sleeping_places} place(s)`);
  }

  // 6. Installation électrique (si présente dans les tâches)
  const hasElectric = tasks.some(t => 
    t.category?.toLowerCase().includes("élect") || 
    t.title.toLowerCase().includes("élect")
  );
  if (hasElectric) {
    sections.push(`- Installation électrique 12V et 220V`);
  }

  // 7. Chauffage (si présent dans les accessoires)
  const heating = accessories.find(a => 
    a.accessory?.nom?.toLowerCase().includes("chauffage") ||
    a.accessory?.nom?.toLowerCase().includes("webasto") ||
    a.accessory?.nom?.toLowerCase().includes("truma")
  );
  if (heating) {
    sections.push(`- Chauffage ${heating.accessory.marque || ""} ${heating.accessory.nom}`);
  }

  return sections.join("\n");
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

async function fetchCompletedTasks(projectId: string): Promise<WorkTask[]> {
  const { data, error } = await supabase
    .from("work_tasks")
    .select("id, title, description, status, category")
    .eq("project_id", projectId)
    .eq("status", "completed");

  if (error) {
    console.error("Erreur fetch tasks:", error);
    return [];
  }

  return data || [];
}

async function fetchProjectAccessories(projectId: string): Promise<ProjectAccessory[]> {
  const { data, error } = await supabase
    .from("project_accessories")
    .select(`
      id,
      quantity,
      accessory:accessories_catalog (
        nom,
        marque,
        description,
        poids_kg
      )
    `)
    .eq("project_id", projectId);

  if (error) {
    console.error("Erreur fetch accessories:", error);
    return [];
  }

  return (data || []) as ProjectAccessory[];
}

async function fetchProjectData(projectId: string): Promise<any> {
  const { data, error } = await supabase
    .from("projects")
    .select("furniture_data, sleeping_places, seats_added, seats_type")
    .eq("id", projectId)
    .single();

  if (error) {
    console.error("Erreur fetch project:", error);
    return null;
  }

  return data;
}

function groupTasksByCategory(tasks: WorkTask[]): Record<string, WorkTask[]> {
  const groups: Record<string, WorkTask[]> = {};
  
  const categoryMapping: Record<string, string> = {
    "electricite": "Électricité",
    "plomberie": "Plomberie",
    "menuiserie": "Menuiserie",
    "isolation": "Isolation",
    "amenagement": "Aménagement",
    "carrosserie": "Carrosserie",
    "default": "Travaux divers",
  };

  for (const task of tasks) {
    let category = "Travaux divers";
    
    if (task.category) {
      const normalizedCategory = task.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (const [key, value] of Object.entries(categoryMapping)) {
        if (normalizedCategory.includes(key)) {
          category = value;
          break;
        }
      }
    }

    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(task);
  }

  return groups;
}

function parseFurnitureData(furnitureData: any): FurnitureItem[] {
  if (!furnitureData) return [];
  
  try {
    const data = typeof furnitureData === "string" 
      ? JSON.parse(furnitureData) 
      : furnitureData;

    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id || String(Math.random()),
        name: item.name || item.nom || "Meuble",
        type: item.type,
        weight: item.weight || item.poids,
        dimensions: item.dimensions,
      }));
    }

    // Si c'est un objet avec des clés = types de meubles
    if (typeof data === "object") {
      const items: FurnitureItem[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          items.push(...(value as any[]).map(v => ({
            id: v.id || String(Math.random()),
            name: v.name || key,
            type: key,
            weight: v.weight || v.poids,
            dimensions: v.dimensions,
          })));
        }
      }
      return items;
    }

    return [];
  } catch (e) {
    console.error("Erreur parsing furniture_data:", e);
    return [];
  }
}

function getSeatInfo(accessories: ProjectAccessory[], projectData: any): SeatInfo {
  // D'abord vérifier les données du projet
  if (projectData?.seats_added) {
    return {
      seats_added: projectData.seats_added,
      seats_type: projectData.seats_type,
      sleeping_places: projectData.sleeping_places,
    };
  }

  // Sinon chercher dans les accessoires
  const seatAccessory = accessories.find(a => 
    a.accessory?.nom?.toLowerCase().includes("siège") ||
    a.accessory?.nom?.toLowerCase().includes("banquette")
  );

  if (seatAccessory) {
    return {
      seats_added: seatAccessory.quantity,
      seats_type: seatAccessory.accessory.nom,
      sleeping_places: projectData?.sleeping_places || 0,
    };
  }

  return {
    sleeping_places: projectData?.sleeping_places || 0,
  };
}

// ============================================
// GÉNÉRATION DESCRIPTION COURTE (pour formulaires)
// ============================================

export async function generateShortDescription(projectId: string, maxLength: number = 500): Promise<string> {
  const fullDescription = await generateWorkDescription(projectId);
  
  if (fullDescription.length <= maxLength) {
    return fullDescription;
  }

  // Tronquer intelligemment
  const lines = fullDescription.split("\n");
  let result = lines[0]; // Garder l'introduction
  
  for (let i = 1; i < lines.length; i++) {
    if ((result + "\n" + lines[i]).length <= maxLength - 3) {
      result += "\n" + lines[i];
    } else {
      break;
    }
  }

  return result + "...";
}
