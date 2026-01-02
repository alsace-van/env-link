// services/rtiPdfService.ts
// Service pour générer et télécharger les documents RTI
// VERSION: 2.0 - Support du dossier complet avec documents conditionnels

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Génère et télécharge le PDF RTI pour un projet
 */
export async function generateAndDownloadRTIPdf(projectId: string, projectName?: string): Promise<boolean> {
  try {
    toast.loading("Génération du PDF RTI en cours...", { id: "rti-pdf" });

    // Appeler l'Edge Function
    const { data, error } = await supabase.functions.invoke("generate-rti-pdf", {
      body: { projectId },
    });

    if (error) {
      throw error;
    }

    // Vérifier si c'est une erreur JSON
    if (data && typeof data === "object" && data.success === false) {
      throw new Error(data.error || "Erreur lors de la génération");
    }

    // Créer le blob à partir de la réponse
    let pdfBlob: Blob;
    
    if (data instanceof Blob) {
      pdfBlob = data;
    } else if (data instanceof ArrayBuffer) {
      pdfBlob = new Blob([data], { type: "application/pdf" });
    } else {
      // Si c'est une réponse brute, on doit la récupérer autrement
      throw new Error("Format de réponse inattendu");
    }

    // Créer l'URL et déclencher le téléchargement
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `RTI_${projectName || projectId}_${new Date().toISOString().split("T")[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("PDF RTI généré avec succès !", { id: "rti-pdf" });
    return true;
  } catch (error: any) {
    console.error("Erreur génération PDF RTI:", error);
    toast.error(`Erreur: ${error.message || "Impossible de générer le PDF"}`, { id: "rti-pdf" });
    return false;
  }
}

/**
 * Génère le PDF RTI et retourne les bytes (pour prévisualisation)
 */
export async function generateRTIPdfBytes(projectId: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-rti-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ projectId }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error("Erreur génération PDF bytes:", error);
    return null;
  }
}

/**
 * Génère et télécharge le dossier RTI complet (ZIP) avec documents conditionnels
 * - Pièce 01 : Demande de réception (TOUJOURS)
 * - Pièce 04 : Attestation de travaux (TOUJOURS)
 * - Pièce 06 : Tableau justificatifs (TOUJOURS)
 * - Pièce 12 : Calcul charges - Excel (TOUJOURS)
 * - Pièce 14 : Attestation sièges (SI sièges détectés dans expenses/scénario)
 * - Pièce 15 : Attestation chauffage (SI chauffage détecté dans expenses/scénario)
 */
export async function generateAndDownloadRTIDossier(projectId: string, projectName?: string): Promise<boolean> {
  try {
    toast.loading("Génération du dossier RTI en cours...\nAnalyse des équipements...", { id: "rti-dossier" });

    // Appeler l'Edge Function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-rti`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ projectId }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur ${response.status}`);
    }

    // Vérifier le content-type
    const contentType = response.headers.get("content-type");
    
    if (contentType?.includes("application/json")) {
      // C'est une erreur
      const errorData = await response.json();
      throw new Error(errorData.error || "Erreur lors de la génération");
    }

    // Créer le blob ZIP
    const arrayBuffer = await response.arrayBuffer();
    const zipBlob = new Blob([arrayBuffer], { type: "application/zip" });

    // Créer l'URL et déclencher le téléchargement
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Dossier_RTI_${projectName?.replace(/[^a-zA-Z0-9]/g, "_") || projectId}_${new Date().toISOString().split("T")[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Dossier RTI généré avec succès !", { id: "rti-dossier" });
    return true;
  } catch (error: any) {
    console.error("Erreur génération dossier RTI:", error);
    toast.error(`Erreur: ${error.message || "Impossible de générer le dossier"}`, { id: "rti-dossier" });
    return false;
  }
}
