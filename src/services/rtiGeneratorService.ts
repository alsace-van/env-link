// Service de génération du PDF RTI (Rapport Technique Initial)
// Utilise pdf-lib pour créer le PDF côté client

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";

// ============================================
// TYPES
// ============================================

export interface RTIData {
  // Véhicule
  vehicleMarque?: string;
  vehicleModele?: string;
  vehicleImmatriculation?: string;
  vehicleVin?: string;
  vehicleDatePremiereImmat?: string;
  vehicleGenre?: string;
  vehicleCarrosserie?: string;
  vehicleType?: string;
  vehiclePtac?: number;
  vehiclePoidsVide?: number;
  vehicleEnergie?: string;
  vehiclePuissanceFiscale?: number;
  vehicleCylindree?: number;
  vehiclePlacesAssises?: number;

  // Client/Propriétaire
  clientNom?: string;
  clientPrenom?: string;
  clientAdresse?: string;
  clientCodePostal?: string;
  clientVille?: string;
  clientPays?: string;
  clientTelephone?: string;
  clientEmail?: string;

  // Transformation
  projectName?: string;
  transformationType?: string;
  descriptionTransformation?: string;
  dateTransformation?: string;
  transformateurNom?: string;
  transformateurAdresse?: string;
  transformateurSiret?: string;

  // Équipements
  equipements: {
    nom: string;
    marque?: string;
    numeroAgrement?: string;
    type?: string;
    poids?: number;
    quantite?: number;
  }[];

  // Poids
  poidsVideAvant?: number;
  poidsAmenagements?: number;
  poidsApresTransformation?: number;
  chargeUtile?: number;
  masseEnOrdreDeMarche?: number;

  // Aménagement
  placesCouchage?: number;
  placesAssisesApres?: number;
  meubles: {
    nom: string;
    poids?: number;
    dimensions?: string;
  }[];

  // Documents joints
  documentsJoints?: string[];
}

// ============================================
// CONSTANTES
// ============================================

const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN = 50;
const LINE_HEIGHT = 16;
const SECTION_SPACING = 25;

const COLORS = {
  primary: rgb(0.13, 0.27, 0.53), // Bleu foncé
  secondary: rgb(0.4, 0.4, 0.4), // Gris
  accent: rgb(0.2, 0.5, 0.8), // Bleu clair
  text: rgb(0, 0, 0),
  lightGray: rgb(0.9, 0.9, 0.9),
};

// ============================================
// HELPERS
// ============================================

function formatDate(date?: string): string {
  if (!date) return "Non renseigné";
  try {
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR");
  } catch {
    return date;
  }
}

function safeValue(value: any, suffix = ""): string {
  if (value === null || value === undefined || value === "") {
    return "Non renseigné";
  }
  return `${value}${suffix}`;
}

// ============================================
// GÉNÉRATION PDF
// ============================================

class RTIPDFGenerator {
  private doc: PDFDocument;
  private page: PDFPage;
  private font: PDFFont;
  private fontBold: PDFFont;
  private yPosition: number;

  constructor() {
    this.doc = null as any;
    this.page = null as any;
    this.font = null as any;
    this.fontBold = null as any;
    this.yPosition = PAGE_HEIGHT - MARGIN;
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.yPosition = PAGE_HEIGHT - MARGIN;
  }

  checkPageBreak(neededSpace: number = 100) {
    if (this.yPosition < MARGIN + neededSpace) {
      this.addPage();
    }
  }

  drawTitle(text: string) {
    this.page.drawText(text, {
      x: MARGIN,
      y: this.yPosition,
      size: 18,
      font: this.fontBold,
      color: COLORS.primary,
    });
    this.yPosition -= 30;
  }

  drawSubtitle(text: string) {
    this.page.drawText(text, {
      x: MARGIN,
      y: this.yPosition,
      size: 10,
      font: this.font,
      color: COLORS.secondary,
    });
    this.yPosition -= 20;
  }

  drawSectionHeader(text: string) {
    this.checkPageBreak(80);

    // Fond coloré
    this.page.drawRectangle({
      x: MARGIN - 5,
      y: this.yPosition - 5,
      width: PAGE_WIDTH - 2 * MARGIN + 10,
      height: 22,
      color: COLORS.lightGray,
    });

    this.page.drawText(text, {
      x: MARGIN,
      y: this.yPosition,
      size: 12,
      font: this.fontBold,
      color: COLORS.primary,
    });
    this.yPosition -= SECTION_SPACING;
  }

  drawField(label: string, value: string, indent = 0) {
    this.checkPageBreak(30);

    const labelWidth = 180;
    const xLabel = MARGIN + indent;
    const xValue = xLabel + labelWidth;

    // Label
    this.page.drawText(label + " :", {
      x: xLabel,
      y: this.yPosition,
      size: 10,
      font: this.font,
      color: COLORS.secondary,
    });

    // Value
    this.page.drawText(value, {
      x: xValue,
      y: this.yPosition,
      size: 10,
      font: this.fontBold,
      color: COLORS.text,
    });

    this.yPosition -= LINE_HEIGHT;
  }

