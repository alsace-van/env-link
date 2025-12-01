import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

// Configuration pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface Category {
  id: string;
  nom: string;
}

interface ExistingAccessory {
  id: string;
  nom: string;
  marque?: string;
  prix_reference?: number;
  prix_vente_ttc?: number;
  fournisseur?: string;
}

interface ParsedProduct {
  id: string;
  selected: boolean;
  reference?: string;
  nom: string;
  description?: string;
  prix_reference?: number;
  prix_vente_ttc?: number;
  fournisseur?: string;
  marque?: string;
  poids_kg?: number;
  dimensions?: string;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  // Champs pour la mise à jour
  existingId?: string;
  isUpdate?: boolean;
  oldPrixReference?: number;
  oldPrixVenteTtc?: number;
  priceChanged?: boolean;
}

interface AccessoryImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
}

const AccessoryImportExportDialog = ({ isOpen, onClose, onSuccess, categories }: AccessoryImportExportDialogProps) => {
  const [activeTab, setActiveTab] = useState("excel");
  const [isLoading, setIsLoading] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [defaultFournisseur, setDefaultFournisseur] = useState("");
  const [importStep, setImportStep] = useState<"upload" | "preview">("upload");
  const [pdfText, setPdfText] = useState("");
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [existingAccessories, setExistingAccessories] = useState<ExistingAccessory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les accessoires existants
  useEffect(() => {
    if (isOpen) {
      loadExistingAccessories();
    }
  }, [isOpen]);

  const loadExistingAccessories = async () => {
    const { data, error } = await supabase
      .from("accessories")
      .select("id, nom, marque, prix_reference, prix_vente_ttc, fournisseur");

    if (!error && data) {
      setExistingAccessories(data);
    }
  };

  const resetDialog = () => {
    setParsedProducts([]);
    setImportStep("upload");
    setPdfText("");
    setSelectedCategory("");
    setDefaultFournisseur("");
    setIsUpdateMode(false);
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  // Trouver un produit existant
  const findExistingProduct = (product: ParsedProduct): ExistingAccessory | undefined => {
    // Par nom exact
    const byName = existingAccessories.find((acc) => acc.nom.toLowerCase() === product.nom.toLowerCase());
    if (byName) return byName;

    // Par référence
    if (product.reference) {
      const byRef = existingAccessories.find(
        (acc) =>
          acc.nom.toLowerCase().includes(product.reference!.toLowerCase()) ||
          acc.nom.toLowerCase() === product.reference!.toLowerCase(),
      );
      if (byRef) return byRef;
    }

    // Par marque + nom partiel
    if (product.marque) {
      const byMarque = existingAccessories.find(
        (acc) =>
          acc.marque?.toLowerCase() === product.marque?.toLowerCase() &&
          (acc.nom.toLowerCase().includes(product.nom.toLowerCase().substring(0, 10)) ||
            product.nom.toLowerCase().includes(acc.nom.toLowerCase().substring(0, 10))),
      );
      if (byMarque) return byMarque;
    }

    return undefined;
  };

  // Enrichir avec infos de mise à jour
  const enrichProductsWithUpdateInfo = (products: ParsedProduct[]): ParsedProduct[] => {
    return products.map((product) => {
      const existing = findExistingProduct(product);

      if (existing) {
        const priceChanged =
          (product.prix_reference !== undefined && existing.prix_reference !== product.prix_reference) ||
          (product.prix_vente_ttc !== undefined && existing.prix_vente_ttc !== product.prix_vente_ttc);

        return {
          ...product,
          existingId: existing.id,
          isUpdate: true,
          oldPrixReference: existing.prix_reference,
          oldPrixVenteTtc: existing.prix_vente_ttc,
          priceChanged,
          selected: isUpdateMode ? priceChanged : true,
        };
      }

      return { ...product, isUpdate: false, selected: !isUpdateMode };
    });
  };

  // Parser un prix
  const parsePrice = (value: string): number => {
    if (!value) return 0;
    let cleaned = String(value).replace(/[€\s]/g, "").trim();
    if (cleaned.includes(",") && cleaned.includes(".")) {
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Import Excel
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error("Fichier vide ou sans données");
        return;
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1);
      const columnMapping = detectColumnMapping(headers);

      const products: ParsedProduct[] = rows
        .filter((row) => row.some((cell) => cell != null && cell !== ""))
        .map((row, index) => {
          const product: ParsedProduct = { id: `import-${index}`, selected: true, nom: "" };

          headers.forEach((header, colIndex) => {
            const value = row[colIndex];
            const mappedField = columnMapping[header.toLowerCase().trim()];

            if (mappedField && value != null) {
              if (["prix_reference", "prix_vente_ttc", "poids_kg"].includes(mappedField)) {
                (product as any)[mappedField] = parsePrice(String(value));
              } else if (
                ["nom", "reference", "description", "marque", "fournisseur", "dimensions"].includes(mappedField)
              ) {
                (product as any)[mappedField] = String(value).trim();
              }
            }
          });

          if (!product.nom && product.reference) product.nom = product.reference;
          if (!product.nom && product.description) product.nom = product.description.substring(0, 100);

          return product;
        })
        .filter((p) => p.nom || p.reference);

      const enrichedProducts = enrichProductsWithUpdateInfo(products);
      setParsedProducts(enrichedProducts);
      setImportStep("preview");

      const updateCount = enrichedProducts.filter((p) => p.isUpdate).length;
      const changedCount = enrichedProducts.filter((p) => p.priceChanged).length;
      const newCount = enrichedProducts.filter((p) => !p.isUpdate).length;

      toast.success(
        `${enrichedProducts.length} produits : ${updateCount} existants (${changedCount} modifiés), ${newCount} nouveaux`,
      );
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur de lecture du fichier");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Import PDF
  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Extraire le texte en conservant les positions pour reconstruire les lignes
      let allLines: { y: number; text: string }[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Grouper par position Y (ligne)
        const lineMap = new Map<number, string[]>();

        for (const item of textContent.items as any[]) {
          const y = Math.round(item.transform[5]); // Position Y
          const x = Math.round(item.transform[4]); // Position X pour trier

          if (!lineMap.has(y)) {
            lineMap.set(y, []);
          }
          lineMap.get(y)!.push(`${x.toString().padStart(5, "0")}:${item.str}`);
        }

        // Trier chaque ligne par X et joindre
        lineMap.forEach((items, y) => {
          items.sort(); // Trier par X (préfixé)
          const lineText = items.map((s) => s.split(":").slice(1).join(":")).join(" ");
          allLines.push({ y: y + i * 10000, text: lineText }); // Offset par page
        });
      }

      // Trier par Y décroissant (haut en bas) et joindre
      allLines.sort((a, b) => b.y - a.y);
      const fullText = allLines.map((l) => l.text).join("\n");

      setPdfText(fullText);
      const products = parsePdfText(fullText);

      if (products.length > 0) {
        const enrichedProducts = enrichProductsWithUpdateInfo(products);
        setParsedProducts(enrichedProducts);
        setImportStep("preview");

        const updateCount = enrichedProducts.filter((p) => p.isUpdate).length;
        const changedCount = enrichedProducts.filter((p) => p.priceChanged).length;
        const newCount = enrichedProducts.filter((p) => !p.isUpdate).length;

        toast.success(
          `${enrichedProducts.length} produits : ${updateCount} existants (${changedCount} modifiés), ${newCount} nouveaux`,
        );
      } else {
        toast.warning("Aucun produit détecté");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur de lecture du PDF");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualParse = () => {
    if (!pdfText.trim()) {
      toast.error("Veuillez coller du texte");
      return;
    }

    const products = parsePdfText(pdfText);
    if (products.length > 0) {
      const enrichedProducts = enrichProductsWithUpdateInfo(products);
      setParsedProducts(enrichedProducts);
      setImportStep("preview");
      toast.success(`${enrichedProducts.length} produits détectés`);
    } else {
      toast.error("Aucun produit détecté");
    }
  };

  // Générer description Ultimatron basée sur la référence
  const generateUltimatronDescription = (ref: string): string => {
    if (ref.startsWith("ULS") || ref.startsWith("ULM") || ref.startsWith("UBL")) {
      let desc = `Batterie au lithium LiFePO4`;
      if (ref.includes("-12-")) desc += " 12.8V";
      else if (ref.includes("-24-")) desc += " 25.6V";
      else if (ref.includes("-36-")) desc += " 38.4V";
      const capacityMatch = ref.match(/-(\d{2,3})(?:H|-PRO|-LN3|$)/i);
      if (capacityMatch) desc += ` ${capacityMatch[1]}Ah`;
      if (ref.includes("H") && !ref.includes("-PRO")) desc += " avec chauffage";
      if (ref.includes("-PRO")) desc += " PRO";
      if (ref.includes("-LN3")) desc += " (format LN3)";
      return desc;
    } else if (ref.startsWith("ECO")) {
      return "Batterie Ecowatt LiFePO4 12.8V 100Ah";
    } else if (ref.startsWith("JM")) {
      const cap = ref.match(/-(\d{2,3})$/);
      return `Batterie solaire AGM 12V ${cap ? cap[1] + "Ah" : ""}`;
    } else if (ref.startsWith("JDG")) {
      const cap = ref.match(/-(\d{2,3})$/);
      return `Batterie solaire à gel 12V ${cap ? cap[1] + "Ah" : ""}`;
    } else if (ref.startsWith("JPC")) {
      const cap = ref.match(/-(\d{2,3})$/);
      return `Batterie solaire plomb-carbone 12V ${cap ? cap[1] + "Ah" : ""}`;
    } else if (ref.startsWith("MT")) {
      return "Régulateur de charge solaire MPPT";
    } else if (ref.startsWith("RTD")) {
      return "Régulateur de charge solaire PWM";
    } else if (ref.includes("MONO")) {
      const watts = ref.match(/(\d{3})W/);
      return `Panneau solaire ${watts ? watts[1] + "W" : ""} monocristallin`;
    } else if (ref.includes("ETFE")) {
      const watts = ref.match(/(\d{3})W/);
      return `Panneau solaire ${watts ? watts[1] + "W" : ""} flexible ETFE`;
    } else if (ref.toLowerCase().includes("portable")) {
      const watts = ref.match(/(\d{3})W/i);
      return `Panneau solaire portable ${watts ? watts[1] + "W" : ""}`;
    } else if (ref.startsWith("RVM")) {
      return "Kit support de panneau solaire";
    } else if (ref.startsWith("A701")) {
      return ref.includes("G")
        ? "Sectionneur coupe-batterie unipolaire 200A"
        : "Sectionneur coupe-batterie bipolaire 200A";
    }
    return "";
  };

  // Parser PDF
  const parsePdfText = (text: string): ParsedProduct[] => {
    const products: ParsedProduct[] = [];

    const isUltimatron = text.toLowerCase().includes("ultimatron") || text.toLowerCase().includes("lifepo4");
    const isSCA = text.toLowerCase().includes("sca") || text.toLowerCase().includes("toit relevable");

    let productIndex = 0;

    // Ultimatron - Parser ligne par ligne
    if (isUltimatron) {
      const refPatternUltimatron =
        /\b(ECO-\d{2}-\d{2,3}|U[BL][SLM]?-\d{2}-\d{2,3}(?:-[A-Z0-9]+)?|JM-\d{2}-\d{2,3}|JDG-\d{2}-\d{2,3}|JPC-\d{2}-\d{2,3}|MT\d{4}[A-Z-]*|RTD\d{4}|A\d{3}-[A-Z]|RVM-ABS-\d+PCS|\d{3}W\s*(?:MONO|ETFE)|Portable\s*\d{3}W)\b/gi;

      const lines = text.split(/\n/);
      const seenRefs = new Set<string>();

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const matches = [...line.matchAll(refPatternUltimatron)];

        for (const match of matches) {
          const ref = match[0].toUpperCase().trim();

          if (seenRefs.has(ref)) continue;
          if (ref === "PHOTO" || ref === "DESCRIPTION") continue;
          seenRefs.add(ref);

          // Chercher les données sur cette ligne et les 2 suivantes
          const contextLines = lines.slice(lineIndex, Math.min(lineIndex + 3, lines.length));
          const context = contextLines.join(" ");

          // Dimensions (format: 330*172*220)
          const dimsMatch = context.match(/(\d{2,3})\s*\*\s*(\d{2,3})\s*\*\s*(\d{2,3})/);
          let longueur_mm: number | undefined;
          let largeur_mm: number | undefined;
          let hauteur_mm: number | undefined;
          let dimensions: string | undefined;
          if (dimsMatch) {
            longueur_mm = parseInt(dimsMatch[1]);
            largeur_mm = parseInt(dimsMatch[2]);
            hauteur_mm = parseInt(dimsMatch[3]);
            dimensions = `${longueur_mm}x${largeur_mm}x${hauteur_mm} mm`;
          }

          // Poids - chercher un nombre décimal suivi ou non de "kg"
          let poids_kg: number | undefined;
          // Chercher après les dimensions si elles existent
          const searchText = dimsMatch
            ? context.substring(context.indexOf(dimsMatch[0]) + dimsMatch[0].length)
            : context;
          const weightMatch = searchText.match(/\b(\d{1,2}[.,]\d{1,2})\s*(?:kg)?\b/i);
          if (weightMatch) {
            const w = parseFloat(weightMatch[1].replace(",", "."));
            if (w >= 0.5 && w <= 60) {
              poids_kg = w;
            }
          }

          // Prix (format: 258.94€ ou 258,94€)
          const priceMatches = [...context.matchAll(/(\d{1,4}[.,]\d{2})\s*€/g)];
          const prices = priceMatches.map((m) => parsePrice(m[1])).filter((p) => p > 5 && p < 5000);

          // Générer description
          const description = generateUltimatronDescription(ref);

          products.push({
            id: `import-${productIndex++}`,
            selected: true,
            reference: ref,
            nom: ref,
            description,
            prix_reference: prices.length > 0 ? prices[0] : undefined,
            prix_vente_ttc: prices.length > 1 ? prices[1] : undefined,
            fournisseur: "Ultimatron",
            marque: "Ultimatron",
            poids_kg,
            dimensions,
            longueur_mm,
            largeur_mm,
            hauteur_mm,
          });
        }
      }
    }

    // SCA
    if (isSCA) {
      const lines = text.split(/[\n\r]+/);
      const seenRefs = new Set<string>();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const scaMatch = line.match(/SCA\s*(\d{3})/i);

        if (scaMatch) {
          const scaNum = scaMatch[1];
          const ref = `SCA ${scaNum}`;
          const contextStart = Math.max(0, i - 2);
          const context = lines.slice(contextStart, i + 1).join(" ");

          const refCodeMatch = line.match(/\b(\d{6})\b/);
          const refCode = refCodeMatch ? refCodeMatch[1] : "";
          const uniqueKey = refCode || `${ref}-${i}`;
          if (seenRefs.has(uniqueKey)) continue;
          seenRefs.add(uniqueKey);

          let pricePart = line;
          if (refCode) {
            const refIndex = line.indexOf(refCode);
            if (refIndex !== -1) pricePart = line.substring(refIndex + refCode.length);
          }

          const priceMatches = [...pricePart.matchAll(/(\d[\d\s]*)\s*€/g)];
          const prices = priceMatches
            .map((m) => parseFloat(m[1].replace(/\s/g, "")))
            .filter((p) => p > 100 && p < 20000);

          let vehicule = "";
          const contextLower = context.toLowerCase();
          if (contextLower.includes("vwt4") || contextLower.includes("vw t4")) vehicule = "VW T4";
          else if (contextLower.includes("t5/t6") || contextLower.includes("t5") || contextLower.includes("t6"))
            vehicule = "VW T5/T6";
          else if (contextLower.includes("trafic")) vehicule = "Renault Trafic 3";
          else if (contextLower.includes("transit custom")) vehicule = "Ford Transit Custom";
          else if (contextLower.includes("vito")) vehicule = "Mercedes Vito";
          else if (contextLower.includes("ducato")) vehicule = "Fiat Ducato";
          else if (contextLower.includes("sprinter")) vehicule = "Mercedes Sprinter";
          else if (contextLower.includes("traveller") || contextLower.includes("spacetourer"))
            vehicule = "Traveller/Spacetourer";
          else if (contextLower.includes("boxer")) vehicule = "Peugeot Boxer";
          else if (contextLower.includes("jumper")) vehicule = "Citroën Jumper";
          else if (contextLower.includes("universel")) vehicule = "Universel";

          if (prices.length > 0) {
            products.push({
              id: `import-${productIndex++}`,
              selected: true,
              reference: refCode || ref,
              nom: `Toit relevable ${ref}${vehicule ? ` - ${vehicule}` : ""}`,
              description: `Toit relevable ${ref}${vehicule ? ` pour ${vehicule}` : ""}`,
              prix_reference: prices[1] || prices[0],
              prix_vente_ttc: prices[0],
              fournisseur: "SCA",
              marque: "SCA",
            });
          }
        }
      }
    }

    return products;
  };

  // Détecter mapping colonnes
  const detectColumnMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const patterns: Record<string, string[]> = {
      reference: ["ref", "référence", "reference", "sku", "code", "modèle", "article"],
      nom: ["nom", "name", "désignation", "designation", "libellé", "produit"],
      description: ["desc", "détail", "detail", "caractéristiques"],
      prix_reference: ["prix achat", "prix ht", "prix pro", "revendeur", "coût", "tarif ht"],
      prix_vente_ttc: ["prix vente", "prix ttc", "pvp", "prix public", "prix détail"],
      marque: ["marque", "brand", "fabricant"],
      fournisseur: ["fournisseur", "supplier", "vendeur"],
      poids_kg: ["poids", "weight", "kg"],
      dimensions: ["dimensions", "taille", "dim"],
    };

    headers.forEach((header) => {
      const h = header.toLowerCase().trim();
      for (const [field, keywords] of Object.entries(patterns)) {
        if (keywords.some((k) => h.includes(k))) {
          mapping[h] = field;
          break;
        }
      }
    });

    return mapping;
  };

  // Sélection
  const toggleProductSelection = (id: string) => {
    setParsedProducts((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  const toggleAllProducts = (selected: boolean) => {
    setParsedProducts((prev) => prev.map((p) => ({ ...p, selected })));
  };

  const selectOnlyChanged = () => {
    setParsedProducts((prev) => prev.map((p) => ({ ...p, selected: p.priceChanged === true })));
  };

  const selectOnlyNew = () => {
    setParsedProducts((prev) => prev.map((p) => ({ ...p, selected: !p.isUpdate })));
  };

  // Import / Mise à jour
  const handleImport = async () => {
    const selectedProducts = parsedProducts.filter((p) => p.selected);

    if (selectedProducts.length === 0) {
      toast.error("Aucun produit sélectionné");
      return;
    }

    const newProducts = selectedProducts.filter((p) => !p.isUpdate);
    if (newProducts.length > 0 && !selectedCategory) {
      toast.error("Sélectionnez une catégorie pour les nouveaux produits");
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let imported = 0;
      let updated = 0;
      let errors = 0;

      for (const product of selectedProducts) {
        if (product.isUpdate && product.existingId) {
          const updateData: any = {};
          if (product.prix_reference !== undefined) updateData.prix_reference = product.prix_reference;
          if (product.prix_vente_ttc !== undefined) updateData.prix_vente_ttc = product.prix_vente_ttc;
          updateData.last_price_check = new Date().toISOString();

          const { error } = await supabase.from("accessories").update(updateData).eq("id", product.existingId);

          if (error) errors++;
          else updated++;
        } else {
          const { error } = await supabase.from("accessories").insert({
            user_id: user.id,
            nom: product.nom || product.reference || "Sans nom",
            marque: product.marque || defaultFournisseur || null,
            category_id: selectedCategory,
            prix_reference: product.prix_reference || null,
            prix_vente_ttc: product.prix_vente_ttc || null,
            fournisseur: product.fournisseur || defaultFournisseur || null,
            description: product.description || null,
            poids_kg: product.poids_kg || null,
            longueur_mm: product.longueur_mm || null,
            largeur_mm: product.largeur_mm || null,
            hauteur_mm: product.hauteur_mm || null,
            needs_completion: true,
            imported_at: new Date().toISOString(),
          });

          if (error) errors++;
          else imported++;
        }
      }

      const messages = [];
      if (imported > 0) messages.push(`${imported} importé(s)`);
      if (updated > 0) messages.push(`${updated} mis à jour`);
      if (errors > 0) messages.push(`${errors} erreur(s)`);

      toast.success(messages.join(", "));

      if (imported > 0 || updated > 0) {
        onSuccess();
        handleClose();
      }
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Export
  const handleExport = async () => {
    setIsLoading(true);
    try {
      const { data: accessories, error } = await supabase
        .from("accessories")
        .select(`*, categories (nom)`)
        .order("nom");

      if (error) throw error;

      const exportData = (accessories || []).map((acc) => ({
        Référence: acc.id.substring(0, 8),
        Nom: acc.nom,
        Marque: acc.marque || "",
        Catégorie: acc.categories?.nom || "",
        Fournisseur: acc.fournisseur || "",
        "Prix achat HT": acc.prix_reference || "",
        "Prix vente TTC": acc.prix_vente_ttc || "",
        "Poids (kg)": acc.poids_kg || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Catalogue");
      XLSX.writeFile(wb, `catalogue_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast.success("Export réussi !");
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = parsedProducts.filter((p) => p.selected).length;
  const updateCount = parsedProducts.filter((p) => p.selected && p.isUpdate).length;
  const newCount = parsedProducts.filter((p) => p.selected && !p.isUpdate).length;
  const changedCount = parsedProducts.filter((p) => p.priceChanged).length;

  // Composant variation de prix
  const PriceChange = ({ oldPrice, newPrice }: { oldPrice?: number; newPrice?: number }) => {
    if (oldPrice === undefined || newPrice === undefined) return null;
    if (oldPrice === newPrice) return <Minus className="w-3 h-3 text-muted-foreground" />;

    const diff = newPrice - oldPrice;
    const percent = ((diff / oldPrice) * 100).toFixed(1);

    return diff > 0 ? (
      <span className="flex items-center text-red-500 text-xs">
        <ArrowUp className="w-3 h-3" />+{percent}%
      </span>
    ) : (
      <span className="flex items-center text-green-500 text-xs">
        <ArrowDown className="w-3 h-3" />
        {percent}%
      </span>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import / Export du catalogue</DialogTitle>
          <DialogDescription>Importez ou mettez à jour les prix depuis Excel, CSV ou PDF</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="excel">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel/CSV
            </TabsTrigger>
            <TabsTrigger value="pdf">
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Excel */}
          <TabsContent value="excel" className="flex-1 overflow-hidden flex flex-col">
            {importStep === "upload" ? (
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Mode mise à jour des prix</p>
                      <p className="text-sm text-muted-foreground">
                        Détecte les produits existants et compare les prix
                      </p>
                    </div>
                  </div>
                  <Switch checked={isUpdateMode} onCheckedChange={setIsUpdateMode} />
                </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFileUpload}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label htmlFor="excel-upload" className="cursor-pointer">
                    <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Cliquez pour sélectionner un fichier</p>
                    <p className="text-sm text-muted-foreground">Excel ou CSV</p>
                  </label>
                </div>
              </div>
            ) : (
              <PreviewTable
                products={parsedProducts}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                defaultFournisseur={defaultFournisseur}
                setDefaultFournisseur={setDefaultFournisseur}
                toggleProductSelection={toggleProductSelection}
                toggleAllProducts={toggleAllProducts}
                selectOnlyChanged={selectOnlyChanged}
                selectOnlyNew={selectOnlyNew}
                selectedCount={selectedCount}
                updateCount={updateCount}
                newCount={newCount}
                changedCount={changedCount}
                onImport={handleImport}
                onBack={() => setImportStep("upload")}
                isLoading={isLoading}
                PriceChange={PriceChange}
              />
            )}
          </TabsContent>

          {/* PDF */}
          <TabsContent value="pdf" className="flex-1 overflow-hidden flex flex-col">
            {importStep === "upload" ? (
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Mode mise à jour des prix</p>
                      <p className="text-sm text-muted-foreground">
                        Détecte les produits existants et compare les prix
                      </p>
                    </div>
                  </div>
                  <Switch checked={isUpdateMode} onCheckedChange={setIsUpdateMode} />
                </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfFileUpload}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Cliquez pour sélectionner un PDF</p>
                    <p className="text-sm text-muted-foreground">Catalogue fournisseur</p>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label>Ou coller le texte du PDF</Label>
                  <Textarea
                    value={pdfText}
                    onChange={(e) => setPdfText(e.target.value)}
                    placeholder="Copiez le contenu..."
                    rows={5}
                  />
                  <Button onClick={handleManualParse} disabled={!pdfText.trim()}>
                    <Eye className="w-4 h-4 mr-2" />
                    Analyser
                  </Button>
                </div>
              </div>
            ) : (
              <PreviewTable
                products={parsedProducts}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                defaultFournisseur={defaultFournisseur}
                setDefaultFournisseur={setDefaultFournisseur}
                toggleProductSelection={toggleProductSelection}
                toggleAllProducts={toggleAllProducts}
                selectOnlyChanged={selectOnlyChanged}
                selectOnlyNew={selectOnlyNew}
                selectedCount={selectedCount}
                updateCount={updateCount}
                newCount={newCount}
                changedCount={changedCount}
                onImport={handleImport}
                onBack={() => setImportStep("upload")}
                isLoading={isLoading}
                PriceChange={PriceChange}
              />
            )}
          </TabsContent>

          {/* Export */}
          <TabsContent value="export" className="p-4">
            <div className="bg-muted/50 p-6 rounded-lg text-center">
              <Download className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Exporter le catalogue</h3>
              <Button onClick={handleExport} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Exporter en Excel
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Table de prévisualisation
interface PreviewTableProps {
  products: ParsedProduct[];
  categories: Category[];
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  defaultFournisseur: string;
  setDefaultFournisseur: (v: string) => void;
  toggleProductSelection: (id: string) => void;
  toggleAllProducts: (selected: boolean) => void;
  selectOnlyChanged: () => void;
  selectOnlyNew: () => void;
  selectedCount: number;
  updateCount: number;
  newCount: number;
  changedCount: number;
  onImport: () => void;
  onBack: () => void;
  isLoading: boolean;
  PriceChange: React.FC<{ oldPrice?: number; newPrice?: number }>;
}

const PreviewTable = ({
  products,
  categories,
  selectedCategory,
  setSelectedCategory,
  defaultFournisseur,
  setDefaultFournisseur,
  toggleProductSelection,
  toggleAllProducts,
  selectOnlyChanged,
  selectOnlyNew,
  selectedCount,
  updateCount,
  newCount,
  changedCount,
  onImport,
  onBack,
  isLoading,
  PriceChange,
}: PreviewTableProps) => (
  <div className="flex flex-col h-full max-h-[60vh]">
    <div className="p-4 border-b space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Retour
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{products.length} détectés</Badge>
          <Badge>{selectedCount} sélectionnés</Badge>
          {changedCount > 0 && <Badge className="bg-orange-100 text-orange-800">{changedCount} modifiés</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Catégorie (nouveaux)</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Fournisseur par défaut</Label>
          <Input value={defaultFournisseur} onChange={(e) => setDefaultFournisseur(e.target.value)} />
        </div>

        <div className="flex items-end gap-2 col-span-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => toggleAllProducts(true)}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Tout
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleAllProducts(false)}>
            Aucun
          </Button>
          {changedCount > 0 && (
            <Button variant="outline" size="sm" onClick={selectOnlyChanged} className="text-orange-600">
              <RefreshCw className="w-4 h-4 mr-1" />
              Modifiés ({changedCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={selectOnlyNew} className="text-green-600">
            <Plus className="w-4 h-4 mr-1" />
            Nouveaux
          </Button>
        </div>
      </div>
    </div>

    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedCount === products.length && products.length > 0}
                onCheckedChange={(c) => toggleAllProducts(!!c)}
              />
            </TableHead>
            <TableHead className="w-20">Statut</TableHead>
            <TableHead>Référence</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead className="text-right">Prix achat</TableHead>
            <TableHead className="text-right">Prix vente</TableHead>
            <TableHead className="text-center">Poids</TableHead>
            <TableHead className="text-center">Dimensions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.id}
              className={`
                ${!product.selected ? "opacity-40" : ""} 
                ${product.priceChanged ? "bg-orange-50 dark:bg-orange-950/20" : ""}
                ${product.isUpdate && !product.priceChanged ? "bg-gray-50 dark:bg-gray-900/20" : ""}
                ${!product.isUpdate ? "bg-green-50 dark:bg-green-950/20" : ""}
              `}
            >
              <TableCell>
                <Checkbox checked={product.selected} onCheckedChange={() => toggleProductSelection(product.id)} />
              </TableCell>
              <TableCell>
                {product.isUpdate ? (
                  product.priceChanged ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      MAJ
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500 text-xs">
                      <Minus className="w-3 h-3 mr-1" />=
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Nouveau
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{product.reference || "-"}</TableCell>
              <TableCell className="max-w-[200px] truncate">{product.nom}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-1">
                  {product.isUpdate && product.oldPrixReference !== undefined && (
                    <span className="text-xs text-muted-foreground line-through">
                      {product.oldPrixReference.toFixed(2)}€
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <span>{product.prix_reference ? `${product.prix_reference.toFixed(2)}€` : "-"}</span>
                    {product.isUpdate && (
                      <PriceChange oldPrice={product.oldPrixReference} newPrice={product.prix_reference} />
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-1">
                  {product.isUpdate && product.oldPrixVenteTtc !== undefined && (
                    <span className="text-xs text-muted-foreground line-through">
                      {product.oldPrixVenteTtc.toFixed(2)}€
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <span>{product.prix_vente_ttc ? `${product.prix_vente_ttc.toFixed(2)}€` : "-"}</span>
                    {product.isUpdate && (
                      <PriceChange oldPrice={product.oldPrixVenteTtc} newPrice={product.prix_vente_ttc} />
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {product.poids_kg ? `${product.poids_kg} kg` : "-"}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">{product.dimensions || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <div className="p-4 border-t flex justify-between items-center">
      <div className="text-sm text-muted-foreground">
        {updateCount > 0 && <span className="text-orange-600 mr-3">{updateCount} mise(s) à jour</span>}
        {newCount > 0 && <span className="text-green-600">{newCount} nouveau(x)</span>}
      </div>
      <Button onClick={onImport} disabled={isLoading || selectedCount === 0}>
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : updateCount > 0 && newCount === 0 ? (
          <RefreshCw className="w-4 h-4 mr-2" />
        ) : (
          <ArrowRight className="w-4 h-4 mr-2" />
        )}
        {updateCount > 0 && newCount > 0
          ? `Importer ${newCount} + MAJ ${updateCount}`
          : updateCount > 0
            ? `Mettre à jour ${updateCount}`
            : `Importer ${newCount}`}
      </Button>
    </div>
  </div>
);

export default AccessoryImportExportDialog;
