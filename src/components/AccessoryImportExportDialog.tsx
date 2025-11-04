import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, FileUp, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface AccessoryImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Array<{ id: string; nom: string }>;
}

interface ColumnMapping {
  [key: string]: string; // sourceColumn -> targetColumn
}

const EXPECTED_COLUMNS = {
  nom: { label: "Nom", required: true },
  categorie: { label: "Catégorie", required: false },
  sous_categorie: { label: "Sous-catégorie", required: false },
  prix_reference: { label: "Prix référence", required: false },
  prix_vente_ttc: { label: "Prix vente TTC", required: false },
  marge_pourcent: { label: "Marge %", required: false },
  fournisseur: { label: "Fournisseur", required: false },
  description: { label: "Description", required: false },
  url_produit: { label: "URL produit", required: false },
  type_electrique: { label: "Type électrique", required: false },
  poids_kg: { label: "Poids (kg)", required: false },
  longueur_mm: { label: "Longueur (mm)", required: false },
  largeur_mm: { label: "Largeur (mm)", required: false },
  hauteur_mm: { label: "Hauteur (mm)", required: false },
};

const AccessoryImportExportDialog = ({ isOpen, onClose, onSuccess, categories }: AccessoryImportExportDialogProps) => {
  const [pastedData, setPastedData] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // État pour le mapping de colonnes
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [pendingData, setPendingData] = useState<any[]>([]);

  const handleExport = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data, error } = await supabase
        .from("accessories_catalog")
        .select(
          `
          nom,
          categories (nom),
          prix_reference,
          prix_vente_ttc,
          marge_pourcent,
          fournisseur,
          description,
          url_produit,
          type_electrique,
          poids_kg,
          longueur_mm,
          largeur_mm,
          hauteur_mm
        `,
        )
        .eq("user_id", user.id);

      if (error) throw error;

      // Préparer les données pour l'export
      const exportData = data.map((item: any) => ({
        Nom: item.nom,
        Catégorie: item.categories?.nom || "",
        "Prix référence": item.prix_reference || "",
        "Prix vente TTC": item.prix_vente_ttc || "",
        "Marge %": item.marge_pourcent || "",
        Fournisseur: item.fournisseur || "",
        Description: item.description || "",
        "URL produit": item.url_produit || "",
        "Type électrique": item.type_electrique || "",
        "Poids (kg)": item.poids_kg || "",
        "Longueur (mm)": item.longueur_mm || "",
        "Largeur (mm)": item.largeur_mm || "",
        "Hauteur (mm)": item.hauteur_mm || "",
      }));

      // Créer le fichier Excel
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Accessoires");
      XLSX.writeFile(wb, `accessoires_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast.success("Export réussi");
    } catch (error) {
      console.error("Erreur lors de l'export:", error);
      toast.error("Erreur lors de l'export");
    }
  };

  const detectColumnMapping = (columns: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};

    columns.forEach((col) => {
      const normalized = col.toLowerCase().trim();

      // Essayer de trouver une correspondance automatique
      if (normalized === "nom" || normalized === "name" || normalized === "produit") {
        mapping[col] = "nom";
      } else if (normalized === "catégorie" || normalized === "categorie" || normalized === "category") {
        mapping[col] = "categorie";
      } else if (
        normalized.includes("sous") &&
        (normalized.includes("catégorie") || normalized.includes("categorie"))
      ) {
        mapping[col] = "sous_categorie";
      } else if (normalized.includes("prix") && (normalized.includes("ref") || normalized.includes("référence"))) {
        mapping[col] = "prix_reference";
      } else if (normalized.includes("prix") && (normalized.includes("vente") || normalized.includes("ttc"))) {
        mapping[col] = "prix_vente_ttc";
      } else if (normalized.includes("marge")) {
        mapping[col] = "marge_pourcent";
      } else if (normalized === "fournisseur" || normalized === "supplier") {
        mapping[col] = "fournisseur";
      } else if (normalized === "description") {
        mapping[col] = "description";
      } else if (normalized.includes("url")) {
        mapping[col] = "url_produit";
      } else if (normalized.includes("type") && normalized.includes("élect")) {
        mapping[col] = "type_electrique";
      } else if (normalized.includes("poids")) {
        mapping[col] = "poids_kg";
      } else if (normalized.includes("longueur")) {
        mapping[col] = "longueur_mm";
      } else if (normalized.includes("largeur")) {
        mapping[col] = "largeur_mm";
      } else if (normalized.includes("hauteur")) {
        mapping[col] = "hauteur_mm";
      }
    });

    return mapping;
  };

  const checkAndMapColumns = (data: any[]) => {
    if (data.length === 0) {
      toast.error("Aucune donnée détectée");
      setIsProcessing(false);
      return;
    }

    const columns = Object.keys(data[0]);
    const autoMapping = detectColumnMapping(columns);

    // Vérifier si toutes les colonnes obligatoires sont mappées
    const hasRequiredColumns = Object.entries(EXPECTED_COLUMNS)
      .filter(([_, config]) => config.required)
      .every(([key, _]) => Object.values(autoMapping).includes(key));

    // Si pas toutes les colonnes sont mappées, afficher le dialogue de mapping
    if (!hasRequiredColumns || Object.keys(autoMapping).length < columns.length) {
      setDetectedColumns(columns);
      setColumnMapping(autoMapping);
      setPendingData(data);
      setShowMappingDialog(true);
      setIsProcessing(false);
    } else {
      // Sinon, importer directement avec le mapping auto
      processImportWithMapping(data, autoMapping);
    }
  };

  const handlePasteImport = async () => {
    if (!pastedData.trim()) {
      toast.error("Aucune donnée à importer");
      return;
    }

    setIsProcessing(true);

    try {
      // Parser les données collées (TSV d'Excel)
      const result = Papa.parse(pastedData, {
        header: true,
        skipEmptyLines: true,
        delimiter: pastedData.includes("\t") ? "\t" : ",",
      });

      checkAndMapColumns(result.data);
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      toast.error("Erreur lors du traitement des données");
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv|numbers)$/i)) {
      toast.error("Format de fichier non supporté. Utilisez .xlsx, .xls, .csv ou .numbers");
      return;
    }

    setIsProcessing(true);

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const data = e.target?.result;
        let parsedData: any[] = [];

        try {
          if (file.name.endsWith(".csv")) {
            const result = Papa.parse(data as string, { header: true, skipEmptyLines: true });
            parsedData = result.data;
          } else if (file.name.endsWith(".numbers")) {
            // Fichier Numbers - tenter de le lire avec XLSX
            try {
              const workbook = XLSX.read(data, { type: "binary" });
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              parsedData = XLSX.utils.sheet_to_json(firstSheet);

              if (parsedData.length === 0) {
                throw new Error("Impossible de lire le fichier Numbers");
              }
            } catch (numbersError) {
              console.error("Erreur lecture Numbers:", numbersError);
              toast.error(
                "Impossible de lire ce fichier Numbers. Veuillez l'exporter en .xlsx depuis Numbers (Fichier > Exporter > Excel)",
                { duration: 6000 },
              );
              setIsProcessing(false);
              return;
            }
          } else {
            // Fichier Excel
            const workbook = XLSX.read(data, { type: "binary" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            parsedData = XLSX.utils.sheet_to_json(firstSheet);
          }

          checkAndMapColumns(parsedData);
        } catch (parseError) {
          console.error("Erreur parsing:", parseError);
          toast.error("Erreur lors de la lecture du fichier. Vérifiez le format.");
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        toast.error("Erreur lors de la lecture du fichier");
        setIsProcessing(false);
      };

      if (file.name.endsWith(".csv")) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier:", error);
      toast.error("Erreur lors de la lecture du fichier");
      setIsProcessing(false);
    }
  };

  const processImportWithMapping = async (data: any[], mapping: ColumnMapping) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of data) {
        try {
          // Appliquer le mapping
          const mappedRow: any = {};
          Object.entries(mapping).forEach(([sourceCol, targetCol]) => {
            if (targetCol && targetCol !== "ignore") {
              mappedRow[targetCol] = row[sourceCol];
            }
          });

          const nom = mappedRow.nom || "";
          const categoryName = mappedRow.categorie || "";
          const subCategoryName = mappedRow.sous_categorie || "";
          const prixReference = parseFloat(mappedRow.prix_reference || "0") || null;
          const prixVenteTTC = parseFloat(mappedRow.prix_vente_ttc || "0") || null;
          const margePourcent = parseFloat(mappedRow.marge_pourcent || "0") || null;
          const fournisseur = mappedRow.fournisseur || null;
          const description = mappedRow.description || null;
          const urlProduit = mappedRow.url_produit || null;
          const typeElectrique = mappedRow.type_electrique || null;
          const poidsKg = parseFloat(mappedRow.poids_kg || "0") || null;
          const longueurMm = parseInt(mappedRow.longueur_mm || "0") || null;
          const largeurMm = parseInt(mappedRow.largeur_mm || "0") || null;
          const hauteurMm = parseInt(mappedRow.hauteur_mm || "0") || null;

          if (!nom) {
            errorCount++;
            continue;
          }

          // Gérer la catégorie avec création automatique
          let categoryId = null;

          if (categoryName) {
            const { data: existingCategory } = await supabase
              .from("categories")
              .select("id, nom")
              .eq("user_id", user.id)
              .eq("nom", categoryName)
              .is("parent_id", null)
              .maybeSingle();

            if (existingCategory) {
              categoryId = existingCategory.id;
            } else {
              const { data: newCategory } = await supabase
                .from("categories")
                .insert({
                  user_id: user.id,
                  nom: categoryName,
                  parent_id: null,
                })
                .select("id")
                .single();

              if (newCategory) {
                categoryId = newCategory.id;
              }
            }

            // Gérer la sous-catégorie
            if (subCategoryName && categoryId) {
              const { data: existingSubCategory } = await supabase
                .from("categories")
                .select("id")
                .eq("user_id", user.id)
                .eq("nom", subCategoryName)
                .eq("parent_id", categoryId)
                .maybeSingle();

              if (existingSubCategory) {
                categoryId = existingSubCategory.id;
              } else {
                const { data: newSubCategory } = await supabase
                  .from("categories")
                  .insert({
                    user_id: user.id,
                    nom: subCategoryName,
                    parent_id: categoryId,
                  })
                  .select("id")
                  .single();

                if (newSubCategory) {
                  categoryId = newSubCategory.id;
                }
              }
            }
          }

          // Insérer l'accessoire
          const { error: insertError } = await supabase.from("accessories_catalog").insert({
            user_id: user.id,
            nom,
            category_id: categoryId,
            prix_reference: prixReference,
            prix_vente_ttc: prixVenteTTC,
            marge_pourcent: margePourcent,
            fournisseur,
            description,
            url_produit: urlProduit,
            type_electrique: typeElectrique,
            poids_kg: poidsKg,
            longueur_mm: longueurMm,
            largeur_mm: largeurMm,
            hauteur_mm: hauteurMm,
          });

          if (insertError) {
            console.error("Erreur insertion:", insertError);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (rowError) {
          console.error("Erreur ligne:", rowError);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} accessoire(s) importé(s) avec succès`);
        onSuccess();
        onClose();
      }

      if (errorCount > 0) {
        toast.warning(`${errorCount} ligne(s) ignorée(s)`);
      }

      setPastedData("");
      setIsProcessing(false);
      setShowMappingDialog(false);
      setPendingData([]);
      setColumnMapping({});
      setDetectedColumns([]);
    } catch (error) {
      console.error("Erreur lors de l'import:", error);
      toast.error("Erreur lors de l'import");
      setIsProcessing(false);
    }
  };

  const handleConfirmMapping = () => {
    // Vérifier que la colonne "nom" est mappée
    const hasNomMapping = Object.values(columnMapping).includes("nom");

    if (!hasNomMapping) {
      toast.error("Vous devez mapper au moins la colonne 'Nom'");
      return;
    }

    setIsProcessing(true);
    processImportWithMapping(pendingData, columnMapping);
  };

  const handleCancelMapping = () => {
    setShowMappingDialog(false);
    setPendingData([]);
    setColumnMapping({});
    setDetectedColumns([]);
    setIsProcessing(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import / Export d'accessoires</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="paste">Copier-Coller</TabsTrigger>
              <TabsTrigger value="upload">Importer fichier</TabsTrigger>
              <TabsTrigger value="export">Exporter</TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">📋 Comment ça marche ?</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Créez votre tableau Excel avec les mêmes colonnes que ci-dessous</li>
                    <li>Remplissez vos données dans Excel</li>
                    <li>Sélectionnez tout (en-têtes + données) et copiez (Ctrl+C ou Cmd+C)</li>
                    <li>Cliquez dans le tableau ci-dessous et collez (Ctrl+V ou Cmd+V)</li>
                    <li>Vos données remplaceront le tableau vide</li>
                    <li>Cliquez sur "Importer"</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tableau d'import (structure à reproduire dans Excel)</Label>
                    {pastedData && (
                      <Button variant="ghost" size="sm" onClick={() => setPastedData("")}>
                        <X className="h-3 w-3 mr-1" />
                        Réinitialiser
                      </Button>
                    )}
                  </div>

                  <div
                    className="border rounded-lg overflow-auto max-h-[400px] bg-background"
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = e.clipboardData.getData("text");
                      setPastedData(text);

                      // Parse immédiatement pour afficher dans le tableau
                      const lines = text.split("\n").filter((line) => line.trim());
                      if (lines.length > 0) {
                        toast.success(`${lines.length} ligne(s) collée(s)`);
                      }
                    }}
                    tabIndex={0}
                  >
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-muted/80 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">Nom</th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Catégorie
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Sous-catégorie
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Prix référence
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Prix vente TTC
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Marge %
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Fournisseur
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Description
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            URL produit
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Type électrique
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Poids (kg)
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Longueur (mm)
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b border-r whitespace-nowrap">
                            Largeur (mm)
                          </th>
                          <th className="px-3 py-2 text-left font-medium border-b">Hauteur (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastedData ? (
                          pastedData
                            .split("\n")
                            .filter((line) => line.trim())
                            .map((line, rowIndex) => (
                              <tr key={rowIndex} className="border-b hover:bg-muted/50">
                                {line.split("\t").map((cell, cellIndex) => (
                                  <td key={cellIndex} className="px-3 py-2 border-r whitespace-nowrap">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))
                        ) : (
                          // Afficher des lignes vides pour montrer la structure
                          <>
                            <tr className="border-b">
                              <td className="px-3 py-2 border-r text-muted-foreground text-center" colSpan={14}>
                                Cliquez ici et collez vos données (Ctrl+V ou Cmd+V)
                              </td>
                            </tr>
                            <tr className="border-b hover:bg-muted/30">
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 text-muted-foreground/40">&nbsp;</td>
                            </tr>
                            <tr className="border-b hover:bg-muted/30">
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 text-muted-foreground/40">&nbsp;</td>
                            </tr>
                            <tr className="border-b hover:bg-muted/30">
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 border-r text-muted-foreground/40">&nbsp;</td>
                              <td className="px-3 py-2 text-muted-foreground/40">&nbsp;</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {pastedData && (
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>
                        {pastedData.split("\n").filter((line) => line.trim()).length} ligne(s) collée(s) (incluant
                        l'en-tête si présent)
                      </span>
                    </div>
                  )}
                </div>

                <Button onClick={handlePasteImport} className="w-full" disabled={isProcessing || !pastedData.trim()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessing ? "Import en cours..." : "Importer les données"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">📁 Formats acceptés</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Excel (.xlsx, .xls)</li>
                    <li>• CSV (.csv)</li>
                    <li>• Numbers (.numbers) - Exportez d'abord en .xlsx depuis Numbers pour de meilleurs résultats</li>
                  </ul>
                </div>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <FileUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Glissez-déposez votre fichier ici</p>
                  <p className="text-sm text-muted-foreground mb-4">ou</p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.numbers"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={isProcessing}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={isProcessing}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isProcessing ? "Import en cours..." : "Parcourir les fichiers"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Exportez tous vos accessoires dans un fichier Excel (.xlsx)
                  </p>
                </div>

                <Button onClick={handleExport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter vers Excel
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialogue de mapping de colonnes */}
      <Dialog open={showMappingDialog} onOpenChange={handleCancelMapping}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Correspondance des colonnes</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <p className="text-sm">
                ⚠️ Les colonnes de votre fichier ne correspondent pas exactement au format attendu. Veuillez indiquer à
                quoi correspond chaque colonne.
              </p>
            </div>

            <div className="space-y-3">
              {detectedColumns.map((col) => (
                <div key={col} className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{col}</p>
                    <p className="text-xs text-muted-foreground">Colonne détectée</p>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground" />

                  <Select
                    value={columnMapping[col] || "ignore"}
                    onValueChange={(value) => {
                      setColumnMapping((prev) => ({
                        ...prev,
                        [col]: value,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ignorer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">
                        <span className="text-muted-foreground italic">Ignorer cette colonne</span>
                      </SelectItem>
                      {Object.entries(EXPECTED_COLUMNS).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label} {config.required && <span className="text-red-500">*</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleCancelMapping} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button onClick={handleConfirmMapping} className="flex-1" disabled={isProcessing}>
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? "Import en cours..." : "Confirmer et importer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccessoryImportExportDialog;