  drawText(text: string, options: { bold?: boolean; indent?: number; size?: number } = {}) {
    this.checkPageBreak(30);

    const { bold = false, indent = 0, size = 10 } = options;

    this.page.drawText(text, {
      x: MARGIN + indent,
      y: this.yPosition,
      size,
      font: bold ? this.fontBold : this.font,
      color: COLORS.text,
    });

    this.yPosition -= LINE_HEIGHT;
  }

  drawSeparator() {
    this.yPosition -= 5;
    this.page.drawLine({
      start: { x: MARGIN, y: this.yPosition },
      end: { x: PAGE_WIDTH - MARGIN, y: this.yPosition },
      thickness: 0.5,
      color: COLORS.lightGray,
    });
    this.yPosition -= 10;
  }

  addSpacing(space: number = 10) {
    this.yPosition -= space;
  }

  // ============================================
  // SECTIONS DU RTI
  // ============================================

  drawHeader(data: RTIData) {
    // Titre principal
    this.drawTitle("RAPPORT TECHNIQUE INITIAL (RTI)");
    this.drawSubtitle("Demande de réception à titre isolé - VASP");
    this.addSpacing(10);

    // Infos document
    const today = new Date().toLocaleDateString("fr-FR");
    this.drawField("Date du document", today);
    this.drawField("Projet", safeValue(data.projectName));
    this.drawSeparator();
  }

  drawVehicleSection(data: RTIData) {
    this.drawSectionHeader("1. IDENTIFICATION DU VÉHICULE DE BASE");

    this.drawField("Marque", safeValue(data.vehicleMarque));
    this.drawField("Modèle / Version", safeValue(data.vehicleModele));
    this.drawField("N° d'immatriculation", safeValue(data.vehicleImmatriculation));
    this.drawField("N° VIN (châssis)", safeValue(data.vehicleVin));
    this.drawField("Date 1ère immatriculation", formatDate(data.vehicleDatePremiereImmat));
    this.drawField("Genre national", safeValue(data.vehicleGenre));
    this.drawField("Carrosserie", safeValue(data.vehicleCarrosserie));
    this.drawField("Type Mine / CNIT", safeValue(data.vehicleType));
    this.drawField("Énergie", safeValue(data.vehicleEnergie));
    this.drawField("Puissance fiscale", safeValue(data.vehiclePuissanceFiscale, " CV"));
    this.drawField("Cylindrée", safeValue(data.vehicleCylindree, " cm³"));
    this.drawField("Places assises (origine)", safeValue(data.vehiclePlacesAssises));
    this.drawField("PTAC", safeValue(data.vehiclePtac, " kg"));
    this.drawField("Poids à vide (origine)", safeValue(data.vehiclePoidsVide, " kg"));

    this.addSpacing();
  }

  drawOwnerSection(data: RTIData) {
    this.drawSectionHeader("2. PROPRIÉTAIRE DU VÉHICULE");

    const fullName = [data.clientPrenom, data.clientNom].filter(Boolean).join(" ") || "Non renseigné";
    const fullAddress =
      [data.clientAdresse, [data.clientCodePostal, data.clientVille].filter(Boolean).join(" "), data.clientPays]
        .filter(Boolean)
        .join(", ") || "Non renseigné";

    this.drawField("Nom et prénom", fullName);
    this.drawField("Adresse", fullAddress);
    this.drawField("Téléphone", safeValue(data.clientTelephone));
    this.drawField("Email", safeValue(data.clientEmail));

    this.addSpacing();
  }

  drawTransformerSection(data: RTIData) {
    this.drawSectionHeader("3. TRANSFORMATEUR / AMÉNAGEUR");

    this.drawField("Raison sociale", safeValue(data.transformateurNom));
    this.drawField("Adresse", safeValue(data.transformateurAdresse));
    this.drawField("N° SIRET", safeValue(data.transformateurSiret));
    this.drawField("Date transformation", formatDate(data.dateTransformation));

    this.addSpacing();
  }

  drawTransformationSection(data: RTIData) {
    this.drawSectionHeader("4. DESCRIPTION DE LA TRANSFORMATION");

    this.drawField("Type de transformation", "Transformation en VASP Caravane");

    if (data.descriptionTransformation) {
      this.addSpacing(5);
      this.drawText("Description des travaux :", { bold: true });

      // Découper la description en lignes
      const maxCharsPerLine = 80;
      const description = data.descriptionTransformation;
      const words = description.split(" ");
      let currentLine = "";

      for (const word of words) {
        if ((currentLine + " " + word).length > maxCharsPerLine) {
          this.drawText(currentLine, { indent: 10 });
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + " " + word : word;
        }
      }
      if (currentLine) {
        this.drawText(currentLine, { indent: 10 });
      }
    }

    this.addSpacing();
  }

