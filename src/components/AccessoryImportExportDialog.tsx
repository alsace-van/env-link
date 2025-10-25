import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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
          url_produit
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      // Préparer les données pour l'export
      const exportData = data.map(item => ({
        "Nom": item.nom,
        "Catégorie": item.categories?.nom || "",
        "Prix référence": item.prix_reference || "",
        "Prix vente TTC": item.prix_vente_ttc || "",
        "Marge %": item.marge_pourcent || "",
        "Fournisseur": item.fournisseur || "",
        "Description": item.description || "",
        "URL produit": item.url_produit || "",
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import/Export d'accessoires en masse</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">Exporter</TabsTrigger>
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

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Importez des accessoires depuis un fichier Excel (.xlsx, .xls) ou CSV (.csv).
              </p>
              <div className="space-y-2">
                <Label>Format attendu des colonnes :</Label>
                <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded">
                  <div>• <strong>Nom</strong> (obligatoire)</div>
                  <div>• <strong>Catégorie</strong> (nom de la catégorie)</div>
                  <div>• <strong>Prix référence</strong> (nombre)</div>
                  <div>• <strong>Prix vente TTC</strong> (nombre)</div>
                  <div>• <strong>Marge %</strong> (nombre)</div>
                  <div>• <strong>Fournisseur</strong></div>
                  <div>• <strong>Description</strong></div>
                  <div>• <strong>URL produit</strong></div>
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
