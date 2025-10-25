import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface AccessoryRow {
  id: string;
  nom: string;
  categorie: string;
  prix_reference: string;
  prix_vente_ttc: string;
  marge_pourcent: string;
  fournisseur: string;
  description: string;
  url_produit: string;
  type_electrique: string;
  poids_kg: string;
  longueur_mm: string;
  largeur_mm: string;
  hauteur_mm: string;
}

interface AccessoryImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Array<{ id: string; nom: string }>;
}

const AccessoryImportExportDialog = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  categories 
}: AccessoryImportExportDialogProps) => {
  const [pastedData, setPastedData] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [tableRows, setTableRows] = useState<AccessoryRow[]>([
    { id: "1", nom: "", categorie: "", prix_reference: "", prix_vente_ttc: "", marge_pourcent: "", fournisseur: "", description: "", url_produit: "", type_electrique: "", poids_kg: "", longueur_mm: "", largeur_mm: "", hauteur_mm: "" }
  ]);

  const addTableRow = () => {
    setTableRows([...tableRows, {
      id: Date.now().toString(),
      nom: "",
      categorie: "",
      prix_reference: "",
      prix_vente_ttc: "",
      marge_pourcent: "",
      fournisseur: "",
      description: "",
      url_produit: "",
      type_electrique: "",
      poids_kg: "",
      longueur_mm: "",
      largeur_mm: "",
      hauteur_mm: ""
    }]);
  };

  const removeTableRow = (id: string) => {
    if (tableRows.length > 1) {
      setTableRows(tableRows.filter(row => row.id !== id));
    }
  };

  const updateTableRow = (id: string, field: keyof AccessoryRow, value: string) => {
    setTableRows(tableRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handleTableImport = async () => {
    setIsProcessing(true);
    
    const dataToImport = tableRows.filter(row => row.nom.trim() !== "").map(row => ({
      Nom: row.nom,
      Catégorie: row.categorie,
      "Prix référence": row.prix_reference,
      "Prix vente TTC": row.prix_vente_ttc,
      "Marge %": row.marge_pourcent,
      Fournisseur: row.fournisseur,
      Description: row.description,
      "URL produit": row.url_produit,
      "Type électrique": row.type_electrique,
      "Poids (kg)": row.poids_kg,
      "Longueur (mm)": row.longueur_mm,
      "Largeur (mm)": row.largeur_mm,
      "Hauteur (mm)": row.hauteur_mm,
    }));

    if (dataToImport.length === 0) {
      toast.error("Aucune donnée à importer");
      setIsProcessing(false);
      return;
    }

    await processImportData(dataToImport);
  };

  const handleExport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data, error } = await supabase
        .from("accessories_catalog")
        .select(`
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
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      // Préparer les données pour l'export
      const exportData = data.map((item: any) => ({
        "Nom": item.nom,
        "Catégorie": item.categories?.nom || "",
        "Prix référence": item.prix_reference || "",
        "Prix vente TTC": item.prix_vente_ttc || "",
        "Marge %": item.marge_pourcent || "",
        "Fournisseur": item.fournisseur || "",
        "Description": item.description || "",
        "URL produit": item.url_produit || "",
        "Type électrique": item.type_electrique || "",
        "Poids (kg)": item.poids_kg || "",
        "Longueur (mm)": item.longueur_mm || "",
        "Largeur (mm)": item.largeur_mm || "",
        "Hauteur (mm)": item.hauteur_mm || "",
      }));

      // Créer le CSV
      const csv = Papa.unparse(exportData);
      
      // Télécharger le fichier
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `accessoires_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Export réussi");
    } catch (error) {
      console.error("Erreur lors de l'export:", error);
      toast.error("Erreur lors de l'export");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const data = e.target?.result;
        let parsedData: any[] = [];

        // Parser selon le type de fichier
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(data as string, { header: true, skipEmptyLines: true });
          parsedData = result.data;
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          parsedData = XLSX.utils.sheet_to_json(firstSheet);
        }

        await processImportData(parsedData);
      };

      if (file.name.endsWith('.csv')) {
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

  const handlePasteImport = async () => {
    if (!pastedData.trim()) {
      toast.error("Aucune donnée à importer");
      return;
    }

    setIsProcessing(true);

    try {
      // Parser les données collées (format CSV ou TSV)
      const result = Papa.parse(pastedData, { 
        header: true, 
        skipEmptyLines: true,
        delimiter: pastedData.includes('\t') ? '\t' : ','
      });
      
      await processImportData(result.data);
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      toast.error("Erreur lors du traitement des données");
      setIsProcessing(false);
    }
  };

  const processImportData = async (data: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of data) {
        try {
          // Mapper les colonnes (supporter différents formats de colonnes)
          const nom = row["Nom"] || row["nom"] || row["Name"] || "";
          const categoryName = row["Catégorie"] || row["categorie"] || row["Category"] || "";
          const prixReference = parseFloat(row["Prix référence"] || row["Prix reference"] || row["prix_reference"] || "0") || null;
          const prixVenteTTC = parseFloat(row["Prix vente TTC"] || row["prix_vente_ttc"] || "0") || null;
          const margePourcent = parseFloat(row["Marge %"] || row["Marge"] || row["marge_pourcent"] || "0") || null;
          const fournisseur = row["Fournisseur"] || row["fournisseur"] || row["Supplier"] || null;
          const description = row["Description"] || row["description"] || null;
          const urlProduit = row["URL produit"] || row["url_produit"] || row["URL"] || null;
          const typeElectrique = row["Type électrique"] || row["type_electrique"] || row["Type"] || null;
          const poidsKg = parseFloat(row["Poids (kg)"] || row["Poids"] || row["poids_kg"] || "0") || null;
          const longueurMm = parseInt(row["Longueur (mm)"] || row["Longueur"] || row["longueur_mm"] || "0") || null;
          const largeurMm = parseInt(row["Largeur (mm)"] || row["Largeur"] || row["largeur_mm"] || "0") || null;
          const hauteurMm = parseInt(row["Hauteur (mm)"] || row["Hauteur"] || row["hauteur_mm"] || "0") || null;

          if (!nom) {
            errorCount++;
            continue;
          }

          // Trouver la catégorie correspondante
          let categoryId = null;
          if (categoryName) {
            const category = categories.find(cat => 
              cat.nom.toLowerCase() === categoryName.toLowerCase()
            );
            categoryId = category?.id || null;
          }

          // Insérer l'accessoire
          const { error } = await supabase
            .from("accessories_catalog")
            .insert({
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

          if (error) {
            console.error("Erreur pour:", nom, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error("Erreur lors du traitement de la ligne:", error);
          errorCount++;
        }
      }

      setIsProcessing(false);
      
      if (successCount > 0) {
        toast.success(`${successCount} accessoire(s) importé(s) avec succès${errorCount > 0 ? ` (${errorCount} erreur(s))` : ""}`);
        onSuccess();
        setPastedData("");
      } else {
        toast.error(`Échec de l'import (${errorCount} erreur(s))`);
      }
    } catch (error) {
      console.error("Erreur lors de l'import:", error);
      toast.error("Erreur lors de l'import");
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-auto max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import/Export d'accessoires en masse</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="export">Exporter</TabsTrigger>
            <TabsTrigger value="table">Saisie tableau</TabsTrigger>
            <TabsTrigger value="upload">Importer fichier</TabsTrigger>
            <TabsTrigger value="paste">Copier-coller</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Téléchargez tous vos accessoires au format CSV. Compatible avec Excel, Google Sheets et Numbers.
              </p>
              <Button onClick={handleExport} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Télécharger le catalogue (CSV)
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Remplissez le tableau ci-dessous pour ajouter plusieurs accessoires.
              </p>
              <div className="border rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-xs">Nom *</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Catégorie</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Prix réf.</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Prix TTC</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Marge %</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Fournisseur</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Description</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">URL</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Type élec.</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">Poids (kg)</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">L (mm)</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">l (mm)</th>
                      <th className="px-2 py-2 text-left font-medium text-xs">H (mm)</th>
                      <th className="px-2 py-2 text-center font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-2 py-1">
                          <Input
                            value={row.nom}
                            onChange={(e) => updateTableRow(row.id, "nom", e.target.value)}
                            placeholder="Nom"
                            className="h-8 text-xs min-w-[120px]"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.categorie}
                            onChange={(e) => updateTableRow(row.id, "categorie", e.target.value)}
                            placeholder="Catégorie"
                            className="h-8 text-xs min-w-[100px]"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.prix_reference}
                            onChange={(e) => updateTableRow(row.id, "prix_reference", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs w-20"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.prix_vente_ttc}
                            onChange={(e) => updateTableRow(row.id, "prix_vente_ttc", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs w-20"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.marge_pourcent}
                            onChange={(e) => updateTableRow(row.id, "marge_pourcent", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs w-16"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.fournisseur}
                            onChange={(e) => updateTableRow(row.id, "fournisseur", e.target.value)}
                            placeholder="Fournisseur"
                            className="h-8 text-xs min-w-[100px]"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.description}
                            onChange={(e) => updateTableRow(row.id, "description", e.target.value)}
                            placeholder="Description"
                            className="h-8 text-xs min-w-[120px]"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.url_produit}
                            onChange={(e) => updateTableRow(row.id, "url_produit", e.target.value)}
                            placeholder="https://..."
                            className="h-8 text-xs min-w-[100px]"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={row.type_electrique}
                            onChange={(e) => updateTableRow(row.id, "type_electrique", e.target.value)}
                            className="h-8 text-xs rounded-md border border-input bg-background px-2 w-28"
                          >
                            <option value="">-</option>
                            <option value="consommateur">Conso.</option>
                            <option value="producteur">Prod.</option>
                            <option value="autre">Autre</option>
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.poids_kg}
                            onChange={(e) => updateTableRow(row.id, "poids_kg", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs w-16"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            value={row.longueur_mm}
                            onChange={(e) => updateTableRow(row.id, "longueur_mm", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs w-16"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            value={row.largeur_mm}
                            onChange={(e) => updateTableRow(row.id, "largeur_mm", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs w-16"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            value={row.hauteur_mm}
                            onChange={(e) => updateTableRow(row.id, "hauteur_mm", e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs w-16"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTableRow(row.id)}
                            disabled={tableRows.length === 1}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={addTableRow}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une ligne
                </Button>
                <Button 
                  onClick={handleTableImport}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessing ? "Import en cours..." : "Importer le tableau"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Importez des accessoires depuis un fichier Excel (.xlsx, .xls) ou CSV (.csv).
              </p>
                <div className="space-y-2">
                  <Label>Format attendu des colonnes :</Label>
                  <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded max-h-[200px] overflow-y-auto">
                    <div>• <strong>Nom</strong> (obligatoire)</div>
                    <div>• <strong>Catégorie</strong> (nom de la catégorie)</div>
                    <div>• <strong>Prix référence</strong> (nombre)</div>
                    <div>• <strong>Prix vente TTC</strong> (nombre)</div>
                    <div>• <strong>Marge %</strong> (nombre)</div>
                    <div>• <strong>Fournisseur</strong></div>
                    <div>• <strong>Description</strong></div>
                    <div>• <strong>URL produit</strong></div>
                    <div>• <strong>Type électrique</strong> (consommateur, producteur, autre)</div>
                    <div>• <strong>Poids (kg)</strong> (nombre)</div>
                    <div>• <strong>Longueur (mm)</strong> (nombre)</div>
                    <div>• <strong>Largeur (mm)</strong> (nombre)</div>
                    <div>• <strong>Hauteur (mm)</strong> (nombre)</div>
                  </div>
                </div>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="file-upload">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full cursor-pointer"
                    disabled={isProcessing}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isProcessing ? "Import en cours..." : "Choisir un fichier"}
                  </Button>
                </label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copiez des lignes depuis Excel, Google Sheets ou Numbers et collez-les ici.
              </p>
              <div className="space-y-2">
                <Label>En-têtes de colonnes (copiez cette ligne dans votre tableur)</Label>
                <div className="bg-muted p-3 rounded">
                  <div className="font-mono text-xs select-all cursor-pointer hover:bg-muted-foreground/10 p-2 rounded">
                    Nom	Catégorie	Prix référence	Prix vente TTC	Marge %	Fournisseur	Description	URL produit
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cliquez sur la ligne ci-dessus pour la sélectionner, puis copiez-la (Ctrl+C) et collez-la comme première ligne de votre tableur
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paste-area">Collez vos données ici</Label>
                <Textarea
                  id="paste-area"
                  placeholder="1. Copiez les en-têtes ci-dessus et collez-les dans votre tableur (Excel/Sheets/Numbers)&#10;2. Remplissez vos données dans le tableur&#10;3. Sélectionnez tout (en-têtes + données) et copiez&#10;4. Collez ici"
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  className="min-h-[250px] font-mono text-xs"
                  disabled={isProcessing}
                />
              </div>
              <Button 
                onClick={handlePasteImport} 
                className="w-full"
                disabled={isProcessing || !pastedData.trim()}
              >
                <ClipboardPaste className="h-4 w-4 mr-2" />
                {isProcessing ? "Import en cours..." : "Importer les données"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AccessoryImportExportDialog;