  drawWeightsSection(data: RTIData) {
    this.drawSectionHeader("5. BILAN DES MASSES");

    this.drawField("Poids à vide (véhicule base)", safeValue(data.poidsVideAvant, " kg"));
    this.drawField("Poids des aménagements", safeValue(data.poidsAmenagements, " kg"));
    this.drawField("Poids après transformation", safeValue(data.poidsApresTransformation, " kg"));
    this.drawField("PTAC", safeValue(data.vehiclePtac, " kg"));
    this.drawField("Charge utile restante", safeValue(data.chargeUtile, " kg"));

    // Alerte si dépassement
    if (data.chargeUtile !== undefined && data.chargeUtile < 0) {
      this.addSpacing(5);
      this.drawText("/!\\ ATTENTION : Depassement de la charge utile !", { bold: true });
    } else if (data.chargeUtile !== undefined && data.chargeUtile < 100) {
      this.addSpacing(5);
      this.drawText("/!\\ Marge de charge utile faible", { bold: true });
    }

    this.addSpacing();
  }

  drawEquipmentsSection(data: RTIData) {
    this.drawSectionHeader("6. ÉQUIPEMENTS INSTALLÉS");

    if (data.equipements.length === 0) {
      this.drawText("Aucun équipement spécifié", { indent: 10 });
    } else {
      // En-tête tableau
      this.drawText("Équipement | Marque | N° Agrément | Poids", { bold: true, indent: 10 });
      this.addSpacing(5);

      for (const eq of data.equipements) {
        const line = [eq.nom, eq.marque || "-", eq.numeroAgrement || "-", eq.poids ? `${eq.poids} kg` : "-"].join(
          " | ",
        );
        this.drawText(line, { indent: 10 });
      }
    }

    this.addSpacing();
  }

  drawFurnitureSection(data: RTIData) {
    this.drawSectionHeader("7. AMÉNAGEMENTS INTÉRIEURS");

    this.drawField("Places couchage", safeValue(data.placesCouchage));
    this.drawField("Places assises (après)", safeValue(data.placesAssisesApres));

    if (data.meubles.length > 0) {
      this.addSpacing(5);
      this.drawText("Détail des aménagements :", { bold: true });

      for (const meuble of data.meubles) {
        const line = `- ${meuble.nom}${meuble.poids ? ` - ${meuble.poids} kg` : ""}${meuble.dimensions ? ` (${meuble.dimensions})` : ""}`;
        this.drawText(line, { indent: 10 });
      }
    }

    this.addSpacing();
  }

  drawDocumentsSection(data: RTIData) {
    this.drawSectionHeader("8. DOCUMENTS JOINTS");

    const defaultDocs = [
      "Copie de la carte grise",
      "Photos du véhicule avant/après transformation",
      "Attestation de conformité des équipements",
      "Plan d'aménagement coté",
      "Bilan des masses",
    ];

    const docs = data.documentsJoints || defaultDocs;

    for (const doc of docs) {
      this.drawText(`[ ] ${doc}`, { indent: 10 });
    }

    this.addSpacing();
  }

  drawSignatureSection() {
    this.checkPageBreak(150);
    this.drawSectionHeader("9. ENGAGEMENT ET SIGNATURE");

    this.drawText("Je soussigné(e), certifie l'exactitude des informations fournies dans ce document", { indent: 10 });
    this.drawText("et m'engage à présenter le véhicule pour contrôle sur demande de l'administration.", { indent: 10 });

    this.addSpacing(30);

    // Zones de signature
    this.drawField("Fait à", "___________________________");
    this.drawField("Le", "___________________________");
    this.addSpacing(20);
    this.drawText("Signature du propriétaire :", { bold: true });
    this.addSpacing(50);

    this.drawText("Signature du transformateur :", { bold: true });
  }

  // ============================================
  // MÉTHODE PRINCIPALE
  // ============================================

  async generate(data: RTIData): Promise<Uint8Array> {
    await this.init();

    // Page 1 : Informations générales
    this.drawHeader(data);
    this.drawVehicleSection(data);
    this.drawOwnerSection(data);
    this.drawTransformerSection(data);

    // Page 2 : Transformation et équipements
    this.drawTransformationSection(data);
    this.drawWeightsSection(data);
    this.drawEquipmentsSection(data);
    this.drawFurnitureSection(data);

    // Page 3 : Documents et signature
    this.drawDocumentsSection(data);
    this.drawSignatureSection();

    // Numérotation des pages
    const pages = this.doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      page.drawText(`Page ${i + 1}/${pages.length}`, {
        x: PAGE_WIDTH - 80,
        y: 30,
        size: 8,
        font: this.font,
        color: COLORS.secondary,
      });
    }

    return await this.doc.save();
  }
}

// ============================================
// FONCTION EXPORT
// ============================================

export async function generateRTIPDF(data: RTIData): Promise<Blob> {
  const generator = new RTIPDFGenerator();
  const pdfBytes = await generator.generate(data);
  // Convert Uint8Array to ArrayBuffer for Blob
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function downloadRTIPDF(data: RTIData, filename?: string): Promise<void> {
  const blob = await generateRTIPDF(data);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `RTI_${data.projectName || "projet"}_${new Date().toISOString().split("T")[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
